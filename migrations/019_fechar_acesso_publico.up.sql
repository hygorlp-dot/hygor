-- 019: fecha o schema public para os papéis anon e authenticated.
--
-- Achado do Security Advisor do Supabase (20/10/2026):
-- - as tabelas criadas sem revoke explícito herdaram os privilégios padrão
--   do Supabase (anon/authenticated com todos os direitos). Entre elas
--   company_app_data (base inteira do ERP), audit_events e bank_transactions.
--   Com RLS sem política a leitura já era negada, mas company_app_data tinha
--   políticas para authenticated e kv_store tinha políticas "true" para
--   qualquer papel;
-- - 5 funções SECURITY DEFINER (company_save_with_audit, financial_*) podiam
--   ser chamadas por anon via /rest/v1/rpc, gravando por cima do RLS.
--
-- Nenhum consumidor usa esses papéis: o navegador fala só com /api, e a API
-- usa service_role (createClient com SUPABASE_SERVICE_ROLE_KEY) ou a conexão
-- postgres direta. Por isso o revoke não muda nenhum fluxo do sistema.
--
-- Idempotente: roda a cada deploy de produção (scripts/apply-acesso-publico.mjs)
-- depois das demais migrations, então também fecha o que elas recriarem.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Funções SECURITY DEFINER: só service_role executa (e o dono, postgres).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
  end loop;
end $$;

-- Objetos criados daqui em diante pelo postgres já nascem fechados.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Políticas abertas de tabelas sem consumidor. Sem grant elas já não valiam;
-- removê-las evita que um grant futuro reabra a tabela inteira.
do $$
begin
  if to_regclass('public.kv_store') is not null then
    drop policy if exists "Allow read kv_store" on public.kv_store;
    drop policy if exists "Allow insert kv_store" on public.kv_store;
    drop policy if exists "Allow update kv_store" on public.kv_store;
    drop policy if exists "Allow delete kv_store" on public.kv_store;
  end if;
  if to_regclass('public.company_app_data') is not null then
    drop policy if exists company_app_data_select_authenticated on public.company_app_data;
    drop policy if exists company_app_data_insert_authenticated on public.company_app_data;
    drop policy if exists company_app_data_update_authenticated on public.company_app_data;
    drop policy if exists company_app_data_delete_authenticated on public.company_app_data;
  end if;
  if to_regclass('public.app_data') is not null then
    drop policy if exists "Authenticated users can read app_data" on public.app_data;
    drop policy if exists "Authenticated users can insert app_data" on public.app_data;
    drop policy if exists "Authenticated users can update app_data" on public.app_data;
    drop policy if exists "Authenticated users can delete app_data" on public.app_data;
  end if;
end $$;

-- search_path fixo nas funções de trigger (Security Advisor 0011): impede que
-- um objeto homônimo em outro schema seja resolvido no lugar do de public.
-- As funções da ARP (ponto_arp_*, ponto_dispositivo_protegido) ficam de fora
-- de propósito: a ARP não é alterada fora de uma rodada própria do REP-P.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('prevent_audit_event_mutation','ponto_marcacao_imutavel','ponto_apropriacao_somente_pela_funcao')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.assinatura);
  end loop;
end $$;

notify pgrst, 'reload schema';
