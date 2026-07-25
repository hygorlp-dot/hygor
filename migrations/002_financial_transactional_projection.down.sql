begin;
revoke execute on function financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb
) from service_role;
drop function if exists financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb
);
commit;
