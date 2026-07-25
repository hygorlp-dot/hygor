-- ARCD Financial Engine v1 — execute no Supabase SQL Editor antes de ativar
-- comandos financeiros na interface. O legado permanece somente leitura após
-- a migração de cada módulo.
create extension if not exists pgcrypto;

create table if not exists parties (
  id uuid primary key default gen_random_uuid(), company_id text not null, legal_name text not null, trade_name text,
  status text not null default 'active', created_at timestamptz not null default now(), created_by text not null
);
create table if not exists party_roles (party_id uuid not null references parties(id), role text not null, primary key(party_id,role));
create table if not exists party_identifiers (
  id uuid primary key default gen_random_uuid(), party_id uuid not null references parties(id), kind text not null, value_normalized text not null,
  is_primary boolean not null default false, unique(party_id,kind,value_normalized)
);
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(), company_id text not null, party_id uuid references parties(id), bank_code text,
  branch text, account_number text, pix_key text, active boolean not null default true, created_at timestamptz not null default now(),
  unique(company_id,bank_code,branch,account_number), unique(company_id,pix_key)
);
create table if not exists bank_import_batches (
  id uuid primary key default gen_random_uuid(), company_id text not null, account_id uuid references bank_accounts(id),
  source_file_name text not null, source_hash text not null, raw_content bytea, status text not null default 'active', created_at timestamptz not null default now(),
  unique(company_id,source_hash)
);
create table if not exists reconciliation_cases (
  id uuid primary key default gen_random_uuid(), company_id text not null, bank_transaction_id uuid, status text not null default 'pending',
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists reconciliation_candidates (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references reconciliation_cases(id) on delete cascade,
  target_type text not null, target_id text not null, score numeric(5,2) not null, classification text not null,
  reasons jsonb not null default '[]'::jsonb, blocks jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists data_quality_cases (
  id uuid primary key default gen_random_uuid(), company_id text not null, category text not null, severity text not null,
  entity_type text not null, entity_id text not null, details jsonb not null default '{}'::jsonb,
  status text not null default 'open', created_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists financial_titles (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  origin_type text not null, origin_id text not null, party_id text,
  obra_id text, contract_id text, direction text not null check(direction in ('payable','receivable')),
  competence date, due_date date, original_amount numeric(18,2) not null check(original_amount > 0),
  status text not null default 'open' check(status in ('open','partial','settled','cancelled','reversed')),
  version integer not null default 1, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by text not null,
  cancelled_at timestamptz, cancelled_by text,
  unique(company_id, origin_type, origin_id)
);
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(), company_id text not null, legacy_id text, supplier_party_id uuid references parties(id), obra_id text,
  number text not null, status text not null default 'draft', created_at timestamptz not null default now(), unique(company_id,number)
);
create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references purchase_orders(id), description text not null,
  quantity numeric(18,4) not null, unit_price numeric(18,6) not null, received_quantity numeric(18,4) not null default 0
);
create table if not exists goods_receipts (
  id uuid primary key default gen_random_uuid(), company_id text not null, purchase_order_id uuid references purchase_orders(id),
  received_on date not null, status text not null default 'confirmed', created_at timestamptz not null default now()
);
create table if not exists goods_receipt_items (
  id uuid primary key default gen_random_uuid(), goods_receipt_id uuid not null references goods_receipts(id), purchase_order_item_id uuid references purchase_order_items(id),
  quantity numeric(18,4) not null, unit_cost numeric(18,6)
);
create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(), company_id text not null, supplier_party_id uuid references parties(id), purchase_order_id uuid references purchase_orders(id),
  access_key text, number text not null, issued_on date, due_date date, total_amount numeric(18,2) not null, status text not null default 'draft',
  created_at timestamptz not null default now(), unique(company_id,access_key)
);
create table if not exists supplier_invoice_items (
  id uuid primary key default gen_random_uuid(), supplier_invoice_id uuid not null references supplier_invoices(id), description text not null,
  quantity numeric(18,4), unit_price numeric(18,6), amount numeric(18,2) not null
);
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  account_id uuid references bank_accounts(id), import_batch_id uuid references bank_import_batches(id), fitid text, e2e_id text, txid text,
  booking_date date not null, direction text not null check(direction in ('in','out')),
  amount numeric(18,2) not null check(amount > 0), raw_description text not null default '',
  counterparty_id uuid, metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','partial','reconciled','ignored','reversed')),
  version integer not null default 1, archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, fitid), unique(company_id, e2e_id), unique(company_id, txid)
);
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  title_id uuid not null references financial_titles(id), bank_transaction_id uuid references bank_transactions(id),
  amount numeric(18,2) not null check(amount > 0), settlement_date date not null,
  status text not null default 'active' check(status in ('active','reversed')),
  reversal_of uuid references settlements(id), created_at timestamptz not null default now(), created_by text not null,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists financial_events (
  id uuid primary key default gen_random_uuid(), company_id text not null, event_type text not null,
  source_type text not null, source_id text not null, effective_date date not null,
  reversal_of uuid references financial_events(id), payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), created_by text not null,
  unique(company_id,event_type,source_type,source_id)
);
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(), company_id text not null, event_id uuid not null references financial_events(id),
  entry_date date not null, status text not null default 'posted', created_at timestamptz not null default now()
);
create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(), entry_id uuid not null references journal_entries(id) on delete cascade,
  account_code text not null, debit numeric(18,2) not null default 0 check(debit >= 0),
  credit numeric(18,2) not null default 0 check(credit >= 0),
  obra_id text, source_type text, source_id text, check ((debit = 0) <> (credit = 0))
);
create table if not exists reconciliation_links (
  id uuid primary key default gen_random_uuid(), company_id text not null,
  bank_transaction_id uuid not null references bank_transactions(id), title_id uuid not null references financial_titles(id),
  settlement_id uuid not null references settlements(id), amount numeric(18,2) not null check(amount > 0),
  score numeric(5,2), confidence text, reasons jsonb not null default '[]'::jsonb,
  status text not null default 'active' check(status in ('active','reversed')),
  confirmed_at timestamptz not null default now(), confirmed_by text not null,
  unique(bank_transaction_id, settlement_id)
);
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(), company_id text not null, aggregate_type text not null, aggregate_id text not null,
  action text not null, actor_id text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists idempotency_records (
  company_id text not null, command_key text not null, response jsonb not null, created_at timestamptz not null default now(),
  primary key(company_id, command_key)
);
create table if not exists accounting_periods (
  id uuid primary key default gen_random_uuid(), company_id text not null, starts_on date not null, ends_on date not null,
  status text not null default 'open' check(status in ('open','closed')), closed_by text, closed_at timestamptz,
  unique(company_id,starts_on,ends_on), check(ends_on >= starts_on)
);
create table if not exists integration_outbox (
  id uuid primary key default gen_random_uuid(), company_id text not null, topic text not null, payload jsonb not null,
  created_at timestamptz not null default now(), delivered_at timestamptz
);
create table if not exists legacy_record_links (
  id uuid primary key default gen_random_uuid(), company_id text not null, legacy_type text not null, legacy_id text not null,
  canonical_type text not null, canonical_id uuid not null, record_hash text not null, created_at timestamptz not null default now(),
  unique(company_id,legacy_type,legacy_id), unique(company_id,canonical_type,canonical_id)
);
create index if not exists settlements_title_active_idx on settlements(title_id) where status='active';
create index if not exists reconciliation_links_transaction_active_idx on reconciliation_links(bank_transaction_id) where status='active';

