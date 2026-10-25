-- Pré-requisitos limitados à conciliação operacional e à leitura da DRE.
-- Copia os contratos de tabela do motor existente, sem carregar dados,
-- ativar enforcement, instalar a RPC de comandos nativos ou sincronizar legado.
-- Destino permitido: banco com marcador de homologação.
begin;
do $$ begin
  if not exists (select 1 from public.arcd_ambiente where id=true and ambiente='homologacao') then
    raise exception 'Banco de homologação não confirmado';
  end if;
end $$;

-- Fontes: migrations/20260725_financial_engine.sql e
-- migrations/20261023154632_dre_cash_allocations.up.sql.
create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(), company_id text not null, legal_name text not null, trade_name text,
  status text not null default 'active', created_at timestamptz not null default now(), created_by text not null
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(), company_id text not null, party_id uuid references parties(id), bank_code text,
  branch text, account_number text, pix_key text, active boolean not null default true, created_at timestamptz not null default now(),
  unique(company_id,bank_code,branch,account_number), unique(company_id,pix_key)
);

create table if not exists public.bank_import_batches (
  id uuid primary key default gen_random_uuid(), company_id text not null, account_id uuid references bank_accounts(id),
  source_file_name text not null, source_hash text not null, raw_content bytea, status text not null default 'active', created_at timestamptz not null default now(),
  unique(company_id,source_hash)
);

create table if not exists public.financial_titles (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  origin_type text not null, origin_id text not null, party_id text,
  obra_id text, contract_id text, direction text not null check(direction in ('payable','receivable')),
  competence date, due_date date, original_amount numeric(18,2) not null check(original_amount > 0),
  status text not null default 'open' check(status in ('open','partial','settled','cancelled','reversed')),
  version integer not null default 1, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by text not null,
  cancelled_at timestamptz, cancelled_by text,
  unique(company_id, origin_type, origin_id)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  account_id uuid references bank_accounts(id), import_batch_id uuid references bank_import_batches(id), fitid text, e2e_id text, txid text,
  booking_date date not null, direction text not null check(direction in ('in','out')),
  amount numeric(18,2) not null check(amount > 0), raw_description text not null default '',
  counterparty_id uuid, metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','partial','reconciled','ignored','reversed')),
  version integer not null default 1, archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, fitid), unique(company_id, e2e_id), unique(company_id, txid)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  title_id uuid not null references financial_titles(id), bank_transaction_id uuid references bank_transactions(id),
  amount numeric(18,2) not null check(amount > 0), settlement_date date not null,
  status text not null default 'active' check(status in ('active','reversed')),
  reversal_of uuid references settlements(id), created_at timestamptz not null default now(), created_by text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(), company_id text not null, event_type text not null,
  source_type text not null, source_id text not null, effective_date date not null,
  reversal_of uuid references financial_events(id), payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by text not null,
  unique(company_id,event_type,source_type,source_id)
);

create table if not exists public.reconciliation_links (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  bank_transaction_id uuid not null references bank_transactions(id), title_id uuid not null references financial_titles(id),
  settlement_id uuid not null references settlements(id), amount numeric(18,2) not null check(amount > 0),
  score numeric(5,2), confidence text, reasons jsonb not null default '[]'::jsonb,
  status text not null default 'active' check(status in ('active','reversed')),
  confirmed_at timestamptz not null default now(), confirmed_by text not null,
  unique(bank_transaction_id, settlement_id)
);

create table if not exists public.financial_dre_allocations (
  company_id text not null, id text not null,
  bank_transaction_id uuid not null references public.bank_transactions(id),
  event_id text not null, amount_cents bigint not null check(amount_cents > 0),
  status text not null check(status in ('active','reversed')),
  payload jsonb not null, updated_at timestamptz not null default now(),
  primary key(company_id,id)
);

alter table public.parties enable row level security;
revoke all on table public.parties from public, anon, authenticated, service_role;
grant select on table public.parties to service_role;
alter table public.bank_accounts enable row level security;
revoke all on table public.bank_accounts from public, anon, authenticated, service_role;
grant select on table public.bank_accounts to service_role;
alter table public.bank_import_batches enable row level security;
revoke all on table public.bank_import_batches from public, anon, authenticated, service_role;
grant select on table public.bank_import_batches to service_role;
alter table public.financial_titles enable row level security;
revoke all on table public.financial_titles from public, anon, authenticated, service_role;
grant select on table public.financial_titles to service_role;
alter table public.bank_transactions enable row level security;
revoke all on table public.bank_transactions from public, anon, authenticated, service_role;
grant select on table public.bank_transactions to service_role;
alter table public.settlements enable row level security;
revoke all on table public.settlements from public, anon, authenticated, service_role;
grant select on table public.settlements to service_role;
alter table public.financial_events enable row level security;
revoke all on table public.financial_events from public, anon, authenticated, service_role;
grant select on table public.financial_events to service_role;
alter table public.reconciliation_links enable row level security;
revoke all on table public.reconciliation_links from public, anon, authenticated, service_role;
grant select on table public.reconciliation_links to service_role;
alter table public.financial_dre_allocations enable row level security;
revoke all on table public.financial_dre_allocations from public, anon, authenticated, service_role;
grant select on table public.financial_dre_allocations to service_role;
-- A guarda invocadora só precisa atualizar a reserva do movimento.
-- A API de leitura da DRE materializa seus próprios snapshots.
grant update on table public.bank_transactions to service_role;
grant insert, update on table public.financial_events to service_role;

create or replace function public.financial_guard_source_reconciliation(p_company_id text,p_changes jsonb,p_partial boolean)
returns void language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
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
notify pgrst,'reload schema';
commit;
