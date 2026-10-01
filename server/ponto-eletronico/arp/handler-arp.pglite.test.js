// @vitest-environment node
//
// Ações do ARCD e da ARP no tratador real, sobre Postgres real (PGlite com as
// migrations 016 + 017): estabelecimento, vínculo de obra, consulta que junta
// formato 2 (com NSR fiscal) e legado (sem NSR), foto de evento e hora.
import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarTratadorPonto } from "../handler.js";
import { POLITICA_PADRAO } from "../tempo/fonte-hora.js";
import { camadaSupabase, novoPglite } from "../banco-pglite.test-helper.js";
import { FORMATO_EVENTO, HASH_INICIAL, calcularHashLocal } from "../../../src/domains/ponto-eletronico/evento.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const sha256 = v => createHash("sha256").update(v).digest("hex");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const USUARIOS = { admin: { id: "u-admin", role: "admin" }, rh: { id: "u-rh", role: "rh" }, eng: { id: "u-eng", role: "engenheiro" } };
const DADOS = {
  obras: [{ id: "obra-a", name: "Alameda" }, { id: "obra-b", name: "Galpão" }],
  usuarios: Object.values(USUARIOS).map(u => ({ ...u, nome: u.id, active: true })),
  employees: [{ id: "e1", name: "Zé", cpf: "123.456.789-09", obra: "obra-a", active: true }],
  terceirizados: [],
};

let pg, db, relogio, criar, tratar;
const como = (quem, action, body = {}) => tratar({ action, body: { accessToken: quem, ...body } });
beforeEach(async () => {
  pg = await novoPglite();
  db = camadaSupabase(pg);
  relogio = Date.parse("2026-10-01T10:00:00.000Z");
  criar = (extra = {}) => criarTratadorPonto({
    db, company: "arcd", lerDados: async () => DADOS, agora: () => new Date(relogio),
    autenticarUsuario: async b => USUARIOS[b.accessToken] || null, ...extra,
  });
  tratar = criar();
});
afterEach(async () => { await pg?.close(); });

async function parear(obraId = "obra-a") {
  const { json: { codigo } } = await como("admin", "ponto-codigo-pareamento", { obraId, nome: "Portaria" });
  const r = await tratar({ action: "ponto-parear", body: { codigo } });
  const disp = r.json;
  disp.api = (action, body = {}) => tratar({ action, body, headers: { authorization: `Bearer ${disp.token}` } });
  return disp;
}
async function eventoDe(disp, seq, anterior = HASH_INICIAL, extra = {}) {
  const e = { formatVersion: FORMATO_EVENTO, eventId: randomUUID(), deviceId: disp.dispositivoId, estabelecimentoId: "", localSequence: seq,
    tipoRegistro: "ponto", employeeId: "e1", terceiroId: "", cpf: "12345678909", marcadoEm: "2026-10-01T10:00:00.000Z",
    horaConfiavel: true, metodo: "facial", confianca: 0.9, localPreviousHash: anterior, ...extra };
  e.localHash = await calcularHashLocal(e, sha256);
  return e;
}

