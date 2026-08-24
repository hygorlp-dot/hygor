-- Rollback: reconcede DELETE (volta ao estado de depois da migration 011,
-- antes desta revogação).
grant delete on table public.purchase_requests to service_role;
notify pgrst,'reload schema';
