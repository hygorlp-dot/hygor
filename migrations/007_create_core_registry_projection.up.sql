-- Fundação normalizada de cadastros em modo sombra.
-- Não remove nem altera company_app_data e não troca a leitura do aplicativo.

create table if not exists public.core_projects (
  company_id text not null,
  id text not null,
  name text not null,
  code text not null default '',
  status text not null default 'active',
  active boolean not null default true,
  engineer_id text,
  start_date date,
  end_date date,
  source_version integer not null default 0 check (source_version >= 0),
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> '')
);
create index if not exists idx_core_projects_company_status
  on public.core_projects(company_id, active, status);

create table if not exists public.core_employees (
  company_id text not null,
  id text not null,
  name text not null,
  role_title text not null default '',
  work_area text not null default 'campo'
    check (work_area in ('campo','administrativo')),
  active boolean not null default true,
  start_date date,
  end_date date,
  source_version integer not null default 0 check (source_version >= 0),
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> ''),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists idx_core_employees_company_active
  on public.core_employees(company_id, active, work_area);

create table if not exists public.core_employee_assignments (
  company_id text not null,
  employee_id text not null,
  project_id text not null,
  assignment_type text not null default 'primary',
  active boolean not null default true,
  valid_from date,
  valid_to date,
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, employee_id, project_id),
  foreign key (company_id, employee_id)
    references public.core_employees(company_id, id) on delete restrict,
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index if not exists idx_core_employee_assignments_project_active
  on public.core_employee_assignments(company_id, project_id, active);

create table if not exists public.core_employee_identifiers (
  company_id text not null,
  employee_id text not null,
  identifier_type text not null check (identifier_type in ('cpf','pix')),
  normalized_value text not null,
  display_value text not null default '',
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, employee_id, identifier_type, normalized_value),
  foreign key (company_id, employee_id)
    references public.core_employees(company_id, id) on delete restrict,
  check (btrim(normalized_value) <> '')
);
create index if not exists idx_core_employee_identifiers_lookup
  on public.core_employee_identifiers(company_id, identifier_type, normalized_value)
  where archived_at is null;

create table if not exists public.core_suppliers (
  company_id text not null,
  id text not null,
  name text not null,
  tax_id text not null default '',
  active boolean not null default true,
  categories jsonb not null default '[]'::jsonb
    check (jsonb_typeof(categories) = 'array'),
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> '')
);
create index if not exists idx_core_suppliers_company_active
  on public.core_suppliers(company_id, active, name);
create index if not exists idx_core_suppliers_tax_id
  on public.core_suppliers(company_id, tax_id)
  where tax_id <> '' and archived_at is null;

create table if not exists public.core_third_party_profiles (
  company_id text not null,
  id text not null,
  name text not null,
  person_type text not null default 'PJ'
    check (person_type in ('PF','PJ')),
  tax_id text not null default '',
  active boolean not null default true,
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  check (btrim(id) <> ''),
  check (btrim(name) <> '')
);
create index if not exists idx_core_third_party_profiles_tax_id
  on public.core_third_party_profiles(company_id, tax_id)
  where tax_id <> '' and archived_at is null;

create table if not exists public.core_third_party_contracts (
  company_id text not null,
  id text not null,
  profile_id text not null,
  project_id text not null,
  specialty text not null default '',
  status text not null default 'andamento',
  active boolean not null default true,
  start_date date,
  end_date date,
  source_version integer not null default 0 check (source_version >= 0),
  source_hash text not null check (length(source_hash) = 64),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  archived_at timestamptz,
  primary key (company_id, id),
  foreign key (company_id, profile_id)
    references public.core_third_party_profiles(company_id, id) on delete restrict,
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> ''),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists idx_core_third_party_contracts_project_status
  on public.core_third_party_contracts(company_id, project_id, active, status);

create table if not exists public.core_registry_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  schema_version integer not null,
  actor_id text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_core_registry_shadow_runs_company_created
  on public.core_registry_shadow_runs(company_id, created_at desc);

