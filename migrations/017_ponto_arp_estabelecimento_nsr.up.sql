-- PONTO-002: REP-P Fase 1 - estabelecimento fiscal, ARP e NSR por
-- estabelecimento (01/10/2026). Forward-only e idempotente. NÃO altera a
-- migration 016 nem reescreve dados existentes.
--
-- Modelo (docs/REP-P-ARQUITETURA.md):
-- - ponto_marcacoes (016) vira LEGADO formato 1: "nsr" ali é a sequência do
--   APARELHO, não o NSR fiscal. Continua recebendo envios de apps antigos.
-- - ponto_eventos: ingresso imutável de TODO evento formato 2 vindo dos
--   aparelhos (sequência local + cadeia de hash por aparelho, idempotente
--   por event_id). Inclui acessos de terceirizados (fora do NSR).
-- - ponto_arp_registros: registro fiscal da ARP - NSR por ESTABELECIMENTO,
--   atribuído só aqui (ponto_arp_registrar), com hash fiscal encadeado.
-- - ponto_arp_contadores: último NSR e último hash fiscal por estabelecimento,
--   travado com SELECT ... FOR UPDATE dentro da mesma transação.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- estabelecimento
create table if not exists public.ponto_estabelecimentos (
  company_id        text        not null,
  id                uuid        not null default gen_random_uuid(),
  nome              text        not null check (length(btrim(nome)) between 1 and 150),
  tipo_inscricao    text        check (tipo_inscricao in ('cnpj','cpf')),
  numero_inscricao  text,
  cno               text        check (cno is null or cno ~ '^[0-9]{12}$'),
  caepf             text        check (caepf is null or caepf ~ '^[0-9]{14}$'),
  cei               text        check (cei is null or cei ~ '^[0-9]{12}$'),
  timezone          text        not null default 'America/Recife' check (length(btrim(timezone)) > 0),
  ativo             boolean     not null default true,
  criado_por        text        not null,
  criado_em         timestamptz not null default now(),
  atualizado_por    text,
  atualizado_em     timestamptz,
  primary key (company_id, id),
  -- Inscrição: as duas partes juntas ou nenhuma (pode ser cadastrada depois).
  -- Nenhuma comparação pode ver NULL: com NULL o resultado seria NULL e o
  -- CHECK passaria (tipo sem número, ou número sem tipo). Daí os coalesce.
  check ((tipo_inscricao is null and numero_inscricao is null)
      or (coalesce(tipo_inscricao, '') = 'cnpj' and coalesce(numero_inscricao, '') ~ '^[0-9]{14}$')
      or (coalesce(tipo_inscricao, '') = 'cpf'  and coalesce(numero_inscricao, '') ~ '^[0-9]{11}$'))
);

-- Uma obra pertence a no máximo UM estabelecimento. Obra nunca vira
-- estabelecimento sozinha: o vínculo é cadastrado no ARCD.
create table if not exists public.ponto_estabelecimento_obras (
  company_id         text        not null,
  obra_id            text        not null,
  estabelecimento_id uuid        not null,
  vinculado_por      text        not null,
  vinculado_em       timestamptz not null default now(),
  primary key (company_id, obra_id),
  foreign key (company_id, estabelecimento_id) references public.ponto_estabelecimentos(company_id, id) on delete restrict
);
create index if not exists idx_ponto_estab_obras_estab on public.ponto_estabelecimento_obras(company_id, estabelecimento_id);

-- ---------------------------------------------------------------- dispositivo
-- estabelecimento_id: fixado na primeira vez que é conhecido (pareamento ou
-- primeiro envio) e nunca mais muda - mudar de estabelecimento = novo
-- pareamento. ultima_sequencia_local/ultimo_hash_local: topo da cadeia
-- LOCAL do aparelho já recebida (formato 2).
alter table public.ponto_dispositivos add column if not exists estabelecimento_id uuid;
alter table public.ponto_dispositivos add column if not exists ultima_sequencia_local bigint not null default 0;
alter table public.ponto_dispositivos add column if not exists ultimo_hash_local text not null default repeat('0', 64);
do $$ begin
  alter table public.ponto_dispositivos add constraint ponto_dispositivos_estabelecimento_fk
    foreign key (company_id, estabelecimento_id) references public.ponto_estabelecimentos(company_id, id) on delete restrict;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.ponto_dispositivos add constraint ponto_dispositivos_seq_local_ck check (ultima_sequencia_local >= 0);
