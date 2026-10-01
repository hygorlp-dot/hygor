// @vitest-environment node
//
// ATUALIZAÇÃO DO APP: aparelho que já tem batidas do formato 1 (legado, "nsr"
// = sequência do aparelho) passa a criar eventos formato 2. Regras provadas:
// - batidas antigas não são renumeradas, alteradas nem apagadas;
// - o primeiro evento novo CONTINUA a sequência local do aparelho (não volta a 1);
// - uma única cadeia local por aparelho, verificável nos dois trechos;
// - só os eventos formato 2 recebem NSR fiscal, e só da ARP;
// - reenvios são idempotentes nos dois caminhos.
// Servidor e banco reais (PGlite com as migrations 016 + 017); no teste de
// reabertura, também o SQL real do aparelho (node:sqlite).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarPendentes, sincronizarCadastro } from "./sincronizacao.js";
import { criarAparelho, criarServidor, sha256 } from "./cenario.test-helper.js";
import { HASH_INICIAL, calcularHashMarcacao, verificarCadeia } from "../../../../src/domains/ponto-eletronico/marcacao.js";
import { verificarCadeiaLocal } from "../../../../src/domains/ponto-eletronico/evento.js";
import { abrirArmazemNode, criarBancoFormato1 } from "../dados/sqlite-node.test-helper.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

let s, A, B;
const sincronizar = ap => sincronizarCadastro({ armazem: ap.armazem, api: ap.api, monotonico: ap.monotonico });
const enviar = ap => enviarPendentes({ armazem: ap.armazem, api: ap.api });

// n batidas formato 1 encadeadas, como as versões antigas do app gravavam.
async function batidasFormato1(dispositivoId, n) {
  const lista = [];
  let anterior = HASH_INICIAL;
  for (let nsr = 1; nsr <= n; nsr++) {
    const m = { id: randomUUID(), dispositivoId, nsr, tipoRegistro: "ponto", employeeId: "e1", terceiroId: "", cpf: "12345678909",
      marcadoEm: `2026-10-01T0${nsr}:00:00.000Z`, relogioAparelho: "", horaConfiavel: true, metodo: "facial", confianca: 0.9,
      encarregadoId: "", gps: null, fotoSha256: "", hashAnterior: anterior };
    m.hash = await calcularHashMarcacao(m, sha256);
    lista.push(m);
    anterior = m.hash;
  }
  return lista;
}
// Como a migração local deixa uma batida antiga no armazém.
const noArmazem = (ap, m) => ap.armazem.eventos.push({ ...m, formatVersion: 1, enviada: false, fotoEstado: 1, caminhoFoto: null, fiscal: null });

beforeEach(async () => {
  s = await criarServidor();
  A = await criarAparelho(s, { obraId: "obra-a", nome: "Portaria A" });
  B = await criarAparelho(s, { obraId: "obra-b", nome: "Portaria B" });
  await sincronizar(A); await sincronizar(B);
});

