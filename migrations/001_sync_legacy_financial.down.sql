-- Rollback estrutural. Os fatos sincronizados permanecem preservados para
-- auditoria; esta reversão remove somente a função, o histórico de execuções
-- e os índices específicos da carga.

begin;

revoke execute on function financial_sync_legacy_facts(text,text,jsonb) from service_role;
drop function if exists financial_sync_legacy_facts(text,text,jsonb);
drop index if exists idx_settlements_legacy_id;
drop index if exists idx_bank_transactions_legacy_id;
drop index if exists idx_financial_shadow_runs_company_created;
drop table if exists financial_shadow_runs;

commit;
