-- Limpa o contador depois de autenticação válida. A função é exclusiva da
-- service role para que um cliente anônimo não possa desbloquear a si mesmo.
create or replace function public.auth_rate_limit_success(
  p_company_id text,
  p_subject_hash text
)
returns void
language sql
security definer
set search_path=public
as $$
  delete from public.auth_rate_limits
  where company_id=p_company_id and subject_hash=p_subject_hash
$$;

revoke all on function public.auth_rate_limit_success(text,text)
  from public, anon, authenticated;
grant execute on function public.auth_rate_limit_success(text,text)
  to service_role;
