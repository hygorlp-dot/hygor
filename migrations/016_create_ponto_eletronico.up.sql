-- PONTO-001: app "Ponto de Obra" (REP-P, Portaria MTP 671/2021) - 01/10/2026.
--
-- Tabelas próprias, fora do blob company_app_data: a gestão de ponto atual
-- (data.attendance) NÃO é tocada. Funcionários e obras continuam vindo da
-- base única do ARCD (data.employees / data.obras) - aqui só se guarda o que
-- é do relógio: aparelhos, marcações, biometria e responsáveis.
--
-- Garantias da Portaria materializadas no banco:
-- - ponto_marcacoes é append-only (trigger recusa UPDATE e DELETE);
-- - NSR por aparelho sem buracos e cada marcação apontando para o hash da
--   anterior: conferido dentro de ponto_registrar_marcacoes, com o aparelho
--   travado (for update) - dois envios simultâneos não furam a sequência.
-- Correção de ponto (fase 2) será anotação em tabela própria, nunca edição.

create extension if not exists pgcrypto;

create table if not exists public.ponto_dispositivos (
  company_id         text        not null,
  id                 uuid        not null default gen_random_uuid(),
  obra_id            text        not null,
  nome               text        not null,
  token_hash         text        not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status             text        not null default 'ativo' check (status in ('ativo','revogado')),
  app_versao         text        not null default '',
  aparelho           jsonb       not null default '{}'::jsonb,
  ultimo_contato_em  timestamptz,
  ultimo_gps         jsonb,
  ultimo_nsr         bigint      not null default 0 check (ultimo_nsr >= 0),
  ultimo_hash        text        not null default repeat('0', 64),
  criado_por         text        not null,
  criado_em          timestamptz not null default now(),
  revogado_por       text,
  revogado_em        timestamptz,
  primary key (company_id, id),
  unique (token_hash)
);
create index if not exists idx_ponto_dispositivos_obra on public.ponto_dispositivos(company_id, obra_id);

-- Código de pareamento de uso único (só o hash é guardado).
create table if not exists public.ponto_pareamentos (
  company_id     text        not null,
  codigo_hash    text        not null check (codigo_hash ~ '^[0-9a-f]{64}$'),
  obra_id        text        not null,
  nome           text        not null,
  expira_em      timestamptz not null,
  usado_em       timestamptz,
  dispositivo_id uuid,
  criado_por     text        not null,
  criado_em      timestamptz not null default now(),
  primary key (company_id, codigo_hash)
);

create table if not exists public.ponto_marcacoes (
  company_id        text        not null,
  id                uuid        not null,
  dispositivo_id    uuid        not null,
  obra_id           text        not null,
  nsr               bigint      not null check (nsr >= 1),
  tipo_registro     text        not null check (tipo_registro in ('ponto','acesso_terceiro')),
  employee_id       text,
  terceiro_id       text,
  cpf               text        not null default '',
  marcado_em        timestamptz not null,
  relogio_aparelho  timestamptz,
  hora_confiavel    boolean     not null,
  relogio_alterado  boolean     not null default false,
  metodo            text        not null check (metodo in ('facial','encarregado')),
  confianca         numeric     check (confianca is null or (confianca >= 0 and confianca <= 1)),
  encarregado_id    text,
  gps               jsonb,
  foto_sha256       text        check (foto_sha256 is null or foto_sha256 ~ '^[0-9a-f]{64}$'),
  hash_anterior     text        not null check (hash_anterior ~ '^[0-9a-f]{64}$'),
  hash              text        not null check (hash ~ '^[0-9a-f]{64}$'),
  versao_canonica   integer     not null default 1,
  recebido_em       timestamptz not null default now(),
  payload           jsonb       not null default '{}'::jsonb,
  primary key (company_id, id),
  unique (company_id, dispositivo_id, nsr),
  foreign key (company_id, dispositivo_id) references public.ponto_dispositivos(company_id, id) on delete restrict,
  check ((tipo_registro = 'ponto' and employee_id is not null) or (tipo_registro = 'acesso_terceiro' and terceiro_id is not null))
);
create index if not exists idx_ponto_marcacoes_obra_data on public.ponto_marcacoes(company_id, obra_id, marcado_em desc);
create index if not exists idx_ponto_marcacoes_funcionario on public.ponto_marcacoes(company_id, employee_id, marcado_em desc) where employee_id is not null;