exception when duplicate_object then null; end $$;

create or replace function public.ponto_dispositivo_protegido() returns trigger language plpgsql as $$
begin
  if old.estabelecimento_id is not null and new.estabelecimento_id is distinct from old.estabelecimento_id then
    raise exception 'o estabelecimento do aparelho não muda depois de definido (pareie de novo)';
  end if;
  if (new.ultima_sequencia_local, new.ultimo_hash_local) is distinct from (old.ultima_sequencia_local, old.ultimo_hash_local) then
    if coalesce(current_setting('ponto.arp_ingresso', true), '') <> 'sim' then
      raise exception 'a cadeia local do aparelho só avança pela ARP (ponto_arp_registrar)';
    end if;
    if new.ultima_sequencia_local < old.ultima_sequencia_local then
      raise exception 'a sequência local do aparelho não volta';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ponto_dispositivos_protegido on public.ponto_dispositivos;
create trigger ponto_dispositivos_protegido before update on public.ponto_dispositivos
  for each row execute function public.ponto_dispositivo_protegido();

-- ---------------------------------------------------------------- legado (016)
-- Marca o formato das marcações antigas sem reescrever nenhuma linha.
alter table public.ponto_marcacoes add column if not exists record_format_version integer not null default 1;
do $$ begin
  alter table public.ponto_marcacoes add constraint ponto_marcacoes_formato_legado_ck check (record_format_version = 1);
exception when duplicate_object then null; end $$;
comment on table public.ponto_marcacoes is
  'LEGADO formato 1: nsr = sequência POR APARELHO (não é o NSR fiscal). Registros novos: ponto_eventos + ponto_arp_registros.';

-- ---------------------------------------------------------------- ingresso (eventos formato 2)
create table if not exists public.ponto_eventos (
  company_id            text        not null,
  event_id              uuid        not null,
  record_format_version integer     not null default 2 check (record_format_version = 2),
  dispositivo_id        uuid        not null,
  obra_id               text        not null,
  estabelecimento_id    uuid,
  local_sequence        bigint      not null check (local_sequence >= 1),
  local_previous_hash   text        not null check (local_previous_hash ~ '^[0-9a-f]{64}$'),
  local_hash            text        not null check (local_hash ~ '^[0-9a-f]{64}$'),
  tipo_registro         text        not null check (tipo_registro in ('ponto','acesso_terceiro')),
  employee_id           text,
  terceiro_id           text,
  cpf                   text        not null default '',
  marcado_em            timestamptz not null,
  marcado_em_texto      text        not null,           -- exatamente como o aparelho assinou
  relogio_aparelho      timestamptz,
  hora_confiavel        boolean     not null,
  relogio_alterado      boolean     not null default false,
  divergencia_ms        bigint,
  fonte_hora            text        not null default '',
  idade_referencia_ms   bigint,
  metodo                text        not null check (metodo in ('facial','encarregado')),
  confianca             numeric     check (confianca is null or (confianca >= 0 and confianca <= 1)),
  encarregado_id        text,
  gps                   jsonb,
  foto_sha256           text        check (foto_sha256 is null or foto_sha256 ~ '^[0-9a-f]{64}$'),
  payload               jsonb       not null,           -- evento como recebido (auditoria)
  recebido_em           timestamptz not null default now(),
  primary key (company_id, event_id),
  unique (company_id, dispositivo_id, local_sequence),
  foreign key (company_id, dispositivo_id) references public.ponto_dispositivos(company_id, id) on delete restrict,
  foreign key (company_id, estabelecimento_id) references public.ponto_estabelecimentos(company_id, id) on delete restrict,
  check ((tipo_registro = 'ponto' and employee_id is not null) or (tipo_registro = 'acesso_terceiro' and terceiro_id is not null))
);
create index if not exists idx_ponto_eventos_obra_data on public.ponto_eventos(company_id, obra_id, marcado_em desc);

