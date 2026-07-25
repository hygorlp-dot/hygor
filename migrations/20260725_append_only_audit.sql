-- DATA-001: trilha append-only para toda mutação crítica do blob legado.
-- Execute no Supabase SQL Editor antes de ativar AUDIT_APPEND_ONLY_ENFORCE.
create extension if not exists pgcrypto;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  aggregate_type text not null, aggregate_id text not null, action text not null,
  actor_id text not null, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_events add column if not exists actor_name text not null default '';
alter table public.audit_events add column if not exists correlation_id uuid;
alter table public.audit_events add column if not exists before_snapshot jsonb not null default '{}'::jsonb;
alter table public.audit_events add column if not exists after_snapshot jsonb not null default '{}'::jsonb;
alter table public.audit_events add column if not exists source text not null default 'api/data';
create index if not exists audit_events_company_created_idx on public.audit_events(company_id,created_at desc);
create index if not exists audit_events_correlation_idx on public.audit_events(correlation_id);
alter table public.audit_events enable row level security;

create or replace function public.prevent_audit_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_events é append-only'; end;
$$;
drop trigger if exists audit_events_no_update on public.audit_events;
drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_update before update on public.audit_events for each row execute function public.prevent_audit_event_mutation();
create trigger audit_events_no_delete before delete on public.audit_events for each row execute function public.prevent_audit_event_mutation();

-- A atualização do blob e o evento nascem na mesma transação.
create or replace function public.company_save_with_audit(
  p_company_id text,p_key text,p_expected_updated_at timestamptz,p_value jsonb,
  p_actor_id text,p_actor_name text,p_correlation_id uuid,p_action text,
  p_before jsonb,p_after jsonb
) returns table(updated_at timestamptz, applied boolean)
language plpgsql security definer set search_path=public as $$
declare v_current company_app_data%rowtype; v_now timestamptz:=now();
begin
  select * into v_current from company_app_data where company_id=p_company_id and key=p_key for update;
  if not found or v_current.updated_at<>p_expected_updated_at then
    return query select coalesce(v_current.updated_at,now()),false; return;
  end if;
  update company_app_data set value=p_value,updated_at=v_now,updated_by=null where company_id=p_company_id and key=p_key;
  insert into audit_events(company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,correlation_id,before_snapshot,after_snapshot,source)
    values(p_company_id,'company_app_data',p_key,p_action,p_actor_id,p_actor_name,p_correlation_id,coalesce(p_before,'{}'),coalesce(p_after,'{}'),'api/data');
  return query select v_now,true;
end $$;
revoke all on function public.company_save_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb) from public;
notify pgrst,'reload schema';
