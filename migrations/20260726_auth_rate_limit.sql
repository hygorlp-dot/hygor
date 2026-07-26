-- SEC-002: rate limiting compartilhado entre instâncias serverless.
create table if not exists public.auth_rate_limits (
  company_id text not null,
  subject_hash text not null,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (company_id, subject_hash)
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;

create or replace function public.auth_rate_limit_status(p_company_id text,p_subject_hash text)
returns table(blocked boolean,retry_after_seconds integer)
language sql security definer set search_path=public as $$
  select coalesce(blocked_until>now(),false),
    greatest(0,extract(epoch from (blocked_until-now))::integer)
  from auth_rate_limits where company_id=p_company_id and subject_hash=p_subject_hash
$$;

create or replace function public.auth_rate_limit_failure(p_company_id text,p_subject_hash text,p_limit integer default 8,p_window_seconds integer default 300)
returns table(blocked boolean,retry_after_seconds integer)
language plpgsql security definer set search_path=public as $$
declare r auth_rate_limits%rowtype; v_now timestamptz:=now();
begin
  insert into auth_rate_limits(company_id,subject_hash,attempts,window_started_at,updated_at)
  values(p_company_id,p_subject_hash,1,v_now,v_now)
  on conflict(company_id,subject_hash) do update set
    attempts=case when auth_rate_limits.window_started_at<v_now-make_interval(secs=>p_window_seconds) then 1 else auth_rate_limits.attempts+1 end,
    window_started_at=case when auth_rate_limits.window_started_at<v_now-make_interval(secs=>p_window_seconds) then v_now else auth_rate_limits.window_started_at end,
    blocked_until=case when (case when auth_rate_limits.window_started_at<v_now-make_interval(secs=>p_window_seconds) then 1 else auth_rate_limits.attempts+1 end)>=p_limit then v_now+make_interval(secs=>p_window_seconds) else auth_rate_limits.blocked_until end,
    updated_at=v_now returning * into r;
  return query select coalesce(r.blocked_until>v_now,false),greatest(0,extract(epoch from (r.blocked_until-v_now))::integer);
end $$;

-- Somente a API usa a service role. Nem clientes autenticados podem chamar
-- funções SECURITY DEFINER diretamente pelo PostgREST.
revoke all on function public.auth_rate_limit_status(text,text) from public, anon, authenticated;
revoke all on function public.auth_rate_limit_failure(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.auth_rate_limit_status(text,text) to service_role;
grant execute on function public.auth_rate_limit_failure(text,text,integer,integer) to service_role;
