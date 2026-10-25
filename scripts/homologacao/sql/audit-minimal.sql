-- Auditoria mínima da API no banco isolado. Não altera dados existentes,
-- funções financeiras nem a RPC de gravação do blob.
begin;
do $$ begin
  if not exists (select 1 from public.arcd_ambiente where id=true and ambiente='homologacao') then
    raise exception 'Banco de homologação não confirmado';
  end if;
end $$;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  action text not null,
  actor_id text not null,
  actor_name text not null default '',
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  source text not null default 'api/data',
  created_at timestamptz not null default now()
);
create index if not exists audit_events_company_created_idx on public.audit_events(company_id,created_at desc);
create index if not exists audit_events_correlation_idx on public.audit_events(correlation_id);
alter table public.audit_events enable row level security;
revoke all on table public.audit_events from public, anon, authenticated, service_role;
grant select, insert on table public.audit_events to service_role;

create or replace function public.prevent_audit_event_mutation()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
  raise exception 'audit_events é append-only';
end;
$$;
revoke all on function public.prevent_audit_event_mutation() from public, anon, authenticated;
grant execute on function public.prevent_audit_event_mutation() to service_role;

do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid='public.audit_events'::regclass and tgname='audit_events_no_update') then
    create trigger audit_events_no_update before update on public.audit_events
      for each row execute function public.prevent_audit_event_mutation();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.audit_events'::regclass and tgname='audit_events_no_delete') then
    create trigger audit_events_no_delete before delete on public.audit_events
      for each row execute function public.prevent_audit_event_mutation();
  end if;
end $$;
notify pgrst,'reload schema';
commit;
