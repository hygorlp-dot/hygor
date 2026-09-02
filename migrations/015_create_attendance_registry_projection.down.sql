-- Rollback da projeção normalizada de ponto (attendance). O blob legado
-- particionado por obra (data.attendance, arced_ponto_v1__ponto__obra__*)
-- permanece intacto.
drop function if exists public.attendance_registry_sync_legacy(text,text,jsonb);
drop table if exists public.attendance_registry_shadow_runs;
drop table if exists public.core_attendance_records;
notify pgrst,'reload schema';
