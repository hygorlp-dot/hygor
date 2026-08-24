-- Rollback da projeção normalizada de equipamentos. O blob legado
-- (data.equipamentos/proprietariosEquip/locacoesEquip/manutencoesEquip)
-- permanece intacto.
drop function if exists public.equipment_registry_sync_legacy(text,text,jsonb);
drop table if exists public.equipment_registry_shadow_runs;
drop table if exists public.core_equipment_maintenance_events;
drop table if exists public.core_equipment_allocations;
drop table if exists public.core_equipment_owners;
drop table if exists public.core_equipment;
notify pgrst,'reload schema';
