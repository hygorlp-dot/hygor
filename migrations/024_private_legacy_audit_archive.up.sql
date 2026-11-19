-- Coordinated company cutover only; not an automatic build migration.
-- Expected source count/digest come from the verified integral backup.
begin;
set local lock_timeout='5s';
set local statement_timeout='300s';
create schema if not exists company_cutover_private;
revoke all on schema company_cutover_private from public,anon,authenticated,service_role;
do $archive$
declare source_table regclass; expected_rows bigint; expected_digest text; actual_rows bigint; actual_digest text;
begin
 expected_rows:=current_setting('marcell.audit_archive_rows',true)::bigint;
 expected_digest:=current_setting('marcell.audit_archive_md5',true);
 if expected_rows is null or expected_digest is null or expected_digest !~ '^[a-f0-9]{32}$' then raise exception 'Verified audit archive source proof required'; end if;
 source_table:=coalesce(to_regclass('company_cutover_private.legacy_audit_events'),to_regclass('public.audit_events'));
 if source_table is null then raise exception 'Audit source missing'; end if;
 execute format('lock table %s in access exclusive mode',source_table);
 execute format('select count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' order by md5(to_jsonb(t)::text)),'''')) from %s t',source_table) into actual_rows,actual_digest;
 if actual_rows<>expected_rows or actual_digest<>expected_digest then raise exception 'Audit archive differs from verified backup'; end if;
 if to_regclass('company_cutover_private.legacy_audit_events') is null then
  if exists(select 1 from pg_constraint where contype='f' and (conrelid=source_table or confrelid=source_table)) or exists(select 1 from pg_depend d join pg_rewrite r on r.oid=d.objid where d.refobjid=source_table) then raise exception 'Audit relation has unreviewed dependencies'; end if;
  if exists(select 1 from pg_policy where polrelid=source_table) then raise exception 'Audit policy requires review'; end if;
  if (select count(*) from pg_trigger where tgrelid=source_table and not tgisinternal)<>2 or exists(select 1 from pg_trigger where tgrelid=source_table and not tgisinternal and (tgname not in ('audit_events_no_update','audit_events_no_delete') or tgfoid<>'public.prevent_audit_event_mutation()'::regprocedure)) then raise exception 'Audit triggers require review'; end if;
  alter table public.audit_events set schema company_cutover_private;
  alter table company_cutover_private.audit_events rename to legacy_audit_events;
 end if;
end $archive$;
create table if not exists public.audit_events (like company_cutover_private.legacy_audit_events including all);
alter table public.audit_events owner to postgres;
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public,anon,authenticated,service_role;
grant select,insert on public.audit_events to service_role;
drop trigger if exists audit_events_no_update on public.audit_events;
drop trigger if exists audit_events_no_delete on public.audit_events;
create trigger audit_events_no_update before update on public.audit_events for each row execute function public.prevent_audit_event_mutation();
create trigger audit_events_no_delete before delete on public.audit_events for each row execute function public.prevent_audit_event_mutation();
alter table company_cutover_private.legacy_audit_events enable row level security;
revoke all on company_cutover_private.legacy_audit_events from public,anon,authenticated,service_role;
create or replace function company_cutover_private.prevent_legacy_audit_write() returns trigger language plpgsql set search_path=pg_catalog as $immutable$
begin raise exception 'Private legacy audit archive is immutable'; end $immutable$;
revoke all on function company_cutover_private.prevent_legacy_audit_write() from public,anon,authenticated,service_role;
drop trigger if exists legacy_audit_no_insert_or_truncate on company_cutover_private.legacy_audit_events;
create trigger legacy_audit_no_insert_or_truncate before insert or truncate on company_cutover_private.legacy_audit_events for each statement execute function company_cutover_private.prevent_legacy_audit_write();
notify pgrst,'reload schema';
commit;
