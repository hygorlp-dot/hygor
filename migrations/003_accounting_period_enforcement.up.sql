-- Fechamento mensal imutável.
-- Mantém a implementação transacional original e acrescenta um portão
-- servidor antes de qualquer comando que possa alterar um período fechado.

begin;

do $$
begin
  if to_regprocedure('public.financial_execute_command_unchecked(text,text,jsonb)') is null then
    alter function public.financial_execute_command(text,text,jsonb)
      rename to financial_execute_command_unchecked;
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
  v_starts_on date;
  v_ends_on date;
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
    select settlement_date
      into v_effective_date
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

  return public.financial_execute_command_unchecked(p_company_id,p_actor_id,p_command);
end;
$$;

revoke all on function public.financial_execute_command(text,text,jsonb) from public;
grant execute on function public.financial_execute_command(text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
