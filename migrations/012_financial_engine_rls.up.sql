-- Fecha a lacuna de segurança identificada na "Avaliação qualitativa do
-- código" (24/08/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): as
-- tabelas do motor financeiro (migrations/20260725_financial_engine.sql,
-- 001_sync_legacy_financial) nunca tiveram RLS habilitada nem revoke/grant
-- explícitos - dependiam inteiramente da ausência de política de acesso
-- para anon/authenticated (privilégio padrão de schema do Supabase, não
-- uma trava ativa). Aplica aqui o MESMO padrão já usado desde a migration
-- 007 (CORE-001): enable row level security + revoke all + grant só a
-- service_role.
--
-- Não muda NENHUM comportamento de leitura/escrita hoje - todo acesso via
-- Supabase JS já passa pelo cliente service_role (`db`, api/data.js),
-- nunca pelo token do usuário (ver "Correção na raiz: authDb isolado de
-- db" acima); e toda escrita do motor financeiro em si acontece pelas RPCs
-- financial_sync_legacy_facts/financial_save_with_sync via conexão
-- postgres() direta (POSTGRES_URL_NON_POOLING), que autentica como usuário
-- de banco, não via PostgREST/JWT - imune a GRANT/RLS por construção,
-- então nada muda para essas RPCs.
--
-- Escopo: só as 6 tabelas confirmadas sendo lidas/escritas via db.from()
-- em api/data.js hoje (relatorioSombraFinanceira/financial-shadow-sync,
-- listarTabelaFinanceira) - não é uma varredura de todas as ~26 tabelas
-- da migration financial_engine. As demais não têm nenhum consumidor via
-- Supabase JS client ainda; ficam para quando (se) ganharem um.
--
-- Privilégio mínimo: as 5 tabelas só lidas (nunca escritas via db.from(),
-- só via as RPCs de conexão direta) recebem só select. data_quality_cases
-- é a única também escrita via db.from() (financial-shadow-sync marca
-- casos como resolvidos e insere novas divergências) - recebe select,
-- insert, update.

alter table public.financial_titles enable row level security;
alter table public.settlements enable row level security;
alter table public.financial_events enable row level security;
alter table public.reconciliation_links enable row level security;
alter table public.data_quality_cases enable row level security;
alter table public.financial_shadow_runs enable row level security;

revoke all on table public.financial_titles from public, anon, authenticated;
revoke all on table public.settlements from public, anon, authenticated;
revoke all on table public.financial_events from public, anon, authenticated;
revoke all on table public.reconciliation_links from public, anon, authenticated;
revoke all on table public.data_quality_cases from public, anon, authenticated;
revoke all on table public.financial_shadow_runs from public, anon, authenticated;

grant select on table public.financial_titles to service_role;
grant select on table public.settlements to service_role;
grant select on table public.financial_events to service_role;
grant select on table public.reconciliation_links to service_role;
grant select, insert, update on table public.data_quality_cases to service_role;
grant select on table public.financial_shadow_runs to service_role;

notify pgrst,'reload schema';
