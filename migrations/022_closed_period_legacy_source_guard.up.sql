-- FIN-9.6 · fechamento mensal imutável também para fatos operacionais legados.
-- Reprocessar a MESMA fotografia continua permitido; qualquer inclusão,
-- remoção ou alteração que toque um período fechado é recusada antes de
-- financial_sync_legacy_facts modificar títulos, liquidações ou bancos.

begin;

create or replace function public.financial_date_is_closed(
  p_company_id text,
  p_date date
) returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_date is not null and exists(
    select 1
      from public.accounting_periods period
     where period.company_id=p_company_id
       and period.status='closed'
       and p_date between period.starts_on and period.ends_on
  )
$$;

revoke all on function public.financial_date_is_closed(text,date) from public,anon,authenticated;
grant execute on function public.financial_date_is_closed(text,date) to service_role;

create or replace function public.financial_guard_closed_legacy_snapshot(
  p_company_id text,
  p_snapshot jsonb
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_fact jsonb;
  v_payment jsonb;
  v_bank_json jsonb;
  v_link public.legacy_record_links%rowtype;
  v_title public.financial_titles%rowtype;
  v_event public.financial_events%rowtype;
  v_settlement public.settlements%rowtype;
  v_bank public.bank_transactions%rowtype;
  v_new_date date;
  v_new_due date;
  v_new_bank_date date;
  v_payment_date date;
  v_existing_bank_legacy_id text;
  v_recognition_type text;
  v_recognized_amount numeric;
  v_changed boolean;
  v_title_changed boolean;
  v_recognition_changed boolean;
begin
  if not exists(
    select 1 from public.accounting_periods
     where company_id=p_company_id and status='closed'
  ) then
    return;
  end if;

  -- Inclusão ou alteração de um fato legado.
  --
  -- Fechar a competência congela o TÍTULO e o reconhecimento econômico
  -- daquela competência, mas não impede uma obrigação de julho de ser
  -- liquidada em agosto. Por isso a comparação é granular: título,
  -- reconhecimento e cada liquidação são validados separadamente.
  for v_fact in
    select value from jsonb_array_elements(coalesce(p_snapshot->'facts','[]'::jsonb))
  loop
    v_new_date:=nullif(v_fact->>'date','')::date;
    v_new_due:=nullif(v_fact->>'dueDate','')::date;
    v_recognized_amount:=coalesce(nullif(v_fact->>'recognizedAmount','')::numeric,0);
    v_recognition_type:=coalesce(nullif(v_fact->>'recognitionType',''),'cost_recognized');
    v_link:=null;
    v_title:=null;
    v_event:=null;

    select link.* into v_link
      from public.legacy_record_links link
     where link.company_id=p_company_id
       and link.legacy_type=v_fact->>'legacyType'
       and link.legacy_id=v_fact->>'legacyId';

    if v_link.id is not null and v_link.canonical_type='financial_title' then
      select title.* into v_title
        from public.financial_titles title
       where title.company_id=p_company_id
         and title.id=v_link.canonical_id;

      select event.* into v_event
        from public.financial_events event
       where event.company_id=p_company_id
         and event.source_type=v_fact->>'legacyType'
         and event.source_id=v_fact->>'legacyId'
         and coalesce(event.payload->>'active','true') <> 'false'
       order by event.created_at desc
       limit 1;
    end if;

    v_title_changed :=
      v_title.id is null
      or v_title.status in ('cancelled','reversed')
      or coalesce(v_title.origin_type,'') is distinct from coalesce(v_fact->>'legacyType','')
      or coalesce(v_title.origin_id,'') is distinct from coalesce(v_fact->>'legacyId','')
      or coalesce(v_title.party_id,'') is distinct from coalesce(v_fact->>'partyId','')
      or coalesce(v_title.obra_id,'') is distinct from coalesce(v_fact->>'obraId','')
      or coalesce(v_title.contract_id,'') is distinct from coalesce(v_fact->>'contractId','')
      or coalesce(v_title.direction,'') is distinct from coalesce(v_fact->>'direction','')
      or v_title.competence is distinct from v_new_date
      or v_title.due_date is distinct from v_new_due
      or coalesce(v_title.original_amount,0) is distinct from coalesce(nullif(v_fact->>'titleAmount','')::numeric,0)
      or coalesce(v_title.metadata->>'category','') is distinct from coalesce(v_fact->>'category','')
      or coalesce(v_title.metadata - 'legacyType' - 'legacyId' - 'category','{}'::jsonb)
         is distinct from coalesce(v_fact->'metadata','{}'::jsonb);

    if v_title_changed and (
      public.financial_date_is_closed(p_company_id,v_title.competence)
      or public.financial_date_is_closed(p_company_id,v_title.due_date)
      or public.financial_date_is_closed(p_company_id,v_new_date)
      or public.financial_date_is_closed(p_company_id,v_new_due)
    ) then
      raise exception 'Período contábil fechado: o título %/% não pode ser alterado',
        v_fact->>'legacyType',v_fact->>'legacyId';
    end if;

    v_recognition_changed :=
      (
        v_recognized_amount > 0
        and (
          v_event.id is null
          or v_event.event_type is distinct from v_recognition_type
          or v_event.effective_date is distinct from v_new_date
          or coalesce(nullif(v_event.payload->>'amount','')::numeric,0) is distinct from v_recognized_amount
          or coalesce(v_event.payload->>'obraId','') is distinct from coalesce(v_fact->>'obraId','')
          or coalesce(v_event.payload->>'category','') is distinct from coalesce(v_fact->>'category','')
        )
      )
      or (
        v_recognized_amount <= 0
        and v_event.id is not null
      );

    if v_recognition_changed and (
      public.financial_date_is_closed(p_company_id,v_event.effective_date)
      or public.financial_date_is_closed(p_company_id,v_new_date)
    ) then
      raise exception 'Período contábil fechado: o reconhecimento %/% não pode ser alterado',
        v_fact->>'legacyType',v_fact->>'legacyId';
    end if;

    -- Liquidações novas ou alteradas só são bloqueadas quando a PRÓPRIA
    -- data da liquidação (antiga ou nova) pertence a período fechado.
    for v_payment in
      select value from jsonb_array_elements(coalesce(v_fact->'settlements','[]'::jsonb))
    loop
      v_payment_date:=nullif(v_payment->>'date','')::date;
      v_settlement:=null;
      v_existing_bank_legacy_id:='';

      select settlement.* into v_settlement
        from public.settlements settlement
       where settlement.company_id=p_company_id
         and settlement.metadata->>'legacyType'=v_payment->>'legacyType'
         and settlement.metadata->>'legacyId'=v_payment->>'legacyId'
       limit 1;

      if v_settlement.id is not null and v_settlement.bank_transaction_id is not null then
        select coalesce(bank.metadata->>'legacyId','') into v_existing_bank_legacy_id
          from public.bank_transactions bank
         where bank.company_id=p_company_id
           and bank.id=v_settlement.bank_transaction_id;
      end if;

      v_changed :=
        v_settlement.id is null
        or v_settlement.status is distinct from 'active'
        or coalesce(v_settlement.amount,0) is distinct from coalesce(nullif(v_payment->>'amount','')::numeric,0)
        or v_settlement.settlement_date is distinct from v_payment_date
        or coalesce(v_existing_bank_legacy_id,'') is distinct from coalesce(v_payment->>'bankTransactionLegacyId','');

      if v_changed and (
        public.financial_date_is_closed(p_company_id,v_settlement.settlement_date)
        or public.financial_date_is_closed(p_company_id,v_payment_date)
      ) then
        raise exception 'Período contábil fechado: liquidação legada %/% não pode ser alterada',
          v_payment->>'legacyType',v_payment->>'legacyId';
      end if;
    end loop;

    -- Liquidação que existia e sumiu do snapshot é um estorno/removal.
    -- Só fica proibido depois que a própria data dela foi encerrada.
    if v_title.id is not null then
      for v_settlement in
        select settlement.*
          from public.settlements settlement
         where settlement.company_id=p_company_id
           and settlement.title_id=v_title.id
           and settlement.status='active'
           and coalesce(settlement.metadata->>'legacyId','') <> ''
           and not exists(
             select 1
               from jsonb_array_elements(coalesce(v_fact->'settlements','[]'::jsonb)) incoming
              where incoming->>'legacyType'=settlement.metadata->>'legacyType'
                and incoming->>'legacyId'=settlement.metadata->>'legacyId'
           )
      loop
        if public.financial_date_is_closed(p_company_id,v_settlement.settlement_date) then
          raise exception 'Período contábil fechado: liquidação legada %/% não pode ser removida',
            v_settlement.metadata->>'legacyType',v_settlement.metadata->>'legacyId';
        end if;
      end loop;
    end if;
  end loop;

  -- Remoção/cancelamento de um fato que existia na última fotografia.
  for v_title in
    select title.*
      from public.financial_titles title
      join public.legacy_record_links link
        on link.company_id=title.company_id
       and link.canonical_type='financial_title'
       and link.canonical_id=title.id
     where title.company_id=p_company_id
       and title.status not in ('cancelled','reversed')
       and not exists(
         select 1
           from jsonb_array_elements(coalesce(p_snapshot->'facts','[]'::jsonb)) incoming
          where incoming->>'legacyType'=link.legacy_type
            and incoming->>'legacyId'=link.legacy_id
       )
  loop
    if public.financial_date_is_closed(p_company_id,v_title.competence)
       or public.financial_date_is_closed(p_company_id,v_title.due_date)
       or exists(
         select 1
           from public.settlements settlement
          where settlement.company_id=p_company_id
            and settlement.title_id=v_title.id
            and settlement.status='active'
            and public.financial_date_is_closed(p_company_id,settlement.settlement_date)
       ) then
      raise exception 'Período contábil fechado: fato legado vinculado ao título % não pode ser removido',
        v_title.id;
    end if;
  end loop;

  -- Extrato bancário: inclusão/alteração dentro de período fechado.
  for v_bank_json in
    select value from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]'::jsonb))
  loop
    v_new_bank_date:=nullif(v_bank_json->>'date','')::date;
    v_bank:=null;

    select bank.* into v_bank
      from public.bank_transactions bank
     where bank.company_id=p_company_id
       and bank.metadata->>'legacyId'=v_bank_json->>'legacyId';

    if v_bank.id is null then
      if public.financial_date_is_closed(p_company_id,v_new_bank_date) then
        raise exception 'Período contábil fechado: movimento bancário % não pode ser incluído',
          v_bank_json->>'legacyId';
      end if;
      continue;
    end if;

    v_changed:=
      v_bank.booking_date is distinct from v_new_bank_date
      or v_bank.direction is distinct from (v_bank_json->>'direction')
      or v_bank.amount is distinct from (v_bank_json->>'amount')::numeric
      or coalesce(v_bank.raw_description,'') is distinct from coalesce(v_bank_json->>'description','')
      or coalesce(v_bank.metadata->>'obraId','') is distinct from coalesce(v_bank_json->>'obraId','')
      or coalesce(v_bank.metadata->>'extratoId','') is distinct from coalesce(v_bank_json->'metadata'->>'extratoId','');

    if v_changed and (
      public.financial_date_is_closed(p_company_id,v_bank.booking_date)
      or public.financial_date_is_closed(p_company_id,v_new_bank_date)
    ) then
      raise exception 'Período contábil fechado: movimento bancário % não pode ser alterado',
        v_bank_json->>'legacyId';
    end if;
  end loop;

  -- Remoção do extrato legado: o sync não apaga fisicamente a linha canônica,
  -- mas a ausência no snapshot não pode alterar a fotografia histórica de uma
  -- competência já encerrada.
  for v_bank in
    select bank.*
      from public.bank_transactions bank
     where bank.company_id=p_company_id
       and coalesce(bank.metadata->>'legacyId','') <> ''
       and not exists(
         select 1
           from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]'::jsonb)) incoming
          where incoming->>'legacyId'=bank.metadata->>'legacyId'
       )
  loop
    if public.financial_date_is_closed(p_company_id,v_bank.booking_date) then
      raise exception 'Período contábil fechado: movimento bancário % não pode ser removido',
        v_bank.metadata->>'legacyId';
    end if;
  end loop;
