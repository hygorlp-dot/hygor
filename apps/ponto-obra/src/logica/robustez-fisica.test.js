// @vitest-environment node
//
// Robustez em aparelho físico (fase C): o que acontece no canteiro - app
// morto no meio da fila, banco reaberto, rede que cai e volta, servidor 500,
// tempo esgotado depois do commit, GPS desligado, câmera indisponível.
// Servidor real (tratador + PGlite com as migrations) e, na reabertura, o SQL
// real do aparelho sobre um arquivo (node:sqlite). Nada aqui substitui o
// teste no aparelho (docs/device-matrix.md); isto prova a LÓGICA.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarPendentes, gpsRecente, rodadaDeSincronizacao, sincronizarCadastro } from "./sincronizacao.js";
import { classificarResposta, estadoPermissaoCamera, TIPO_FALHA } from "./falhas.js";
import { telaSemCamera } from "./apresentacao.js";
import { JPEG, criarCenario, sha256 } from "./cenario.test-helper.js";
import { abrirArmazemNode } from "../dados/sqlite-node.test-helper.js";
import { verificarCadeiaLocal } from "../../../../src/domains/ponto-eletronico/evento.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

let s, a;
beforeEach(async () => { ({ s, a } = await criarCenario()); await sincronizar(); });
const sincronizar = () => sincronizarCadastro({ armazem: a.armazem, api: a.api, monotonico: a.monotonico });
const enviar = (extra = {}) => enviarPendentes({ armazem: a.armazem, api: a.api, ...extra });
const rodada = () => rodadaDeSincronizacao({
  armazem: a.armazem, api: a.api, monotonico: a.monotonico, corpo: {}, cadastroVencido: true,
  lerFotoBase64: async () => JPEG.toString("base64"), aposEnviarFoto: async () => {},
});
const fiscaisDoAparelho = async () => (await s.fiscais(s.estabelecimentoA)).filter(f => f.dispositivo_id === a.dispositivoId);
const baterN = async n => { const l = []; for (let i = 0; i < n; i++) { l.push(await a.bater()); a.passar(60_000); } return l; };

describe("app reaberto no meio da fila", () => {
  let pasta;
  beforeEach(() => { pasta = mkdtempSync(path.join(tmpdir(), "ponto-robustez-")); });
  afterEach(() => { rmSync(pasta, { recursive: true, force: true }); });

  const usar = arm => {
    a.armazem = arm;
    const salvar = arm.salvarReferenciaHora.bind(arm);
    arm.salvarReferenciaHora = async r => { arm._ref = r; return salvar(r); };
  };

  it("bate offline, o app morre, o banco é reaberto, a fila sai inteira com NSR e a cadeia local confere", async () => {
    const arquivo = path.join(pasta, "ponto-obra.db");
    let { db, armazem } = await abrirArmazemNode(arquivo);
    usar(armazem);
    await sincronizar();
    a.online = false;
    const batidas = await baterN(4);
    await db.closeAsync();                                                       // processo morto

    ({ db, armazem } = await abrirArmazemNode(arquivo));                        // app aberto de novo
    usar(armazem);
    expect((await armazem.eventosPendentes(50)).map(e => e.eventId)).toEqual(batidas.map(b => b.eventId));
    expect((await a.bater()).localSequence).toBe(5);                             // a sequência continua, não volta a 1

    a.online = true;
    expect(await enviar()).toMatchObject({ enviadas: 5, erro: null });
    const fiscais = await fiscaisDoAparelho();
    expect(fiscais.map(f => Number(f.local_sequence))).toEqual([1, 2, 3, 4, 5]);
    expect(fiscais.map(f => Number(f.nsr))).toEqual([1, 2, 3, 4, 5]);
    await db.closeAsync();

    ({ db, armazem } = await abrirArmazemNode(arquivo));                        // e de novo: nada volta para a fila
    expect(await armazem.eventosPendentes(50)).toEqual([]);
    await db.closeAsync();
  });

  it("app morto DEPOIS do commit no servidor e ANTES de confirmar no aparelho: reenvio não duplica nem renumera", async () => {
    const arquivo = path.join(pasta, "ponto-obra.db");
    let { db, armazem } = await abrirArmazemNode(arquivo);
    usar(armazem);
    await sincronizar();
    await baterN(3);
    a.perderResposta = 1;                                                        // o servidor grava, a resposta some
    expect(await enviar()).toMatchObject({ enviadas: 0, semRede: true });
    await db.closeAsync();

    ({ db, armazem } = await abrirArmazemNode(arquivo));
    usar(armazem);
    expect(await enviar()).toMatchObject({ enviadas: 3, erro: null });
    expect((await fiscaisDoAparelho()).map(f => Number(f.nsr))).toEqual([1, 2, 3]);
    expect(await s.sql("select count(*)::int n from public.ponto_eventos")).toEqual([{ n: 3 }]);
    await db.closeAsync();
  });
});

