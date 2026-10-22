-- Reverte a 019: devolve os privilégios padrão do Supabase a anon/authenticated
-- e recria as políticas de company_app_data. Só para emergência: reabre o banco.

grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated;

do $$
begin
  if to_regclass('public.company_app_data') is not null then
    create policy company_app_data_select_authenticated on public.company_app_data for select to authenticated using (company_id = 'arcd');
    create policy company_app_data_insert_authenticated on public.company_app_data for insert to authenticated with check (company_id = 'arcd');
    create policy company_app_data_update_authenticated on public.company_app_data for update to authenticated using (company_id = 'arcd') with check (company_id = 'arcd');
    create policy company_app_data_delete_authenticated on public.company_app_data for delete to authenticated using (company_id = 'arcd');
  end if;
end $$;

notify pgrst, 'reload schema';
