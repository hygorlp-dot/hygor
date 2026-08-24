revoke delete on table public.purchase_requests from service_role;
notify pgrst,'reload schema';
