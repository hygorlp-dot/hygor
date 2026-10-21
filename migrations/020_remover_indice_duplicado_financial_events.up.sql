-- 020: remove o índice único duplicado de financial_events.
--
-- A tabela tem a restrição financial_events_company_id_event_type_source_type_source_i_key
-- e o índice uq_financial_events_canonical_source (migration 004) sobre as
-- MESMAS colunas (company_id, event_type, source_type, source_id). Os dois
-- garantem a mesma unicidade e o upsert da DRE (on conflict nessas colunas)
-- usa qualquer um; manter os dois só dobra o custo de cada gravação.
-- Fica a restrição; o índice avulso só sai se ela existir. Idempotente.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.financial_events'::regclass
       and contype = 'u'
       and conname = 'financial_events_company_id_event_type_source_type_source_i_key'
  ) then
    drop index if exists public.uq_financial_events_canonical_source;
  end if;
end $$;
