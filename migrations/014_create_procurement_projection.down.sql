-- Rollback da projeção normalizada de cotações/pedidos. O blob legado
-- (data.cotacoes/pedidos) permanece intacto.
drop function if exists public.procurement_registry_sync_legacy(text,text,jsonb);
drop table if exists public.procurement_registry_shadow_runs;
drop table if exists public.core_purchase_orders;
drop table if exists public.core_quotations;
notify pgrst,'reload schema';
