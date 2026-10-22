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

-- Só cria a chave se a tabela ainda não tiver uma única equivalente (a
-- restrição do bootstrap já cobre as mesmas colunas). Sem esta checagem o
-- deploy recriava um índice duplicado a cada execução (migration 020).
do $$
begin
  if not exists (
    select 1
      from pg_index x
     where x.indrelid = 'public.financial_events'::regclass
       and x.indisunique
       and (select array_agg(a.attname::text order by k.ord)
              from unnest(x.indkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = x.indrelid and a.attnum = k.attnum)
           = array['company_id','event_type','source_type','source_id']
  ) then
    create unique index uq_financial_events_canonical_source
      on financial_events(company_id, event_type, source_type, source_id);
  end if;
end $$;

commit;
