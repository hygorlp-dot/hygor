-- Roteiro de reversão manual. Não executar sobre uma homologação usada.
begin;
do $$ declare v_table text; v_has_data boolean; begin
  if not exists (select 1 from public.arcd_ambiente where id=true and ambiente='homologacao') then
    raise exception 'Banco de homologação não confirmado';
  end if;
  foreach v_table in array ARRAY['parties','bank_accounts','bank_import_batches','financial_titles','bank_transactions','settlements','financial_events','reconciliation_links','financial_dre_allocations'] loop
    if to_regclass('public.'||v_table) is not null then
      execute format('select exists(select 1 from public.%I limit 1)',v_table) into v_has_data;
      if v_has_data then raise exception 'Reversão recusada: tabela % contém registros',v_table; end if;
    end if;
  end loop;
end $$;
drop function if exists public.financial_guard_source_reconciliation(text,jsonb,boolean);
drop table if exists public.financial_dre_allocations;
drop table if exists public.reconciliation_links;
drop table if exists public.financial_events;
drop table if exists public.settlements;
drop table if exists public.bank_transactions;
drop table if exists public.financial_titles;
drop table if exists public.bank_import_batches;
drop table if exists public.bank_accounts;
drop table if exists public.parties;
notify pgrst,'reload schema';
commit;