create or replace function public.ponto_marcacao_imutavel() returns trigger language plpgsql as $$
begin raise exception 'ponto_marcacoes é append-only: marcação de ponto não pode ser alterada nem apagada (Portaria 671/2021)'; end;
$$;
drop trigger if exists ponto_marcacoes_no_update on public.ponto_marcacoes;
drop trigger if exists ponto_marcacoes_no_delete on public.ponto_marcacoes;
create trigger ponto_marcacoes_no_update before update on public.ponto_marcacoes for each row execute function public.ponto_marcacao_imutavel();
create trigger ponto_marcacoes_no_delete before delete on public.ponto_marcacoes for each row execute function public.ponto_marcacao_imutavel();

-- Biometria facial (dado sensível, LGPD): vetor do rosto + consentimento.
-- Versão mais recente por funcionário é a vigente. Diferente das marcações,
-- pode ser apagada (direito do titular / desligamento).
create table if not exists public.ponto_biometrias (
  company_id      text        not null,
  id              uuid        not null default gen_random_uuid(),
  employee_id     text        not null,
  modelo          text        not null,
  vetor           jsonb       not null check (jsonb_typeof(vetor) = 'array' and jsonb_array_length(vetor) between 64 and 1024),
  qualidade       numeric,
  fotos           jsonb       not null default '[]'::jsonb,
  consentimento   jsonb       not null check (consentimento ? 'termoVersao' and consentimento ? 'aceitoEm'),
  cadastrado_por  text        not null,
  dispositivo_id  uuid,
  criado_em       timestamptz not null default now(),
  primary key (company_id, id)
);
create index if not exists idx_ponto_biometrias_funcionario on public.ponto_biometrias(company_id, employee_id, criado_em desc);

