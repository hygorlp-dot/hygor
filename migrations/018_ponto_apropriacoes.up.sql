-- PONTO-003: funcionário global e APROPRIAÇÃO de jornada por obra
-- (01/10/2026). Forward-only e idempotente. NÃO toca na ARP (017) nem no
-- legado (016).
--
-- Três "obras" diferentes (docs/REP-P-ARQUITETURA.md):
--   - lotação administrativa: employee.obra no cadastro do ARCD - informativa;
--   - obra de CAPTURA: ponto_eventos.obra_id - obra do aparelho onde a batida
--     aconteceu. Parte do registro imutável da ARP. Nunca é corrigida;
--   - obra APROPRIADA: ponto_apropriacoes - a que recebe cada intervalo de
--     trabalho no tratamento do ponto. Fora da ARP, corrigível, auditada.
-- Um funcionário pode ter VÁRIAS obras no mesmo dia (intervalos), por isso
-- não existe "funcionário + dia -> uma obra".

create extension if not exists pgcrypto;

comment on column public.ponto_eventos.obra_id is
  'Obra de CAPTURA: obra do aparelho onde a batida aconteceu. Não é a lotação do funcionário nem a obra apropriada (ponto_apropriacoes).';
comment on column public.ponto_marcacoes.obra_id is
  'LEGADO formato 1. Obra de CAPTURA: obra do aparelho onde a batida aconteceu.';

create table if not exists public.ponto_apropriacoes (
  company_id          text        not null,
  id                  uuid        not null default gen_random_uuid(),
  employee_id         text        not null,
  data                date        not null,                       -- dia civil da jornada
  inicio              timestamptz not null,
  fim                 timestamptz not null,
  obra_apropriada_id  text        not null,
  origem              text        not null check (origem in ('proposta_capturas','manual')),
  status              text        not null default 'ativa' check (status in ('ativa','cancelada')),
  motivo              text,
  responsavel_id      text        not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  version             integer     not null default 1 check (version >= 1),
  primary key (company_id, id),
  check (fim > inicio),
  check (fim - inicio <= interval '24 hours')
);
create index if not exists idx_ponto_apropriacoes_func_dia on public.ponto_apropriacoes(company_id, employee_id, data);
create index if not exists idx_ponto_apropriacoes_obra_dia on public.ponto_apropriacoes(company_id, obra_apropriada_id, data);

-- Toda criação, alteração e cancelamento: valor anterior, novo, quem, quando,
-- por quê. Só se acrescenta.
create table if not exists public.ponto_apropriacoes_auditoria (
  company_id      text        not null,
  id              uuid        not null default gen_random_uuid(),
  apropriacao_id  uuid        not null,
  acao            text        not null check (acao in ('criada','alterada','cancelada')),
  antes           jsonb,
  depois          jsonb       not null,
  responsavel_id  text        not null,
  motivo          text,
  em              timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, apropriacao_id) references public.ponto_apropriacoes(company_id, id) on delete restrict
);
create index if not exists idx_ponto_aprop_auditoria on public.ponto_apropriacoes_auditoria(company_id, apropriacao_id, em);

-- Escrita só pelas funções abaixo (marca da transação); auditoria imutável.
create or replace function public.ponto_apropriacao_somente_pela_funcao() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('ponto.apropriacao', true), '') <> 'sim' then
    raise exception '% só muda pelas funções de apropriação (ponto_apropriacao_salvar/cancelar)', tg_table_name;
  end if;
  if tg_op = 'DELETE' then raise exception 'apropriação não se apaga: cancele com motivo'; end if;
  return new;
end $$;
drop trigger if exists ponto_apropriacoes_so_funcao on public.ponto_apropriacoes;
create trigger ponto_apropriacoes_so_funcao before insert or update or delete on public.ponto_apropriacoes
  for each row execute function public.ponto_apropriacao_somente_pela_funcao();

