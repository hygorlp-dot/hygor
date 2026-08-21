-- Rollback estrutural: remove as versões com p_sync_dre_snapshots. Restaurar
-- o comportamento anterior exige reaplicar 001/002 (create or replace),
-- já que esta reversão apenas derruba o que este up criou.

begin;

revoke all on function financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb,boolean
) from service_role;
drop function if exists financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb,boolean
);

revoke all on function financial_sync_legacy_facts(text,text,jsonb,boolean) from service_role;
drop function if exists financial_sync_legacy_facts(text,text,jsonb,boolean);

commit;