alter table public.core_projects enable row level security;
alter table public.core_employees enable row level security;
alter table public.core_employee_assignments enable row level security;
alter table public.core_employee_identifiers enable row level security;
alter table public.core_suppliers enable row level security;
alter table public.core_third_party_profiles enable row level security;
alter table public.core_third_party_contracts enable row level security;
alter table public.core_registry_shadow_runs enable row level security;

revoke all on table public.core_projects from public, anon, authenticated;
revoke all on table public.core_employees from public, anon, authenticated;
revoke all on table public.core_employee_assignments from public, anon, authenticated;
revoke all on table public.core_employee_identifiers from public, anon, authenticated;
revoke all on table public.core_suppliers from public, anon, authenticated;
revoke all on table public.core_third_party_profiles from public, anon, authenticated;
revoke all on table public.core_third_party_contracts from public, anon, authenticated;
revoke all on table public.core_registry_shadow_runs from public, anon, authenticated;

grant select, insert, update on table public.core_projects to service_role;
grant select, insert, update on table public.core_employees to service_role;
grant select, insert, update on table public.core_employee_assignments to service_role;
grant select, insert, update on table public.core_employee_identifiers to service_role;
grant select, insert, update on table public.core_suppliers to service_role;
grant select, insert, update on table public.core_third_party_profiles to service_role;
grant select, insert, update on table public.core_third_party_contracts to service_role;
grant select, insert on table public.core_registry_shadow_runs to service_role;