drop trigger if exists ponto_aprop_auditoria_no_update on public.ponto_apropriacoes_auditoria;
drop trigger if exists ponto_aprop_auditoria_no_delete on public.ponto_apropriacoes_auditoria;
drop trigger if exists ponto_aprop_auditoria_no_truncate on public.ponto_apropriacoes_auditoria;
drop trigger if exists ponto_aprop_auditoria_so_funcao on public.ponto_apropriacoes_auditoria;
create trigger ponto_aprop_auditoria_no_update before update on public.ponto_apropriacoes_auditoria for each row execute function public.ponto_arp_imutavel();
create trigger ponto_aprop_auditoria_no_delete before delete on public.ponto_apropriacoes_auditoria for each row execute function public.ponto_arp_imutavel();
create trigger ponto_aprop_auditoria_no_truncate before truncate on public.ponto_apropriacoes_auditoria for each statement execute function public.ponto_arp_imutavel();
create trigger ponto_aprop_auditoria_so_funcao before insert on public.ponto_apropriacoes_auditoria
  for each row execute function public.ponto_apropriacao_somente_pela_funcao();
drop trigger if exists ponto_apropriacoes_no_truncate on public.ponto_apropriacoes;
create trigger ponto_apropriacoes_no_truncate before truncate on public.ponto_apropriacoes for each statement execute function public.ponto_arp_imutavel();

-- Cria (p_id nulo) ou altera uma apropriação. Trava por funcionário, recusa
-- sobreposição com outra apropriação ativa dele, confere a versão e exige
-- motivo em toda alteração. Grava a auditoria na mesma transação.
create or replace function public.ponto_apropriacao_salvar(
  p_company_id text, p_id uuid, p_employee_id text, p_data date, p_inicio timestamptz, p_fim timestamptz,
  p_obra_apropriada_id text, p_origem text, p_responsavel_id text, p_motivo text, p_versao_esperada integer
) returns table(id uuid, version integer)
language plpgsql security definer set search_path = public as $$
declare
  v_atual public.ponto_apropriacoes%rowtype;
  v_novo  public.ponto_apropriacoes%rowtype;
  v_id    uuid := coalesce(p_id, gen_random_uuid());
begin
  perform set_config('ponto.apropriacao', 'sim', true);
  perform pg_advisory_xact_lock(hashtextextended(p_company_id || '|' || p_employee_id, 0));
  if p_id is not null then
    select * into v_atual from public.ponto_apropriacoes a where a.company_id = p_company_id and a.id = p_id for update;
    if not found then raise exception 'apropriação não encontrada'; end if;
    if v_atual.status <> 'ativa' then raise exception 'apropriação cancelada não pode ser alterada'; end if;
    if v_atual.employee_id <> p_employee_id then raise exception 'a apropriação é de outro funcionário'; end if;
    if v_atual.version <> coalesce(p_versao_esperada, -1) then raise exception 'a apropriação foi alterada por outra pessoa (versão %)', v_atual.version; end if;
    if length(btrim(coalesce(p_motivo, ''))) = 0 then raise exception 'informe o motivo da alteração da apropriação'; end if;
  end if;
  if exists (
    select 1 from public.ponto_apropriacoes a
     where a.company_id = p_company_id and a.employee_id = p_employee_id and a.status = 'ativa' and a.id <> v_id
       and tstzrange(a.inicio, a.fim, '[)') && tstzrange(p_inicio, p_fim, '[)')
  ) then
    raise exception 'o intervalo se sobrepõe a outra apropriação do mesmo funcionário';
  end if;

  if p_id is null then
    insert into public.ponto_apropriacoes(company_id, id, employee_id, data, inicio, fim, obra_apropriada_id, origem, motivo, responsavel_id)
    values (p_company_id, v_id, p_employee_id, p_data, p_inicio, p_fim, p_obra_apropriada_id, p_origem, nullif(btrim(coalesce(p_motivo, '')), ''), p_responsavel_id)
    returning * into v_novo;
    insert into public.ponto_apropriacoes_auditoria(company_id, apropriacao_id, acao, antes, depois, responsavel_id, motivo)
    values (p_company_id, v_id, 'criada', null, to_jsonb(v_novo), p_responsavel_id, v_novo.motivo);
  else
    update public.ponto_apropriacoes a
       set data = p_data, inicio = p_inicio, fim = p_fim, obra_apropriada_id = p_obra_apropriada_id, origem = p_origem,
           motivo = btrim(p_motivo), responsavel_id = p_responsavel_id, atualizado_em = now(), version = a.version + 1
     where a.company_id = p_company_id and a.id = p_id
    returning * into v_novo;
    insert into public.ponto_apropriacoes_auditoria(company_id, apropriacao_id, acao, antes, depois, responsavel_id, motivo)
    values (p_company_id, p_id, 'alterada', to_jsonb(v_atual), to_jsonb(v_novo), p_responsavel_id, btrim(p_motivo));
  end if;
  return query select v_novo.id, v_novo.version;
