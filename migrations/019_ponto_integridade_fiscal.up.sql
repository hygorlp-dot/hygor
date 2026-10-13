-- PONTO-019: integridade fiscal da ARP (Fase 01, revisão independente de
-- banco - docs/PONTO-OBRA-MIGRATION-019.md). Forward-only e idempotente.
-- NÃO reescreve nenhum registro existente e não altera 016/017/018.
--
-- *** PRELIMINAR: NÃO está em scripts/apply-ponto-eletronico.mjs. Só vai
-- para produção com autorização expressa (ver o documento acima). ***
--
-- A. Legado formato 1 só ANTES do formato 2: com evento formato 2 do
--    aparelho, ponto_registrar_marcacoes recusa legado novo (cadeia local
--    única garantida pelo banco). A ARP só grava o topo da cadeia local do
--    aparelho quando insere algum evento.
-- B. Hora de gravação calculada SOB a trava do contador. Fonte = hora do
--    host se ISO UTC e dentro da tolerância do relógio do banco; senão o
--    relógio do banco. Atrás do NSR anterior por até uma tolerância: usa a
--    do anterior (monotonia); mais que isso, grava a verdadeira e marca
--    (sem efeito catraca). Tudo registrado na evidência (fora do hash).
-- C. Inscrição (CNPJ/CPF, CNO, CAEPF, CEI) e fuso do estabelecimento ficam
--    congelados depois do primeiro NSR; o preenchimento inicial (de vazio
--    para valor) continua possível uma vez, com responsável, e fica na
--    auditoria append-only do estabelecimento. ARP lê o estabelecimento com
--    FOR SHARE: alteração de inscrição e emissão de NSR ficam serializadas.
-- D. Endurecimento: TRUNCATE de ponto_marcacoes bloqueado; semente legada,
--    obra e token do aparelho imutáveis; aparelho revogado não volta a
--    ativo; service_role sem TRUNCATE/DELETE onde não precisa; marcas de
--    sessão desligadas ao fim das funções; search_path endurecido;
--    comparações com NULL via "is distinct from".

-- ---------------------------------------------------------------- C. auditoria do estabelecimento
create table if not exists public.ponto_estabelecimentos_auditoria (
  id                  bigint generated always as identity primary key,
  company_id          text        not null,
  estabelecimento_id  uuid        not null,
  acao                text        not null check (acao in ('linha_de_base','reaplicacao','criado','alterado','inscricao_preenchida_apos_nsr')),
  campos              text[]      not null default '{}',
  antes               jsonb,
  depois              jsonb       not null,
  nsr_emitidos        bigint      not null default 0 check (nsr_emitidos >= 0),
  responsavel         text,
  em                  timestamptz not null default now()
);
create index if not exists idx_ponto_estab_auditoria on public.ponto_estabelecimentos_auditoria(company_id, estabelecimento_id, id);
alter table public.ponto_estabelecimentos_auditoria enable row level security;

drop trigger if exists ponto_estabelecimentos_auditoria_no_update on public.ponto_estabelecimentos_auditoria;
drop trigger if exists ponto_estabelecimentos_auditoria_no_delete on public.ponto_estabelecimentos_auditoria;
drop trigger if exists ponto_estabelecimentos_auditoria_no_truncate on public.ponto_estabelecimentos_auditoria;
create trigger ponto_estabelecimentos_auditoria_no_update before update on public.ponto_estabelecimentos_auditoria
  for each row execute function public.ponto_arp_imutavel();
create trigger ponto_estabelecimentos_auditoria_no_delete before delete on public.ponto_estabelecimentos_auditoria
  for each row execute function public.ponto_arp_imutavel();
create trigger ponto_estabelecimentos_auditoria_no_truncate before truncate on public.ponto_estabelecimentos_auditoria
  for each statement execute function public.ponto_arp_imutavel();

