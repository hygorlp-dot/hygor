-- FIN-9.6 · corrige os estados derivados após estorno de liquidação.
-- A função transacional base marca o título como "partial" de forma
-- incondicional e não recalcula o status da transação bancária após o
-- vínculo de conciliação ser revertido. Este wrapper mantém todos os gates
-- já existentes e reconcilia os estados finais dentro da mesma transação.

begin;

do $$
begin
  if to_regprocedure('public.financial_execute_command_unchecked(text,text,jsonb)') is null then
    raise exception 'financial_execute_command_unchecked ausente; aplique as migrations financeiras anteriores primeiro';
  end if;
end;
$$;

create or replace function public.financial_execute_command(
  p_company_id text,
  p_actor_id text,
  p_command jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := p_command->>'type';
  v_payload jsonb := coalesce(p_command->'payload','{}'::jsonb);
  v_effective_date date;
  v_title_direction text;
  v_bank_direction text;
  v_starts_on date;
  v_ends_on date;
  v_response jsonb;
  v_reversed_title_id uuid;
  v_reversed_bank_id uuid;
begin
  if v_type = 'CREATE_FINANCIAL_TITLE' then
    v_effective_date := coalesce(
      nullif(v_payload->>'competence','')::date,
      nullif(v_payload->>'dueDate','')::date,
      current_date
    );
  elsif v_type = 'REGISTER_SETTLEMENT' then
    v_effective_date := coalesce(nullif(v_payload->>'date','')::date,current_date);
  elsif v_type = 'REVERSE_SETTLEMENT' then
    select settlement_date,title_id,bank_transaction_id
      into v_effective_date,v_reversed_title_id,v_reversed_bank_id
      from public.settlements
     where id = (v_payload->>'settlementId')::uuid
       and company_id = p_company_id;
  elsif v_type = 'CLOSE_ACCOUNTING_PERIOD' then
    v_starts_on := (v_payload->>'startsOn')::date;
    v_ends_on := (v_payload->>'endsOn')::date;
    if v_starts_on is null or v_ends_on is null or v_ends_on < v_starts_on then
      raise exception 'Intervalo de fechamento inválido';
    end if;
    if exists(
      select 1
        from public.accounting_periods
       where company_id = p_company_id
         and status = 'closed'
         and daterange(starts_on,ends_on,'[]') && daterange(v_starts_on,v_ends_on,'[]')
    ) then
      raise exception 'O período solicitado já está total ou parcialmente fechado';
    end if;
  end if;

  if v_effective_date is not null and exists(
    select 1
      from public.accounting_periods
     where company_id = p_company_id
       and status = 'closed'
       and v_effective_date between starts_on and ends_on
  ) then
    raise exception 'Período contábil fechado';
  end if;

  if v_type = 'REGISTER_SETTLEMENT' and nullif(v_payload->>'bankTransactionId','') is not null then
    select direction into v_title_direction
      from public.financial_titles
     where company_id=p_company_id
       and id=(v_payload->>'titleId')::uuid
     for update;
    if not found then raise exception 'Título indisponível'; end if;

    select direction into v_bank_direction
      from public.bank_transactions
     where company_id=p_company_id
       and id=(v_payload->>'bankTransactionId')::uuid
     for update;
    if not found then raise exception 'Transação bancária indisponível'; end if;

    if v_bank_direction <> (case when v_title_direction='payable' then 'out' else 'in' end) then
      raise exception 'Direção bancária incompatível com o título';
    end if;
  end if;

  v_response := public.financial_execute_command_unchecked(
    p_company_id,p_actor_id,p_command
  );

  if v_type = 'REVERSE_SETTLEMENT'
     and v_reversed_title_id is not null
     and not coalesce((v_response->>'idempotent')::boolean,false) then
    update public.financial_titles title
       set status = case
         when title.status in ('cancelled','reversed') then title.status
         when coalesce((
           select sum(settlement.amount)
             from public.settlements settlement
            where settlement.title_id = title.id
              and settlement.status = 'active'
         ),0) <= 0 then 'open'
         when coalesce((
           select sum(settlement.amount)
             from public.settlements settlement
            where settlement.title_id = title.id
              and settlement.status = 'active'
         ),0) < title.original_amount then 'partial'
         else 'settled'
       end
     where title.company_id = p_company_id
       and title.id = v_reversed_title_id;

    if v_reversed_bank_id is not null then
      update public.bank_transactions bank
         set status = case
           when bank.status = 'ignored' then 'ignored'
           when coalesce((
             select sum(link.amount)
               from public.reconciliation_links link
              where link.bank_transaction_id = bank.id
                and link.status = 'active'
           ),0) <= 0 then 'pending'
           when coalesce((
             select sum(link.amount)
               from public.reconciliation_links link
              where link.bank_transaction_id = bank.id
                and link.status = 'active'
           ),0) < bank.amount then 'partial'
           else 'reconciled'
         end,
         version = bank.version + 1
       where bank.company_id = p_company_id
         and bank.id = v_reversed_bank_id;
    end if;
  end if;

  return v_response;
end;
$$;

revoke all on function public.financial_execute_command(text,text,jsonb) from public;
grant execute on function public.financial_execute_command(text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