-- ---------------------------------------------------------------- ARP fiscal
create table if not exists public.ponto_arp_contadores (
  company_id          text        not null,
  estabelecimento_id  uuid        not null,
  ultimo_nsr          bigint      not null default 0 check (ultimo_nsr >= 0),
  ultimo_hash_fiscal  text        not null default repeat('0', 64) check (ultimo_hash_fiscal ~ '^[0-9a-f]{64}$'),
  atualizado_em       timestamptz not null default now(),
  primary key (company_id, estabelecimento_id),
  foreign key (company_id, estabelecimento_id) references public.ponto_estabelecimentos(company_id, id) on delete restrict
);

create table if not exists public.ponto_arp_registros (
  company_id            text        not null,
  event_id              uuid        not null,
  estabelecimento_id    uuid        not null,
  nsr                   bigint      not null check (nsr >= 1),
  dispositivo_id        uuid        not null,
  local_sequence        bigint      not null,
  gravado_em            timestamptz not null,
  gravado_em_texto      text        not null,           -- como entrou no hash fiscal
  fiscal_previous_hash  text        not null check (fiscal_previous_hash ~ '^[0-9a-f]{64}$'),
  fiscal_hash           text        not null check (fiscal_hash ~ '^[0-9a-f]{64}$'),
  versao_hash_fiscal    integer     not null default 1,
  evidencia_hora        jsonb       not null default '{}'::jsonb,   -- fonte de hora no momento da gravação
  primary key (company_id, event_id),
  unique (company_id, estabelecimento_id, nsr),
  unique (company_id, estabelecimento_id, fiscal_hash),
  foreign key (company_id, event_id) references public.ponto_eventos(company_id, event_id) on delete restrict,
  foreign key (company_id, estabelecimento_id) references public.ponto_estabelecimentos(company_id, id) on delete restrict
);
create index if not exists idx_ponto_arp_registros_nsr on public.ponto_arp_registros(company_id, estabelecimento_id, nsr);

