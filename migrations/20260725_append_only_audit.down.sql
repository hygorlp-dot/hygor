revoke all on function public.company_save_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb)
  from public,anon,authenticated,service_role;
drop function if exists public.company_save_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb);
drop trigger if exists audit_events_no_update on public.audit_events;
drop trigger if exists audit_events_no_delete on public.audit_events;
drop function if exists public.prevent_audit_event_mutation();
drop table if exists public.audit_events;
notify pgrst,'reload schema';