-- Responsáveis da obra (encarregado/engenheiro) com PIN próprio do app -
-- separado do PIN do ARCD. Só o hash PBKDF2 é guardado e enviado ao aparelho.
create table if not exists public.ponto_responsaveis (
  company_id     text        not null,
  user_id        text        not null,
  nome           text        not null,
  pin_hash       text        not null check (pin_hash ~ '^[0-9a-f]{64}$'),
  pin_salt       text        not null,
  pin_iteracoes  integer     not null check (pin_iteracoes >= 10000),
  obras          jsonb       not null default '[]'::jsonb,
  ativo          boolean     not null default true,
  atualizado_por text        not null,
  atualizado_em  timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- Grava um lote de marcações de UM aparelho. A API já conferiu forma e hash
-- (src/domains/ponto-eletronico/marcacao.js); aqui se garante a sequência
-- sob trava: NSR = último + 1 e hash_anterior = hash do último aceito.
-- Reenvio do que já foi aceito é ignorado (idempotente).
create or replace function public.ponto_registrar_marcacoes(
  p_company_id text, p_dispositivo_id uuid, p_marcacoes jsonb
) returns table(aceitas integer, ultimo_nsr bigint, ultimo_hash text, erro text)
language plpgsql security definer set search_path = public as $$
declare
  v_disp public.ponto_dispositivos%rowtype;
  v_m jsonb;
  v_nsr bigint;
  v_aceitas integer := 0;
  v_erro text := null;
begin
  select * into v_disp from public.ponto_dispositivos
   where company_id = p_company_id and id = p_dispositivo_id for update;
  if not found then
    return query select 0, 0::bigint, ''::text, 'aparelho não encontrado'::text; return;
  end if;
  if v_disp.status <> 'ativo' then
    return query select 0, v_disp.ultimo_nsr, v_disp.ultimo_hash, 'aparelho revogado'::text; return;
  end if;

  for v_m in select value from jsonb_array_elements(coalesce(p_marcacoes, '[]'::jsonb)) order by (value->>'nsr')::bigint loop
    v_nsr := (v_m->>'nsr')::bigint;
    if v_nsr <= v_disp.ultimo_nsr then continue; end if;
    if v_nsr <> v_disp.ultimo_nsr + 1 then
      v_erro := format('NSR %s chegou antes do %s - lacuna na sequência', v_nsr, v_disp.ultimo_nsr + 1); exit;
    end if;
    if lower(v_m->>'hashAnterior') <> v_disp.ultimo_hash then
      v_erro := format('NSR %s não aponta para a marcação anterior (cadeia quebrada)', v_nsr); exit;
    end if;
    insert into public.ponto_marcacoes(
      company_id, id, dispositivo_id, obra_id, nsr, tipo_registro, employee_id, terceiro_id, cpf,
      marcado_em, relogio_aparelho, hora_confiavel, relogio_alterado, metodo, confianca, encarregado_id,
      gps, foto_sha256, hash_anterior, hash, versao_canonica, payload
    ) values (
      p_company_id, (v_m->>'id')::uuid, p_dispositivo_id, v_disp.obra_id, v_nsr,
      coalesce(nullif(v_m->>'tipoRegistro', ''), 'ponto'), nullif(v_m->>'employeeId', ''), nullif(v_m->>'terceiroId', ''),
      coalesce(v_m->>'cpf', ''), (v_m->>'marcadoEm')::timestamptz, nullif(v_m->>'relogioAparelho', '')::timestamptz,
      coalesce((v_m->>'horaConfiavel')::boolean, false), coalesce((v_m->>'relogioAlterado')::boolean, false),
      v_m->>'metodo', nullif(v_m->>'confianca', '')::numeric, nullif(v_m->>'encarregadoId', ''),
      case when jsonb_typeof(v_m->'gps') = 'object' then v_m->'gps' else null end,
      nullif(lower(v_m->>'fotoSha256'), ''), lower(v_m->>'hashAnterior'), lower(v_m->>'hash'),
      coalesce((v_m->>'versaoCanonica')::integer, 1), coalesce(v_m->'extra', '{}'::jsonb)
    );
    v_disp.ultimo_nsr := v_nsr;
    v_disp.ultimo_hash := lower(v_m->>'hash');
    v_aceitas := v_aceitas + 1;
  end loop;

  update public.ponto_dispositivos
     set ultimo_nsr = v_disp.ultimo_nsr, ultimo_hash = v_disp.ultimo_hash, ultimo_contato_em = now()
   where company_id = p_company_id and id = p_dispositivo_id;
  return query select v_aceitas, v_disp.ultimo_nsr, v_disp.ultimo_hash, v_erro;
end $$;

-- Fotos das marcações e do cadastro facial: bucket PRIVADO (acesso só por
-- link assinado gerado pela API). O schema storage só existe no Supabase.
-- Se a permissão para criar o bucket faltar, vira aviso (o deploy não pode
-- cair por isso); scripts/apply-ponto-eletronico.mjs avisa e o bucket pode
-- ser criado no painel do Supabase com o mesmo nome.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    begin
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('ponto-obra', 'ponto-obra', false, 2097152, array['image/jpeg'])
      on conflict (id) do nothing;
    exception when others then
      raise notice 'ponto-obra: bucket não criado (%). Crie no painel do Supabase como privado.', sqlerrm;
    end;
  end if;
end $$;

alter table public.ponto_dispositivos enable row level security;
alter table public.ponto_pareamentos  enable row level security;
alter table public.ponto_marcacoes    enable row level security;
alter table public.ponto_biometrias   enable row level security;
alter table public.ponto_responsaveis enable row level security;
revoke all on table public.ponto_dispositivos, public.ponto_pareamentos, public.ponto_marcacoes,
  public.ponto_biometrias, public.ponto_responsaveis from public, anon, authenticated;
revoke all on function public.ponto_registrar_marcacoes(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ponto_registrar_marcacoes(text, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