end;
$$;

revoke all on function public.financial_guard_closed_legacy_snapshot(text,jsonb)
  from public,anon,authenticated;
grant execute on function public.financial_guard_closed_legacy_snapshot(text,jsonb)
  to service_role;

do $$
begin
  if to_regprocedure(
    'public.financial_sync_legacy_facts_before_closed_period_guard(text,text,jsonb,boolean)'
  ) is null then
    alter function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
      rename to financial_sync_legacy_facts_before_closed_period_guard;
  end if;
end;
$$;

create or replace function public.financial_sync_legacy_facts(
  p_company_id text,
  p_actor_id text,
  p_snapshot jsonb,
  p_sync_dre_snapshots boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
  v_snapshot jsonb;
begin
  -- O guard e a mutação precisam observar a mesma fotografia canônica.
  -- A função envolvida adquire a mesma trava novamente (reentrante na
  -- transação), mas o wrapper a toma antes de validar para fechar a janela
  -- TOCTOU entre duas sincronizações concorrentes.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':financial-shadow-sync',0));
  perform public.financial_guard_closed_legacy_snapshot(p_company_id,p_snapshot);
  -- O sync anterior grava obraId no INSERT do banco, mas no UPDATE mescla
  -- apenas metadata. A classificação alterada enquanto o mês está aberto
  -- precisa chegar aos dois caminhos; caso contrário, fechar o mês faria
  -- o replay idêntico divergir da obra antiga conservada no banco canônico.
  v_snapshot:=jsonb_set(p_snapshot,'{bankTransactions}',coalesce((
    select jsonb_agg(bank || jsonb_build_object(
      'metadata',coalesce(bank->'metadata','{}'::jsonb)
        || jsonb_build_object('obraId',coalesce(bank->>'obraId',''))
    ))
      from jsonb_array_elements(coalesce(p_snapshot->'bankTransactions','[]'::jsonb)) bank
  ),'[]'::jsonb));
  v_result:=public.financial_sync_legacy_facts_before_closed_period_guard(
    p_company_id,p_actor_id,v_snapshot,p_sync_dre_snapshots
  );
  return v_result;
end;
$$;

revoke all on function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
  from public,anon,authenticated;
grant execute on function public.financial_sync_legacy_facts(text,text,jsonb,boolean)
  to service_role;

notify pgrst,'reload schema';
commit;
