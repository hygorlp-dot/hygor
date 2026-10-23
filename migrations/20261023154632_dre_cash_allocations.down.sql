begin;
do $$ begin
  if exists(select 1 from public.financial_dre_allocations) then
    raise exception 'Reversão recusada: preserve o histórico de associações financeiras';
  end if;
end $$;
drop trigger if exists financial_guard_dre_bank_link on public.reconciliation_links;
drop function if exists public.financial_guard_dre_bank_link();
drop function if exists public.financial_guard_source_reconciliation(text,jsonb,boolean);
drop function if exists public.financial_sync_legacy_facts(text,text,jsonb,boolean);
alter function public.financial_sync_legacy_facts_before_allocations(text,text,jsonb,boolean) rename to financial_sync_legacy_facts;
grant execute on function public.financial_sync_legacy_facts(text,text,jsonb,boolean) to service_role;
drop function if exists public.financial_sync_dre_allocations(text,jsonb);
drop table if exists public.financial_dre_allocations;
notify pgrst,'reload schema';
commit;
