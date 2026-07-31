-- Ponto: arquivamento/restauração atômicos. O principal, o arquivo e a
-- auditoria são alterados na mesma transação PostgreSQL.
create or replace function public.attendance_archive_transaction(
  p_company_id text,
  p_main_key text,
  p_archive_key text,
  p_expected_updated_at timestamptz,
  p_main_value jsonb,
  p_archive_value jsonb,
  p_actor_id text,
  p_actor_name text,
  p_actor_role text,
  p_correlation_id uuid,
  p_before jsonb,
  p_after jsonb
) returns table(updated_at timestamptz, applied boolean, reason text)
language plpgsql security definer set search_path=public as $$
declare
  v_main company_app_data%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if coalesce(p_actor_role,'') not in ('admin','rh') then
    raise exception 'forbidden_attendance_archive' using errcode='42501';
  end if;
  select * into v_main
    from company_app_data
    where company_id=p_company_id and key=p_main_key
    for update;
  if not found then
    return query select null::timestamptz,false,'main_not_found'::text; return;
  end if;
  if v_main.updated_at<>p_expected_updated_at then
    return query select v_main.updated_at,false,'concurrent_update'::text; return;
  end if;
  if exists(select 1 from company_app_data where company_id=p_company_id and key=p_archive_key) then
    return query select v_main.updated_at,false,'archive_exists'::text; return;
  end if;

  insert into company_app_data(company_id,key,value,updated_at,updated_by)
    values(p_company_id,p_archive_key,p_archive_value,v_now,null);
  update company_app_data
    set value=p_main_value,updated_at=v_now,updated_by=null
    where company_id=p_company_id and key=p_main_key;
  insert into audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values(
    p_company_id,'attendance_archive',p_archive_key,'attendance_archive',
    p_actor_id,p_actor_name,p_correlation_id,coalesce(p_before,'{}'::jsonb),
    coalesce(p_after,'{}'::jsonb),'api/data'
  );
  return query select v_now,true,''::text;
end $$;

create or replace function public.attendance_restore_transaction(
  p_company_id text,
  p_main_key text,
  p_archive_key text,
  p_expected_updated_at timestamptz,
  p_main_value jsonb,
  p_actor_id text,
  p_actor_name text,
  p_actor_role text,
  p_correlation_id uuid,
  p_before jsonb,
  p_after jsonb
) returns table(updated_at timestamptz, applied boolean, reason text)
language plpgsql security definer set search_path=public as $$
declare
  v_main company_app_data%rowtype;
  v_archive company_app_data%rowtype;
  v_now timestamptz:=clock_timestamp();
begin
  if coalesce(p_actor_role,'')<>'admin' then
    raise exception 'forbidden_attendance_restore' using errcode='42501';
  end if;
  select * into v_main
    from company_app_data
    where company_id=p_company_id and key=p_main_key
    for update;
  if not found then
    return query select null::timestamptz,false,'main_not_found'::text; return;
  end if;
  if v_main.updated_at<>p_expected_updated_at then
    return query select v_main.updated_at,false,'concurrent_update'::text; return;
  end if;
  select * into v_archive
    from company_app_data
    where company_id=p_company_id and key=p_archive_key
    for update;
  if not found then
    return query select v_main.updated_at,false,'archive_not_found'::text; return;
  end if;

  update company_app_data
    set value=p_main_value,updated_at=v_now,updated_by=null
    where company_id=p_company_id and key=p_main_key;
  delete from company_app_data
    where company_id=p_company_id and key=p_archive_key;
  insert into audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values(
    p_company_id,'attendance_archive',p_archive_key,'attendance_restore',
    p_actor_id,p_actor_name,p_correlation_id,coalesce(p_before,'{}'::jsonb),
    coalesce(p_after,'{}'::jsonb),'api/data'
  );
  return query select v_now,true,''::text;
end $$;

revoke all on function public.attendance_archive_transaction(text,text,text,timestamptz,jsonb,jsonb,text,text,text,uuid,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.attendance_archive_transaction(text,text,text,timestamptz,jsonb,jsonb,text,text,text,uuid,jsonb,jsonb)
  to service_role;
revoke all on function public.attendance_restore_transaction(text,text,text,timestamptz,jsonb,text,text,text,uuid,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.attendance_restore_transaction(text,text,text,timestamptz,jsonb,text,text,text,uuid,jsonb,jsonb)
  to service_role;
notify pgrst,'reload schema';
