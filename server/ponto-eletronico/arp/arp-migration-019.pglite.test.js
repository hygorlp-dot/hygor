// @vitest-environment node
//
// Migration 019 (PRELIMINAR, fora do deploy automático) num Postgres real
// (PGlite): legado só antes do formato 2, hora de gravação sob a trava do
// contador, inscrição congelada depois do NSR com auditoria, endurecimento
// do aparelho e das permissões, e aplicação sobre dados já existentes sem
// reescrever nada. Especificação: docs/PONTO-OBRA-MIGRATION-019.md.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lerMigration, novoPglite } from "../banco-pglite.test-helper.js";
import { verificarCadeiaFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const C = "arcd";
const uuid = (pref, n) => `${pref}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DISP_A = uuid("a", 1), DISP_B = uuid("b", 1);
const EST = uuid("1", 1);
const ZERO = "0".repeat(64);
const hora = serverTime => ({ serverTime, source: "host", status: "nao_verificada" });

let db;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const registrar = (disp, eventos, h = hora("2026-10-01T12:00:00.000Z")) =>
  q("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)", [C, disp, JSON.stringify(eventos), JSON.stringify(h)]);
const legado = (disp, marcacoes) =>
  q("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, disp, JSON.stringify(marcacoes)]);

// Cadeia local de mentira (o SQL só confere o encadeamento).
function eventos(disp, n, { inicio = 1, anterior = ZERO } = {}) {
  const lista = [];
  for (let i = 0; i < n; i++) {
    const seq = inicio + i, localHash = sha256(`${disp}-${seq}`);
    lista.push({ formatVersion: 2, eventId: uuid(disp[0] === "a" ? "d" : "e", seq), deviceId: disp, localSequence: seq, localPreviousHash: anterior, localHash,
      tipoRegistro: "ponto", employeeId: "emp-1", cpf: "12345678909", marcadoEm: `2026-10-01T10:00:0${seq % 10}.000Z`, horaConfiavel: true, metodo: "facial" });
    anterior = localHash;
  }
  return lista;
}
function marcacoes(disp, n, { inicio = 1, anterior = ZERO } = {}) {
  const lista = [];
  for (let i = 0; i < n; i++) {
    const nsr = inicio + i, hash = sha256(`legado-${disp}-${nsr}`);
    lista.push({ id: uuid("9", nsr + (disp[0] === "a" ? 0 : 500)), nsr, hashAnterior: anterior, hash, employeeId: "emp-1", cpf: "12345678909",
      marcadoEm: "2026-09-30T10:00:00.000Z", metodo: "facial", tipoRegistro: "ponto" });
    anterior = hash;
  }
  return lista;
}
const fiscais = estab => q(`select r.*, e.cpf, e.employee_id, e.marcado_em_texto, e.local_hash from public.ponto_arp_registros r
  join public.ponto_eventos e using (company_id, event_id) where r.estabelecimento_id = $1 order by r.nsr`, [estab]);
const cadeiaFiscalOk = async estab => verificarCadeiaFiscal((await fiscais(estab)).map(r => ({
  estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto", cpf: r.cpf, employeeId: r.employee_id,
  marcadoEm: r.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
  localHash: r.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash,
})), async t => sha256(t));

async function cenario() {
  for (const [id, obra, tok] of [[DISP_A, "obra-a", "a"], [DISP_B, "obra-b", "b"]]) {
    await q("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,$3,'Aparelho',$4,'admin')", [C, id, obra, tok.repeat(64)]);
  }
  await q("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,'Matriz','admin')", [C, EST]);
  for (const o of ["obra-a", "obra-b"]) await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,$2,$3,'admin')", [C, o, EST]);
}

describe("migration 019 aplicada sobre 016-018", () => {
  beforeEach(async () => { db = await novoPglite({ ate: "019" }); await cenario(); });
  afterEach(async () => { await db?.close(); });

  describe("A. legado formato 1 só antes do formato 2", () => {
    it("depois do primeiro evento formato 2, legado NOVO é recusado e nada é gravado; reenvio do já aceito segue idempotente", async () => {
      const antigos = marcacoes(DISP_A, 2);
      expect((await legado(DISP_A, antigos))[0]).toMatchObject({ aceitas: 2, erro: null });
      const [e3] = eventos(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash });
      expect((await registrar(DISP_A, [e3]))[0]).toMatchObject({ status: "registrado", local_sequence: 3 });
      // Legado "3" apontando para o mesmo hash bifurcaria a cadeia: recusado.
      const [l3] = marcacoes(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash });
      const r = (await legado(DISP_A, [l3]))[0];
      expect(r.aceitas).toBe(0);
      expect(r.erro).toMatch(/formato 2/);
      expect((await q("select count(*)::int n from public.ponto_marcacoes"))[0].n).toBe(2);
      // Reenvio do legado já aceito: sem erro (o app confirma pelo topo).
      expect((await legado(DISP_A, antigos))[0]).toMatchObject({ aceitas: 0, ultimo_nsr: 2, erro: null });
    });

    it("lote que não grava nada (aguardando estabelecimento) não mexe no topo da cadeia local; o legado continua e o formato 2 segue dele", async () => {
      await q("delete from public.ponto_estabelecimento_obras where obra_id = 'obra-a'");
      const antigos = marcacoes(DISP_A, 2);
      await legado(DISP_A, antigos);
      expect((await registrar(DISP_A, eventos(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash })))[0].status).toBe("aguardando_estabelecimento");
      const [d] = await q("select ultima_sequencia_local, ultimo_hash_local from public.ponto_dispositivos where id = $1", [DISP_A]);
      expect(Number(d.ultima_sequencia_local)).toBe(0);                 // na 017 virava 2 sem nenhum evento
      const [l3] = marcacoes(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash });
      expect((await legado(DISP_A, [l3]))[0]).toMatchObject({ aceitas: 1, erro: null });
      await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-a',$2,'admin')", [C, EST]);
      const r = await registrar(DISP_A, eventos(DISP_A, 1, { inicio: 4, anterior: l3.hash }));
      expect(r[0]).toMatchObject({ status: "registrado", nsr: 1, local_sequence: 4 });
    });
  });

  describe("B. relógio fiscal (auditoria da regra de hora)", () => {
    // Horários relativos ao relógio REAL do banco (é ele o árbitro).
    const agora = deslocMs => new Date(Date.now() + deslocMs).toISOString();
    const ev = disp => eventos(disp, 1, { inicio: (seqs[disp] = (seqs[disp] || 0) + 1), anterior: ultimos[disp] || ZERO }).map(e => { ultimos[disp] = e.localHash; return e; });
    let seqs, ultimos;
    beforeEach(() => { seqs = {}; ultimos = {}; });
    const ultimo = async () => (await fiscais(EST)).at(-1);

    it("host normal: grava a hora do host, no formato ISO que o JS assina; evidência completa", async () => {
      const h = agora(-200);
      await registrar(DISP_A, ev(DISP_A), { ...hora(h), toleranciaMs: 30000, status: "verificada" });
      const f = await ultimo();
      expect(f.gravado_em_texto).toBe(h);
      expect(new Date(f.gravado_em).toISOString()).toBe(f.gravado_em_texto);
      expect(f.evidencia_hora).toMatchObject({ serverTime: h, status: "verificada", arp: { versao: 19, fonteGravacao: "host", horaHost: h, ajuste: "nenhum", toleranciaMs: 30000 } });
      expect(Math.abs(f.evidencia_hora.arp.diferencaHostBancoMs + 200)).toBeLessThan(5000);
    });

    it("host ATRASADO além da tolerância: grava o relógio do banco e diz por quê (não troca em silêncio)", async () => {
      const h = agora(-10 * 60_000);
      await registrar(DISP_A, ev(DISP_A), hora(h));
      const f = await ultimo();
      expect(Math.abs(Date.parse(f.gravado_em_texto) - Date.now())).toBeLessThan(5000);
      expect(f.evidencia_hora.arp).toMatchObject({ fonteGravacao: "banco:host_divergente", horaHost: h, ajuste: "nenhum" });
      expect(f.evidencia_hora.arp.diferencaHostBancoMs).toBeLessThan(-590_000);
      expect(f.evidencia_hora.serverTime).toBe(h);                    // evidência original preservada
    });

    it("host ADIANTADO / hora no futuro (+1 dia): não vira hora fiscal e NÃO arrasta os NSR seguintes (sem catraca)", async () => {
      await registrar(DISP_A, ev(DISP_A), hora(agora(24 * 3_600_000)));
      await registrar(DISP_B, ev(DISP_B), hora(agora(0)));
      const [a, b] = await fiscais(EST);
      expect(a.evidencia_hora.arp.fonteGravacao).toBe("banco:host_divergente");
      expect(Math.abs(Date.parse(a.gravado_em_texto) - Date.now())).toBeLessThan(5000);
      expect(Date.parse(b.gravado_em_texto)).toBeGreaterThanOrEqual(Date.parse(a.gravado_em_texto));
      expect(b.evidencia_hora.arp.fonteGravacao).toBe("host");
    });

    it("instâncias com relógios diferentes dentro da tolerância: o NSR seguinte nunca fica com hora menor (monotonia marcada)", async () => {
      const adiantada = agora(4000), atrasada = agora(0);
      await registrar(DISP_A, ev(DISP_A), hora(adiantada));
      await registrar(DISP_B, ev(DISP_B), hora(atrasada));
      const [a, b] = await fiscais(EST);
      expect(a.gravado_em_texto).toBe(adiantada);
      expect(b.gravado_em_texto).toBe(adiantada);
      expect(b.evidencia_hora.arp).toMatchObject({ fonteGravacao: "host", horaHost: atrasada, ajuste: "monotonia", gravadoAnterior: adiantada });
      expect(await cadeiaFiscalOk(EST)).toEqual({ ok: true, erro: null });
    });

    it("registro anterior anômalo (no futuro além da tolerância, ex.: gravado antes da 019): o próximo grava a hora verdadeira e marca a regressão", async () => {
      await registrar(DISP_A, ev(DISP_A), hora(agora(0)));
      // Simula um NSR anterior com hora no futuro (como a 017 permitia): reescrita só no banco descartável do teste.
      await q("alter table public.ponto_arp_registros disable trigger ponto_arp_registros_no_update");
      await q("update public.ponto_arp_registros set gravado_em = now() + interval '2 hours' where estabelecimento_id = $1", [EST]);
      await q("alter table public.ponto_arp_registros enable trigger ponto_arp_registros_no_update");
      const h = agora(0);
      await registrar(DISP_B, ev(DISP_B), hora(h));
      const b = await ultimo();
      expect(b.gravado_em_texto).toBe(h);
      expect(b.evidencia_hora.arp).toMatchObject({ fonteGravacao: "host", ajuste: "regressao_registro_anterior_anomalo" });
      expect(b.evidencia_hora.arp.gravadoAnterior).toBeTruthy();
    });

    it("serverTime fora do ISO UTC ('01/02/2026 10:00') ou ausente: relógio do banco, marcado como hora inválida", async () => {
      await registrar(DISP_A, ev(DISP_A), { serverTime: "01/02/2026 10:00", source: "host" });
      await registrar(DISP_B, ev(DISP_B), {});
      for (const f of await fiscais(EST)) {
        expect(f.gravado_em_texto).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(Math.abs(Date.parse(f.gravado_em_texto) - Date.now())).toBeLessThan(5000);
        expect(f.evidencia_hora.arp).toMatchObject({ fonteGravacao: "banco:hora_do_host_invalida", horaHost: null });
      }
      expect(await cadeiaFiscalOk(EST)).toEqual({ ok: true, erro: null });
    });

    it("referência vencida, fora da tolerância HLB ou falha do NTP: a gravação não é bloqueada e o estado da fonte fica na evidência", async () => {
      for (const status of ["verificacao_vencida", "fora_da_tolerancia", "nao_verificada"]) {
        const disp = DISP_A;
        await registrar(disp, ev(disp), { ...hora(agora(0)), status, confiavel: status !== "fora_da_tolerancia", lastVerifiedAt: null, offsetMs: null });
        expect((await ultimo()).evidencia_hora).toMatchObject({ status, arp: { fonteGravacao: "host" } });
      }
      expect((await fiscais(EST)).map(f => Number(f.nsr))).toEqual([1, 2, 3]);
    });

    it("tolerância vem da política (toleranciaMs) e é limitada a 1 s..5 min; valor inválido usa 30 s", async () => {
      await registrar(DISP_A, ev(DISP_A), { ...hora(agora(-3000)), toleranciaMs: 1000 });
      expect((await ultimo()).evidencia_hora.arp).toMatchObject({ fonteGravacao: "banco:host_divergente", toleranciaMs: 1000 });
      await registrar(DISP_A, ev(DISP_A), { ...hora(agora(-3000)), toleranciaMs: 999_999_999 });
      expect((await ultimo()).evidencia_hora.arp).toMatchObject({ toleranciaMs: 300000 });
      await registrar(DISP_A, ev(DISP_A), { ...hora(agora(0)), toleranciaMs: "abc" });
      expect((await ultimo()).evidencia_hora.arp).toMatchObject({ toleranciaMs: 30000 });
    });
  });

  describe("C. identificação fiscal do estabelecimento", () => {
    const atualizar = (campos, por = "fiscal-1") => q(
      `update public.ponto_estabelecimentos set ${Object.keys(campos).map((k, i) => `${k} = $${i + 2}`).join(", ")}, atualizado_por = $${Object.keys(campos).length + 2}, atualizado_em = now() where id = $1`,
      [EST, ...Object.values(campos), por]);
    const auditoria = () => q("select acao, campos, nsr_emitidos::int, responsavel, antes, depois from public.ponto_estabelecimentos_auditoria where estabelecimento_id = $1 order by id", [EST]);

    it("sem NSR emitido a inscrição muda livremente (e fica auditada)", async () => {
      await atualizar({ tipo_inscricao: "cnpj", numero_inscricao: "11222333000181" });
      await atualizar({ numero_inscricao: "11444777000161" });
      expect((await auditoria()).map(a => [a.acao, a.nsr_emitidos])).toEqual([["criado", 0], ["alterado", 0], ["alterado", 0]]);
    });

    it("depois do NSR: preencher a inscrição vazia é permitido UMA vez, com responsável, e a auditoria guarda quantos NSR já existiam", async () => {
      await registrar(DISP_A, eventos(DISP_A, 2));
      await expect(atualizar({ tipo_inscricao: "cnpj", numero_inscricao: "11222333000181" }, "")).rejects.toThrow(/responsável/);
      await atualizar({ tipo_inscricao: "cnpj", numero_inscricao: "11222333000181" });
      const a = (await auditoria()).at(-1);
      expect(a).toMatchObject({ acao: "inscricao_preenchida_apos_nsr", nsr_emitidos: 2, responsavel: "fiscal-1", campos: expect.arrayContaining(["numero_inscricao", "tipo_inscricao"]) });
      expect(a.antes.numero_inscricao).toBeNull();
      // Trocar ou apagar depois disso: recusado.
      await expect(atualizar({ numero_inscricao: "11444777000161" })).rejects.toThrow(/não muda depois de emitido NSR/);
      await expect(atualizar({ tipo_inscricao: null, numero_inscricao: null })).rejects.toThrow(/não muda depois de emitido NSR/);
      await expect(atualizar({ tipo_inscricao: "cpf", numero_inscricao: "12345678909" })).rejects.toThrow(/não muda depois de emitido NSR/);
      // Os registros fiscais anteriores não mudam (o hash cobre o id do estabelecimento, não a inscrição).
      expect(await cadeiaFiscalOk(EST)).toEqual({ ok: true, erro: null });
    });

    it("depois do NSR: CNO/CAEPF/CEI preenchem uma vez; fuso não muda; nome muda (auditado); estabelecimento não é apagado", async () => {
      await registrar(DISP_A, eventos(DISP_A, 1));
      await atualizar({ cno: "123456789012" });
      await expect(atualizar({ cno: "999999999999" })).rejects.toThrow(/CNO/);
      await expect(atualizar({ timezone: "America/Sao_Paulo" })).rejects.toThrow(/fuso/);
      await atualizar({ nome: "Matriz Recife" });
      expect((await auditoria()).at(-1)).toMatchObject({ acao: "alterado", campos: ["nome"], nsr_emitidos: 1 });
      await expect(q("delete from public.ponto_estabelecimentos where id = $1", [EST])).rejects.toThrow();
    });

    it("revisão: a service_role só LÊ a auditoria - nem com a marca de sessão consegue inserir linha forjada", async () => {
      await atualizar({ nome: "Y" });
      await q("set role service_role");
      try {
        expect((await q("select count(*)::int n from public.ponto_estabelecimentos_auditoria")).length).toBe(1);
        await q("select set_config('ponto.estab_auditoria', 'sim', false)");
        await expect(q("insert into public.ponto_estabelecimentos_auditoria(company_id, estabelecimento_id, acao, depois) values ($1, $2, 'alterado', '{}')", [C, EST]))
          .rejects.toThrow(/permission denied/);
      } finally { await q("reset role"); await q("select set_config('ponto.estab_auditoria', '', false)"); }
      const privs = await q(`select privilege_type from information_schema.role_table_grants where grantee = 'service_role' and table_name = 'ponto_estabelecimentos_auditoria'`);
      expect(privs.map(p => p.privilege_type)).toEqual(["SELECT"]);
    });

    it("revisão: preencher a inscrição com responsável HERDADO (sem atualizado_em novo) é recusado", async () => {
      await registrar(DISP_A, eventos(DISP_A, 1));
      await q("update public.ponto_estabelecimentos set nome = 'X', atualizado_por = 'usuario-antigo', atualizado_em = now() where id = $1", [EST]);
      await expect(q("update public.ponto_estabelecimentos set tipo_inscricao = 'cnpj', numero_inscricao = '11222333000181' where id = $1", [EST]))
        .rejects.toThrow(/responsável desta alteração/);
    });

    it("auditoria é append-only e só recebe linhas do trigger", async () => {
      await atualizar({ nome: "X" });
      await expect(q("update public.ponto_estabelecimentos_auditoria set responsavel = 'outro'")).rejects.toThrow(/imutável/);
      await expect(q("delete from public.ponto_estabelecimentos_auditoria")).rejects.toThrow(/imutável/);
      await expect(q("truncate public.ponto_estabelecimentos_auditoria")).rejects.toThrow(/imutável/);
      await expect(q("insert into public.ponto_estabelecimentos_auditoria(company_id, estabelecimento_id, acao, depois) values ($1, $2, 'alterado', '{}')", [C, EST]))
        .rejects.toThrow(/só recebe linhas do próprio banco/);
    });
  });

  describe("D. endurecimento", () => {
    it("aparelho: semente legada, obra e token imutáveis; revogado não volta; atualizações da API seguem funcionando", async () => {
      await expect(q("update public.ponto_dispositivos set ultimo_nsr = 5 where id = $1", [DISP_A])).rejects.toThrow(/sequência legada/);
      await expect(q("update public.ponto_dispositivos set ultimo_hash = $2 where id = $1", [DISP_A, "f".repeat(64)])).rejects.toThrow(/sequência legada/);
      await expect(q("update public.ponto_dispositivos set obra_id = 'outra' where id = $1", [DISP_A])).rejects.toThrow(/não mudam/);
      await expect(q("update public.ponto_dispositivos set token_hash = $2 where id = $1", [DISP_A, "c".repeat(64)])).rejects.toThrow(/não mudam/);
      // O que a API faz (ponto-sincronizar e revogar):
      await q("update public.ponto_dispositivos set ultimo_contato_em = now(), app_versao = '1.0.1', ultimo_gps = '{\"lat\":1}', aparelho = '{\"modelo\":\"X\"}' where id = $1", [DISP_A]);
      await q("update public.ponto_dispositivos set status = 'revogado', revogado_por = 'u', revogado_em = now() where id = $1", [DISP_A]);
      await expect(q("update public.ponto_dispositivos set status = 'ativo' where id = $1", [DISP_A])).rejects.toThrow(/revogado não volta/);
    });

    it("TRUNCATE de ponto_marcacoes bloqueado; service_role sem TRUNCATE nas tabelas do ponto e sem escrita direta no legado", async () => {
      await legado(DISP_A, marcacoes(DISP_A, 1));
      await expect(q("truncate public.ponto_marcacoes")).rejects.toThrow(/append-only/);
      const privs = await q(`select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'service_role' and table_schema = 'public' and table_name like 'ponto%' and privilege_type in ('TRUNCATE','DELETE','INSERT','UPDATE')`);
      expect(privs.filter(p => p.privilege_type === "TRUNCATE")).toEqual([]);
      expect(privs.filter(p => p.table_name === "ponto_marcacoes")).toEqual([]);
      expect(privs.filter(p => p.table_name === "ponto_dispositivos" && p.privilege_type === "DELETE")).toEqual([]);
      const [f] = await q("select has_function_privilege('anon', 'public.ponto_arp_texto_fiscal(uuid, bigint, uuid, text, text, text, text, text, uuid, bigint, text, text)', 'execute') pode");
      expect(f.pode).toBe(false);
    });

    it("marcas de sessão desligadas ao fim das funções: na mesma transação não dá para inserir direto na ARP", async () => {
      await q("begin");
      await registrar(DISP_A, eventos(DISP_A, 1));
      await legado(DISP_B, marcacoes(DISP_B, 1));
      expect((await q("select current_setting('ponto.arp_ingresso', true) a, current_setting('ponto.legado_ingresso', true) l"))[0]).toEqual({ a: "", l: "" });
      await expect(q(`insert into public.ponto_eventos(company_id,event_id,dispositivo_id,obra_id,local_sequence,local_previous_hash,local_hash,tipo_registro,employee_id,marcado_em,marcado_em_texto,hora_confiavel,metodo,payload)
        values ($1, gen_random_uuid(), $2, 'obra-a', 9, $3, $3, 'ponto', 'e', now(), 'x', true, 'facial', '{}')`, [C, DISP_A, ZERO])).rejects.toThrow(/só recebe registros pela ARP/);
      await q("rollback");
    });

    it("revisão: semente local deixada pela 017 num lote vazio também bloqueia legado novo (sem bifurcação)", async () => {
      const antigos = marcacoes(DISP_A, 2);
      await legado(DISP_A, antigos);
      // Como a 017 deixava: topo da cadeia local gravado sem nenhum evento (reproduzido só no banco descartável).
      await q("alter table public.ponto_dispositivos disable trigger ponto_dispositivos_protegido");
      await q("update public.ponto_dispositivos set ultima_sequencia_local = 2, ultimo_hash_local = $2 where id = $1", [DISP_A, antigos[1].hash]);
      await q("alter table public.ponto_dispositivos enable trigger ponto_dispositivos_protegido");
      const [l3] = marcacoes(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash });
      expect((await legado(DISP_A, [l3]))[0]).toMatchObject({ aceitas: 0, erro: expect.stringMatching(/formato 2/) });
      expect((await registrar(DISP_A, eventos(DISP_A, 1, { inicio: 3, anterior: antigos[1].hash })))[0]).toMatchObject({ status: "registrado", local_sequence: 3 });
    });

    it("revisão: serverTime no formato certo mas data impossível (30/02) não derruba o lote: vira relógio do banco", async () => {
      const [r] = await registrar(DISP_A, eventos(DISP_A, 1), { serverTime: "2026-02-30T10:00:00.000Z", source: "host" });
      expect(r.status).toBe("registrado");
      const [f] = await fiscais(EST);
      expect(f.evidencia_hora.arp).toMatchObject({ fonteGravacao: "banco:hora_do_host_invalida", horaHost: null });
    });

    it("search_path endurecido nas funções security definer", async () => {
      const r = await q(`select p.proname, array_to_string(p.proconfig, ',') cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('ponto_arp_registrar','ponto_registrar_marcacoes','ponto_apropriacao_salvar','ponto_apropriacao_cancelar') order by 1`);
      expect(r).toHaveLength(4);
      for (const f of r) expect(f.cfg).toBe("search_path=pg_catalog, public, pg_temp");
    });
  });
});

describe("migration 019 sobre um banco que já tem dados (como produção)", () => {
  beforeEach(async () => { db = await novoPglite({ ate: "018" }); await cenario(); });
  afterEach(async () => { await db?.close(); });

  const tabelas = ["ponto_dispositivos", "ponto_marcacoes", "ponto_eventos", "ponto_arp_registros", "ponto_arp_contadores", "ponto_estabelecimentos", "ponto_estabelecimento_obras", "ponto_tempo_verificacoes"];
  const retrato = async () => Object.fromEntries(await Promise.all(tabelas.map(async t => [t, await q(`select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text), '')) h, count(*)::int n from public.${t} x`)])));

  it("aplicar a 019 não reescreve nenhuma linha, cria a linha de base da auditoria e a ARP continua de onde estava", async () => {
    await legado(DISP_B, marcacoes(DISP_B, 2));
    await registrar(DISP_A, eventos(DISP_A, 2));
    const antes = await retrato();
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    expect(await retrato()).toEqual(antes);
    expect(await q("select acao, nsr_emitidos::int, responsavel from public.ponto_estabelecimentos_auditoria")).toEqual([{ acao: "linha_de_base", nsr_emitidos: 2, responsavel: "migration-019" }]);
    // Reaplicar não duplica a linha de base.
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    expect((await q("select count(*)::int n from public.ponto_estabelecimentos_auditoria"))[0].n).toBe(1);
    // A cadeia segue: NSR 3 e a cadeia fiscal inteira confere.
    const e = eventos(DISP_A, 3);
    expect((await registrar(DISP_A, [e[2]]))[0]).toMatchObject({ status: "registrado", nsr: 3 });
    expect(await cadeiaFiscalOk(EST)).toEqual({ ok: true, erro: null });
  });

  it("revisão: down -> cadastro muda sem auditoria -> up de novo: a trilha ganha 'reaplicacao' com o estado atual (sem buraco)", async () => {
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    await db.exec(lerMigration("019_ponto_integridade_fiscal.down.sql"));
    await q("update public.ponto_estabelecimentos set tipo_inscricao = 'cnpj', numero_inscricao = '11222333000181' where id = $1", [EST]);
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    const linhas = await q("select acao, antes->>'numero_inscricao' antes, depois->>'numero_inscricao' depois from public.ponto_estabelecimentos_auditoria order by id");
    expect(linhas).toEqual([{ acao: "linha_de_base", antes: null, depois: null }, { acao: "reaplicacao", antes: null, depois: "11222333000181" }]);
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));     // sem mudança: nenhuma linha nova
    expect((await q("select count(*)::int n from public.ponto_estabelecimentos_auditoria"))[0].n).toBe(2);
  });

  it("reverter (down) devolve as funções da 016/017 sem apagar a auditoria", async () => {
    await registrar(DISP_A, eventos(DISP_A, 1));
    await db.exec(lerMigration("019_ponto_integridade_fiscal.up.sql"));
    await db.exec(lerMigration("019_ponto_integridade_fiscal.down.sql"));
    expect((await q("select count(*)::int n from public.ponto_estabelecimentos_auditoria"))[0].n).toBe(1);
    // Sem a 019 a inscrição volta a mudar livremente (comportamento da 017).
    await q("update public.ponto_estabelecimentos set tipo_inscricao = 'cnpj', numero_inscricao = '11222333000181' where id = $1", [EST]);
    await q("update public.ponto_estabelecimentos set numero_inscricao = '11444777000161' where id = $1", [EST]);
    expect((await registrar(DISP_A, [eventos(DISP_A, 2)[1]]))[0]).toMatchObject({ status: "registrado", nsr: 2 });
  });
});

describe("019 é PRELIMINAR", () => {
  it("não está no deploy automático (scripts/apply-ponto-eletronico.mjs): incluir exige autorização e muda este teste de propósito", () => {
    const script = readFileSync(new URL("../../../scripts/apply-ponto-eletronico.mjs", import.meta.url), "utf8");
    expect(script).not.toMatch(/019_/);
  });
});
