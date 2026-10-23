begin;

-- Associações de caixa, sem inserir títulos, notas ou pagamentos.
create table if not exists public.financial_dre_allocations (
  company_id text not null, id text not null,
  bank_transaction_id uuid not null references public.bank_transactions(id),
  event_id text not null, amount_cents bigint not null check(amount_cents > 0),
  status text not null check(status in ('active','reversed')),
  payload jsonb not null, updated_at timestamptz not null default now(),
  primary key(company_id,id)
);
create index if not exists dre_allocations_bank_active on public.financial_dre_allocations(company_id,bank_transaction_id) where status='active';
create index if not exists dre_allocations_event_active on public.financial_dre_allocations(company_id,event_id) where status='active';
alter table public.financial_dre_allocations enable row level security;
revoke all on public.financial_dre_allocations from public, anon, authenticated;
grant select on public.financial_dre_allocations to service_role;

create or replace function public.financial_sync_dre_allocations(p_company_id text,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_link jsonb; v_entry jsonb; v_imported jsonb; v_bank bank_transactions%rowtype;
  v_total bigint; v_old financial_dre_allocations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_company_id||':dre-allocations',0));
  if exists(select 1 from jsonb_array_elements(coalesce(p_snapshot->'cashAllocations','[]')) x group by x->>'id' having count(*)>1) then
    raise exception 'O snapshot contém associações repetidas';
  end if;
  for v_link in select value from jsonb_array_elements(coalesce(p_snapshot->'cashAllocations','[]')) loop
    select * into v_bank from bank_transactions where company_id=p_company_id
      and metadata->>'legacyId'=v_link->>'transactionId' for update;
    if not found then
      select value into v_imported from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]')) where value->>'legacyId'=v_link->>'transactionId';
      if v_imported is null then raise exception 'Movimento bancário não encontrado no extrato importado'; end if;
      insert into bank_transactions(company_id,booking_date,direction,amount,raw_description,metadata)
      values(p_company_id,(v_imported->>'date')::date,v_imported->>'direction',(v_imported->>'amount')::numeric,
        coalesce(v_imported->>'description',''),coalesce(v_imported->'metadata','{}')||jsonb_build_object('legacyId',v_link->>'transactionId'))
      on conflict do nothing;
      select * into v_bank from bank_transactions where company_id=p_company_id and metadata->>'legacyId'=v_link->>'transactionId' for update;
    end if;
    select value into v_imported from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]')) where value->>'legacyId'=v_link->>'transactionId';
    if v_imported is null or v_bank.amount<>(v_imported->>'amount')::numeric or v_bank.direction<>v_imported->>'direction' or v_bank.booking_date<>(v_imported->>'date')::date then
      raise exception 'O extrato e o razão divergem sobre o movimento bancário';
    end if;
    select value into v_entry from jsonb_array_elements(coalesce(p_snapshot->'cashEntries','[]'))
      where value->>'id'=v_link->>'eventId';
    select * into v_old from financial_dre_allocations where company_id=p_company_id and id=v_link->>'id';
    if found and (v_old.event_id<>v_link->>'eventId' or v_old.bank_transaction_id<>v_bank.id
       or v_old.amount_cents<>(v_link->>'amountCents')::bigint or (v_old.status='reversed' and v_link->>'status'='active')) then
      raise exception 'Associação existente é imutável; desfaça e crie outro vínculo';
    end if;
    if v_link->>'status'='active' then
      if v_bank.metadata->>'legacyId'='mt7l9lt5xrta' then raise exception 'Composição do aporte de R$ 7.160 ainda não confirmada'; end if;
      if v_entry is null or coalesce(v_entry->>'transactionId','')<>'' then raise exception 'Registro de caixa indisponível ou já vinculado'; end if;
      if v_bank.direction<>(case when v_entry->>'effect'='cash_in' then 'in' else 'out' end) then raise exception 'Direção do vínculo incompatível'; end if;
      if v_bank.status in ('ignored','reversed') then raise exception 'Movimento bancário indisponível'; end if;
      if exists(select 1 from reconciliation_links where company_id=p_company_id and bank_transaction_id=v_bank.id and status='active') then
        raise exception 'Movimento já associado a liquidações do razão; conclua os vínculos pela API financeira';
      end if;
    end if;
    if v_old.id is null or v_old.status<>v_link->>'status' then
      if exists(select 1 from accounting_periods where company_id=p_company_id and status='closed'
        and (v_bank.booking_date between starts_on and ends_on or nullif(v_entry->>'date','')::date between starts_on and ends_on)) then
        raise exception 'Período contábil fechado';
      end if;
    end if;
    insert into financial_dre_allocations(company_id,id,bank_transaction_id,event_id,amount_cents,status,payload)
    values(p_company_id,v_link->>'id',v_bank.id,v_link->>'eventId',(v_link->>'amountCents')::bigint,v_link->>'status',v_link)
    on conflict(company_id,id) do update set status=excluded.status,payload=excluded.payload,updated_at=now();
  end loop;
  -- O snapshot deve preservar toda associação anterior, inclusive estornos.
  if exists(select 1 from financial_dre_allocations a where a.company_id=p_company_id and not exists(
    select 1 from jsonb_array_elements(coalesce(p_snapshot->'cashAllocations','[]')) x where x->>'id'=a.id)) then
    raise exception 'Não é permitido apagar o histórico dos vínculos';
  end if;
  for v_entry in select value from jsonb_array_elements(coalesce(p_snapshot->'cashEntries','[]')) loop
    select coalesce(sum(amount_cents),0) into v_total from financial_dre_allocations where company_id=p_company_id and event_id=v_entry->>'id' and status='active';
    if v_total>(v_entry->>'amountCents')::bigint or (v_total>0 and coalesce(v_entry->>'transactionId','')<>'') then
      raise exception 'Vínculos excedem o saldo do registro de caixa';
    end if;
  end loop;
  if exists(select 1 from financial_dre_allocations a where a.company_id=p_company_id and a.status='active'
    and not exists(select 1 from jsonb_array_elements(coalesce(p_snapshot->'cashEntries','[]')) x where x->>'id'=a.event_id)) then
    raise exception 'Registro de caixa vinculado não pode ser excluído ou cancelado';
  end if;
  for v_bank in select b.* from bank_transactions b where b.company_id=p_company_id and (exists(
    select 1 from financial_dre_allocations a where a.company_id=p_company_id and a.bank_transaction_id=b.id)
    or exists(select 1 from reconciliation_links l where l.company_id=p_company_id and l.bank_transaction_id=b.id and l.status='active')) for update loop
    select coalesce(sum(amount_cents),0) into v_total from financial_dre_allocations where company_id=p_company_id and bank_transaction_id=v_bank.id and status='active';
    v_total:=v_total+coalesce((select sum(amount*100)::bigint from reconciliation_links where company_id=p_company_id and bank_transaction_id=v_bank.id and status='active'),0);
    if v_total>v_bank.amount*100 then raise exception 'Vínculos excedem o saldo bancário'; end if;
    update bank_transactions set status=case when v_total=amount*100 then 'reconciled' when v_total>0 then 'partial' else 'pending' end where id=v_bank.id;
  end loop;
  return jsonb_build_object('allocations',(select count(*) from financial_dre_allocations where company_id=p_company_id and status='active'));
