-- FIN-9.6 · fechamento mensal imutável também para fatos operacionais legados.
-- Reprocessar a MESMA fotografia continua permitido; qualquer inclusão,
-- remoção ou alteração que toque um período fechado é recusada antes de
-- financial_sync_legacy_facts modificar títulos, liquidações ou bancos.

begin;

create or replace function public.financial_date_is_closed(
  p_company_id text,
  p_date date
) returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_date is not null and exists(
    select 1
      from public.accounting_periods period
     where period.company_id=p_company_id
       and period.status='closed'
       and p_date between period.starts_on and period.ends_on
  )
$$;

revoke all on function public.financial_date_is_closed(text,date) from public,anon,authenticated;
grant execute on function public.financial_date_is_closed(text,date) to service_role;

create or replace function public.financial_guard_closed_legacy_snapshot(
  p_company_id text,
  p_snapshot jsonb
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_fact jsonb;
  v_payment jsonb;
  v_bank_json jsonb;
  v_link public.legacy_record_links%rowtype;
  v_title public.financial_titles%rowtype;
  v_bank public.bank_transactions%rowtype;
  v_new_hash text;
  v_new_date date;
  v_new_due date;
  v_new_bank_date date;
  v_changed boolean;
begin
  if not exists(
    select 1 from public.accounting_periods
     where company_id=p_company_id and status='closed'
  ) then
    return;
  end if;

  -- Inclusão ou alteração de um fato legado.
  for v_fact in
    select value from jsonb_array_elements(coalesce(p_snapshot->'facts','[]'::jsonb))
  loop
    v_new_hash:=md5(v_fact::text);
    v_new_date:=nullif(v_fact->>'date','')::date;
    v_new_due:=nullif(v_fact->>'dueDate','')::date;
    v_link:=null;
    v_title:=null;

    select link.* into v_link
      from public.legacy_record_links link
     where link.company_id=p_company_id
       and link.legacy_type=v_fact->>'legacyType'
       and link.legacy_id=v_fact->>'legacyId';

    if found and v_link.record_hash=v_new_hash then
      continue;
    end if;

    if v_link.id is not null and v_link.canonical_type='financial_title' then
      select title.* into v_title
        from public.financial_titles title
       where title.company_id=p_company_id
         and title.id=v_link.canonical_id;

      if v_title.id is not null and (
        public.financial_date_is_closed(p_company_id,v_title.competence)
        or public.financial_date_is_closed(p_company_id,v_title.due_date)
        or exists(
          select 1
            from public.settlements settlement
           where settlement.company_id=p_company_id
             and settlement.title_id=v_title.id
             and settlement.status='active'
             and public.financial_date_is_closed(p_company_id,settlement.settlement_date)
        )
      ) then
        raise exception 'Período contábil fechado: o fato %/% já pertence a competência encerrada',
          v_fact->>'legacyType',v_fact->>'legacyId';
      end if;
    end if;

    if public.financial_date_is_closed(p_company_id,v_new_date)
       or public.financial_date_is_closed(p_company_id,v_new_due) then
      raise exception 'Período contábil fechado: não é permitido incluir ou alterar o fato %/%',
        v_fact->>'legacyType',v_fact->>'legacyId';
    end if;

    for v_payment in
      select value from jsonb_array_elements(coalesce(v_fact->'settlements','[]'::jsonb))
    loop
      if public.financial_date_is_closed(
        p_company_id,nullif(v_payment->>'date','')::date
      ) then
        raise exception 'Período contábil fechado: liquidação legada %/% não pode ser alterada',
          v_fact->>'legacyType',v_fact->>'legacyId';
      end if;
    end loop;
  end loop;

  -- Remoção/cancelamento de um fato que existia na última fotografia.
  for v_title in
    select title.*
      from public.financial_titles title
      join public.legacy_record_links link
        on link.company_id=title.company_id
       and link.canonical_type='financial_title'
       and link.canonical_id=title.id
     where title.company_id=p_company_id
       and title.status not in ('cancelled','reversed')
       and not exists(
         select 1
           from jsonb_array_elements(coalesce(p_snapshot->'facts','[]'::jsonb)) incoming
          where incoming->>'legacyType'=link.legacy_type
            and incoming->>'legacyId'=link.legacy_id
       )
  loop
    if public.financial_date_is_closed(p_company_id,v_title.competence)
       or public.financial_date_is_closed(p_company_id,v_title.due_date)
       or exists(
         select 1
           from public.settlements settlement
          where settlement.company_id=p_company_id
            and settlement.title_id=v_title.id
            and settlement.status='active'
            and public.financial_date_is_closed(p_company_id,settlement.settlement_date)
       ) then
      raise exception 'Período contábil fechado: fato legado vinculado ao título % não pode ser removido',
        v_title.id;
    end if;
  end loop;

  -- Extrato bancário: inclusão/alteração dentro de período fechado.
  for v_bank_json in
    select value from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]'::jsonb))
  loop
    v_new_bank_date:=nullif(v_bank_json->>'date','')::date;
    v_bank:=null;

    select bank.* into v_bank
      from public.bank_transactions bank
     where bank.company_id=p_company_id
       and bank.metadata->>'legacyId'=v_bank_json->>'legacyId';

    if v_bank.id is null then
      if public.financial_date_is_closed(p_company_id,v_new_bank_date) then
        raise exception 'Período contábil fechado: movimento bancário % não pode ser incluído',
          v_bank_json->>'legacyId';
      end if;
      continue;
    end if;

    v_changed:=
      v_bank.booking_date is distinct from v_new_bank_date
      or v_bank.direction is distinct from (v_bank_json->>'direction')
      or v_bank.amount is distinct from (v_bank_json->>'amount')::numeric
      or coalesce(v_bank.raw_description,'') is distinct from coalesce(v_bank_json->>'description','');

    if v_changed and (
      public.financial_date_is_closed(p_company_id,v_bank.booking_date)
      or public.financial_date_is_closed(p_company_id,v_new_bank_date)
    ) then
      raise exception 'Período contábil fechado: movimento bancário % não pode ser alterado',
        v_bank_json->>'legacyId';
    end if;
  end loop;
end;
$$;

revoke all on function public.financial_guard_closed_legacy_snapshot(text,jsonb)
  from public,anon,authenticated;
grant execute on function public.financial_guard_closed_legacy_snapshot(text,jsonb)
  to service_role;

do $$
begin
  if to_regprocedure(
    'public.financial_sync_legacy_facts_before_closed_period_guard(text,text,jsonb,boolean)'
  ) is null then
    alter function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
      rename to financial_sync_legacy_facts_before_closed_period_guard;
  end if;
end;
$$;

create or replace function public.financial_sync_legacy_facts(
  p_company_id text,
  p_actor_id text,
  p_snapshot jsonb,
  p_sync_dre_snapshots boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  perform public.financial_guard_closed_legacy_snapshot(p_company_id,p_snapshot);
  v_result:=public.financial_sync_legacy_facts_before_closed_period_guard(
    p_company_id,p_actor_id,p_snapshot,p_sync_dre_snapshots
  );
  return v_result;
end;
$$;

revoke all on function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
  from public,anon,authenticated;
grant execute on function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
  to service_role;

notify pgrst,'reload schema';
commit;
