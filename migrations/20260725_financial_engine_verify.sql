-- ARCD Financial Engine v1 — verificação pós-migração (somente leitura)
-- Execute no Supabase SQL Editor DEPOIS de 20260725_financial_engine.sql.
-- Não cria, altera ou apaga dados. O resultado precisa estar integralmente OK
-- antes de habilitar FINANCIAL_ENGINE_ENFORCE=true na Vercel.

with required_objects(name) as (
  values
    ('financial_titles'), ('bank_transactions'), ('settlements'),
    ('reconciliation_links'), ('financial_events'), ('audit_events'),
    ('idempotency_records'), ('accounting_periods'), ('legacy_record_links')
), schema_check as (
  select name, to_regclass('public.' || name) is not null as ok
  from required_objects
), function_check as (
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='financial_execute_command'
  ) as ok
), integrity_check as (
  select
    not exists (
      select 1 from settlements s
      left join financial_titles t on t.id=s.title_id
      where t.id is null
    ) as settlements_have_titles,
    not exists (
      select 1 from reconciliation_links l
      left join settlements s on s.id=l.settlement_id
      where s.id is null
    ) as links_have_settlements,
    not exists (
      select 1 from financial_titles t
      where t.status='settled' and t.original_amount > coalesce((
        select sum(s.amount) from settlements s where s.title_id=t.id and s.status='active'
      ),0) + .01
    ) as settled_titles_are_fully_paid
)
select 'schema:' || name as check_name, ok, case when ok then 'OK' else 'EXECUTE A MIGRAÇÃO BASE' end as guidance
from schema_check
union all
select 'function:financial_execute_command', ok, case when ok then 'OK' else 'FUNÇÃO AUSENTE — EXECUTE A MIGRAÇÃO BASE' end
from function_check
union all
select 'integrity:settlements_have_titles', settlements_have_titles, case when settlements_have_titles then 'OK' else 'HÁ LIQUIDAÇÃO ÓRFÃ' end from integrity_check
union all
select 'integrity:links_have_settlements', links_have_settlements, case when links_have_settlements then 'OK' else 'HÁ VÍNCULO DE CONCILIAÇÃO ÓRFÃO' end from integrity_check
union all
select 'integrity:settled_titles_are_fully_paid', settled_titles_are_fully_paid, case when settled_titles_are_fully_paid then 'OK' else 'HÁ TÍTULO QUITADO SEM LIQUIDAÇÃO SUFICIENTE' end from integrity_check
order by check_name;

-- Evidências para homologação em sombra. Registre estes números junto com a
-- mesma competência do legado; diferenças devem virar data_quality_cases.
select
  (select count(*) from financial_titles) as titles,
  (select count(*) from bank_transactions) as bank_transactions,
  (select count(*) from settlements where status='active') as active_settlements,
  (select coalesce(sum(amount),0) from settlements where status='active') as settled_amount,
  (select count(*) from data_quality_cases where status='open') as open_quality_cases,
  (select count(*) from legacy_record_links) as linked_legacy_records;
