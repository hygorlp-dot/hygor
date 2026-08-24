-- CORE-002: fundação normalizada de equipamentos em modo sombra, mesmo
-- padrão da migration 007 (CORE-001). Não remove nem altera
-- company_app_data e não troca a leitura do aplicativo.
--
-- Escopo deliberadamente limitado à camada de cadastro/vínculo (mesma
-- disciplina do CORE-001, que também parou em "cadastros e vínculos
-- operacionais" - ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md):
--   - core_equipment: registro físico (data.equipamentos - a fonte
--     canônica ainda editada via EQUIPAMENTO_SALVO, não a normalização
--     interna equipmentModels/Lots/Units, que é derivada e re-derivável a
--     qualquer momento por migrateLegacyEquipmentRegistry).
--   - core_equipment_owners: proprietários (data.proprietariosEquip).
--   - core_equipment_allocations: locações (data.locacoesEquip) - no
--     código a locação JÁ É o vínculo equipamento-obra (não existe um
--     conceito de "alocação" separado de "locação"), por isso um único
--     projeta os dois nomes que o plano de redução lista
--     ("equipment_allocations"/"equipment_rentals").
--   - core_equipment_maintenance_events: manutenções (data.manutencoesEquip).
--
-- Fica de fora (fluxo transacional, não cadastro - fase posterior):
-- rentalChargeItems/rentalInvoices/rentalInvoiceReceipts (faturamento de
-- locação), equipmentUnavailability (calendário derivado), transferenciasEquip,
-- e a normalização interna equipmentModels/Lots/Units em si - tudo
-- preservado dentro do `payload` de core_equipment_allocations quando
-- relevante (tarifas, descontos, lifecycleState), nunca modelado em coluna
-- própria.

create table if not exists public.core_equipment (
  company_id          text        not null,
  id                  text        not null,
  name                text        not null,
  category            text        not null default '',
  asset_tag           text        not null default '',
  status              text        not null default 'disponivel',
  active              boolean     not null default true,
  owner_id            text,
  current_project_id  text,
  acquisition_value    numeric     not null default 0,
  source_version      integer     not null default 0 check (source_version >= 0),
  source_hash         text        not null check (length(source_hash) = 64),
  payload             jsonb       not null default '{}'::jsonb,
  synced_at           timestamptz not null default now(),
  archived_at         timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> '')
);
create index if not exists idx_core_equipment_company_status
  on public.core_equipment(company_id, active, status);

create table if not exists public.core_equipment_owners (
  company_id  text        not null,
  id          text        not null,
  name        text        not null,
  owner_type  text        not null default 'terceiro',
  active      boolean     not null default true,
  source_hash text        not null check (length(source_hash) = 64),
  payload     jsonb       not null default '{}'::jsonb,
  synced_at   timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> '')
);

create table if not exists public.core_equipment_allocations (
  company_id      text        not null,
  id              text        not null,
  equipment_id    text        not null,
  project_id      text        not null,
  start_date      date        not null,
  end_date        date,
  status          text        not null default 'ativa',
  active          boolean     not null default true,
  source_version  integer     not null default 0 check (source_version >= 0),
  source_hash     text        not null check (length(source_hash) = 64),
  payload         jsonb       not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  archived_at     timestamptz,
  primary key (company_id, id),
  foreign key (company_id, equipment_id)
    references public.core_equipment(company_id, id) on delete restrict,
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> ''),
  check (end_date is null or end_date >= start_date)
);
create index if not exists idx_core_equipment_allocations_equipment_active
  on public.core_equipment_allocations(company_id, equipment_id, active);
create index if not exists idx_core_equipment_allocations_project_active
  on public.core_equipment_allocations(company_id, project_id, active);

create table if not exists public.core_equipment_maintenance_events (
  company_id    text        not null,
  id            text        not null,
  equipment_id  text        not null,
  project_id    text        not null,
  start_date    date        not null,
  end_date      date,
  cost          numeric     not null default 0,
  description   text        not null default '',
  status        text        not null default 'programada',
  source_hash   text        not null check (length(source_hash) = 64),
  payload       jsonb       not null default '{}'::jsonb,
  synced_at     timestamptz not null default now(),
  archived_at   timestamptz,
  primary key (company_id, id),
  foreign key (company_id, equipment_id)
    references public.core_equipment(company_id, id) on delete restrict,
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> ''),
  check (end_date is null or end_date >= start_date)
);
create index if not exists idx_core_equipment_maintenance_equipment
  on public.core_equipment_maintenance_events(company_id, equipment_id);

