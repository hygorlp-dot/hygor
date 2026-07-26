-- Fundação reversível dos domínios de produção. Não altera nem remove o blob legado.
create table if not exists public.operational_records (
  id text primary key,
  company_id text not null,
  obra_id text,
  domain text not null,
  entity_type text not null,
  status text not null default 'rascunho',
  version integer not null default 1 check (version > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  archived_at timestamptz,
  archived_by text,
  source text not null default 'app',
  external_id text
);
create index if not exists idx_operational_records_scope on public.operational_records(company_id, obra_id, domain, entity_type, status);
create index if not exists idx_operational_records_updated on public.operational_records(company_id, updated_at desc);

create table if not exists public.operational_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  obra_id text,
  domain text not null,
  entity_type text not null,
  entity_id text not null,
  actor_id text,
  actor_role text,
  action text not null,
  reason text,
  before_state jsonb,
  after_state jsonb,
  origin text not null default 'app',
  created_at timestamptz not null default now()
);
create index if not exists idx_operational_audit_entity on public.operational_audit_events(company_id, entity_id, created_at desc);

alter table public.operational_records enable row level security;
alter table public.operational_audit_events enable row level security;
-- A API autenticada usa service role; clientes não recebem política direta.
