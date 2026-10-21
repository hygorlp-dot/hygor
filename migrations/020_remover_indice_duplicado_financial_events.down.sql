-- Reverte a 020: recria o índice avulso (redundante com a restrição).
create unique index if not exists uq_financial_events_canonical_source
  on public.financial_events(company_id, event_type, source_type, source_id);
