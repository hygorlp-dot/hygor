-- Achado de 21/08/2026 (investigação de performance ao vivo): salvar um
-- funcionário (EMPLOYEE_SAVED, comando "financeiro" por afetar custo de mão
-- de obra) levava ~25s em produção. Toda a demora estava dentro de
-- financial_sync_legacy_facts, que a cada chamada desativa e reinsere os
-- ~1.764 snapshots de DRE da empresa inteira (migrations/001, linhas
-- 100-104 e 141-157), mesmo quando nenhum dado de DRE mudou.
--
-- A tela de DRE já se auto-repara na leitura (api/data.js, ação
-- financial-dre-report: compara sourceRevision/updated_at e reconstrói só o
-- período pedido via buildRequestedDreProjectionRows) - a reconstrução
-- completa dentro da transação de escrita é redundante e nunca precisa
-- rodar ali. p_sync_dre_snapshots preserva o comportamento anterior por
-- padrão (true): o job manual/de deploy (ação financial-shadow-sync e
-- scripts/apply-financial-shadow.mjs, que chamam sem passar esse
-- argumento) continua fazendo a carga completa, usada como gate de
-- integridade antes de qualquer promoção do FIN-003. Só o caminho
-- transacional de escrita (api/data.js: gravarMutacaoNaTransacao,
-- salvarFinanceiroComAuditoria) passa false.

begin;

drop function if exists financial_sync_legacy_facts(text,text,jsonb);

