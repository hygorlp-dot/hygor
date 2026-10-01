// @vitest-environment node
//
// Aparelho e servidor juntos: os eventos são montados pela lógica real do
// app (terminal.js) e enviados pela sincronização real (sincronizacao.js) ao
// tratador real do servidor (server/ponto-eletronico/handler.js), que grava
// num Postgres real (PGlite com as migrations 016 + 017). Se o formato, o
// encadeamento ou o contrato eventId -> NSR divergir entre os lados, quebra.
import { pbkdf2Sync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enviarFotos, enviarPendentes, sincronizarCadastro } from "./sincronizacao.js";
import { proximaEsperaPin, verificarPinResponsavel } from "./pin.js";
import { JPEG, criarAparelho, criarCenario, sha256 } from "./cenario.test-helper.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const pbkdf2Hex = (pin, salt, it) => pbkdf2Sync(pin, salt, it, 32, "sha256").toString("hex");

let s, a;
beforeEach(async () => { ({ s, a } = await criarCenario()); });
const sincronizar = (ap = a) => sincronizarCadastro({ armazem: ap.armazem, api: ap.api, monotonico: ap.monotonico });
const enviar = (ap = a, extra = {}) => enviarPendentes({ armazem: ap.armazem, api: ap.api, ...extra });

describe("aparelho + servidor, ponta a ponta", () => {
  it("sincroniza a base única, bate offline com a hora do servidor e a ARP atribui o NSR quando a rede volta", async () => {
    const r = await sincronizar();
    expect(r).toMatchObject({ ok: true, cadeiaDivergente: false });
    expect(r.estabelecimento).toMatchObject({ id: s.estabelecimentoA });
    expect((await a.armazem.cadastro()).funcionarios.map(f => f.id)).toEqual(["e3", "e2", "e1"]);   // funcionário global: e3 é lotado na obra-b

    a.online = false;
    a.passar(2 * 3_600_000);
    const b1 = await a.bater();
    a.passar(4 * 3_600_000);
    const b2 = await a.bater();
    expect(b1.marcadoEm).toBe("2026-10-01T12:00:00.000Z");   // hora do servidor, não a do celular adiantado
    expect(b1).toMatchObject({ horaConfiavel: true, localSequence: 1, formatVersion: 2 });
    expect(b1).not.toHaveProperty("nsr");                      // evento local não tem NSR
    expect((await enviar()).semRede).toBe(true);

    a.online = true;
    expect(await enviar()).toMatchObject({ enviadas: 2, erro: null });
    const fiscais = await s.fiscais(s.estabelecimentoA);
    expect(fiscais.map(f => [Number(f.nsr), f.event_id, Number(f.local_sequence)])).toEqual([[1, b1.eventId, 1], [2, b2.eventId, 2]]);
    expect(await a.armazem.registroFiscal(b1.eventId)).toMatchObject({ nsr: 1, fiscalHash: fiscais[0].fiscal_hash, estabelecimentoId: s.estabelecimentoA });
    expect(await a.armazem.eventosPendentes(10)).toEqual([]);
  });

  it("a sincronização não muda nada do evento: só guarda NSR e hash fiscal ao lado", async () => {
    await sincronizar();
    const b = await a.bater();
    const antes = JSON.stringify((await a.armazem.eventosPendentes(1))[0]);
    await enviar();
    const depois = a.armazem.eventos.find(e => e.eventId === b.eventId);
    const { enviada, fotoEstado, caminhoFoto, fiscal, motivoFoto, ...material } = depois;
    expect(JSON.stringify(material)).toBe(antes);
    expect(fiscal.nsr).toBe(1);
    const [noServidor] = await s.eventos();
    expect(noServidor.local_hash).toBe(b.localHash);
  });

  it("foto vai depois do evento gravado e precisa ser a mesma registrada", async () => {
    await sincronizar();
    // O caminho da foto vai na MESMA transação do evento.
    const b = await a.bater({ fotoSha256: sha256(JPEG), caminhoFoto: "file://foto.jpg" });
    expect((await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => JPEG.toString("base64") })).enviadas).toBe(0);
    await enviar();
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => JPEG.toString("base64") })).toEqual({ enviadas: 1, falhas: 0, semArquivo: 0, recusadas: 0 });
    expect([...s.db.arquivos.keys()]).toEqual([`marcacoes/obra-a/2026-10-01/${b.eventId}.jpg`]);
  });

  it("aparelho reiniciado sem sincronizar: bate com o relógio do celular e sinaliza", async () => {
    await sincronizar();
    a.bootId = "boot-2"; a.monotonicoMs = 1_000;
    const b = await a.bater();
    expect(b).toMatchObject({ horaConfiavel: false, fonteHora: "relogio-do-aparelho", idadeReferenciaMs: null });
    expect((await enviar()).erro).toBeNull();
    const [e] = await s.eventos();
    expect(e).toMatchObject({ hora_confiavel: false, fonte_hora: "relogio-do-aparelho" });
  });

  it("acesso de terceirizado é gravado sem consumir NSR", async () => {
    await sincronizar();
    await a.bater({ pessoa: { tipo: "terceiro", id: "t1" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    const p = await a.bater();
    await enviar();
    const [t] = await s.eventos();
    expect(t).toMatchObject({ tipo_registro: "acesso_terceiro", terceiro_id: "t1", employee_id: null });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => [Number(f.nsr), f.event_id])).toEqual([[1, p.eventId]]);
  });

  it("banco do aparelho perdido: não se renumera nada - novo pareamento é outro aparelho, com cadeia própria", async () => {
    await sincronizar();
    await a.bater(); await a.bater();
    await enviar();
    // Banco local some mas a sessão (token) sobrevive: o servidor sabe que a
    // cadeia local deste aparelho já foi até 2 e o app SINALIZA, sem renumerar.
    a.novoArmazem();
    expect(await sincronizar()).toMatchObject({ ok: true, cadeiaDivergente: true });
    const perdida = await a.bater();
    expect(perdida.localSequence).toBe(1);
    const r = await enviar();
    expect(r).toMatchObject({ status: "conflito" });
    expect((await a.armazem.eventosPendentes(5)).map(e => e.eventId)).toEqual([perdida.eventId]);   // guardada, intacta
    // Caminho previsto: parear de novo = outro aparelho, sequência local própria.
    const novo = await criarAparelho(s, { obraId: "obra-a", nome: "Portaria (novo banco)" });
    await sincronizar(novo);
    const nb = await novo.bater();
    expect(nb.localSequence).toBe(1);
    expect((await enviar(novo)).erro).toBeNull();
    expect((await s.fiscais(s.estabelecimentoA)).map(f => Number(f.nsr))).toEqual([1, 2, 3]);
  });

  it("PIN do encarregado confere offline contra o hash que veio do servidor", async () => {
    await sincronizar();
    const { responsaveis } = await a.armazem.cadastro();
    expect(verificarPinResponsavel("2468", responsaveis, pbkdf2Hex)).toEqual({ userId: "u-enc", nome: "Encarregado" });
    expect(verificarPinResponsavel("1111", responsaveis, pbkdf2Hex)).toBeNull();
    expect(proximaEsperaPin(4)).toBe(0);
    expect(proximaEsperaPin(6)).toBe(60_000);
  });
});
