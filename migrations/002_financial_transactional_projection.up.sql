-- FIN-003 / REC-001 · a projeção compatível do frontend e o razão canônico
-- são confirmados na mesma transação. Se qualquer etapa falhar, nada é salvo.

begin;

create or replace function financial_save_with_sync(
  p_company_id text,
  p_key text,
  p_expected_updated_at timestamptz,
  p_value jsonb,
  p_actor_id text,
  p_actor_name text,
  p_correlation_id uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb,
  p_snapshot jsonb
) returns table(updated_at timestamptz, applied boolean, sync_result jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current company_app_data%rowtype;
  v_now timestamptz := now();
  v_sync jsonb;
begin
  select * into v_current
    from company_app_data
   where company_id = p_company_id and key = p_key
   for update;

  if not found or p_expected_updated_at is null or v_current.updated_at <> p_expected_updated_at then
    return query select coalesce(v_current.updated_at,now()),false,'{}'::jsonb;
    return;
  end if;

  v_sync := financial_sync_legacy_facts(p_company_id,p_actor_id,p_snapshot);

  if exists(
    select 1
      from financial_titles title
     where title.company_id = p_company_id
       and coalesce((
         select sum(item.amount)
           from settlements item
          where item.title_id = title.id and item.status = 'active'
       ),0) > title.original_amount + 0.01
  ) then
    raise exception 'Liquidações excedem o valor de um ou mais títulos';
  end if;

  if exists(
    select 1 from settlements
     where company_id = p_company_id and status = 'active' and amount <= 0
  ) then
    raise exception 'Liquidação ativa deve possuir valor positivo';
  end if;

  if exists(
    select 1
      from bank_transactions bank
     where bank.company_id = p_company_id
       and coalesce((
         select sum(link.amount)
           from reconciliation_links link
          where link.bank_transaction_id = bank.id and link.status = 'active'
       ),0) > bank.amount + 0.01
  ) then
    raise exception 'Conciliações excedem o valor de uma ou mais transações bancárias';
  end if;

  if exists(
    select 1
      from reconciliation_links link
      join settlements settlement on settlement.id = link.settlement_id
     where link.company_id = p_company_id
       and link.status = 'active'
       and settlement.status <> 'active'
  ) then
    raise exception 'Vínculo de conciliação ativo aponta para uma liquidação estornada';
  end if;

  update company_app_data
     set value = p_value, updated_at = v_now, updated_by = null
   where company_id = p_company_id and key = p_key;

  insert into audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source,payload
  ) values (
    p_company_id,'company_app_data',p_key,p_action,p_actor_id,p_actor_name,
    p_correlation_id,coalesce(p_before,'{}'),coalesce(p_after,'{}'),
    'api/data:financial_save_with_sync',jsonb_build_object('sync',v_sync)
  );

  return query select v_now,true,v_sync;
end;
$$;

revoke all on function financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb
) from public;
grant execute on function financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb
) to service_role;

notify pgrst, 'reload schema';
commit;
