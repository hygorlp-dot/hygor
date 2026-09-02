-- CORE-004: ponto (attendance) em modo sombra - mesmo padrão das
-- migrations 007/009/014 (CORE-001/002/003). Não remove nem altera
-- company_app_data e não troca a leitura/escrita do aplicativo.
--
-- Diferença deliberada em relação aos outros três domínios: o blob legado
-- de `data.attendance` já NÃO é uma linha só - desde a Fase 1.5 reduzida
-- (22/08/2026, ver server/attendance-obra-routing.js), ele é particionado
-- em uma linha por obra e reconstruído por merge na leitura. Um bug real
-- de produção (02/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md)
-- nasceu exatamente dessa reconstrução por merge ser dependente de ordem.
-- `core_attendance_records` é o desenho oposto: UMA linha por
-- (funcionário,data), sem partição nenhuma - a existência mesma da tabela
-- já elimina essa classe de bug por construção. Em modo sombra por
-- enquanto (só projeção/comparação); o corte para se tornar a escrita
-- real é decisão separada, feita só depois de sinal acumulado em
-- produção (mesmo critério já usado para CORE-001/002/003).
--
-- Escopo: um registro por dia com status (P/M/F) - dias "sem registro"
-- nunca existiram no blob e não têm linha aqui (não é "arquivado", é
-- "nunca aconteceu"). Um dia limpo pelo usuário (tombstone no blob) some
-- do snapshot na próxima sincronização e a linha correspondente é
-- arquivada, nunca apagada de verdade - mesma disciplina de
-- core_equipment/core_equipment_allocations.

create table if not exists public.core_attendance_records (
  company_id      text        not null,
  id              text        not null,
  employee_id     text        not null,
  project_id      text,
  record_date     date        not null,
  status          text        not null check (status in ('P','M','F')),
  ot              numeric     not null default 0,
  worked_minutes  integer     not null default 0,
  atraso_min      integer     not null default 0,
  note            text        not null default '',
  source_hash     text        not null check (length(source_hash) = 64),
  payload         jsonb       not null default '{}'::jsonb,
  synced_at       timestamptz not null default now(),
  archived_at     timestamptz,
  primary key (company_id, id),
  foreign key (company_id, employee_id)
    references public.core_employees(company_id, id) on delete restrict,
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> ''),
  check (id = employee_id || '__' || record_date::text)
);
create index if not exists idx_core_attendance_records_employee_date
  on public.core_attendance_records(company_id, employee_id, record_date);
create index if not exists idx_core_attendance_records_project_date
  on public.core_attendance_records(company_id, project_id, record_date)
  where project_id is not null;

create table if not exists public.attendance_registry_shadow_runs (
  id             uuid primary key default gen_random_uuid(),
  company_id     text not null,
  schema_version integer not null,
  actor_id       text not null,
  result         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_attendance_registry_shadow_runs_company_created
  on public.attendance_registry_shadow_runs(company_id, created_at desc);

alter table public.core_attendance_records enable row level security;
alter table public.attendance_registry_shadow_runs enable row level security;

revoke all on table public.core_attendance_records from public, anon, authenticated;
revoke all on table public.attendance_registry_shadow_runs from public, anon, authenticated;

grant select, insert, update on table public.core_attendance_records to service_role;
grant select, insert on table public.attendance_registry_shadow_runs to service_role;

create or replace function public.attendance_registry_sync_legacy(
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
    raise exception 'attendance_registry_invalid_actor_or_company' using errcode='22023';
  end if;
  if v_schema_version <> 1 or coalesce((p_snapshot->>'complete')::boolean, false) is not true then
    raise exception 'attendance_registry_invalid_snapshot' using errcode='22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot->'records','[]'::jsonb))
  loop
    insert into public.core_attendance_records(
      company_id,id,employee_id,project_id,record_date,status,ot,worked_minutes,atraso_min,
      note,source_hash,payload,synced_at,archived_at
    ) values (
      p_company_id,v_item->>'id',v_item->>'employeeId',nullif(v_item->>'projectId',''),
      (v_item->>'date')::date,v_item->>'status',coalesce((v_item->>'ot')::numeric,0),
      coalesce((v_item->>'workedMinutes')::integer,0),coalesce((v_item->>'atrasoMin')::integer,0),
      coalesce(v_item->>'note',''),v_item->>'sourceHash',coalesce(v_item->'payload','{}'::jsonb),
      v_now,null
    )
    on conflict (company_id,id) do update set
      employee_id=excluded.employee_id,project_id=excluded.project_id,
      record_date=excluded.record_date,status=excluded.status,ot=excluded.ot,
      worked_minutes=excluded.worked_minutes,atraso_min=excluded.atraso_min,note=excluded.note,
      source_hash=excluded.source_hash,payload=excluded.payload,
      synced_at=excluded.synced_at,archived_at=null;
  end loop;

  -- Arquiva o que saiu do snapshot (dia limpo pelo usuário, ou funcionário/
  -- registro que deixou de existir) - nunca apaga a linha de verdade.
  update public.core_attendance_records row set archived_at=v_now,synced_at=v_now
  where row.company_id=p_company_id and row.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot->'records','[]'::jsonb)) item
      where item->>'id'=row.id
    );

  v_result := jsonb_build_object(
    'schemaVersion',v_schema_version,
    'records',jsonb_array_length(coalesce(p_snapshot->'records','[]'::jsonb))
  );

  insert into public.attendance_registry_shadow_runs(
    company_id,schema_version,actor_id,result
  ) values (p_company_id,v_schema_version,p_actor_id,v_result);
  insert into public.audit_events(
    company_id,aggregate_type,aggregate_id,action,actor_id,actor_name,
    correlation_id,before_snapshot,after_snapshot,source
  ) values (
    p_company_id,'attendance_registry_shadow',p_company_id,'attendance_registry_shadow_synced',
    p_actor_id,'Sistema',gen_random_uuid(),'{}'::jsonb,v_result,'migration/015'
  );
  return v_result;
end;
$$;

revoke all on function public.attendance_registry_sync_legacy(text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.attendance_registry_sync_legacy(text,text,jsonb)
  to service_role;

notify pgrst,'reload schema';
