-- CORE-003: fundação normalizada de cotações e pedidos de compra em modo
-- sombra, mesmo padrão das migrations 007 (CORE-001, cadastros) e 009
-- (CORE-002, equipamentos). Não remove nem altera company_app_data e não
-- troca a leitura do aplicativo - só leitura até que exista um consumidor
-- real (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Comando de
-- criação de cotação: a lacuna fundamental fechada", que é o pré-requisito
-- que esta migration segue).
--
-- Escopo deliberadamente mínimo (mesma disciplina do CORE-001/CORE-002):
--   - core_quotations: cotações (data.cotacoes) - id, obra, insumo,
--     vínculo com a solicitação de origem, status. As propostas
--     (fornecedor/preço/prazo) ficam inteiras dentro de `payload`, sem
--     tabela filha própria - nenhum outro domínio referencia uma proposta
--     pelo próprio id.
--   - core_purchase_orders: pedidos (data.pedidos) - id, obra, fornecedor,
--     vínculo com cotação/solicitação de origem, status. Itens,
--     pagamentos e recebimentos ficam inteiros em `payload`, mesmo
--     princípio.
--
-- `request_id` (solicitacaoId) é armazenado sem chave estrangeira de
-- propósito: `purchase_requests` (migration 010) é uma escrita AO VIVO de
-- melhor esforço desde 24/08/2026, não uma projeção em lote como esta -
-- não garante cobertura de solicitações criadas antes dessa data. Uma FK
-- aqui quebraria a sincronização para qualquer cotação/pedido histórico
-- vinculado a uma solicitação nunca duplicada na tabela viva. A
-- integridade desse vínculo específico já é garantida no lado do blob por
-- server/procurement-chain-policy.js.
--
-- `project_id` e `supplier_id` SÃO chave estrangeira para core_projects/
-- core_suppliers (CORE-001) porque essas tabelas são projeção completa em
-- lote (todo registro, sempre) e nunca fazem DELETE físico (só archived_at)
-- - uma referência antiga permanece válida mesmo que o cadastro de origem
-- tenha sido removido do blob depois, mesmo raciocínio já usado por
-- core_equipment_allocations (migration 009).

create table if not exists public.core_quotations (
  company_id      text        not null,
  id              text        not null,
  project_id      text        not null,
  material_id     text        not null,
  request_id      text,
  status          text        not null default 'aberta',
  active          boolean     not null default true,
  quantity        numeric     not null default 0,
  source_version  integer     not null default 0 check (source_version >= 0),
  source_hash     text        not null check (length(source_hash) = 64),
  payload         jsonb       not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  archived_at     timestamptz,
  primary key (company_id, id),
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> ''),
  check (btrim(material_id) <> '')
);
create index if not exists idx_core_quotations_company_status
  on public.core_quotations(company_id, active, status);
create index if not exists idx_core_quotations_request
  on public.core_quotations(company_id, request_id)
  where request_id is not null;

create table if not exists public.core_purchase_orders (
  company_id      text        not null,
  id              text        not null,
  project_id      text        not null,
  supplier_id     text        not null,
  quote_id        text,
  request_id      text,
  numero          text        not null default '',
  status          text        not null default 'enviado',
  active          boolean     not null default true,
  source_version  integer     not null default 0 check (source_version >= 0),
  source_hash     text        not null check (length(source_hash) = 64),
  payload         jsonb       not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  archived_at     timestamptz,
  primary key (company_id, id),
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  foreign key (company_id, supplier_id)
    references public.core_suppliers(company_id, id) on delete restrict,
  foreign key (company_id, quote_id)
    references public.core_quotations(company_id, id) on delete restrict,
  check (btrim(id) <> '')
);
create index if not exists idx_core_purchase_orders_company_status
  on public.core_purchase_orders(company_id, active, status);
create index if not exists idx_core_purchase_orders_quote
  on public.core_purchase_orders(company_id, quote_id)
  where quote_id is not null;
create index if not exists idx_core_purchase_orders_request
  on public.core_purchase_orders(company_id, request_id)
  where request_id is not null;

