drop function if exists public.attendance_restore_transaction(text,text,text,timestamptz,jsonb,text,text,text,uuid,jsonb,jsonb);
drop function if exists public.attendance_archive_transaction(text,text,text,timestamptz,jsonb,jsonb,text,text,text,uuid,jsonb,jsonb);
notify pgrst,'reload schema';