end $$;

create or replace function public.ponto_apropriacao_cancelar(
  p_company_id text, p_id uuid, p_responsavel_id text, p_motivo text, p_versao_esperada integer
) returns table(id uuid, version integer)
language plpgsql security definer set search_path = public as $$
declare
  v_atual public.ponto_apropriacoes%rowtype;
  v_novo  public.ponto_apropriacoes%rowtype;
begin
  perform set_config('ponto.apropriacao', 'sim', true);
  if length(btrim(coalesce(p_motivo, ''))) = 0 then raise exception 'informe o motivo do cancelamento da apropriação'; end if;
  select * into v_atual from public.ponto_apropriacoes a where a.company_id = p_company_id and a.id = p_id for update;
  if not found then raise exception 'apropriação não encontrada'; end if;
  if v_atual.status <> 'ativa' then raise exception 'apropriação já cancelada'; end if;
  if v_atual.version <> coalesce(p_versao_esperada, -1) then raise exception 'a apropriação foi alterada por outra pessoa (versão %)', v_atual.version; end if;
  update public.ponto_apropriacoes a set status = 'cancelada', motivo = btrim(p_motivo), responsavel_id = p_responsavel_id,
         atualizado_em = now(), version = a.version + 1
   where a.company_id = p_company_id and a.id = p_id
  returning * into v_novo;
  insert into public.ponto_apropriacoes_auditoria(company_id, apropriacao_id, acao, antes, depois, responsavel_id, motivo)
  values (p_company_id, p_id, 'cancelada', to_jsonb(v_atual), to_jsonb(v_novo), p_responsavel_id, btrim(p_motivo));
  return query select v_novo.id, v_novo.version;
end $$;

alter table public.ponto_apropriacoes            enable row level security;
alter table public.ponto_apropriacoes_auditoria  enable row level security;
do $$
declare papel text;
begin
  foreach papel in array array['anon','authenticated','service_role'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on table public.ponto_apropriacoes, public.ponto_apropriacoes_auditoria from %I', papel);
      execute format('revoke all on function public.ponto_apropriacao_salvar(text, uuid, text, date, timestamptz, timestamptz, text, text, text, text, integer) from %I', papel);
      execute format('revoke all on function public.ponto_apropriacao_cancelar(text, uuid, text, text, integer) from %I', papel);
    end if;
  end loop;
  revoke all on table public.ponto_apropriacoes, public.ponto_apropriacoes_auditoria from public;
  revoke all on function public.ponto_apropriacao_salvar(text, uuid, text, date, timestamptz, timestamptz, text, text, text, text, integer) from public;
  revoke all on function public.ponto_apropriacao_cancelar(text, uuid, text, text, integer) from public;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.ponto_apropriacoes, public.ponto_apropriacoes_auditoria to service_role;
    grant execute on function public.ponto_apropriacao_salvar(text, uuid, text, date, timestamptz, timestamptz, text, text, text, text, integer) to service_role;
    grant execute on function public.ponto_apropriacao_cancelar(text, uuid, text, text, integer) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