create table if not exists public.procurement_registry_shadow_runs (
  id             uuid primary key default gen_random_uuid(),
  company_id     text not null,
  schema_version integer not null,
  actor_id       text not null,
  result         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_procurement_registry_shadow_runs_company_created
  on public.procurement_registry_shadow_runs(company_id, created_at desc);

alter table public.core_quotations enable row level security;
alter table public.core_purchase_orders enable row level security;
alter table public.procurement_registry_shadow_runs enable row level security;

revoke all on table public.core_quotations from public, anon, authenticated;
revoke all on table public.core_purchase_orders from public, anon, authenticated;
revoke all on table public.procurement_registry_shadow_runs from public, anon, authenticated;

grant select, insert, update on table public.core_quotations to service_role;
grant select, insert, update on table public.core_purchase_orders to service_role;
grant select, insert on table public.procurement_registry_shadow_runs to service_role;

create or replace function public.procurement_registry_sync_legacy(
  p_company_id text,
  p_actor_id text,
  p_snapshot jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item jsonb;
  v_now timestamptz := clock_timestamp();
  v_schema_version integer := coalesce((p_snapshot->>'schemaVersion')::integer, 0);
  v_result jsonb;
begin
  if btrim(coalesce(p_company_id,'')) = '' or btrim(coalesce(p_actor_id,'')) = '' then
    raise exception 'procurement_registry_invalid_actor_or_company' using errcode='22023';
  end if;
  if v_schema_version <> 1 or coalesce((p_snapshot->>'complete')::boolean, false) is not true then
    raise exception 'procurement_registry_invalid_snapshot' using errcode='22023';
  end if;

  -- Ordem importa: cotação antes de pedido (FK quote_id).
  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'quotations','[]'::jsonb))
  loop
    insert into public.core_quotations(
      company_id,id,project_id,material_id,request_id,status,active,quantity,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'projectId',v_item->>'materialId',
      nullif(v_item->>'requestId',''),coalesce(v_item->>'status','aberta'),
      coalesce((v_item->>'active')::boolean,true),coalesce((v_item->>'quantity')::numeric,0),
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      project_id=excluded.project_id,material_id=excluded.material_id,
      request_id=excluded.request_id,status=excluded.status,active=excluded.active,
      quantity=excluded.quantity,source_version=excluded.source_version,
      source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'purchaseOrders','[]'::jsonb))
  loop
    insert into public.core_purchase_orders(
      company_id,id,project_id,supplier_id,quote_id,request_id,numero,status,active,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'projectId',v_item->>'supplierId',
      nullif(v_item->>'quoteId',''),nullif(v_item->>'requestId',''),
      coalesce(v_item->>'numero',''),coalesce(v_item->>'status','enviado'),
      coalesce((v_item->>'active')::boolean,true),
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      project_id=excluded.project_id,supplier_id=excluded.supplier_id,
      quote_id=excluded.quote_id,request_id=excluded.request_id,numero=excluded.numero,
      status=excluded.status,active=excluded.active,source_version=excluded.source_version,
      source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  -- Arquiva o que saiu do snapshot - ordem inversa da inserção (dependente
  -- primeiro), embora "restrict" nunca deixaria isso importar de fato aqui
  -- (arquivar não apaga a linha, e cotações/pedidos são append-only no
  -- blob - este ramo raramente dispara na prática, mas cobre o mesmo caso
  -- defensivo que CORE-001/CORE-002 já cobrem).
  update public.core_purchase_orders row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'purchaseOrders','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_quotations row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'quotations','[]'::jsonb)) item
      where item->>'id'=row.id
    );

  v_result := jsonb_build_object(
    'schemaVersion',v_schema_version,
    'quotations',jsonb_array_length(coalesce(p_snapshot->'quotations','[]'::jsonb)),
    'purchaseOrders',jsonb_array_length(coalesce(p_snapshot->'purchaseOrders','[]'::jsonb))
  );

  insert into public.procurement_registry_shadow_runs(
    company_id,schema_version,actor_id,result
  ) values (p_company_id,v_schema_version,p_actor_id,v_result);
  insert into public.audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values (
    p_company_id,'procurement_registry_shadow',p_company_id,'procurement_registry_shadow_synced',
    p_actor_id,'Sistema',gen_random_uuid(),'{}'::jsonb,v_result,'migration/014'
  );
  return v_result;
end;
$$;

revoke all on function public.procurement_registry_sync_legacy(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.procurement_registry_sync_legacy(text,text,jsonb)
  to service_role;

notify pgrst,'reload schema';
