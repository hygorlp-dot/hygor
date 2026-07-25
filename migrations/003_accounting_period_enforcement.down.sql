begin;

drop function if exists public.financial_execute_command(text,text,jsonb);

do $$
begin
  if to_regprocedure('public.financial_execute_command_unchecked(text,text,jsonb)') is not null then
    alter function public.financial_execute_command_unchecked(text,text,jsonb)
      rename to financial_execute_command;
  end if;
end;
$$;

revoke all on function public.financial_execute_command(text,text,jsonb) from public;
grant execute on function public.financial_execute_command(text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
