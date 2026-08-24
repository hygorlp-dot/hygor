-- Rollback: restaura o privilégio padrão de schema (revoke a trava
-- explícita, desabilita RLS) - volta ao estado de antes desta migration,
-- que já era seguro na prática (só service_role acessa via db.from()),
-- só sem a trava ativa em nível de banco.
alter table public.financial_titles disable row level security;
alter table public.settlements disable row level security;
alter table public.financial_events disable row level security;
alter table public.reconciliation_links disable row level security;
alter table public.data_quality_cases disable row level security;
alter table public.financial_shadow_runs disable row level security;

revoke select on table public.financial_titles from service_role;
revoke select on table public.settlements from service_role;
revoke select on table public.financial_events from service_role;
revoke select on table public.reconciliation_links from service_role;
revoke select, insert, update on table public.data_quality_cases from service_role;
revoke select on table public.financial_shadow_runs from service_role;

notify pgrst,'reload schema';