create or replace function public.ponto_estab_auditoria_so_trigger() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('ponto.estab_auditoria', true), '') <> 'sim' then
    raise exception 'ponto_estabelecimentos_auditoria só recebe linhas do próprio banco (trigger do estabelecimento)';
  end if;
  return new;
end $$;
drop trigger if exists ponto_estabelecimentos_auditoria_so_trigger on public.ponto_estabelecimentos_auditoria;
create trigger ponto_estabelecimentos_auditoria_so_trigger before insert on public.ponto_estabelecimentos_auditoria
  for each row execute function public.ponto_estab_auditoria_so_trigger();

-- NSR já emitidos pelo estabelecimento (0 se nunca emitiu).
create or replace function public.ponto_estab_nsr_emitidos(p_company_id text, p_estab uuid) returns bigint
language sql stable set search_path = pg_catalog, public, pg_temp as $$
  select coalesce((select c.ultimo_nsr from public.ponto_arp_contadores c
                    where c.company_id = p_company_id and c.estabelecimento_id = p_estab), 0)
$$;

create or replace function public.ponto_estabelecimento_protegido() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_nsr bigint;
  v_campo text;
begin
  if tg_op = 'DELETE' then
    if public.ponto_estab_nsr_emitidos(old.company_id, old.id) > 0 then
      raise exception 'estabelecimento com NSR emitido não pode ser apagado';
    end if;
    return old;
  end if;
  if (new.company_id, new.id) is distinct from (old.company_id, old.id) then
    raise exception 'identificador do estabelecimento não muda';
  end if;
  -- FOR SHARE no contador: em REPEATABLE READ, um NSR emitido depois do
  -- snapshot vira erro de serialização em vez de passar despercebido.
  perform 1 from public.ponto_arp_contadores c
   where c.company_id = old.company_id and c.estabelecimento_id = old.id for share;
  v_nsr := public.ponto_estab_nsr_emitidos(old.company_id, old.id);
  if v_nsr = 0 then return new; end if;
  -- Com NSR emitido: inscrição e demais identificações só de vazio para
  -- valor (uma vez); nunca trocadas nem apagadas. Fuso não muda.
  if (new.tipo_inscricao, new.numero_inscricao) is distinct from (old.tipo_inscricao, old.numero_inscricao)
     and old.numero_inscricao is not null then
    raise exception 'a inscrição (CNPJ/CPF) do estabelecimento não muda depois de emitido NSR (% registro(s)). Para outra inscrição, cadastre outro estabelecimento.', v_nsr;
  end if;
  foreach v_campo in array array['cno','caepf','cei'] loop
    if (to_jsonb(old)->>v_campo) is not null and (to_jsonb(new)->>v_campo) is distinct from (to_jsonb(old)->>v_campo) then
      raise exception 'o % do estabelecimento não muda depois de emitido NSR (% registro(s))', upper(v_campo), v_nsr;
    end if;
  end loop;
  if new.timezone is distinct from old.timezone then
    raise exception 'o fuso horário do estabelecimento não muda depois de emitido NSR (% registro(s))', v_nsr;
  end if;
  -- O responsável precisa vir NESTA alteração (atualizado_em novo), não
  -- herdado de uma edição anterior.
  if old.numero_inscricao is null and new.numero_inscricao is not null
     and (nullif(btrim(coalesce(new.atualizado_por, '')), '') is null
          or new.atualizado_em is null or (old.atualizado_em is not null and new.atualizado_em <= old.atualizado_em)) then
    raise exception 'preenchimento da inscrição depois de emitido NSR exige o responsável desta alteração (atualizado_por e atualizado_em novos)';
  end if;
  return new;
end $$;
drop trigger if exists ponto_estabelecimentos_protegido on public.ponto_estabelecimentos;
create trigger ponto_estabelecimentos_protegido before update or delete on public.ponto_estabelecimentos
  for each row execute function public.ponto_estabelecimento_protegido();