describe("estabelecimento fiscal no ARCD", () => {
  it("só admin e RH cadastram; dado inválido é recusado com o motivo", async () => {
    expect((await como("eng", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "X" } })).status).toBe(403);
    const ruim = await como("rh", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "X", tipoInscricao: "cnpj", numeroInscricao: "11.222.333/0001-80" } });
    expect(ruim).toMatchObject({ status: 400, json: { error: "CNPJ com dígito verificador inválido" } });
    const ok = await como("rh", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "Matriz", tipoInscricao: "cnpj", numeroInscricao: "11.222.333/0001-81" } });
    expect(ok.json.estabelecimento).toMatchObject({ nome: "Matriz", tipoInscricao: "cnpj", numeroInscricao: "11222333000181" });
    const editado = await como("admin", "ponto-estabelecimento-salvar", { estabelecimento: { id: ok.json.estabelecimento.id, nome: "Matriz SP", cno: "123456789012" } });
    expect(editado.json.estabelecimento).toMatchObject({ nome: "Matriz SP", cno: "123456789012", tipoInscricao: null });
  });

  it("vínculo de obra, listagem com último NSR e pendências; troca bloqueada depois que aparelho gravou", async () => {
    const { json: { estabelecimento: e1 } } = await como("admin", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "E1" } });
    const { json: { estabelecimento: e2 } } = await como("admin", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "E2" } });
    expect((await como("eng", "ponto-estabelecimento-vincular-obra", { obraId: "obra-a", estabelecimentoId: e1.id })).status).toBe(403);
    expect((await como("admin", "ponto-estabelecimento-vincular-obra", { obraId: "obra-a", estabelecimentoId: e1.id })).status).toBe(200);
    const d = await parear("obra-a");
    const ev = await eventoDe(d, 1);
    expect((await d.api("ponto-enviar-marcacoes", { eventos: [ev] })).json.resultados[0]).toMatchObject({ status: "registrado", nsr: 1 });
    const lista = await como("eng", "ponto-estabelecimentos");
    expect(lista.json.estabelecimentos.find(x => x.id === e1.id)).toMatchObject({ obras: ["obra-a"], ultimoNsr: 1, pendencias: ["inscrição (CNPJ/CPF) não cadastrada"] });
    expect(lista.json.repP).toMatchObject({ conforme: false });
    expect((await como("admin", "ponto-estabelecimento-vincular-obra", { obraId: "obra-a", estabelecimentoId: e2.id })).status).toBe(409);
    expect((await como("admin", "ponto-estabelecimento-vincular-obra", { obraId: "obra-b", estabelecimentoId: e2.id })).status).toBe(200);
    expect((await como("admin", "ponto-estabelecimento-vincular-obra", { obraId: "obra-b", estabelecimentoId: "" })).json).toEqual({ obraId: "obra-b", estabelecimentoId: null });
  });
});