create or replace function public.core_registry_sync_legacy(
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
    raise exception 'core_registry_invalid_actor_or_company' using errcode='22023';
  end if;
  if v_schema_version <> 1 or coalesce((p_snapshot->>'complete')::boolean, false) is not true then
    raise exception 'core_registry_invalid_snapshot' using errcode='22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'projects','[]'::jsonb))
  loop
    insert into public.core_projects(
      company_id,id,name,code,status,active,engineer_id,start_date,end_date,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'code',''),
      coalesce(v_item->>'status','active'),coalesce((v_item->>'active')::boolean,true),
      nullif(v_item->>'engineerId',''),nullif(v_item->>'startDate','')::date,
      nullif(v_item->>'endDate','')::date,
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,code=excluded.code,status=excluded.status,active=excluded.active,
      engineer_id=excluded.engineer_id,start_date=excluded.start_date,end_date=excluded.end_date,
      source_version=excluded.source_version,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'employees','[]'::jsonb))
  loop
    insert into public.core_employees(
      company_id,id,name,role_title,work_area,active,start_date,end_date,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'roleTitle',''),
      coalesce(v_item->>'workArea','campo'),coalesce((v_item->>'active')::boolean,true),
      nullif(v_item->>'startDate','')::date,nullif(v_item->>'endDate','')::date,
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,role_title=excluded.role_title,work_area=excluded.work_area,
      active=excluded.active,start_date=excluded.start_date,end_date=excluded.end_date,
      source_version=excluded.source_version,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'employeeAssignments','[]'::jsonb))
  loop
    insert into public.core_employee_assignments(
      company_id,employee_id,project_id,assignment_type,active,valid_from,valid_to,
      source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'employeeId',v_item->>'projectId',
      coalesce(v_item->>'assignmentType','primary'),coalesce((v_item->>'active')::boolean,true),
      nullif(v_item->>'validFrom','')::date,nullif(v_item->>'validTo','')::date,
      v_item->>'sourceHash',coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,employee_id,project_id) do update set
      assignment_type=excluded.assignment_type,active=excluded.active,
      valid_from=excluded.valid_from,valid_to=excluded.valid_to,
      source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'employeeIdentifiers','[]'::jsonb))
  loop
    insert into public.core_employee_identifiers(
      company_id,employee_id,identifier_type,normalized_value,display_value,
      source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'employeeId',v_item->>'identifierType',
      v_item->>'normalizedValue',coalesce(v_item->>'displayValue',''),
      v_item->>'sourceHash',coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,employee_id,identifier_type,normalized_value) do update set
      display_value=excluded.display_value,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'suppliers','[]'::jsonb))
  loop
    insert into public.core_suppliers(
      company_id,id,name,tax_id,active,categories,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'taxId',''),
      coalesce((v_item->>'active')::boolean,true),coalesce(v_item->'categories','[]'::jsonb),
      v_item->>'sourceHash',coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,tax_id=excluded.tax_id,active=excluded.active,
      categories=excluded.categories,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'thirdPartyProfiles','[]'::jsonb))
  loop
    insert into public.core_third_party_profiles(
      company_id,id,name,person_type,tax_id,active,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'personType','PJ'),
      coalesce(v_item->>'taxId',''),coalesce((v_item->>'active')::boolean,true),
      v_item->>'sourceHash',coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      name=excluded.name,person_type=excluded.person_type,tax_id=excluded.tax_id,
      active=excluded.active,source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'thirdPartyContracts','[]'::jsonb))
  loop
    insert into public.core_third_party_contracts(
      company_id,id,profile_id,project_id,specialty,status,active,start_date,end_date,
      source_version,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'profileId',v_item->>'projectId',
      coalesce(v_item->>'specialty',''),coalesce(v_item->>'status','andamento'),
      coalesce((v_item->>'active')::boolean,true),nullif(v_item->>'startDate','')::date,
      nullif(v_item->>'endDate','')::date,
      coalesce((v_item->>'sourceVersion')::integer,0),v_item->>'sourceHash',
      coalesce(v_item->'payload','{}'::jsonb),v_now,null
    )
    on conflict (company_id,id) do update set
      profile_id=excluded.profile_id,project_id=excluded.project_id,
      specialty=excluded.specialty,status=excluded.status,active=excluded.active,
      start_date=excluded.start_date,end_date=excluded.end_date,
      source_version=excluded.source_version,source_hash=excluded.source_hash,
      payload=excluded.payload,synced_at=excluded.synced_at,archived_at=null;
  end loop;

  update public.core_employee_assignments row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'employeeAssignments','[]'::jsonb)) item
      where item->>'employeeId'=row.employee_id and item->>'projectId'=row.project_id
    );
  update public.core_employee_identifiers row set archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'employeeIdentifiers','[]'::jsonb)) item
      where item->>'employeeId'=row.employee_id
        and item->>'identifierType'=row.identifier_type
        and item->>'normalizedValue'=row.normalized_value
    );
  update public.core_third_party_contracts row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'thirdPartyContracts','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_third_party_profiles row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'thirdPartyProfiles','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_suppliers row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'suppliers','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_employees row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'employees','[]'::jsonb)) item
      where item->>'id'=row.id
    );
  update public.core_projects row set
    active=false,archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'projects','[]'::jsonb)) item
      where item->>'id'=row.id
    );

  v_result := jsonb_build_object(
    'schemaVersion',v_schema_version,
    'projects',jsonb_array_length(coalesce(p_snapshot->'projects','[]'::jsonb)),
    'employees',jsonb_array_length(coalesce(p_snapshot->'employees','[]'::jsonb)),
    'employeeAssignments',jsonb_array_length(coalesce(p_snapshot->'employeeAssignments','[]'::jsonb)),
    'employeeIdentifiers',jsonb_array_length(coalesce(p_snapshot->'employeeIdentifiers','[]'::jsonb)),
    'suppliers',jsonb_array_length(coalesce(p_snapshot->'suppliers','[]'::jsonb)),
    'thirdPartyProfiles',jsonb_array_length(coalesce(p_snapshot->'thirdPartyProfiles','[]'::jsonb)),
    'thirdPartyContracts',jsonb_array_length(coalesce(p_snapshot->'thirdPartyContracts','[]'::jsonb))
  );

  insert into public.core_registry_shadow_runs(
    company_id,schema_version,actor_id,result
  ) values (p_company_id,v_schema_version,p_actor_id,v_result);
  insert into public.audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values (
    p_company_id,'core_registry_shadow',p_company_id,'core_registry_shadow_synced',
    p_actor_id,'Sistema',gen_random_uuid(),'{}'::jsonb,v_result,'migration/007'
  );
  return v_result;
end;
$$;

revoke all on function public.core_registry_sync_legacy(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.core_registry_sync_legacy(text,text,jsonb)
  to service_role;

notify pgrst,'reload schema';