create or replace function public.ponto_estabelecimento_auditar() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_nsr    bigint := public.ponto_estab_nsr_emitidos(new.company_id, new.id);
  v_campos text[];
  v_acao   text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criado';
    v_campos := '{}';
  else
    select coalesce(array_agg(k order by k), '{}') into v_campos
      from jsonb_each(to_jsonb(new)) n(k, v)
     where k not in ('atualizado_em','atualizado_por') and n.v is distinct from (to_jsonb(old)->k);
    if cardinality(v_campos) = 0 then return new; end if;
    v_acao := case when v_nsr > 0 and old.numero_inscricao is null and new.numero_inscricao is not null
                   then 'inscricao_preenchida_apos_nsr' else 'alterado' end;
  end if;
  perform set_config('ponto.estab_auditoria', 'sim', true);
  insert into public.ponto_estabelecimentos_auditoria(company_id, estabelecimento_id, acao, campos, antes, depois, nsr_emitidos, responsavel)
  values (new.company_id, new.id, v_acao, v_campos, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new), v_nsr,
          coalesce(nullif(btrim(coalesce(new.atualizado_por, '')), ''), new.criado_por));
  perform set_config('ponto.estab_auditoria', '', true);
  return new;
end $$;
drop trigger if exists ponto_estabelecimentos_auditar on public.ponto_estabelecimentos;
create trigger ponto_estabelecimentos_auditar after insert or update on public.ponto_estabelecimentos
  for each row execute function public.ponto_estabelecimento_auditar();

-- Linha de base: o estado de cada estabelecimento existente no momento da
-- 019 (com quantos NSR já tinham sido emitidos). Reaplicação (ex.: depois
-- de um down em que o cadastro mudou sem auditoria): nova linha
-- 'reaplicacao' só se o estado atual difere do último registrado - a trilha
-- não fica com buraco.
do $$ begin
  perform set_config('ponto.estab_auditoria', 'sim', true);
  insert into public.ponto_estabelecimentos_auditoria(company_id, estabelecimento_id, acao, antes, depois, nsr_emitidos, responsavel)
  select e.company_id, e.id,
         case when u.depois is null then 'linha_de_base' else 'reaplicacao' end,
         u.depois, to_jsonb(e), public.ponto_estab_nsr_emitidos(e.company_id, e.id), 'migration-019'
    from public.ponto_estabelecimentos e
    left join lateral (select a.depois from public.ponto_estabelecimentos_auditoria a
                        where a.company_id = e.company_id and a.estabelecimento_id = e.id order by a.id desc limit 1) u on true
   where u.depois is null or u.depois is distinct from to_jsonb(e);
  perform set_config('ponto.estab_auditoria', '', true);
end $$;

-- ---------------------------------------------------------------- D. aparelho
create or replace function public.ponto_dispositivo_protegido() returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin
  if (new.company_id, new.id, new.obra_id, new.token_hash) is distinct from (old.company_id, old.id, old.obra_id, old.token_hash) then
    raise exception 'obra, token e identificador do aparelho não mudam (pareie de novo)';
  end if;
  if old.status = 'revogado' and new.status is distinct from 'revogado' then
    raise exception 'aparelho revogado não volta a ficar ativo (pareie de novo)';
  end if;
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
  if (new.ultimo_nsr, new.ultimo_hash) is distinct from (old.ultimo_nsr, old.ultimo_hash) then
    if coalesce(current_setting('ponto.legado_ingresso', true), '') <> 'sim' then
      raise exception 'a sequência legada do aparelho só avança por ponto_registrar_marcacoes';
    end if;
    if new.ultimo_nsr < old.ultimo_nsr then
      raise exception 'a sequência legada do aparelho não volta';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ponto_marcacoes_no_truncate on public.ponto_marcacoes;
create trigger ponto_marcacoes_no_truncate before truncate on public.ponto_marcacoes
  for each statement execute function public.ponto_marcacao_imutavel();