-- ---------------------------------------------------------------- verificações de hora
-- Medições da fonte de hora do servidor contra servidores NTP rastreáveis à
-- Hora Legal Brasileira (docs/REP-P-TEMPO-CONFIAVEL.md). Só se acrescenta.
create table if not exists public.ponto_tempo_verificacoes (
  id              uuid        not null default gen_random_uuid() primary key,
  fonte           text        not null,
  servidor        text        not null,
  verificado_em   timestamptz not null,
  offset_ms       numeric,
  atraso_ms       numeric,
  incerteza_ms    numeric,
  estrato         integer,
  ok              boolean     not null,
  erro            text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_ponto_tempo_verificacoes_em on public.ponto_tempo_verificacoes(verificado_em desc);

-- ---------------------------------------------------------------- imutabilidade
create or replace function public.ponto_arp_imutavel() returns trigger language plpgsql as $$
begin
  raise exception '% é imutável: registro de ponto aceito não pode ser alterado nem apagado (Portaria 671/2021). Correção é registro novo.', tg_table_name;
end $$;

-- Inserção só pela função da ARP (ela liga a marca da transação).
create or replace function public.ponto_arp_somente_pela_funcao() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('ponto.arp_ingresso', true), '') <> 'sim' then
    raise exception '% só recebe registros pela ARP (ponto_arp_registrar)', tg_table_name;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ponto_eventos','ponto_arp_registros','ponto_tempo_verificacoes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_no_update', t);
    execute format('drop trigger if exists %I on public.%I', t || '_no_delete', t);
    execute format('drop trigger if exists %I on public.%I', t || '_no_truncate', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.ponto_arp_imutavel()', t || '_no_update', t);
    execute format('create trigger %I before delete on public.%I for each row execute function public.ponto_arp_imutavel()', t || '_no_delete', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.ponto_arp_imutavel()', t || '_no_truncate', t);
  end loop;
  foreach t in array array['ponto_eventos','ponto_arp_registros'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_so_arp', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.ponto_arp_somente_pela_funcao()', t || '_so_arp', t);
  end loop;
end $$;

-- Contador: só pela ARP, nunca volta, nunca é apagado.
create or replace function public.ponto_arp_contador_protegido() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'contador de NSR não pode ser apagado'; end if;
  if coalesce(current_setting('ponto.arp_ingresso', true), '') <> 'sim' then
    raise exception 'contador de NSR só muda pela ARP (ponto_arp_registrar)';
  end if;
  if tg_op = 'UPDATE' and new.ultimo_nsr <> old.ultimo_nsr + 1 then
    raise exception 'NSR só avança de um em um (de % para %)', old.ultimo_nsr, new.ultimo_nsr;
  end if;
  if tg_op = 'UPDATE' then return new; end if;
  if new.ultimo_nsr <> 0 then raise exception 'contador de NSR começa em zero'; end if;
  return new;
end $$;
drop trigger if exists ponto_arp_contadores_protegido on public.ponto_arp_contadores;
create trigger ponto_arp_contadores_protegido before insert or update or delete on public.ponto_arp_contadores
  for each row execute function public.ponto_arp_contador_protegido();
drop trigger if exists ponto_arp_contadores_no_truncate on public.ponto_arp_contadores;
create trigger ponto_arp_contadores_no_truncate before truncate on public.ponto_arp_contadores
  for each statement execute function public.ponto_arp_imutavel();

-- ---------------------------------------------------------------- hash fiscal
-- MESMO texto de src/domains/ponto-eletronico/registro-fiscal.js
-- (canonicalizarRegistroFiscal). Há teste comparando os dois.
create or replace function public.ponto_arp_texto_fiscal(
  p_estabelecimento_id uuid, p_nsr bigint, p_event_id uuid, p_tipo text, p_cpf text, p_employee_id text,
  p_marcado_em text, p_gravado_em text, p_dispositivo_id uuid, p_local_sequence bigint, p_local_hash text, p_previous text
) returns text language sql immutable as $$
  select concat_ws('|', 'fiscal-v1', lower(p_estabelecimento_id::text), p_nsr::text, lower(p_event_id::text),
    coalesce(nullif(btrim(p_tipo), ''), 'ponto'), regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'),
    btrim(coalesce(p_employee_id, '')), btrim(coalesce(p_marcado_em, '')), btrim(coalesce(p_gravado_em, '')),
    lower(p_dispositivo_id::text), p_local_sequence::text, lower(btrim(p_local_hash)), lower(btrim(p_previous)))
$$;

-- ---------------------------------------------------------------- ARP
-- Recebe um lote de eventos formato 2 de UM aparelho (forma e hash local já
-- conferidos pela API - server/ponto-eletronico/arp/). Numa transação:
--   1. trava o aparelho (FOR UPDATE) e resolve o estabelecimento;
--   2. por evento, em ordem de sequência local:
--      - event_id já gravado com o mesmo hash local -> devolve o MESMO NSR e
--        hash fiscal (idempotência: retry, timeout, resposta perdida);
--      - confere a cadeia local (sequência +1 e hash anterior);
--      - grava o evento; se for PONTO, trava o contador do estabelecimento
--        (FOR UPDATE), NSR = último + 1, calcula o hash fiscal e grava;
--   3. qualquer exceção desfaz TUDO (contador inclusive): sem lacuna de NSR.
-- Ordem de travas sempre aparelho -> contador: dois aparelhos do mesmo
-- estabelecimento esperam um pelo outro no contador, sem impasse.
-- p_hora: evidência da fonte de hora oficial ({ serverTime, source, ... }).
create or replace function public.ponto_arp_registrar(
  p_company_id text, p_dispositivo_id uuid, p_eventos jsonb, p_hora jsonb
) returns table(event_id uuid, local_sequence bigint, status text, nsr bigint, fiscal_hash text, estabelecimento_id uuid, gravado_em text, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_disp     public.ponto_dispositivos%rowtype;
  v_estab    uuid;
  v_ativo    boolean;
  v_e        jsonb;
  v_id       uuid;
  v_seq      bigint;
  v_hash     text;
  v_exist    record;
  v_cont     record;
  v_nsr      bigint;
  v_fiscal   text;
  v_gravado  text := coalesce(nullif(p_hora->>'serverTime', ''), to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  v_parou    boolean := false;
begin
  perform set_config('ponto.arp_ingresso', 'sim', true);

  select * into v_disp from public.ponto_dispositivos d
   where d.company_id = p_company_id and d.id = p_dispositivo_id for update;
  if not found then
    return query select null::uuid, null::bigint, 'dispositivo_desconhecido'::text, null::bigint, null::text, null::uuid, null::text, 'aparelho não encontrado'::text;
    return;
  end if;
  if v_disp.status <> 'ativo' then
    return query select null::uuid, null::bigint, 'dispositivo_revogado'::text, null::bigint, null::text, null::uuid, null::text, 'aparelho revogado'::text;
    return;
  end if;

  -- Cadeia local ÚNICA por aparelho através dos formatos: sem nenhum evento
  -- formato 2 ainda, a cadeia continua do topo do formato 1 (legado, 016) -
  -- num aparelho novo esse topo é 0 / hash inicial. Nada é renumerado.
  if v_disp.ultima_sequencia_local = 0 then
    v_disp.ultima_sequencia_local := v_disp.ultimo_nsr;
    v_disp.ultimo_hash_local := v_disp.ultimo_hash;
  end if;

  v_estab := v_disp.estabelecimento_id;
  if v_estab is null then
    select o.estabelecimento_id into v_estab from public.ponto_estabelecimento_obras o
     where o.company_id = p_company_id and o.obra_id = v_disp.obra_id;
    if v_estab is not null then
      update public.ponto_dispositivos d set estabelecimento_id = v_estab
       where d.company_id = p_company_id and d.id = p_dispositivo_id;
    end if;
  end if;
  if v_estab is not null then
    select e.ativo into v_ativo from public.ponto_estabelecimentos e where e.company_id = p_company_id and e.id = v_estab;
  end if;

  for v_e in select value from jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) order by (value->>'localSequence')::bigint loop
    v_id := (v_e->>'eventId')::uuid;
    v_seq := (v_e->>'localSequence')::bigint;
    v_hash := lower(v_e->>'localHash');

    if v_parou then
      return query select v_id, v_seq, 'nao_processado'::text, null::bigint, null::text, null::uuid, null::text, 'um evento anterior do lote não foi aceito'::text;
      continue;
    end if;

    -- Idempotência por event_id.
    select ev.local_hash, ev.dispositivo_id, r.nsr, r.fiscal_hash, r.estabelecimento_id, r.gravado_em_texto
      into v_exist
      from public.ponto_eventos ev
      left join public.ponto_arp_registros r on r.company_id = ev.company_id and r.event_id = ev.event_id
     where ev.company_id = p_company_id and ev.event_id = v_id;
    if found then
      if v_exist.local_hash = v_hash and v_exist.dispositivo_id = p_dispositivo_id then
        return query select v_id, v_seq, case when v_exist.nsr is null then 'acesso_ja_registrado' else 'ja_registrado' end,
          v_exist.nsr, v_exist.fiscal_hash, v_exist.estabelecimento_id, v_exist.gravado_em_texto, null::text;
      else
        v_parou := true;
        return query select v_id, v_seq, 'conflito'::text, null::bigint, null::text, null::uuid, null::text, 'eventId já existe com outro conteúdo'::text;
      end if;
      continue;
    end if;

    if v_estab is null then
      v_parou := true;
      return query select v_id, v_seq, 'aguardando_estabelecimento'::text, null::bigint, null::text, null::uuid, null::text, 'a obra do aparelho não está vinculada a um estabelecimento'::text;
      continue;
    end if;
    if not coalesce(v_ativo, false) then
      v_parou := true;
      return query select v_id, v_seq, 'estabelecimento_inativo'::text, null::bigint, null::text, v_estab, null::text, 'estabelecimento inativo'::text;
      continue;
    end if;
    if nullif(v_e->>'estabelecimentoId', '') is not null and (v_e->>'estabelecimentoId')::uuid <> v_estab then
      v_parou := true;
      return query select v_id, v_seq, 'conflito'::text, null::bigint, null::text, v_estab, null::text, 'evento declara outro estabelecimento'::text;
      continue;
    end if;

    -- Cadeia local do aparelho.
    if v_seq <= v_disp.ultima_sequencia_local then
      v_parou := true;
      return query select v_id, v_seq, 'conflito'::text, null::bigint, null::text, null::uuid, null::text, 'sequência local já usada por outro evento'::text;
      continue;
    end if;
    if v_seq <> v_disp.ultima_sequencia_local + 1 then
      v_parou := true;
      return query select v_id, v_seq, 'fora_de_sequencia'::text, null::bigint, null::text, null::uuid, null::text,
        format('sequência local %s chegou antes da %s', v_seq, v_disp.ultima_sequencia_local + 1);
      continue;
    end if;
    if lower(v_e->>'localPreviousHash') <> v_disp.ultimo_hash_local then
      v_parou := true;
      return query select v_id, v_seq, 'cadeia_quebrada'::text, null::bigint, null::text, null::uuid, null::text, 'evento não aponta para o anterior do aparelho'::text;
      continue;
    end if;

    insert into public.ponto_eventos(
      company_id, event_id, dispositivo_id, obra_id, estabelecimento_id, local_sequence, local_previous_hash, local_hash,
      tipo_registro, employee_id, terceiro_id, cpf, marcado_em, marcado_em_texto, relogio_aparelho, hora_confiavel,
      relogio_alterado, divergencia_ms, fonte_hora, idade_referencia_ms, metodo, confianca, encarregado_id, gps, foto_sha256, payload
    ) values (
      p_company_id, v_id, p_dispositivo_id, v_disp.obra_id, v_estab, v_seq, lower(v_e->>'localPreviousHash'), v_hash,
      coalesce(nullif(v_e->>'tipoRegistro', ''), 'ponto'), nullif(v_e->>'employeeId', ''), nullif(v_e->>'terceiroId', ''),
      regexp_replace(coalesce(v_e->>'cpf', ''), '[^0-9]', '', 'g'), (v_e->>'marcadoEm')::timestamptz, v_e->>'marcadoEm',
      nullif(v_e->>'relogioAparelho', '')::timestamptz, coalesce((v_e->>'horaConfiavel')::boolean, false),
      coalesce((v_e->>'relogioAlterado')::boolean, false), round(nullif(v_e->>'divergenciaMs', '')::numeric)::bigint,
      coalesce(v_e->>'fonteHora', ''), round(nullif(v_e->>'idadeReferenciaMs', '')::numeric)::bigint,
      v_e->>'metodo', nullif(v_e->>'confianca', '')::numeric, nullif(v_e->>'encarregadoId', ''),
      case when jsonb_typeof(v_e->'gps') = 'object' then v_e->'gps' else null end,
      nullif(lower(v_e->>'fotoSha256'), ''), v_e
    );
    v_disp.ultima_sequencia_local := v_seq;
    v_disp.ultimo_hash_local := v_hash;

    if coalesce(nullif(v_e->>'tipoRegistro', ''), 'ponto') = 'ponto' then
      insert into public.ponto_arp_contadores(company_id, estabelecimento_id) values (p_company_id, v_estab)
        on conflict on constraint ponto_arp_contadores_pkey do nothing;
      select c.ultimo_nsr, c.ultimo_hash_fiscal into v_cont from public.ponto_arp_contadores c
       where c.company_id = p_company_id and c.estabelecimento_id = v_estab for update;
      v_nsr := v_cont.ultimo_nsr + 1;
      v_fiscal := encode(sha256(convert_to(public.ponto_arp_texto_fiscal(
        v_estab, v_nsr, v_id, 'ponto', v_e->>'cpf', v_e->>'employeeId', v_e->>'marcadoEm', v_gravado,
        p_dispositivo_id, v_seq, v_hash, v_cont.ultimo_hash_fiscal), 'UTF8')), 'hex');
      insert into public.ponto_arp_registros(
        company_id, event_id, estabelecimento_id, nsr, dispositivo_id, local_sequence, gravado_em, gravado_em_texto,
        fiscal_previous_hash, fiscal_hash, evidencia_hora
      ) values (
        p_company_id, v_id, v_estab, v_nsr, p_dispositivo_id, v_seq, v_gravado::timestamptz, v_gravado,
        v_cont.ultimo_hash_fiscal, v_fiscal, coalesce(p_hora, '{}'::jsonb)
      );
      update public.ponto_arp_contadores c set ultimo_nsr = v_nsr, ultimo_hash_fiscal = v_fiscal, atualizado_em = now()
       where c.company_id = p_company_id and c.estabelecimento_id = v_estab;
      return query select v_id, v_seq, 'registrado'::text, v_nsr, v_fiscal, v_estab, v_gravado, null::text;
    else
      return query select v_id, v_seq, 'acesso_registrado'::text, null::bigint, null::text, v_estab, v_gravado, null::text;
    end if;
  end loop;

  update public.ponto_dispositivos d
     set ultima_sequencia_local = v_disp.ultima_sequencia_local, ultimo_hash_local = v_disp.ultimo_hash_local, ultimo_contato_em = now()
   where d.company_id = p_company_id and d.id = p_dispositivo_id;
end $$;

-- ---------------------------------------------------------------- permissões
alter table public.ponto_estabelecimentos       enable row level security;
alter table public.ponto_estabelecimento_obras  enable row level security;
alter table public.ponto_eventos                enable row level security;
alter table public.ponto_arp_contadores         enable row level security;
alter table public.ponto_arp_registros          enable row level security;
alter table public.ponto_tempo_verificacoes     enable row level security;

do $$
declare papel text;
begin
  foreach papel in array array['anon','authenticated','service_role'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on table public.ponto_estabelecimentos, public.ponto_estabelecimento_obras, public.ponto_eventos,
        public.ponto_arp_contadores, public.ponto_arp_registros, public.ponto_tempo_verificacoes from %I', papel);
      execute format('revoke all on function public.ponto_arp_registrar(text, uuid, jsonb, jsonb) from %I', papel);
    end if;
  end loop;
  revoke all on table public.ponto_estabelecimentos, public.ponto_estabelecimento_obras, public.ponto_eventos,
    public.ponto_arp_contadores, public.ponto_arp_registros, public.ponto_tempo_verificacoes from public;
  revoke all on function public.ponto_arp_registrar(text, uuid, jsonb, jsonb) from public;
  -- A API (service_role) lê tudo, cadastra estabelecimento/vínculo e grava
  -- medições de hora; eventos, NSR e contador SÓ pela função da ARP.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.ponto_estabelecimentos, public.ponto_estabelecimento_obras, public.ponto_eventos,
      public.ponto_arp_contadores, public.ponto_arp_registros, public.ponto_tempo_verificacoes to service_role;
    grant insert, update on public.ponto_estabelecimentos to service_role;
    -- vínculo obra -> estabelecimento é configuração (não é registro fiscal)
    grant insert, update, delete on public.ponto_estabelecimento_obras to service_role;
    grant insert on public.ponto_tempo_verificacoes to service_role;
    grant execute on function public.ponto_arp_registrar(text, uuid, jsonb, jsonb) to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