describe("timeout de rede", () => {
  it("tempo esgotado depois do commit: o aparelho trata como sem rede, mantém a batida e o reenvio é idempotente", async () => {
    const [b] = await baterN(1);
    a.perderResposta = 1;
    const r = await enviar();
    expect(r).toMatchObject({ enviadas: 0, semRede: true });
    expect(classificarResposta({ ok: false, status: 0 }).tipo).toBe(TIPO_FALHA.SEM_REDE);
    expect((await a.armazem.eventosPendentes(10)).map(e => e.eventId)).toEqual([b.eventId]);
    expect(await enviar()).toMatchObject({ enviadas: 1, erro: null });
    expect((await fiscaisDoAparelho()).map(f => [Number(f.nsr), f.event_id])).toEqual([[1, b.eventId]]);
  });
});

describe("servidor alterna 500 e 200", () => {
  it("500 não perde nada nem consome NSR; quando volta 200 a fila sai em ordem", async () => {
    const batidas = await baterN(3);
    a.statusForaDoAr = 500;
    const r1 = await rodada();
    expect(r1.envio).toMatchObject({ enviadas: 0, status: 500 });
    expect(classificarResposta({ ok: false, status: 500 }).tipo).toBe(TIPO_FALHA.SERVIDOR);
    expect(await fiscaisDoAparelho()).toEqual([]);

    a.statusForaDoAr = 0;
    await a.bater();
    a.statusForaDoAr = 503;
    expect((await rodada()).envio.enviadas).toBe(0);
    a.statusForaDoAr = 0;
    const r3 = await rodada();
    expect(r3).toMatchObject({ online: true, erro: null });
    expect(r3.envio.enviadas).toBe(4);
    const fiscais = await fiscaisDoAparelho();
    expect(fiscais.map(f => Number(f.nsr))).toEqual([1, 2, 3, 4]);
    expect(fiscais.slice(0, 3).map(f => f.event_id)).toEqual(batidas.map(b => b.eventId));
  });
});

describe("rede cai no meio do lote", () => {
  it("lote parcial confirmado; o resto fica pendente e sai quando a rede volta, sem buraco na sequência", async () => {
    const batidas = await baterN(5);
    let chamadas = 0;
    const api = a.api;
    a.api = async (acao, corpo) => {                                              // 1º lote passa, depois a rede cai
      if (acao === "ponto-enviar-marcacoes" && ++chamadas > 1) a.online = false;
      return api(acao, corpo);
    };
    const r = await enviar({ lote: 2 });
    expect(r).toMatchObject({ enviadas: 2, semRede: true });
    expect((await a.armazem.eventosPendentes(10)).map(e => e.localSequence)).toEqual([3, 4, 5]);

    a.api = api; a.online = true;
    expect(await enviar({ lote: 2 })).toMatchObject({ enviadas: 3, erro: null });
    expect((await fiscaisDoAparelho()).map(f => Number(f.local_sequence))).toEqual([1, 2, 3, 4, 5]);
    expect(await verificarCadeiaLocal(batidas, null, sha256)).toMatchObject({ erro: null });
  });
});

describe("GPS desligado", () => {
  it("sem GPS (ou leitura velha) a batida é registrada sem localização e chega ao servidor", async () => {
    expect(gpsRecente(null, s.relogioServidor)).toBeNull();
    expect(gpsRecente({ lat: -8.28, lng: -35.97, precisao: 10, em: s.relogioServidor - 60 * 60_000 }, s.relogioServidor)).toBeNull();
    const b = await a.bater({ gps: null });
    expect(b.gps).toBeNull();
    expect(await enviar()).toMatchObject({ enviadas: 1, erro: null });
    expect((await fiscaisDoAparelho()).map(f => f.event_id)).toEqual([b.eventId]);
  });

  it("coordenada inválida vira 'sem GPS' em vez de recusar a batida", async () => {
    const b = await a.bater({ gps: { lat: 999, lng: "x", precisao: -1 } });
    expect(b.gps).toBeNull();
    expect(await enviar()).toMatchObject({ enviadas: 1, erro: null });
  });
});

describe("câmera indisponível", () => {
  it("permissão negada de vez leva às configurações; o caminho do encarregado continua", () => {
    expect(estadoPermissaoCamera({ granted: false, canAskAgain: false })).toBe("configuracoes");
    expect(telaSemCamera("configuracoes")).toMatchObject({ acao: "abrir_configuracoes", alternativa: "Registrar com encarregado" });
    expect(telaSemCamera(estadoPermissaoCamera({ granted: false, canAskAgain: true }))).toMatchObject({ acao: "pedir_permissao" });
  });

  it("sem câmera, a batida pelo encarregado (sem foto) é registrada e sincronizada", async () => {
    const b = await a.bater({ identificacao: { metodo: "encarregado", confianca: null, encarregadoId: "u-enc" }, fotoSha256: "" });
    expect(b).toMatchObject({ metodo: "encarregado", fotoSha256: "" });
    expect(await a.armazem.fotosPendentes(10)).toEqual([]);
    expect(await enviar()).toMatchObject({ enviadas: 1, erro: null });
  });
});