end $$;
revoke all on function public.financial_sync_dre_allocations(text,jsonb) from public,anon,authenticated;
grant execute on function public.financial_sync_dre_allocations(text,jsonb) to service_role;

-- Inclui associações ao reprocessar a projeção compatível, na mesma transação.
do $$ begin
  if not exists(select 1 from pg_proc where oid='public.financial_sync_legacy_facts(text,text,jsonb,boolean)'::regprocedure
    and position('financial_sync_legacy_facts_before_allocations' in prosrc)>0) then
    drop function if exists public.financial_sync_legacy_facts_before_allocations(text,text,jsonb,boolean);
    alter function public.financial_sync_legacy_facts(text,text,jsonb,boolean) rename to financial_sync_legacy_facts_before_allocations;
  end if;
end $$;
create or replace function public.financial_sync_legacy_facts(p_company_id text,p_actor_id text,p_snapshot jsonb,p_sync_dre_snapshots boolean default true)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  v_result:=financial_sync_legacy_facts_before_allocations(p_company_id,p_actor_id,p_snapshot,p_sync_dre_snapshots);
  return v_result||financial_sync_dre_allocations(p_company_id,p_snapshot);
end $$;
revoke all on function public.financial_sync_legacy_facts_before_allocations(text,text,jsonb,boolean) from public,anon,authenticated,service_role;
revoke all on function public.financial_sync_legacy_facts(text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.financial_sync_legacy_facts(text,text,jsonb,boolean) to service_role;

-- Também protege chamadas nativas da RPC, que não passam pelo blob.
create or replace function public.financial_guard_source_reconciliation(p_company_id text,p_changes jsonb,p_partial boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_change jsonb; v_bank bank_transactions%rowtype;
begin
  for v_change in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
    if v_change->>'id'='mt7l9lt5xrta' then raise exception 'Composição do aporte de R$ 7.160 ainda não confirmada'; end if;
    select * into v_bank from bank_transactions where company_id=p_company_id and metadata->>'legacyId'=v_change->>'id' for update;
    if not found then continue; end if;
    if not p_partial and (exists(select 1 from financial_dre_allocations where company_id=p_company_id and bank_transaction_id=v_bank.id and status='active')
      or exists(select 1 from reconciliation_links l join settlements s on s.id=l.settlement_id
        where l.company_id=p_company_id and l.bank_transaction_id=v_bank.id and l.status='active' and coalesce(s.metadata->>'legacyId','')='')) then
      raise exception 'Movimento já gerido pelo DRE ou pela API financeira';
    end if;
    update bank_transactions set metadata=metadata||jsonb_build_object('sourceReconciliationStatus',v_change->>'status') where id=v_bank.id;
  end loop;
end $$;
revoke all on function public.financial_guard_source_reconciliation(text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.financial_guard_source_reconciliation(text,jsonb,boolean) to service_role;

create or replace function public.financial_guard_dre_bank_link()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_bank bank_transactions%rowtype; v_used numeric;
begin
  if new.status<>'active' then return new; end if;
  select * into v_bank from bank_transactions where id=new.bank_transaction_id and company_id=new.company_id for update;
  if not found then raise exception 'Movimento fora da empresa'; end if;
  if v_bank.metadata->>'legacyId'='mt7l9lt5xrta' then raise exception 'Composição do aporte de R$ 7.160 ainda não confirmada'; end if;
  if coalesce(v_bank.metadata->>'sourceReconciliationStatus',v_bank.metadata->>'legacyStatus','') in ('conciliado','parcial','ignorado')
    and exists(select 1 from settlements where id=new.settlement_id and coalesce(metadata->>'legacyId','')='') then
    raise exception 'O movimento já está reservado pela conciliação operacional';
  end if;
  select coalesce(sum(amount_cents),0)/100.0 into v_used from financial_dre_allocations where company_id=new.company_id and bank_transaction_id=v_bank.id and status='active';
  -- Não mistura liquidação nova com associação de pagamento já existente.
  if v_used>0 then raise exception 'Movimento possui vínculos parciais geridos pelo DRE'; end if;
  return new;
end $$;
drop trigger if exists financial_guard_dre_bank_link on public.reconciliation_links;
create trigger financial_guard_dre_bank_link before insert or update on public.reconciliation_links for each row execute function public.financial_guard_dre_bank_link();

notify pgrst,'reload schema';
commit;