describe("atualização do formato 1 para o formato 2", () => {
  it("legado JÁ sincronizado (1, 2): os eventos novos são 3 e 4, sem renumerar nada, e só eles ganham NSR da ARP", async () => {
    const antigas = await batidasFormato1(A.dispositivoId, 2);
    antigas.forEach(m => noArmazem(A, m));
    expect(await enviar(A)).toMatchObject({ enviadas: 2, erro: null });          // o app antigo já tinha enviado
    const legadoAntes = await s.sql("select id, nsr, hash, hash_anterior, record_format_version from public.ponto_marcacoes order by nsr");

    const n3 = await A.bater(), n4 = await A.bater();
    expect([n3.localSequence, n4.localSequence]).toEqual([3, 4]);
    expect(n3.localPreviousHash).toBe(antigas[1].hash);
    expect(await enviar(A)).toMatchObject({ enviadas: 2, erro: null });

    // Legado intacto: mesmas linhas, mesmos hashes, mesma numeração antiga.
    expect(await s.sql("select id, nsr, hash, hash_anterior, record_format_version from public.ponto_marcacoes order by nsr")).toEqual(legadoAntes);
    expect(legadoAntes.map(l => [l.id, Number(l.nsr), l.hash, l.record_format_version])).toEqual(antigas.map(m => [m.id, m.nsr, m.hash, 1]));
    // NSR fiscal só nos novos, a partir de 1, pela ARP.
    expect((await s.fiscais(s.estabelecimentoA)).map(f => [Number(f.nsr), f.event_id, Number(f.local_sequence)])).toEqual([[1, n3.eventId, 3], [2, n4.eventId, 4]]);
    // Uma cadeia local só: o trecho antigo confere e o novo continua dele.
    expect((await verificarCadeia(antigas, null, sha256)).erro).toBeNull();
    expect(await verificarCadeiaLocal([n3, n4], { localSequence: 2, localHash: antigas[1].hash }, sha256)).toMatchObject({ erro: null });
    const [d] = await s.sql("select ultimo_nsr, ultima_sequencia_local from public.ponto_dispositivos where id = $1", [A.dispositivoId]);
    expect([Number(d.ultimo_nsr), Number(d.ultima_sequencia_local)]).toEqual([2, 4]);
  });

  it("legado PENDENTE + eventos novos feitos offline: nada se perde, o servidor reconhece os dois formatos, e os reenvios são idempotentes", async () => {
    const antigas = await batidasFormato1(A.dispositivoId, 2);
    antigas.forEach(m => noArmazem(A, m));
    A.online = false;
    const n3 = await A.bater(), n4 = await A.bater();
    expect([n3.localSequence, n4.localSequence]).toEqual([3, 4]);
    A.online = true;
    expect(await enviar(A)).toMatchObject({ enviadas: 4, erro: null });

    const r = await s.admin("ponto-marcacoes", { obraId: "obra-a", de: "2026-09-30T00:00:00Z", ate: "2026-10-02T00:00:00Z" });
    const porId = new Map(r.json.marcacoes.map(m => [m.id, m]));
    for (const m of antigas) expect(porId.get(m.id)).toMatchObject({ formato: 1, nsr: null, legacyDeviceSequence: m.nsr, situacaoFiscal: "legado_sem_nsr" });
    expect(porId.get(n3.eventId)).toMatchObject({ formato: 2, nsr: 1, localSequence: 3, situacaoFiscal: "registrado" });
    expect(porId.get(n4.eventId)).toMatchObject({ formato: 2, nsr: 2, localSequence: 4 });

    // Reenvio do legado: idempotente (nada novo, mesmo topo).
    const rl = await A.api("ponto-enviar-marcacoes", { marcacoes: antigas });
    expect(rl).toMatchObject({ ok: true, aceitas: 0, ultimoNsr: 2 });
    // Reenvio dos novos: mesmo NSR e mesmo hash fiscal.
    const antes = await s.fiscais(s.estabelecimentoA);
    const rn = await A.api("ponto-enviar-marcacoes", { eventos: [n3, n4] });
    expect(rn.resultados.map(x => [x.eventId, x.status, x.nsr, x.fiscalHash])).toEqual(antes.map(f => [f.event_id, "ja_registrado", Number(f.nsr), f.fiscal_hash]));
    expect((await s.sql("select count(*)::int n from public.ponto_marcacoes"))[0].n).toBe(2);
    expect((await s.fiscais(s.estabelecimentoA)).length).toBe(2);
  });

  it("evento novo nunca reaproveita a sequência local de uma batida antiga", async () => {
    const antigas = await batidasFormato1(A.dispositivoId, 2);
    await A.api("ponto-enviar-marcacoes", { marcacoes: antigas });             // servidor já tem o legado 1..2
    const [falso] = await (async () => { const e = await A.bater(); return [{ ...e, localSequence: 1 }]; })();
    const r = await A.api("ponto-enviar-marcacoes", { eventos: [falso] });
    expect(r.resultados[0].status).toMatch(/invalido|conflito/);                 // hash local não confere / sequência já usada
    expect((await s.fiscais(null)).length).toBe(0);
  });
});

