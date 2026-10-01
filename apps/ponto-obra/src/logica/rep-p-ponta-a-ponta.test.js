// @vitest-environment node
//
// REP-P ponta a ponta com VÁRIOS aparelhos: cada aparelho mantém sua
// sequência local e sua cadeia local; todos os aparelhos do mesmo
// estabelecimento dividem UMA sequência de NSR, atribuída só pela ARP no
// banco (Postgres real via PGlite). A ordem dos NSR é a ordem em que a ARP
// grava - os testes não supõem nada além disso.
//
// (Concorrência com conexões realmente paralelas: server/ponto-eletronico/
// arp/arp-concorrencia.pg.test.js, que roda na CI contra um Postgres de verdade.)
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enviarPendentes, sincronizarCadastro } from "./sincronizacao.js";
import { criarAparelho, criarServidor, sha256 } from "./cenario.test-helper.js";
import { HASH_INICIAL, calcularHashMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

let s, A, B;
const sincronizar = ap => sincronizarCadastro({ armazem: ap.armazem, api: ap.api, monotonico: ap.monotonico });
const enviar = (ap, extra = {}) => enviarPendentes({ armazem: ap.armazem, api: ap.api, ...extra });
const enviarUm = ap => enviar(ap, { lote: 1, maxRodadas: 1 });

beforeEach(async () => {
  s = await criarServidor();                                   // estabelecimento X = obras A e B
  A = await criarAparelho(s, { obraId: "obra-a", nome: "Portaria A" });
  B = await criarAparelho(s, { obraId: "obra-b", nome: "Portaria B" });
  await sincronizar(A); await sincronizar(B);
});

const unicos = lista => new Set(lista).size === lista.length;

describe("REP-P: sequência local por aparelho, NSR fiscal por estabelecimento", () => {
  it("A1 A2 / B1 B2 offline, sincronizados como B1, A1, B2, A2: NSR na ordem de gravação, nada perdido nem duplicado", async () => {
    A.online = false; B.online = false;
    const a1 = await A.bater(), a2 = await A.bater();
    const b1 = await B.bater({ pessoa: { tipo: "funcionario", id: "e3", cpf: "11144477735" } });
    const b2 = await B.bater({ pessoa: { tipo: "funcionario", id: "e3", cpf: "11144477735" } });
    expect([a1.localSequence, a2.localSequence, b1.localSequence, b2.localSequence]).toEqual([1, 2, 1, 2]);   // cada um a sua
    A.online = true; B.online = true;

    await enviarUm(B); await enviarUm(A); await enviarUm(B); await enviarUm(A);

    const fiscais = await s.fiscais(s.estabelecimentoA);
    expect(fiscais.map(f => [Number(f.nsr), f.event_id])).toEqual([[1, b1.eventId], [2, a1.eventId], [3, b2.eventId], [4, a2.eventId]]);
    expect(unicos(fiscais.map(f => f.event_id))).toBe(true);
    // Cada aparelho guardou o NSR do SEU evento.
    expect((await A.armazem.registroFiscal(a1.eventId)).nsr).toBe(2);
    expect((await B.armazem.registroFiscal(b2.eventId)).nsr).toBe(3);
    // Todos no mesmo estabelecimento; cadeias locais separadas por aparelho.
    const eventos = await s.eventos();
    expect(new Set(eventos.map(e => e.estabelecimento_id))).toEqual(new Set([s.estabelecimentoA]));
    const disp = await s.sql("select id, ultima_sequencia_local from public.ponto_dispositivos order by nome");
    expect(disp.map(d => Number(d.ultima_sequencia_local))).toEqual([2, 2]);

    // Reenvio de tudo (retry manual): mesmos NSR, nenhum registro novo.
    const r = await A.api("ponto-enviar-marcacoes", { eventos: [a1, a2] });
    expect(r.resultados.map(x => [x.eventId, x.status, x.nsr])).toEqual([[a1.eventId, "ja_registrado", 2], [a2.eventId, "ja_registrado", 4]]);
    expect((await s.fiscais(s.estabelecimentoA)).length).toBe(4);
  });

  it("dez eventos de dois aparelhos enviados ao mesmo tempo: NSR 1..10 sem colisão nem lacuna", async () => {
    A.online = false; B.online = false;
    for (let i = 0; i < 5; i++) { await A.bater(); await B.bater({ pessoa: { tipo: "funcionario", id: "e3", cpf: "11144477735" } }); }
    A.online = true; B.online = true;
    const [ra, rb] = await Promise.all([enviar(A, { lote: 2 }), enviar(B, { lote: 3 })]);
    expect(ra.enviadas + rb.enviadas).toBe(10);
    const fiscais = await s.fiscais(s.estabelecimentoA);
    expect(fiscais.map(f => Number(f.nsr))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(unicos(fiscais.map(f => f.event_id))).toBe(true);
  });

  it("retry SIMULTÂNEO do mesmo eventId: um só NSR, a mesma resposta para os dois", async () => {
    const e = await A.bater();
    const [r1, r2] = await Promise.all([
      A.api("ponto-enviar-marcacoes", { eventos: [e] }),
      A.api("ponto-enviar-marcacoes", { eventos: [e] }),
    ]);
    const nsrs = [r1, r2].map(r => r.resultados[0].nsr);
    expect(nsrs).toEqual([1, 1]);
    expect(r1.resultados[0].fiscalHash).toBe(r2.resultados[0].fiscalHash);
    expect([r1, r2].map(r => r.resultados[0].status).sort()).toEqual(["ja_registrado", "registrado"]);
    expect((await s.fiscais(s.estabelecimentoA)).length).toBe(1);
  });

  it("timeout DEPOIS do commit: o aparelho não sabe, reenvia e recebe o MESMO NSR (sem lacuna, sem duplicata)", async () => {
    const e = await A.bater();
    A.perderResposta = 1;                                       // servidor grava, resposta some
    expect(await enviar(A)).toMatchObject({ semRede: true, enviadas: 0 });
    expect((await A.armazem.eventosPendentes(5)).map(x => x.eventId)).toEqual([e.eventId]);
    const fiscalNoServidor = (await s.fiscais(s.estabelecimentoA))[0];
    expect(await enviar(A)).toMatchObject({ enviadas: 1, erro: null });
    expect(await A.armazem.registroFiscal(e.eventId)).toMatchObject({ nsr: 1, fiscalHash: fiscalNoServidor.fiscal_hash });
    const outro = await B.bater({ pessoa: { tipo: "funcionario", id: "e3", cpf: "11144477735" } });
    await enviar(B);
    expect((await B.armazem.registroFiscal(outro.eventId)).nsr).toBe(2);   // nada queimado no meio
  });

  it("estabelecimentos distintos: sequências de NSR independentes", async () => {
    const estX = await s.criarEstabelecimento("Outra inscrição", ["obra-x"]);
    const X = await criarAparelho(s, { obraId: "obra-x", nome: "Portaria X" });
    await sincronizar(X);
    await A.bater(); await A.bater(); await enviar(A);
    const ex = await X.bater();
    await enviar(X);
    expect((await X.armazem.registroFiscal(ex.eventId))).toMatchObject({ nsr: 1, estabelecimentoId: estX });
    expect((await s.fiscais(estX)).length).toBe(1);
    expect((await s.fiscais(s.estabelecimentoA)).length).toBe(2);
  });

  it("evento adulterado no meio do lote: os anteriores gravam; ele e os seguintes ficam guardados; nenhum NSR é queimado", async () => {
    A.online = false;
    const [e1, e2, e3] = [await A.bater(), await A.bater(), await A.bater()];
    A.armazem.eventos.find(x => x.eventId === e2.eventId).employeeId = "e2";   // alguém mexeu no banco local
    A.online = true;
    const r = await enviar(A);
    expect(r).toMatchObject({ enviadas: 1, status: "invalido" });
    expect((await A.armazem.eventosPendentes(5)).map(x => x.eventId)).toEqual([e2.eventId, e3.eventId]);
    expect((await s.fiscais(s.estabelecimentoA)).map(f => [Number(f.nsr), f.event_id])).toEqual([[1, e1.eventId]]);
  });

  it("obra sem estabelecimento: batidas ficam no aparelho (sem NSR) e sobem quando o vínculo é feito no ARCD", async () => {
    const semEst = await criarServidor({ estabelecimento: false });
    const P = await criarAparelho(semEst, { obraId: "obra-a" });
    await sincronizar(P);
    const e = await P.bater();
    expect(e.estabelecimentoId).toBe("");
    expect(await enviar(P)).toMatchObject({ aguardandoEstabelecimento: true, enviadas: 0 });
    expect((await P.armazem.eventosPendentes(5)).length).toBe(1);
    const est = await semEst.criarEstabelecimento("Matriz", ["obra-a"]);
    expect(await enviar(P)).toMatchObject({ enviadas: 1, erro: null });
    expect(await P.armazem.registroFiscal(e.eventId)).toMatchObject({ nsr: 1, estabelecimentoId: est });
  });

  it("aparelho atualizado com batida antiga (formato 1) pendente: ela sobe como legado, intacta, e o evento novo continua a mesma cadeia local", async () => {
    const antiga = { formatVersion: 1, id: randomUUID(), dispositivoId: A.dispositivoId, nsr: 1, tipoRegistro: "ponto", employeeId: "e1", terceiroId: "",
      cpf: "12345678909", marcadoEm: "2026-10-01T09:00:00.000Z", horaConfiavel: true, metodo: "facial", confianca: 0.9, encarregadoId: "", gps: null, fotoSha256: "", hashAnterior: HASH_INICIAL };
    antiga.hash = await calcularHashMarcacao(antiga, sha256);
    A.armazem.eventos.push({ ...antiga, enviada: false, fotoEstado: 1, caminhoFoto: null, fiscal: null });   // como a migração local deixa
    const nova = await A.bater();
    expect(nova).toMatchObject({ localSequence: 2, localPreviousHash: antiga.hash });
    expect(await enviar(A)).toMatchObject({ enviadas: 2, erro: null });
    const legado = await s.sql("select id, nsr, hash, record_format_version from public.ponto_marcacoes");
    expect(legado).toEqual([{ id: antiga.id, nsr: 1, hash: antiga.hash, record_format_version: 1 }]);
    expect((await s.fiscais(s.estabelecimentoA)).map(f => [Number(f.nsr), f.event_id, Number(f.local_sequence)])).toEqual([[1, nova.eventId, 2]]);
  });

  it("aparelho revogado: para de sincronizar, mas banco, eventos e cadeia local ficam intactos", async () => {
    A.online = false;
    const e1 = await A.bater(), e2 = await A.bater();
    A.online = true;
    await s.admin("ponto-dispositivo-revogar", { dispositivoId: A.dispositivoId });
    const r = await enviar(A);
    expect(r).toMatchObject({ codigo: "APARELHO_REVOGADO", enviadas: 0 });
    const guardados = await A.armazem.eventosPendentes(5);
    expect(guardados.map(x => [x.eventId, x.localSequence, x.localHash])).toEqual([[e1.eventId, 1, e1.localHash], [e2.eventId, 2, e2.localHash]]);
    expect((await s.fiscais(null)).length).toBe(0);
  });
});