create or replace function financial_execute_command(p_company_id text, p_actor_id text, p_command jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_type text := p_command->>'type'; v_key text := p_command->>'idempotencyKey'; v_payload jsonb := coalesce(p_command->'payload','{}'::jsonb);
  v_title financial_titles%rowtype; v_bank bank_transactions%rowtype; v_amount numeric(18,2); v_settlement_id uuid; v_event_id uuid; v_response jsonb;
begin
  if coalesce(v_key,'')='' then raise exception 'idempotencyKey é obrigatório'; end if;
  -- Serializa comandos sobre a mesma empresa/chave enquanto a RPC estiver em
  -- execução. Somado aos FOR UPDATE abaixo, impede duas baixas concorrentes
  -- no mesmo título ou movimento mesmo em conexões diferentes.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':' || v_key,0));
  select response into v_response from idempotency_records where company_id=p_company_id and command_key=v_key;
  if found then return v_response || jsonb_build_object('idempotent',true); end if;

  if v_type='CREATE_FINANCIAL_TITLE' then
    insert into financial_titles(company_id,origin_type,origin_id,party_id,obra_id,contract_id,direction,competence,due_date,original_amount,metadata,created_by)
    values(p_company_id,v_payload->>'originType',v_payload->>'originId',v_payload->>'partyId',v_payload->>'obraId',v_payload->>'contractId',v_payload->>'direction',nullif(v_payload->>'competence','')::date,nullif(v_payload->>'dueDate','')::date,(v_payload->>'amount')::numeric,v_payload,p_actor_id)
    returning * into v_title;
    v_response:=jsonb_build_object('ok',true,'titleId',v_title.id);
  elsif v_type='REGISTER_SETTLEMENT' then
    select * into v_title from financial_titles where id=(v_payload->>'titleId')::uuid and company_id=p_company_id for update;
    if not found or v_title.status in ('cancelled','reversed') then raise exception 'Título indisponível'; end if;
    v_amount:=(v_payload->>'amount')::numeric;
    if exists(select 1 from accounting_periods where company_id=p_company_id and status='closed' and coalesce(nullif(v_payload->>'date','')::date,current_date) between starts_on and ends_on) then raise exception 'Período contábil fechado'; end if;
    if v_amount<=0 or v_amount>(v_title.original_amount-coalesce((select sum(amount) from settlements where title_id=v_title.id and status='active'),0)) then raise exception 'Valor inválido para o saldo do título'; end if;
    if v_payload ? 'bankTransactionId' then
      select * into v_bank from bank_transactions where id=(v_payload->>'bankTransactionId')::uuid and company_id=p_company_id for update;
      if not found then raise exception 'Transação bancária indisponível'; end if;
      if v_amount>(v_bank.amount-coalesce((select sum(amount) from reconciliation_links where bank_transaction_id=v_bank.id and status='active'),0)) then raise exception 'Valor excede o saldo conciliável da transação'; end if;
    end if;
    insert into settlements(company_id,title_id,bank_transaction_id,amount,settlement_date,created_by,metadata) values(p_company_id,v_title.id,nullif(v_payload->>'bankTransactionId','')::uuid,v_amount,coalesce(nullif(v_payload->>'date','')::date,current_date),p_actor_id,v_payload) returning id into v_settlement_id;
    if v_bank.id is not null then insert into reconciliation_links(company_id,bank_transaction_id,title_id,settlement_id,amount,score,confidence,reasons,confirmed_by) values(p_company_id,v_bank.id,v_title.id,v_settlement_id,v_amount,nullif(v_payload->>'score','')::numeric,v_payload->>'confidence',coalesce(v_payload->'reasons','[]'::jsonb),p_actor_id); end if;
    update financial_titles set status=case when original_amount<=coalesce((select sum(amount) from settlements where title_id=v_title.id and status='active'),0) then 'settled' else 'partial' end,version=version+1 where id=v_title.id;
    if v_bank.id is not null then update bank_transactions set status=case when amount<=coalesce((select sum(amount) from reconciliation_links where bank_transaction_id=v_bank.id and status='active'),0) then 'reconciled' else 'partial' end,version=version+1 where id=v_bank.id; end if;
    insert into financial_events(company_id,event_type,source_type,source_id,effective_date,payload,created_by) values(p_company_id,'settlement','settlement',v_settlement_id::text,coalesce(nullif(v_payload->>'date','')::date,current_date),v_payload,p_actor_id) returning id into v_event_id;
    v_response:=jsonb_build_object('ok',true,'settlementId',v_settlement_id,'eventId',v_event_id);
  elsif v_type='REVERSE_SETTLEMENT' then
    update settlements set status='reversed' where id=(v_payload->>'settlementId')::uuid and company_id=p_company_id and status='active' returning title_id into v_title.id;
    if not found then raise exception 'Liquidação não encontrada ou já revertida'; end if;
    update reconciliation_links set status='reversed' where settlement_id=(v_payload->>'settlementId')::uuid and status='active';
    update financial_titles set status='partial',version=version+1 where id=v_title.id;
    v_response:=jsonb_build_object('ok',true,'reversedSettlementId',v_payload->>'settlementId');
  elsif v_type='CLOSE_ACCOUNTING_PERIOD' then
    insert into accounting_periods(company_id,starts_on,ends_on,status,closed_by,closed_at) values(p_company_id,(v_payload->>'startsOn')::date,(v_payload->>'endsOn')::date,'closed',p_actor_id,now())
    on conflict(company_id,starts_on,ends_on) do update set status='closed',closed_by=excluded.closed_by,closed_at=excluded.closed_at;
    v_response:=jsonb_build_object('ok',true,'periodClosed',true);
  else raise exception 'Comando financeiro não suportado: %',v_type;
  end if;
  insert into audit_events(company_id,aggregate_type,aggregate_id,action,actor_id,payload) values(p_company_id,'financial_command',coalesce(v_response->>'settlementId',v_response->>'titleId',v_type),v_type,p_actor_id,p_command);
  insert into integration_outbox(company_id,topic,payload) values(p_company_id,'financial.'||lower(v_type),v_response);
  insert into idempotency_records(company_id,command_key,response) values(p_company_id,v_key,v_response);
  return v_response;
end $$;