create or replace function financial_sync_legacy_facts(
  p_company_id text,
  p_actor_id text,
  p_snapshot jsonb,
  p_sync_dre_snapshots boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fact jsonb;
  v_bank jsonb;
  v_payment jsonb;
  v_dre jsonb;
  v_title_id uuid;
  v_bank_id uuid;
  v_settlement_id uuid;
  v_event_id uuid;
  v_run_id uuid;
  v_facts integer := jsonb_array_length(coalesce(p_snapshot->'facts','[]'::jsonb));
  v_banks integer := jsonb_array_length(coalesce(p_snapshot->'bankTransactions','[]'::jsonb));
  v_dre_snapshots integer := case when p_sync_dre_snapshots
    then jsonb_array_length(coalesce(p_snapshot->'dreSnapshots','[]'::jsonb)) else 0 end;
  v_titles integer := 0;
  v_settlements integer := 0;
  v_links integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':financial-shadow-sync', 0));

  -- Primeiro desativa toda projeção legada. Os fatos presentes no snapshot são
  -- reativados abaixo. Assim, cancelamentos e estornos não sobrevivem no razão.
  update reconciliation_links link
     set status = 'reversed'
   where link.company_id = p_company_id
     and exists (
       select 1
         from settlements settlement
        where settlement.id = link.settlement_id
          and settlement.company_id = p_company_id
          and coalesce(settlement.metadata->>'legacyId','') <> ''
     );

  update settlements
     set status = 'reversed'
   where company_id = p_company_id
     and coalesce(metadata->>'legacyId','') <> '';

  update financial_titles
     set status = 'cancelled',
         version = version + 1
   where company_id = p_company_id
     and coalesce(metadata->>'legacyId','') <> '';

  update financial_events
     set payload = payload || jsonb_build_object('active', false)
   where company_id = p_company_id
     and coalesce(source_id,'') <> ''
     and exists (
       select 1
         from legacy_record_links legacy_link
        where legacy_link.company_id = p_company_id
          and legacy_link.legacy_type = financial_events.source_type
          and legacy_link.legacy_id = financial_events.source_id
     );

  update bank_transactions
     set status = case
       when status = 'ignored' then 'ignored'
       else 'pending'
     end,
     version = version + 1
   where company_id = p_company_id
     and coalesce(metadata->>'legacyId','') <> '';

  if p_sync_dre_snapshots then
    update financial_events
       set payload = payload || jsonb_build_object('active', false)
     where company_id = p_company_id
       and event_type = 'dre_snapshot'
       and source_type = 'dre_projection';
  end if;

  for v_bank in select value from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]'::jsonb))
  loop
    select id into v_bank_id
      from bank_transactions
     where company_id = p_company_id
       and metadata->>'legacyId' = v_bank->>'legacyId'
     for update;

    if v_bank_id is null then
      insert into bank_transactions(
        company_id, booking_date, direction, amount, raw_description, status, metadata
      ) values (
        p_company_id,
        (v_bank->>'date')::date,
        v_bank->>'direction',
        (v_bank->>'amount')::numeric,
        coalesce(v_bank->>'description',''),
        coalesce(v_bank->>'status','pending'),
        coalesce(v_bank->'metadata','{}'::jsonb) || jsonb_build_object(
          'legacyId', v_bank->>'legacyId',
          'obraId', coalesce(v_bank->>'obraId','')
        )
      ) returning id into v_bank_id;
    else
      update bank_transactions
         set booking_date = (v_bank->>'date')::date,
             direction = v_bank->>'direction',
             amount = (v_bank->>'amount')::numeric,
             raw_description = coalesce(v_bank->>'description',''),
             metadata = metadata || coalesce(v_bank->'metadata','{}'::jsonb)
       where id = v_bank_id;
    end if;
    v_bank_id := null;
  end loop;

  if p_sync_dre_snapshots then
    for v_dre in select value from jsonb_array_elements(coalesce(p_snapshot->'dreSnapshots','[]'::jsonb))
    loop
      insert into financial_events(
        company_id, event_type, source_type, source_id, effective_date, payload, created_by
      ) values (
        p_company_id, 'dre_snapshot', 'dre_projection', v_dre->>'sourceId',
        make_date((v_dre->>'year')::integer,(v_dre->>'month')::integer + 1,1),
        coalesce(v_dre->'payload','{}'::jsonb) || jsonb_build_object(
          'active',true,'obraId',coalesce(v_dre->>'obraId',''),
          'year',(v_dre->>'year')::integer,'month',(v_dre->>'month')::integer,
          'period',v_dre->>'period'
        ),
        p_actor_id
      )
      on conflict(company_id,event_type,source_type,source_id) do update
        set effective_date=excluded.effective_date,payload=excluded.payload;
    end loop;
  end if;

  for v_fact in select value from jsonb_array_elements(coalesce(p_snapshot->'facts','[]'::jsonb))
  loop
    insert into financial_titles(
      company_id, origin_type, origin_id, party_id, obra_id, contract_id,
      direction, competence, due_date, original_amount, status, metadata, created_by
    ) values (
      p_company_id,
      v_fact->>'legacyType',
      v_fact->>'legacyId',
      nullif(v_fact->>'partyId',''),
      nullif(v_fact->>'obraId',''),
      nullif(v_fact->>'contractId',''),
      v_fact->>'direction',
      (v_fact->>'date')::date,
      (v_fact->>'dueDate')::date,
      (v_fact->>'titleAmount')::numeric,
      'open',
      coalesce(v_fact->'metadata','{}'::jsonb) || jsonb_build_object(
        'legacyType', v_fact->>'legacyType',
        'legacyId', v_fact->>'legacyId',
        'category', v_fact->>'category'
      ),
      p_actor_id
    )
    on conflict(company_id, origin_type, origin_id) do update
      set party_id = excluded.party_id,
          obra_id = excluded.obra_id,
          contract_id = excluded.contract_id,
          competence = excluded.competence,
          due_date = excluded.due_date,
          original_amount = excluded.original_amount,
          metadata = financial_titles.metadata || excluded.metadata,
          version = financial_titles.version + 1
    returning id into v_title_id;
    v_titles := v_titles + 1;

    insert into legacy_record_links(
      company_id, legacy_type, legacy_id, canonical_type, canonical_id, record_hash
    ) values (
      p_company_id, v_fact->>'legacyType', v_fact->>'legacyId',
      'financial_title', v_title_id,
      md5(v_fact::text)
    )
    on conflict(company_id, legacy_type, legacy_id) do update
      set canonical_type = excluded.canonical_type,
          canonical_id = excluded.canonical_id,
          record_hash = excluded.record_hash;

    if coalesce((v_fact->>'recognizedAmount')::numeric, 0) > 0 then
      insert into financial_events(
        company_id, event_type, source_type, source_id, effective_date, payload, created_by
      ) values (
        p_company_id,
        coalesce(nullif(v_fact->>'recognitionType',''), 'cost_recognized'),
        v_fact->>'legacyType',
        v_fact->>'legacyId',
        (v_fact->>'date')::date,
        jsonb_build_object(
          'amount', (v_fact->>'recognizedAmount')::numeric,
          'obraId', coalesce(v_fact->>'obraId',''),
          'category', v_fact->>'category',
          'titleId', v_title_id,
          'active', true
        ),
        p_actor_id
      )
      on conflict(company_id, event_type, source_type, source_id) do update
        set effective_date = excluded.effective_date,
            payload = excluded.payload
      returning id into v_event_id;
    end if;

    for v_payment in select value from jsonb_array_elements(coalesce(v_fact->'settlements','[]'::jsonb))
    loop
      v_bank_id := null;
      if coalesce(v_payment->>'bankTransactionLegacyId','') <> '' then
        select id into v_bank_id
          from bank_transactions
         where company_id = p_company_id
           and metadata->>'legacyId' = v_payment->>'bankTransactionLegacyId';
      end if;

      select id into v_settlement_id
        from settlements
       where company_id = p_company_id
         and metadata->>'legacyType' = v_payment->>'legacyType'
         and metadata->>'legacyId' = v_payment->>'legacyId'
       for update;

      if v_settlement_id is null then
        insert into settlements(
          company_id, title_id, bank_transaction_id, amount, settlement_date,
          status, created_by, metadata
        ) values (
          p_company_id, v_title_id, v_bank_id,
          (v_payment->>'amount')::numeric, (v_payment->>'date')::date,
          'active', p_actor_id,
          jsonb_build_object(
            'legacyType', v_payment->>'legacyType',
            'legacyId', v_payment->>'legacyId',
            'category', v_fact->>'category'
          )
        ) returning id into v_settlement_id;
      else
        update settlements
           set title_id = v_title_id,
               bank_transaction_id = v_bank_id,
               amount = (v_payment->>'amount')::numeric,
               settlement_date = (v_payment->>'date')::date,
               status = 'active',
               metadata = metadata || jsonb_build_object('category', v_fact->>'category')
         where id = v_settlement_id;
      end if;
      v_settlements := v_settlements + 1;

      if v_bank_id is not null then
        insert into reconciliation_links(
          company_id, bank_transaction_id, title_id, settlement_id, amount,
          confidence, reasons, confirmed_by
        ) values (
          p_company_id, v_bank_id, v_title_id, v_settlement_id,
          (v_payment->>'amount')::numeric, 'legacy',
          jsonb_build_array('Carga idempotente do vínculo legado'), p_actor_id
        )
        on conflict(bank_transaction_id, settlement_id) do update
          set title_id = excluded.title_id,
              amount = excluded.amount,
              status = 'active',
              confirmed_by = excluded.confirmed_by,
              confirmed_at = now();
        v_links := v_links + 1;
      end if;
      v_settlement_id := null;
    end loop;

    update financial_titles title
       set status = case
         when coalesce((
           select sum(item.amount) from settlements item
            where item.title_id = title.id and item.status = 'active'
         ), 0) >= title.original_amount - 0.01 then 'settled'
         when exists(select 1 from settlements item where item.title_id = title.id and item.status = 'active') then 'partial'
         else 'open'
       end
     where title.id = v_title_id;
    v_title_id := null;
  end loop;

  update bank_transactions bank
     set status = case
       when coalesce((
         select sum(link.amount) from reconciliation_links link
          where link.bank_transaction_id = bank.id and link.status = 'active'
       ), 0) >= bank.amount - 0.01 then 'reconciled'
       when exists(select 1 from reconciliation_links link where link.bank_transaction_id = bank.id and link.status = 'active') then 'partial'
       else bank.status
     end,
     version = version + 1
   where bank.company_id = p_company_id
     and coalesce(bank.metadata->>'legacyId','') <> '';

  insert into financial_shadow_runs(company_id, actor_id, facts_received, bank_transactions_received, result)
  values (
    p_company_id, p_actor_id, v_facts, v_banks,
    jsonb_build_object('titles',v_titles,'settlements',v_settlements,'reconciliationLinks',v_links,'dreSnapshots',v_dre_snapshots)
  ) returning id into v_run_id;

  insert into audit_events(company_id, aggregate_type, aggregate_id, action, actor_id, payload)
  values (
    p_company_id, 'financial_shadow_run', v_run_id::text, 'SYNC_LEGACY_FINANCIAL_FACTS',
    p_actor_id, jsonb_build_object('facts',v_facts,'bankTransactions',v_banks,'titles',v_titles,'settlements',v_settlements,'reconciliationLinks',v_links,'dreSnapshots',v_dre_snapshots)
  );

  return jsonb_build_object(
    'ok', true, 'runId', v_run_id, 'facts', v_facts, 'bankTransactions', v_banks,
    'titles', v_titles, 'settlements', v_settlements, 'reconciliationLinks', v_links,
    'dreSnapshots', v_dre_snapshots
  );
end;
$$;

revoke all on function financial_sync_legacy_facts(text,text,jsonb,boolean) from public;
grant execute on function financial_sync_legacy_facts(text,text,jsonb,boolean) to service_role;

drop function if exists financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb
);

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
  p_snapshot jsonb,
  p_sync_dre_snapshots boolean default true
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

  v_sync := financial_sync_legacy_facts(p_company_id,p_actor_id,p_snapshot,p_sync_dre_snapshots);

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
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb,boolean
) from public;
grant execute on function financial_save_with_sync(
  text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb,jsonb,boolean
) to service_role;

notify pgrst, 'reload schema';
commit;
