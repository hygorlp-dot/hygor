-- FIN-004 · garante a chave usada para materializar snapshots canônicos do DRE.
-- Instalações anteriores ao motor transacional podem possuir a tabela sem a
-- restrição declarada no bootstrap mais recente.

begin;

-- Projeções antigas duplicadas não representam lançamentos contábeis. Mantém a
-- versão mais recente de cada snapshot antes de instalar a chave de conflito.
delete from financial_events older
using financial_events newer
where older.company_id = newer.company_id
  and older.event_type = 'dre_snapshot'
  and older.source_type = 'dre_projection'
  and newer.event_type = older.event_type
  and newer.source_type = older.source_type
  and older.source_id = newer.source_id
  and (older.created_at, older.id) < (newer.created_at, newer.id)
  and not exists (
    select 1 from journal_entries entry where entry.event_id = older.id
  );

create unique index if not exists uq_financial_events_canonical_source
  on financial_events(company_id, event_type, source_type, source_id);

commit;