describe("banco local real fechado e reaberto durante a atualização", () => {
  let pasta;
  beforeEach(() => { pasta = mkdtempSync(path.join(tmpdir(), "ponto-atualizacao-")); });
  afterEach(() => { rmSync(pasta, { recursive: true, force: true }); });

  it("legado no banco antigo → reabre (migração local) → evento 3 → sincroniza → reabre: eventId, sequência, NSR e hash fiscal continuam associados", async () => {
    const arquivo = path.join(pasta, "ponto-obra.db");
    const antigas = await batidasFormato1(A.dispositivoId, 2);
    criarBancoFormato1(arquivo, antigas);                                        // como a versão antiga deixou

    let { db, armazem } = await abrirArmazemNode(arquivo);
    const usar = arm => {
      A.armazem = arm;
      const salvar = arm.salvarReferenciaHora.bind(arm);
      arm.salvarReferenciaHora = async r => { arm._ref = r; return salvar(r); };
    };
    usar(armazem);
    await sincronizar(A);
    const n3 = await A.bater();
    expect(n3).toMatchObject({ localSequence: 3, localPreviousHash: antigas[1].hash });
    await db.closeAsync();

    ({ db, armazem } = await abrirArmazemNode(arquivo));                        // app fechado e aberto de novo, ainda offline
    usar(armazem);
    expect((await armazem.eventosPendentes(10)).map(e => [e.formatVersion, e.formatVersion === 2 ? e.localSequence : e.legacyDeviceSequence])).toEqual([[1, 1], [1, 2], [2, 3]]);
    expect(await enviar(A)).toMatchObject({ enviadas: 3, erro: null });
    await db.closeAsync();

    ({ db, armazem } = await abrirArmazemNode(arquivo));
    const [fiscal] = await s.fiscais(s.estabelecimentoA);
    expect(fiscal).toMatchObject({ event_id: n3.eventId });
    expect(await armazem.registroFiscal(n3.eventId)).toMatchObject({ nsr: 1, fiscalHash: fiscal.fiscal_hash, estabelecimentoId: s.estabelecimentoA });
    expect(Number(fiscal.local_sequence)).toBe(3);
    expect(await armazem.eventosPendentes(10)).toEqual([]);
    expect(await armazem.ultimoNsrRecebido()).toBe(1);
    await db.closeAsync();
  });
});

describe("retry do evento novo", () => {
  it("ABC recebe o NSR 50; a resposta se perde; o reenvio devolve 50, nunca 51 (lógica e banco)", async () => {
    B.online = false;
    for (let i = 0; i < 49; i++) await B.bater({ pessoa: { tipo: "funcionario", id: "e3", cpf: "11144477735" } });
    B.online = true;
    await enviar(B);
    const abc = await A.bater();
    A.perderResposta = 1;                                                        // grava, mas a resposta não chega
    expect(await enviar(A)).toMatchObject({ semRede: true, enviadas: 0 });
    const [gravado] = await s.sql("select nsr, fiscal_hash from public.ponto_arp_registros where event_id = $1", [abc.eventId]);
    expect(Number(gravado.nsr)).toBe(50);
    expect(await enviar(A)).toMatchObject({ enviadas: 1, erro: null });
    expect(await A.armazem.registroFiscal(abc.eventId)).toMatchObject({ nsr: 50, fiscalHash: gravado.fiscal_hash });
    // Mais um reenvio direto: ainda 50.
    expect((await A.api("ponto-enviar-marcacoes", { eventos: [abc] })).resultados[0]).toMatchObject({ status: "ja_registrado", nsr: 50 });
    expect((await s.sql("select count(*)::int n from public.ponto_arp_registros where event_id = $1", [abc.eventId]))[0].n).toBe(1);
    expect((await s.sql("select max(nsr)::int m, count(*)::int n from public.ponto_arp_registros"))[0]).toEqual({ m: 50, n: 50 });
    // As garantias também estão no banco, não só na lógica.
    const unicos = (await s.sql(`select pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'public.ponto_arp_registros'::regclass and contype in ('p','u')`)).map(c => c.d);
    expect(unicos).toEqual(expect.arrayContaining(["PRIMARY KEY (company_id, event_id)", "UNIQUE (company_id, estabelecimento_id, nsr)"]));
  });
});