describe("consulta e foto", () => {
  it("ponto-marcacoes junta formato 2 (com NSR fiscal) e legado (sem NSR, só sequência local)", async () => {
    const { json: { estabelecimento: e } } = await como("admin", "ponto-estabelecimento-salvar", { estabelecimento: { nome: "E" } });
    await como("admin", "ponto-estabelecimento-vincular-obra", { obraId: "obra-a", estabelecimentoId: e.id });
    const d = await parear("obra-a");
    const legado = { id: randomUUID(), dispositivoId: d.dispositivoId, nsr: 1, tipoRegistro: "ponto", employeeId: "e1", cpf: "12345678909",
      marcadoEm: "2026-10-01T09:00:00.000Z", horaConfiavel: true, metodo: "facial", confianca: 0.9, hashAnterior: "0".repeat(64) };
    const { calcularHashMarcacao } = await import("../../../src/domains/ponto-eletronico/marcacao.js");
    legado.hash = await calcularHashMarcacao(legado, sha256);
    expect((await d.api("ponto-enviar-marcacoes", { marcacoes: [legado] })).json).toMatchObject({ aceitas: 1, ultimoNsr: 1 });
    // Cadeia local única do aparelho: o primeiro evento formato 2 continua do legado.
    const novo = await eventoDe(d, 2, legado.hash, { fotoSha256: sha256(JPEG) });
    await d.api("ponto-enviar-marcacoes", { eventos: [novo] });
    const r = await como("eng", "ponto-marcacoes", { obraId: "obra-a", de: "2026-10-01T00:00:00Z", ate: "2026-10-02T00:00:00Z" });
    const porId = new Map(r.json.marcacoes.map(m => [m.id, m]));
    expect(porId.get(novo.eventId)).toMatchObject({ formato: 2, nsr: 1, localSequence: 2, estabelecimentoId: e.id, situacaoFiscal: "registrado", temFoto: true });
    expect(porId.get(legado.id)).toMatchObject({ formato: 1, nsr: null, localSequence: 1, situacaoFiscal: "legado_sem_nsr" });
    // Foto do evento formato 2: aceita só a mesma, e o ARCD vê por link assinado.
    expect((await d.api("ponto-enviar-foto", { marcacaoId: novo.eventId, foto: Buffer.from([0xff, 0xd8, 9]).toString("base64") })).status).toBe(400);
    expect((await d.api("ponto-enviar-foto", { marcacaoId: novo.eventId, foto: JPEG.toString("base64") })).status).toBe(200);
    expect((await como("eng", "ponto-foto-url", { marcacaoId: novo.eventId })).json.url).toMatch(/^https:\/\/assinado\/marcacoes\/obra-a\/2026-10-01\//);
  });
});

describe("fonte de hora", () => {
  const medicao = { ok: true, servidor: "b.st1.ntp.br", verificadoEm: "2026-10-01T09:59:00.000Z", offsetMs: 8, atrasoMs: 20, incertezaMs: 11, estrato: 1, erro: null };

  it("ponto-tempo-verificar: só admin ou rotina agendada; grava a medição e a sincronização passa a mostrar a origem", async () => {
    tratar = criar({ verificarHoraNtp: async () => medicao });
    expect((await como("rh", "ponto-tempo-verificar")).status).toBe(403);
    expect((await tratar({ action: "ponto-tempo-verificar", body: {}, cron: true })).status).toBe(200);
    const st = await como("eng", "ponto-tempo-status");
    expect(st.json.tempo).toMatchObject({ source: "host+ntp:b.st1.ntp.br", offsetMs: 8, uncertaintyMs: 11, status: "verificada", confiavel: true });
    expect(st.json.verificacoes).toHaveLength(1);
    const d = await parear();
    const sync = await d.api("ponto-sincronizar");
    expect(sync.json.tempo).toMatchObject({ source: "host+ntp:b.st1.ntp.br", lastVerifiedAt: medicao.verificadoEm });
    expect(sync.json.servidorMs).toBe(relogio);
  });

  it("sem verificador configurado: 501, sem inventar medição", async () => {
    expect((await como("admin", "ponto-tempo-verificar")).status).toBe(501);
  });

  it("política que exige verificação: sem medição, a referência entregue ao aparelho não é confiável", async () => {
    tratar = criar({ politicaHora: { ...POLITICA_PADRAO, exigirVerificacao: true } });
    const d = await parear();
    expect((await d.api("ponto-sincronizar")).json.tempo).toMatchObject({ status: "nao_verificada", confiavel: false });
  });

  it("verificação diária que falha NÃO apaga a última evidência válida; uma nova medição boa a renova", async () => {
    let proxima = medicao;
    tratar = criar({ verificarHoraNtp: async () => proxima });
    await tratar({ action: "ponto-tempo-verificar", body: {}, cron: true });
    relogio += 24 * 3_600_000;
    proxima = { ok: false, servidor: "a.st1.ntp.br,b.st1.ntp.br", verificadoEm: new Date(relogio).toISOString(), erro: "tempo esgotado" };
    await tratar({ action: "ponto-tempo-verificar", body: {}, cron: true });
    let st = await como("admin", "ponto-tempo-status");
    expect(st.json.tempo).toMatchObject({ source: "host+ntp:b.st1.ntp.br", lastVerifiedAt: medicao.verificadoEm, confiavel: true });
    relogio += 7 * 3_600_000;                                   // passou da validade (30 h) sem nova medição boa
    tratar = criar({ verificarHoraNtp: async () => proxima });   // cache novo
    st = await como("admin", "ponto-tempo-status");
    expect(st.json.tempo.status).toBe("verificacao_vencida");
    proxima = { ...medicao, verificadoEm: new Date(relogio).toISOString(), offsetMs: 3 };
    await tratar({ action: "ponto-tempo-verificar", body: {}, cron: true });
    st = await como("admin", "ponto-tempo-status");
    expect(st.json.tempo).toMatchObject({ status: "verificada", offsetMs: 3 });
  });

  it("medição que falhou fica registrada (ok=false) e não vira evidência", async () => {
    tratar = criar({ verificarHoraNtp: async () => ({ ok: false, servidor: "a.st1.ntp.br", verificadoEm: "2026-10-01T10:00:00.000Z", erro: "UDP bloqueado" }) });
    await como("admin", "ponto-tempo-verificar");
    const st = await como("admin", "ponto-tempo-status");
    expect(st.json.tempo.source).toBe("host");
    expect(st.json.verificacoes[0]).toMatchObject({ ok: false, erro: "UDP bloqueado" });
  });
});
