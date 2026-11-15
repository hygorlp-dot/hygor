-- Somente preparação local. Requer 005_client_portal_foundation.up.sql.
-- Todos os comandos são atômicos e não escrevem em tabelas financeiras.
grant select,insert,update,delete on public.client_portal_users,public.client_portal_project_memberships,
  public.client_portal_sessions,public.client_portal_publications,public.client_portal_audit_events to service_role;
create or replace function public.client_portal_manage(
  p_company_id text, p_project_id text, p_actor_id text,
  p_operation text, p_values jsonb default '{}'::jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid;
  v_now timestamptz := clock_timestamp();
  v_row jsonb;
begin
  if coalesce(p_company_id,'')='' or coalesce(p_project_id,'')='' or coalesce(p_actor_id,'')='' then
    raise exception 'Contexto administrativo ausente';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':portal:' || p_project_id,0));
  if p_operation = 'provision' then
    -- Serializa a mesma pessoa em obras diferentes antes de renovar sua senha.
    perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':portal-user:' || (p_values->>'email'),0));
    insert into public.client_portal_users(company_id,email,phone,password_hash,status)
      values(p_company_id,p_values->>'email',p_values->>'phone',p_values->>'password_hash','active')
      on conflict(company_id,email) do update set
        phone=excluded.phone,password_hash=excluded.password_hash,status='active',revoked_at=null,updated_at=v_now
      returning id into v_user_id;
    insert into public.client_portal_project_memberships(company_id,portal_user_id,project_id,profile,active)
      values(p_company_id,v_user_id,p_project_id,p_values->>'profile',true)
      on conflict(company_id,portal_user_id,project_id) do update set profile=excluded.profile,active=true,updated_at=v_now;
    update public.client_portal_sessions set revoked_at=v_now
      where company_id=p_company_id and portal_user_id=v_user_id and revoked_at is null;
  elsif p_operation = 'revoke' then
    update public.client_portal_project_memberships set active=false,updated_at=v_now
      where company_id=p_company_id and project_id=p_project_id and id=(p_values->>'membership_id')::uuid
      returning portal_user_id into v_user_id;
    if not found then raise exception 'Acesso não encontrado'; end if;
    update public.client_portal_sessions set revoked_at=v_now
      where company_id=p_company_id and portal_user_id=v_user_id and revoked_at is null;
  elsif p_operation = 'publish' then
    if jsonb_typeof(p_values->'rows') is distinct from 'array'
      or jsonb_array_length(p_values->'rows') not between 1 and 20000 then
      raise exception 'Publicação inválida';
    end if;
    if (select count(*) from jsonb_array_elements(p_values->'rows') r where r->>'domain'='project_summary') <> 1 then
      raise exception 'A publicação deve conter um resumo da obra';
    end if;
    update public.client_portal_publications set status='superseded',updated_at=v_now
      where company_id=p_company_id and project_id=p_project_id and status='published';
    for v_row in select * from jsonb_array_elements(p_values->'rows') loop
      if coalesce(v_row->>'domain','')='' or jsonb_typeof(v_row->'payload') is distinct from 'object' then
        raise exception 'Registro de publicação inválido';
      end if;
      insert into public.client_portal_publications(company_id,project_id,domain,status,visibility,payload,created_by,published_by,published_at)
        values(p_company_id,p_project_id,v_row->>'domain','published','project_users',v_row->'payload',p_actor_id,p_actor_id,v_now);
    end loop;
  elsif p_operation = 'suspend' then
    update public.client_portal_publications set status='archived',updated_at=v_now
      where company_id=p_company_id and project_id=p_project_id and status='published';
  else
    raise exception 'Operação de portal inválida';
  end if;
  insert into public.client_portal_audit_events(company_id,portal_user_id,project_id,event_type,metadata)
    values(p_company_id,v_user_id,p_project_id,
      case p_operation when 'provision' then 'access_provisioned' when 'revoke' then 'access_revoked' when 'publish' then 'project_published' else 'project_suspended' end,
      jsonb_build_object('actorId',p_actor_id));
end $$;
revoke all on function public.client_portal_manage(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.client_portal_manage(text,text,text,text,jsonb) to service_role;

create or replace function public.client_portal_change_password(
  p_company_id text,p_user_id uuid,p_expected_hash text,p_password_hash text
) returns boolean language plpgsql security invoker set search_path = public as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_password_hash not like 'scrypt-v1$%' then raise exception 'Senha inválida'; end if;
  update public.client_portal_users set password_hash=p_password_hash,updated_at=v_now
    where company_id=p_company_id and id=p_user_id and password_hash=p_expected_hash and status='active';
  if not found then return false; end if;
  update public.client_portal_sessions set revoked_at=v_now
    where company_id=p_company_id and portal_user_id=p_user_id and revoked_at is null;
  insert into public.client_portal_audit_events(company_id,portal_user_id,event_type)
    values(p_company_id,p_user_id,'password_changed');
  return true;
end $$;
revoke all on function public.client_portal_change_password(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.client_portal_change_password(text,uuid,text,text) to service_role;