-- ---------------------------------------------------------------- A. legado (016)
create or replace function public.ponto_registrar_marcacoes(
  p_company_id text, p_dispositivo_id uuid, p_marcacoes jsonb
) returns table(aceitas integer, ultimo_nsr bigint, ultimo_hash text, erro text)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_disp     public.ponto_dispositivos%rowtype;
  v_m        jsonb;
  v_nsr      bigint;
  v_aceitas  integer := 0;
  v_erro     text := null;
  v_formato2 boolean;
begin
  select * into v_disp from public.ponto_dispositivos
   where company_id = p_company_id and id = p_dispositivo_id for update;
  if not found then
    return query select 0, 0::bigint, ''::text, 'aparelho não encontrado'::text; return;
  end if;
  if v_disp.status <> 'ativo' then
    return query select 0, v_disp.ultimo_nsr, v_disp.ultimo_hash, 'aparelho revogado'::text; return;
  end if;
  -- Cadeia local única: depois do primeiro evento formato 2 do aparelho, o
  -- legado não cresce mais (reenvio do que já foi aceito segue idempotente).
  -- Também a semente gravada pela 017 num lote vazio (ultima_sequencia_local
  -- > 0 sem evento) conta: o formato 2 já começou daquele ponto.
  v_formato2 := v_disp.ultima_sequencia_local > 0 or exists (select 1 from public.ponto_eventos e
                         where e.company_id = p_company_id and e.dispositivo_id = p_dispositivo_id);
  perform set_config('ponto.legado_ingresso', 'sim', true);

  for v_m in select value from jsonb_array_elements(coalesce(p_marcacoes, '[]'::jsonb)) order by (value->>'nsr')::bigint loop
    v_nsr := (v_m->>'nsr')::bigint;
    if v_nsr <= v_disp.ultimo_nsr then continue; end if;
    if v_formato2 then
      v_erro := format('NSR %s recusado: o aparelho já registra no formato 2 (batidas antigas novas bifurcariam a cadeia local) - guardar no aparelho para resolução manual', v_nsr); exit;
    end if;
    if v_nsr is distinct from v_disp.ultimo_nsr + 1 then
      v_erro := format('NSR %s chegou antes do %s - lacuna na sequência', v_nsr, v_disp.ultimo_nsr + 1); exit;
    end if;
    if lower(v_m->>'hashAnterior') is distinct from v_disp.ultimo_hash then
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
  perform set_config('ponto.legado_ingresso', '', true);
  return query select v_aceitas, v_disp.ultimo_nsr, v_disp.ultimo_hash, v_erro;
end $$;

-- ---------------------------------------------------------------- B. fonte da hora de gravação
-- Chamada pela ARP DEPOIS da trava do contador: lê o relógio do banco
-- naquele instante e decide a base (host dentro da tolerância, ou banco).
create or replace function public.ponto_arp_fonte_hora(
  p_host timestamptz, p_tol interval, out banco timestamptz, out base timestamptz, out fonte text, out dif_ms numeric
) language plpgsql volatile set search_path = pg_catalog, public, pg_temp as $$
begin
  banco := date_trunc('milliseconds', clock_timestamp());
  dif_ms := case when p_host is not null then round(extract(epoch from (p_host - banco)) * 1000) end;
  if p_host is null then
    base := banco; fonte := 'banco:hora_do_host_invalida';
  elsif p_host - banco > p_tol or banco - p_host > p_tol then
    base := banco; fonte := 'banco:host_divergente';
  else
    base := p_host; fonte := 'host';
  end if;
end $$;