create table if not exists public.equipment_registry_shadow_runs (
  id             uuid primary key default gen_random_uuid(),
  company_id     text not null,
  schema_version integer not null,
  actor_id       text not null,
  result         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_equipment_registry_shadow_runs_company_created
  on public.equipment_registry_shadow_runs(company_id, created_at desc);

alter table public.core_equipment enable row level security;
alter table public.core_equipment_owners enable row level security;
alter table public.core_equipment_allocations enable row level security;
alter table public.core_equipment_maintenance_events enable row level security;
alter table public.equipment_registry_shadow_runs enable row level security;

revoke all on table public.core_equipment from public, anon, authenticated;
revoke all on table public.core_equipment_owners from public, anon, authenticated;
revoke all on table public.core_equipment_allocations from public, anon, authenticated;
revoke all on table public.core_equipment_maintenance_events from public, anon, authenticated;
revoke all on table public.equipment_registry_shadow_runs from public, anon, authenticated;

grant select, insert, update on table public.core_equipment to service_role;
grant select, insert, update on table public.core_equipment_owners to service_role;
grant select, insert, update on table public.core_equipment_allocations to service_role;
grant select, insert, update on table public.core_equipment_maintenance_events to service_role;
grant select, insert on table public.equipment_registry_shadow_runs to service_role;

create or replace function public.equipment_registry_sync_legacy(
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
    raise exception 'equipment_registry_invalid_actor_or_company' using errcode='22023';
  end if;
  if v_schema_version <> 1 or coalesce((p_snapshot->>'complete')::boolean, false) is not true then
    raise exception 'equipment_registry_invalid_snapshot' using errcode='22023';
  end if;

  -- Ordem importa: equipamento antes de alocação/manutenção (FK).
  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'equipment','[]'::jsonb))
  loop
    insert into public.core_equipment(
      company_id,id,name,category,asset_tag,status,active,owner_id,current_project_id,
      acquisition_value,source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'category',''),
      coalesce(v_item->>'assetTag',''),coalesce(v_item->>'status','disponivel'),
      coalesce((v_item->>'active')::boolean,true),nullif(v_item->>'ownerId',''),
      nullif(v_item->>'currentProjectId',''),coalesce((v_item->>'acquisitionValue')::numeric,0),
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,category=excluded.category,asset_tag=excluded.asset_tag,
      status=excluded.status,active=excluded.active,owner_id=excluded.owner_id,
      current_project_id=excluded.current_project_id,acquisition_value=excluded.acquisition_value,
      source_version=excluded.source_version,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'owners','[]'::jsonb))
  loop
    insert into public.core_equipment_owners(
      company_id,id,name,owner_type,active,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'ownerType','terceiro'),
      coalesce((v_item->>'active')::boolean,true),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,owner_type=excluded.owner_type,active=excluded.active,
      source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'allocations','[]'::jsonb))
  loop
    insert into public.core_equipment_allocations(
      company_id,id,equipment_id,project_id,start_date,end_date,status,active,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'equipmentId',v_item->>'projectId',
      (v_item->>'startDate')::date,nullif(v_item->>'endDate','')::date,
      coalesce(v_item->>'status','ativa'),coalesce((v_item->>'active')::boolean,true),
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      equipment_id=excluded.equipment_id,project_id=excluded.project_id,
      start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status,
      active=excluded.active,source_version=excluded.source_version,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'maintenanceEvents','[]'::jsonb))
  loop
    insert into public.core_equipment_maintenance_events(
      company_id,id,equipment_id,project_id,start_date,end_date,cost,description,status,
      source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'equipmentId',v_item->>'projectId',
      (v_item->>'startDate')::date,nullif(v_item->>'endDate','')::date,
      coalesce((v_item->>'cost')::numeric,0),coalesce(v_item->>'description',''),
      coalesce(v_item->>'status','programada'),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      equipment_id=excluded.equipment_id,project_id=excluded.project_id,
      start_date=excluded.start_date,end_date=excluded.end_date,cost=excluded.cost,
      description=excluded.description,status=excluded.status,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  -- Arquiva o que saiu do snapshot - ordem inversa da inserção (dependentes
  -- primeiro), embora "restrict" nunca deixaria isso importar de fato aqui
  -- (arquivar não apaga a linha).
  update public.core_equipment_maintenance_events row set archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'maintenanceEvents','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_equipment_allocations row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'allocations','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_equipment_owners row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'owners','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_equipment row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'equipment','[]'::jsonb)) item
      where item->>'id'=row.id
    );

  v_result := jsonb_build_object(
    'schemaVersion',v_schema_version,
    'equipment',jsonb_array_length(coalesce(p_snapshot->'equipment','[]'::jsonb)),
    'owners',jsonb_array_length(coalesce(p_snapshot->'owners','[]'::jsonb)),
    'allocations',jsonb_array_length(coalesce(p_snapshot->'allocations','[]'::jsonb)),
    'maintenanceEvents',jsonb_array_length(coalesce(p_snapshot->'maintenanceEvents','[]'::jsonb))
  );

  insert into public.equipment_registry_shadow_runs(
    company_id,schema_version,actor_id,result
  ) values (p_company_id,v_schema_version,p_actor_id,v_result);
  insert into public.audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values (
    p_company_id,'equipment_registry_shadow',p_company_id,'equipment_registry_shadow_synced',
    p_actor_id,'Sistema',gen_random_uuid(),'{}'::jsonb,v_result,'migration/009'
  );
  return v_result;
end;
$$;

revoke all on function public.equipment_registry_sync_legacy(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.equipment_registry_sync_legacy(text,text,jsonb)
  to service_role;

notify pgrst,'reload schema';
