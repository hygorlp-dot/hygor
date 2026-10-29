-- Rollback FIN-9.6: remove o guard de snapshot legado em período fechado.

begin;

do $$
begin
  if to_regprocedure(
    'public.financial_sync_legacy_facts_before_closed_period_guard(text,text,jsonb,boolean)'
  ) is not null then
    -- O segundo rollback já encontra a função anterior restaurada. Só
    -- remova o wrapper quando ainda existe a cópia que será restaurada.
    drop function if exists public.financial_sync_legacy_facts(text,text,jsonb,boolean);
    alter function public.financial_sync_legacy_facts_before_closed_period_guard(text,text,jsonb,boolean)
      rename to financial_sync_legacy_facts;
  end if;
end;
$$;

drop function if exists public.financial_guard_closed_legacy_snapshot(text,jsonb);
drop function if exists public.financial_date_is_closed(text,date);

notify pgrst,'reload schema';
commit;
