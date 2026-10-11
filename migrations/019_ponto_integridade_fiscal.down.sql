-- Reverte a 019 SEM apagar dado nenhum: devolve os corpos das funções da
-- 016/017 (copiados literalmente desses arquivos) e tira os triggers novos.
-- A tabela ponto_estabelecimentos_auditoria, se tiver linhas, FICA (evidência
-- append-only) e só deixa de receber linhas novas. As permissões retiradas
-- (TRUNCATE/DELETE da service_role) NÃO são devolvidas de propósito.
-- Rodar inteira numa transação: psql -1 -f ... (nunca comando a comando).

drop trigger if exists ponto_estabelecimentos_protegido on public.ponto_estabelecimentos;
drop trigger if exists ponto_estabelecimentos_auditar on public.ponto_estabelecimentos;
drop function if exists public.ponto_estabelecimento_protegido();
drop function if exists public.ponto_estabelecimento_auditar();
drop trigger if exists ponto_marcacoes_no_truncate on public.ponto_marcacoes;

-- 016 (literal)
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

-- 017 (literal)
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

-- 017 (literal)
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

-- Auditoria do estabelecimento: com linhas, FICA (evidência; e nesse caso a
-- 017 também não pode ser revertida, pela guarda dela). Vazia, sai junto -
-- assim a reversão completa 019 -> 018 -> 017 funciona num banco limpo.
do $$ begin
  if to_regclass('public.ponto_estabelecimentos_auditoria') is not null
     and not exists (select 1 from public.ponto_estabelecimentos_auditoria) then
    drop table public.ponto_estabelecimentos_auditoria;
    drop function if exists public.ponto_estab_auditoria_so_trigger();
    drop function if exists public.ponto_estab_nsr_emitidos(text, uuid);
  end if;
end $$;
notify pgrst, 'reload schema';