-- ---------------------------------------------------------------- A + B + C. ARP
-- Mesmo contrato da 017 (mesma assinatura, mesmos status e mesmo texto do
-- hash fiscal - src/domains/ponto-eletronico/registro-fiscal.js). Mudanças:
--   - estabelecimento lido com FOR SHARE (ordem de travas: aparelho ->
--     estabelecimento -> contador);
--   - gravado_em calculado sob a trava do contador e nunca menor que o do
--     NSR anterior do estabelecimento;
--   - topo da cadeia local do aparelho só é gravado se algum evento entrou;
--   - marca de sessão desligada no fim.
create or replace function public.ponto_arp_registrar(
  p_company_id text, p_dispositivo_id uuid, p_eventos jsonb, p_hora jsonb
) returns table(event_id uuid, local_sequence bigint, status text, nsr bigint, fiscal_hash text, estabelecimento_id uuid, gravado_em text, motivo text)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_disp       public.ponto_dispositivos%rowtype;
  v_estab      uuid;
  v_ativo      boolean;
  v_e          jsonb;
  v_id         uuid;
  v_seq        bigint;
  v_hash       text;
  v_exist      record;
  v_cont       record;
  v_nsr        bigint;
  v_fiscal     text;
  v_host       timestamptz;
  v_host_ok    boolean;
  v_banco      timestamptz;
  v_tol        interval;
  v_dif_ms     numeric;
  v_base       timestamptz;
  v_fonte      text;
  v_anterior   timestamptz;
  v_ts         timestamptz;
  v_ajuste     text;
  v_gravado    text;
  v_parou      boolean := false;
  v_inseriu    boolean := false;
  v_iso        constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$';
