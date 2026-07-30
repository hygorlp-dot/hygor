-- Rollback da projeção normalizada. O blob legado permanece intacto.
drop function if exists public.core_registry_sync_legacy(text,text,jsonb);
drop table if exists public.core_registry_shadow_runs;
drop table if exists public.core_third_party_contracts;
drop table if exists public.core_third_party_profiles;
drop table if exists public.core_suppliers;
drop table if exists public.core_employee_identifiers;
drop table if exists public.core_employee_assignments;
drop table if exists public.core_employees;
drop table if exists public.core_projects;
notify pgrst,'reload schema';
