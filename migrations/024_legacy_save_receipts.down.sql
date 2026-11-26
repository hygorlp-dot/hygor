drop function if exists public.save_legacy_operation_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,text,text,text);
drop function if exists public.lock_legacy_save_receipt(text,text,text,text);
drop table if exists public.legacy_save_receipts;
notify pgrst, 'reload schema';