begin
  perform set_config('ponto.arp_ingresso', 'sim', true);

  -- Hora de gravação (docs/PONTO-OBRA-MIGRATION-019.md, seção 3):
  -- - fonte = hora do host (a medida contra o NTP.br), se em ISO 8601 UTC e a
  --   no máximo `toleranciaMs` (política da fonte de hora; 30 s; limitada a
  --   1 s..5 min) do relógio do banco, lido aqui dentro da transação;
  -- - fora disso, o relógio do banco - e a evidência diz por quê;
  -- - milissegundos, como o JS assina.
  -- O relógio do banco é lido DEPOIS da trava do contador (ponto_arp_fonte_hora).
  v_tol := make_interval(secs => least(greatest(
    case when coalesce(p_hora->>'toleranciaMs', '') ~ '^[0-9]+(\.[0-9]+)?$' then (p_hora->>'toleranciaMs')::numeric else 30000 end, 1000), 300000) / 1000.0);
  v_host_ok := coalesce(p_hora->>'serverTime', '') ~ v_iso;
  if v_host_ok then
    begin
      v_host := date_trunc('milliseconds', (p_hora->>'serverTime')::timestamptz);
    exception when others then   -- passa no formato mas não é data (ex.: 30/02)
      v_host_ok := false; v_host := null;
    end;
  end if;

  select * into v_disp from public.ponto_dispositivos d
   where d.company_id = p_company_id and d.id = p_dispositivo_id for update;
  if not found then
    perform set_config('ponto.arp_ingresso', '', true);
    return query select null::uuid, null::bigint, 'dispositivo_desconhecido'::text, null::bigint, null::text, null::uuid, null::text, 'aparelho não encontrado'::text;
    return;
  end if;
  if v_disp.status <> 'ativo' then
    perform set_config('ponto.arp_ingresso', '', true);
    return query select null::uuid, null::bigint, 'dispositivo_revogado'::text, null::bigint, null::text, null::uuid, null::text, 'aparelho revogado'::text;
    return;
  end if;

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
    -- FOR SHARE: a inscrição não pode mudar enquanto este lote emite NSR.
    select e.ativo into v_ativo from public.ponto_estabelecimentos e
     where e.company_id = p_company_id and e.id = v_estab for share;
  end if;

  for v_e in select value from jsonb_array_elements(coalesce(p_eventos, '[]'::jsonb)) order by (value->>'localSequence')::bigint loop
    v_id := (v_e->>'eventId')::uuid;
    v_seq := (v_e->>'localSequence')::bigint;
    v_hash := lower(v_e->>'localHash');

    if v_parou then
      return query select v_id, v_seq, 'nao_processado'::text, null::bigint, null::text, null::uuid, null::text, 'um evento anterior do lote não foi aceito'::text;
      continue;
    end if;

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
    if nullif(v_e->>'estabelecimentoId', '') is not null and (v_e->>'estabelecimentoId')::uuid is distinct from v_estab then
      v_parou := true;
      return query select v_id, v_seq, 'conflito'::text, null::bigint, null::text, v_estab, null::text, 'evento declara outro estabelecimento'::text;
      continue;
    end if;

    if v_seq <= v_disp.ultima_sequencia_local then
      v_parou := true;
      return query select v_id, v_seq, 'conflito'::text, null::bigint, null::text, null::uuid, null::text, 'sequência local já usada por outro evento'::text;
      continue;
    end if;
    if v_seq is distinct from v_disp.ultima_sequencia_local + 1 then
      v_parou := true;
      return query select v_id, v_seq, 'fora_de_sequencia'::text, null::bigint, null::text, null::uuid, null::text,
        format('sequência local %s chegou antes da %s', v_seq, v_disp.ultima_sequencia_local + 1);
      continue;
    end if;
    if lower(v_e->>'localPreviousHash') is distinct from v_disp.ultimo_hash_local then
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
    v_inseriu := true;
    v_disp.ultima_sequencia_local := v_seq;
    v_disp.ultimo_hash_local := v_hash;

    if coalesce(nullif(v_e->>'tipoRegistro', ''), 'ponto') = 'ponto' then
      insert into public.ponto_arp_contadores(company_id, estabelecimento_id) values (p_company_id, v_estab)
        on conflict on constraint ponto_arp_contadores_pkey do nothing;
      select c.ultimo_nsr, c.ultimo_hash_fiscal into v_cont from public.ponto_arp_contadores c
       where c.company_id = p_company_id and c.estabelecimento_id = v_estab for update;
      v_nsr := v_cont.ultimo_nsr + 1;
      select f.banco, f.base, f.fonte, f.dif_ms into v_banco, v_base, v_fonte, v_dif_ms
        from public.ponto_arp_fonte_hora(v_host, v_tol) f;
      -- Hora SOB a trava do contador. Atrás do NSR anterior por até uma
      -- tolerância (relógios de instâncias diferentes): usa a do anterior
      -- (monotonia). Mais que isso: o anterior é que está errado (futuro) -
      -- grava a hora verdadeira e marca, em vez de propagar o erro (catraca).
      select r.gravado_em into v_anterior from public.ponto_arp_registros r
       where r.company_id = p_company_id and r.estabelecimento_id = v_estab and r.nsr = v_cont.ultimo_nsr;
      if v_anterior is null or v_base >= v_anterior then
        v_ts := v_base; v_ajuste := 'nenhum';
      elsif v_anterior - v_base <= v_tol then
        v_ts := v_anterior; v_ajuste := 'monotonia';
      else
        v_ts := v_base; v_ajuste := 'regressao_registro_anterior_anomalo';
      end if;
      v_gravado := to_char(v_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      v_fiscal := encode(sha256(convert_to(public.ponto_arp_texto_fiscal(
        v_estab, v_nsr, v_id, 'ponto', v_e->>'cpf', v_e->>'employeeId', v_e->>'marcadoEm', v_gravado,
        p_dispositivo_id, v_seq, v_hash, v_cont.ultimo_hash_fiscal), 'UTF8')), 'hex');
      insert into public.ponto_arp_registros(
        company_id, event_id, estabelecimento_id, nsr, dispositivo_id, local_sequence, gravado_em, gravado_em_texto,
        fiscal_previous_hash, fiscal_hash, evidencia_hora
      ) values (
        p_company_id, v_id, v_estab, v_nsr, p_dispositivo_id, v_seq, v_gravado::timestamptz, v_gravado,
        v_cont.ultimo_hash_fiscal, v_fiscal,
        coalesce(p_hora, '{}'::jsonb) || jsonb_build_object('arp', jsonb_build_object(
          'versao', 19,
          'fonteGravacao', v_fonte,
          'horaHost', case when v_host_ok then to_char(v_host at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
          'relogioBanco', to_char(v_banco at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'diferencaHostBancoMs', v_dif_ms,
          'toleranciaMs', round(extract(epoch from v_tol) * 1000),
          'ajuste', v_ajuste,
          'gravadoAnterior', case when v_ajuste <> 'nenhum' then to_char(v_anterior at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end))
      );
      update public.ponto_arp_contadores c set ultimo_nsr = v_nsr, ultimo_hash_fiscal = v_fiscal, atualizado_em = now()
       where c.company_id = p_company_id and c.estabelecimento_id = v_estab;
      return query select v_id, v_seq, 'registrado'::text, v_nsr, v_fiscal, v_estab, v_gravado, null::text;
    else
      select f.base into v_base from public.ponto_arp_fonte_hora(v_host, v_tol) f;
      return query select v_id, v_seq, 'acesso_registrado'::text, null::bigint, null::text, v_estab,
        to_char(v_base at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), null::text;
    end if;
  end loop;

  if v_inseriu then
    update public.ponto_dispositivos d
       set ultima_sequencia_local = v_disp.ultima_sequencia_local, ultimo_hash_local = v_disp.ultimo_hash_local, ultimo_contato_em = now()
     where d.company_id = p_company_id and d.id = p_dispositivo_id;
  else
    update public.ponto_dispositivos d set ultimo_contato_em = now()
     where d.company_id = p_company_id and d.id = p_dispositivo_id;
  end if;
  perform set_config('ponto.arp_ingresso', '', true);
end $$;

-- ---------------------------------------------------------------- D. permissões e search_path
alter function public.ponto_arp_texto_fiscal(uuid, bigint, uuid, text, text, text, text, text, uuid, bigint, text, text)
  set search_path = pg_catalog, public, pg_temp;
-- Funções da 018 (assinatura resolvida pelo catálogo, sem recriar o corpo).
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('ponto_apropriacao_salvar', 'ponto_apropriacao_cancelar') loop
    execute format('alter function %s set search_path = pg_catalog, public, pg_temp', f);
  end loop;
end $$;

do $$
declare papel text;
begin
  foreach papel in array array['public','anon','authenticated'] loop
    if papel = 'public' or exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on function public.ponto_arp_texto_fiscal(uuid, bigint, uuid, text, text, text, text, text, uuid, bigint, text, text) from %s', papel);
      execute format('revoke all on function public.ponto_estab_nsr_emitidos(text, uuid) from %s', papel);
      execute format('revoke all on table public.ponto_estabelecimentos_auditoria from %s', papel);
      execute format('revoke all on function public.ponto_arp_fonte_hora(timestamptz, interval) from %s', papel);
      execute format('revoke all on sequence public.ponto_estabelecimentos_auditoria_id_seq from %s', papel);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    -- TRUNCATE ignora RLS e não é usado pela API: tirado de todas as tabelas do ponto.
    revoke truncate on public.ponto_dispositivos, public.ponto_pareamentos, public.ponto_marcacoes, public.ponto_biometrias,
      public.ponto_responsaveis, public.ponto_estabelecimentos, public.ponto_estabelecimento_obras, public.ponto_eventos,
      public.ponto_arp_contadores, public.ponto_arp_registros, public.ponto_tempo_verificacoes, public.ponto_estabelecimentos_auditoria
      from service_role;
    -- Marcação legada e aparelho não são apagados pela API.
    revoke delete on public.ponto_marcacoes, public.ponto_dispositivos from service_role;
    revoke insert, update, delete on public.ponto_marcacoes from service_role;
    -- Auditoria: a service_role só LÊ (o trigger grava como dono). Sem isso,
    -- os privilégios padrão do Supabase deixariam INSERT com a marca de sessão.
    revoke all on public.ponto_estabelecimentos_auditoria from service_role;
    revoke all on sequence public.ponto_estabelecimentos_auditoria_id_seq from service_role;
    grant select on public.ponto_estabelecimentos_auditoria to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
