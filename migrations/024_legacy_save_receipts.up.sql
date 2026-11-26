-- A confirmação pertence à mesma transação da gravação e do evento append-only.
create table if not exists public.legacy_save_receipts (
  company_id text not null,
  actor_id text not null,
  operation text not null check (operation in ('save', 'save-sections')),
  operation_id text not null,
  request_hash text not null,
  updated_at timestamptz not null,
  correlation_id uuid not null,
  primary key (company_id, actor_id, operation, operation_id)
);
alter table public.legacy_save_receipts enable row level security;
revoke all on public.legacy_save_receipts from public, anon, authenticated, service_role;
grant select on public.legacy_save_receipts to service_role;

create or replace function public.lock_legacy_save_receipt(
  p_company_id text, p_actor_id text, p_operation text, p_operation_id text
) returns setof public.legacy_save_receipts
language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array('legacy-save', p_company_id, p_actor_id, p_operation, p_operation_id)::text, 0));
  return query select r.* from public.legacy_save_receipts r
    where r.company_id = p_company_id and r.actor_id = p_actor_id
      and r.operation = p_operation and r.operation_id = p_operation_id;
end;
$$;
revoke all on function public.lock_legacy_save_receipt(text,text,text,text) from public, anon, authenticated;

create or replace function public.save_legacy_operation_with_audit(
  p_company_id text, p_key text, p_expected_updated_at timestamptz, p_value jsonb,
  p_actor_id text, p_actor_name text, p_correlation_id uuid, p_action text,
  p_before jsonb, p_after jsonb, p_operation text, p_operation_id text, p_request_hash text
) returns table(updated_at timestamptz, applied boolean, replayed boolean, correlation_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  receipt public.legacy_save_receipts%rowtype;
  saved record;
begin
  select * into receipt from public.lock_legacy_save_receipt(
    p_company_id, p_actor_id, p_operation, p_operation_id);
  if found then
    if receipt.request_hash is distinct from p_request_hash then
      raise exception 'Identidade de salvamento já utilizada com outro conteúdo.' using errcode = 'P0409';
    end if;
    return query select receipt.updated_at, true, true, receipt.correlation_id;
    return;
  end if;

  select * into saved from public.company_save_with_audit(
    p_company_id, p_key, p_expected_updated_at, p_value, p_actor_id, p_actor_name,
    p_correlation_id, p_action, p_before, p_after);
  if saved.applied then
    insert into public.legacy_save_receipts
      (company_id, actor_id, operation, operation_id, request_hash, updated_at, correlation_id)
      values (p_company_id, p_actor_id, p_operation, p_operation_id, p_request_hash, saved.updated_at, p_correlation_id);
  end if;
  return query select saved.updated_at, saved.applied, false, p_correlation_id;
end;
$$;
revoke all on function public.save_legacy_operation_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.save_legacy_operation_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,text,text,text) to service_role;
notify pgrst, 'reload schema';
