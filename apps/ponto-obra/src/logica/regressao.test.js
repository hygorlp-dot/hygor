// @vitest-environment node
//
// Regressão do app Ponto de Obra (rodada de estabilização + Fase 1 REP-P).
// Aparelho e servidor reais sobre Postgres real em memória
// (cenario.test-helper.js). Cada bloco corresponde a um item da lista de
// regressão do app. O antigo "realinhamento" (renumerar batidas) não existe
// mais: os testes dele viraram testes de que NADA é renumerado.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AVISO_CAMERA_FALHOU, AVISO_FOTO_NAO_GUARDADA, fotoSemBloquear, registrarBatida } from "./terminal.js";
import {
  GPS_IDADE_MAXIMA_MS, enviarFotos, enviarPendentes, gpsRecente, montarCorpoSincronizacao,
  rodadaDeSincronizacao, sincronizarCadastro,
} from "./sincronizacao.js";
import { identificar, vetorDoCadastro } from "./rosto.js";
import { resumoCadastro } from "./cadastro.js";
import { classificarResposta, estadoPermissaoCamera, mensagemDeErro, resumirTexto, TIPO_FALHA } from "./falhas.js";
import { FotoForaDoLimite, fotoDentroDoLimite } from "./foto.js";
import { FOTO } from "./armazem-memoria.js";
import { LIMITE_FOTO_BYTES } from "../../../../src/domains/ponto-eletronico/foto.js";
import { JPEG, criarCenario, sha256 } from "./cenario.test-helper.js";
import { IDADE_MAXIMA_REFERENCIA_MS, estadoDaReferencia, horaDaMarcacao, novaReferencia } from "../../../../src/domains/ponto-eletronico/relogio.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

let s, a;
beforeEach(async () => { ({ s, a } = await criarCenario()); });
const sincronizar = () => sincronizarCadastro({ armazem: a.armazem, api: a.api, monotonico: a.monotonico });
const enviar = () => enviarPendentes({ armazem: a.armazem, api: a.api });
const rodada = (extra = {}) => rodadaDeSincronizacao({
  armazem: a.armazem, api: a.api, monotonico: a.monotonico, corpo: {}, cadastroVencido: true,
  lerFotoBase64: async () => JPEG.toString("base64"), aposEnviarFoto: async () => {}, ...extra,
});
const dispositivo = async () => (await s.sql("select * from public.ponto_dispositivos where id = $1", [a.dispositivoId]))[0];
const vetor = (i, ruido = 0) => { const v = Array.from({ length: 192 }, (_, k) => (k === i ? 1 : 0) + (k === i + 1 ? ruido : 0)); const n = Math.hypot(...v); return v.map(x => x / n); };

describe("pareamento", () => {
  it("válido: aparelho fica ativo, preso à obra e ao estabelecimento, e só o hash do token vai para o banco", async () => {
    const d = await dispositivo();
    expect(d).toMatchObject({ obra_id: "obra-a", status: "ativo", estabelecimento_id: s.estabelecimentoA });
    expect(d.token_hash).toBe(sha256(a.token));
    const tudo = JSON.stringify(await s.sql("select * from public.ponto_dispositivos"));
    expect(tudo).not.toContain(a.token);
  });

  it("código expirado é recusado com mensagem clara", async () => {
    const { json: { codigo } } = await s.admin("ponto-codigo-pareamento", { obraId: "obra-a" });
    s.relogioServidor += 31 * 60_000;
    const expirado = await s.tratar({ action: "ponto-parear", body: { codigo } });
    expect(expirado.json.code).toBe("CODIGO_EXPIRADO");
    expect(classificarResposta({ ok: false, status: expirado.status, ...expirado.json })).toMatchObject({ tipo: TIPO_FALHA.RECUSADO, mensagem: expect.stringContaining("expirado") });
  });
});

describe("primeira sincronização e situação do cadastro", () => {
  it("baixa a base única e envia versão do app, aparelho e GPS válido", async () => {
    const corpo = montarCorpoSincronizacao({
      app: { versao: "1.0.0", build: "4", commit: "abc1234" }, aparelho: { marca: "samsung", modelo: "SM-A155M", android: "14" },
      gps: { lat: -8.28, lng: -35.97, precisao: 12, em: s.relogioServidor - 60_000 }, agoraMs: s.relogioServidor,
    });
    const r = await rodada({ corpo });
    expect(r).toMatchObject({ online: true, cadastroAtualizado: true, erro: null });
    expect(a.chamadas.find(x => x.action === "ponto-sincronizar").corpo).toEqual({ ...corpo, biometriasAssinatura: "" });   // primeira vez: ainda não tem biometrias
    const d = await dispositivo();
    expect(d.app_versao).toBe("1.0.0 (4)");
    expect(d.aparelho).toEqual({ marca: "samsung", modelo: "SM-A155M", android: "14", build: "4", commit: "abc1234" });
    expect(d.ultimo_gps).toMatchObject({ lat: -8.28, lng: -35.97, precisao: 12 });
    expect((await a.armazem.cadastro()).funcionarios.map(f => f.id)).toEqual(["e3", "e2", "e1"]);   // funcionário global: e3 é lotado na obra-b
    expect((await a.armazem.cadastro()).tempo).toMatchObject({ source: "host", status: "nao_verificada" });
  });

  it("cadastro sem responsáveis: a tela leva primeiro ao ARCD", async () => {
    ({ s, a } = await criarCenario({ comResponsavel: false }));
    await sincronizar();
    expect(resumoCadastro(await a.armazem.cadastro())).toMatchObject({ temResponsavel: false, semRostos: true, totalFuncionarios: 3, sincronizado: true });
  });

  it("cadastro sem biometria: obra sem rostos, com responsável", async () => {
    await sincronizar();
    expect(resumoCadastro(await a.armazem.cadastro())).toMatchObject({ temResponsavel: true, semRostos: true, comRosto: 0 });
  });

  it("biometria de quem saiu da obra não conta como rosto cadastrado", () => {
    expect(resumoCadastro({ funcionarios: [{ id: "e1" }], biometrias: [{ employeeId: "x" }] }).semRostos).toBe(true);
  });
});

describe("cadastro facial e ponto facial", () => {
  it("cadastra o rosto com consentimento, sincroniza e o ponto facial chega à ARP com NSR", async () => {
    const r = await a.api("ponto-cadastrar-biometria", {
      employeeId: "e1", modelo: "mobilefacenet-192-apache2", vetor: vetorDoCadastro([vetor(3), vetor(3, 0.05), vetor(3, -0.05)]),
      fotos: [JPEG.toString("base64")], consentimento: { termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00.000Z", textoSha256: "x" }, responsavelId: "u-enc",
    });
    expect(r.ok).toBe(true);
    await sincronizar();
    const cad = await a.armazem.cadastro();
    expect(resumoCadastro(cad)).toMatchObject({ semRostos: false, comRosto: 1 });
    const id = identificar(vetor(3, 0.1), cad.biometrias);
    expect(id).toMatchObject({ reconhecido: true, employeeId: "e1" });
    const b = await a.bater({ identificacao: { metodo: "facial", confianca: id.confianca } });
    await enviar();
    const [e] = await s.eventos();
    expect(e).toMatchObject({ employee_id: "e1", metodo: "facial" });
    expect(Number(e.confianca)).toBe(id.confianca);
    expect((await a.armazem.registroFiscal(b.eventId)).nsr).toBe(1);
  });

  it("ponto pelo encarregado registra quem identificou", async () => {
    await sincronizar();
    await a.bater({ identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    await enviar();
    expect((await s.eventos())[0]).toMatchObject({ metodo: "encarregado", encarregado_id: "u-enc", confianca: null });
  });

  it("terceirizado entra como acesso, fora do ponto CLT e sem NSR", async () => {
    await sincronizar();
    const t = await a.bater({ pessoa: { tipo: "terceiro", id: "t1" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    await enviar();
    expect((await s.eventos())[0]).toMatchObject({ tipo_registro: "acesso_terceiro", terceiro_id: "t1", employee_id: null, cpf: "" });
    expect(await a.armazem.registroFiscal(t.eventId)).toMatchObject({ nsr: null });
    expect((await s.fiscais(null)).length).toBe(0);
  });
});

describe("offline, reconexão, revogação e servidor fora do ar", () => {
  it("sem internet a rodada não lança, nada é perdido e a reconexão envia tudo", async () => {
    await sincronizar();
    a.online = false;
    await a.bater(); await a.bater();
    expect(await rodada()).toMatchObject({ online: false });
    expect((await a.armazem.contagem()).pendentes).toBe(2);
    a.online = true;
    expect(await rodada()).toMatchObject({ online: true, erro: null });
    expect((await s.fiscais(s.estabelecimentoA)).map(f => Number(f.nsr))).toEqual([1, 2]);
    expect((await a.armazem.contagem()).pendentes).toBe(0);
  });

  it("servidor fora do ar (503): eventos continuam pendentes e a mensagem diz que o envio será repetido", async () => {
    await sincronizar();
    await a.bater();
    a.statusForaDoAr = 503;
    expect((await rodada()).erro).toBeTruthy();
    expect((await a.armazem.contagem()).pendentes).toBe(1);
    expect(classificarResposta({ ok: false, status: 503 })).toMatchObject({ tipo: TIPO_FALHA.SERVIDOR });
  });

  it("aparelho revogado: a rodada avisa e os eventos não enviados continuam guardados", async () => {
    await sincronizar();
    await a.bater(); await a.bater();
    await s.admin("ponto-dispositivo-revogar", { dispositivoId: a.dispositivoId });
    expect((await rodada()).revogado).toBe(true);
    expect((await a.armazem.eventosPendentes(10)).map(e => e.localSequence)).toEqual([1, 2]);
    expect(classificarResposta({ ok: false, status: 403, code: "APARELHO_REVOGADO" }).tipo).toBe(TIPO_FALHA.REVOGADO);
  });

  it("token inválido leva a parear de novo", async () => {
    a.token = "token-que-nao-existe";
    expect((await rodada()).desconhecido).toBe(true);
  });

  it("evento de outro aparelho no lote é recusado sem gravar nada", async () => {
    await sincronizar();
    const b = await a.bater();
    const intruso = { ...b, deviceId: "00000000-0000-4000-8000-000000000999" };
    const r = await a.api("ponto-enviar-marcacoes", { eventos: [intruso] });
    expect(r.resultados[0]).toMatchObject({ status: "invalido", motivo: expect.stringMatching(/outro aparelho|hash local/) });
    expect((await s.eventos()).length).toBe(0);
  });
});

describe("fila de eventos e cadeia local", () => {
  it("lote grande: 450 eventos offline saem em lotes, em ordem, sem buraco de NSR", async () => {
    await sincronizar();
    a.online = false;
    for (let i = 0; i < 450; i++) await a.bater();
    a.online = true;
    expect(await enviar()).toMatchObject({ enviadas: 450, erro: null });
    expect(a.chamadas.filter(x => x.action === "ponto-enviar-marcacoes").length).toBeGreaterThanOrEqual(3);
    const fiscais = await s.fiscais(s.estabelecimentoA);
    expect(fiscais.map(f => Number(f.nsr))).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
    expect(fiscais.map(f => Number(f.local_sequence))).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
  });

  it("batidas simultâneas nunca pegam a mesma sequência local", async () => {
    const feitas = await Promise.all(Array.from({ length: 8 }, () => a.bater()));
    expect(feitas.map(b => b.localSequence).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("sequência local nunca é renumerada: conflito, rede e revogação deixam sequência e hash como foram criados", async () => {
    await sincronizar();
    const criados = [await a.bater(), await a.bater()];
    a.statusForaDoAr = 500; await enviar(); a.statusForaDoAr = 0;
    a.online = false; await enviar(); a.online = true;
    const guardados = await a.armazem.eventosPendentes(5);
    expect(guardados.map(e => [e.eventId, e.localSequence, e.localHash])).toEqual(criados.map(e => [e.eventId, e.localSequence, e.localHash]));
    await enviar();
    const noServidor = await s.eventos();
    expect(noServidor.map(e => [e.event_id, Number(e.local_sequence), e.local_hash])).toEqual(criados.map(e => [e.eventId, e.localSequence, e.localHash]));
  });

  it("evento nunca é marcado como enviado antes de a ARP responder pelo SEU eventId", async () => {
    await sincronizar();
    const b = await a.bater();
    // Servidor "responde ok" sem citar o evento: o aparelho não confirma.
    const apiMuda = async () => ({ ok: true, status: 200, resultados: [] });
    expect(await enviarPendentes({ armazem: a.armazem, api: apiMuda })).toMatchObject({ enviadas: 0, status: "sem_resposta" });
    expect((await a.armazem.eventosPendentes(5)).map(e => e.eventId)).toEqual([b.eventId]);
    // Resposta com NSR inválido também não confirma.
    const apiTorta = async () => ({ ok: true, status: 200, resultados: [{ eventId: b.eventId, status: "registrado", nsr: 0, fiscalHash: "x" }] });
    expect((await enviarPendentes({ armazem: a.armazem, api: apiTorta })).enviadas).toBe(0);
  });

  it("confirmação é pelo eventId, não pela posição: resposta fora de ordem e com evento alheio", async () => {
    await sincronizar();
    const b1 = await a.bater(), b2 = await a.bater();
    const fiscal = n => ({ status: "registrado", nsr: n, fiscalHash: String(n).repeat(64).slice(0, 64), estabelecimentoId: "est", gravadoEm: "2026-10-01T10:00:00.000Z" });
    // Só cita OUTRO evento: nada é confirmado.
    const apiAlheia = async () => ({ ok: true, status: 200, resultados: [{ eventId: randomUUID(), ...fiscal(9) }] });
    expect((await enviarPendentes({ armazem: a.armazem, api: apiAlheia })).enviadas).toBe(0);
    expect((await a.armazem.eventosPendentes(5)).map(e => e.eventId)).toEqual([b1.eventId, b2.eventId]);
    // Ordem invertida e um resultado alheio no meio: cada um fica com o NSR do SEU eventId.
    const apiInvertida = async () => ({ ok: true, status: 200, resultados: [{ eventId: b2.eventId, ...fiscal(2) }, { eventId: randomUUID(), ...fiscal(9) }, { eventId: b1.eventId, ...fiscal(1) }] });
    expect(await enviarPendentes({ armazem: a.armazem, api: apiInvertida })).toMatchObject({ enviadas: 2, erro: null });
    expect((await a.armazem.registroFiscal(b1.eventId)).nsr).toBe(1);
    expect((await a.armazem.registroFiscal(b2.eventId)).nsr).toBe(2);
  });

  it("ARP respondendo outro NSR para evento já confirmado não troca nada e é sinalizado", async () => {
    await sincronizar();
    const b = await a.bater();
    const fiscal = n => ({ status: "registrado", nsr: n, fiscalHash: String(n).repeat(64).slice(0, 64), estabelecimentoId: "est", gravadoEm: "2026-10-01T10:00:00.000Z" });
    // Outra rodada confirma o evento enquanto esta espera a resposta (NSR 7) e esta recebe NSR 8.
    const apiAtrasada = async () => {
      await a.armazem.confirmarEvento(b.eventId, { nsr: 7, fiscalHash: fiscal(7).fiscalHash, estabelecimentoId: "est", gravadoEm: fiscal(7).gravadoEm });
      return { ok: true, status: 200, resultados: [{ eventId: b.eventId, ...fiscal(8) }] };
    };
    expect(await enviarPendentes({ armazem: a.armazem, api: apiAtrasada })).toMatchObject({ enviadas: 0, status: "fiscal_divergente", fiscalDivergente: true });
    expect((await a.armazem.registroFiscal(b.eventId)).nsr).toBe(7);
    // Mesma resposta da ARP (idempotente) numa rodada concorrente: sem erro.
    const c = await a.bater();
    const apiIgual = async () => {
      await a.armazem.confirmarEvento(c.eventId, { nsr: 3, fiscalHash: fiscal(3).fiscalHash, estabelecimentoId: "est", gravadoEm: fiscal(3).gravadoEm });
      return { ok: true, status: 200, resultados: [{ eventId: c.eventId, ...fiscal(3) }] };
    };
    expect(await enviarPendentes({ armazem: a.armazem, api: apiIgual })).toMatchObject({ erro: null });
  });
});

describe("hora: reboot durante a sincronização e monotônico que volta", () => {
  it("reboot entre o envio e a resposta: a referência NÃO é gravada e a batida sai sinalizada", async () => {
    const leituras = [{ ms: 9_000_000, bootId: "boot-1" }, { ms: 2_000, bootId: "boot-2" }];
    const monotonico = () => leituras.shift();
    expect(await sincronizarCadastro({ armazem: a.armazem, api: a.api, monotonico })).toMatchObject({ ok: true });
    expect(await a.armazem.referenciaHora()).toBeNull();          // cadastro salvo, hora não
    expect((await a.armazem.cadastro()).funcionarios.length).toBeGreaterThan(0);
    a.bootId = "boot-2"; a.monotonicoMs = 3_000;
    expect(await a.bater()).toMatchObject({ horaConfiavel: false, fonteHora: "relogio-do-aparelho" });
  });

  it("mesmo bootId mas monotônico menor que o da referência (leitura inconsistente): não confia", () => {
    const referencia = novaReferencia({ servidorMs: Date.parse("2026-10-01T10:00:00Z"), monotonicoEnvioMs: 5_000, monotonicoRespostaMs: 5_100, bootId: "b" });
    const relogioParedeMs = Date.parse("2026-10-01T12:00:00Z");
    expect(horaDaMarcacao({ referencia, monotonicoMs: 6_000, bootId: "b", relogioParedeMs })).toMatchObject({ horaConfiavel: true });
    expect(horaDaMarcacao({ referencia, monotonicoMs: 4_000, bootId: "b", relogioParedeMs })).toMatchObject({ horaConfiavel: false, marcadoEmMs: relogioParedeMs });
    expect(estadoDaReferencia({ referencia, monotonicoMs: 4_000, bootId: "b" }).estado).toBe("invalida_apos_reinicio");
  });
});

describe("hora: reboot e relógio do celular alterado", () => {
  it("reboot: bate com a hora do celular sinalizada; depois de sincronizar volta a ser confiável", async () => {
    await sincronizar();
    a.bootId = "boot-2"; a.monotonicoMs = 1_000;
    const antes = await a.bater();
    expect(antes.horaConfiavel).toBe(false);
    await sincronizar();
    const depois = await a.bater();
    expect(depois).toMatchObject({ horaConfiavel: true, fonteHora: "host", idadeReferenciaMs: 0 });
    expect(depois.marcadoEm).toBe(new Date(s.relogioServidor).toISOString());
    expect((await a.armazem.eventosPendentes(5))[0]).toMatchObject({ eventId: antes.eventId, marcadoEm: antes.marcadoEm, localHash: antes.localHash });
  });

  it("mudar a hora do celular não altera eventos existentes e não muda a hora dos novos", async () => {
    await sincronizar();
    const b1 = await a.bater();
    const guardado = { ...(await a.armazem.eventosPendentes(1))[0] };
    a.paredeAdiantadaMs = 3 * 3_600_000;
    a.passar(60_000);
    const b2 = await a.bater();
    expect((await a.armazem.eventosPendentes(1))[0]).toEqual(guardado);
    expect(b2.marcadoEm).toBe(new Date(s.relogioServidor).toISOString());
    expect(b2).toMatchObject({ horaConfiavel: true, relogioAlterado: true, idadeReferenciaMs: 60_000 });
    expect(b1.relogioAlterado).toBe(false);
  });

  it("validade da referência: offline dentro da validade continua confiável; vencida marca sem confiar; renovação depois volta ao normal", async () => {
    await sincronizar();
    a.online = false;                                         // offline durante a renovação
    const sincronizacoesAntes = a.chamadas.filter(x => x.action === "ponto-sincronizar").length;
    expect(await sincronizar()).toMatchObject({ ok: false, semRede: true });
    a.passar(6 * 24 * 3_600_000);
    expect(await a.bater()).toMatchObject({ horaConfiavel: true, idadeReferenciaMs: 6 * 24 * 3_600_000 });   // a falha não apagou a referência
    a.passar(2 * 24 * 3_600_000);
    const vencida = await a.bater();
    expect(vencida).toMatchObject({ horaConfiavel: false });
    expect(vencida.idadeReferenciaMs).toBeGreaterThan(IDADE_MAXIMA_REFERENCIA_MS);
    a.online = true;                                          // renovação posterior
    expect(await sincronizar()).toMatchObject({ ok: true });
    expect(await a.bater()).toMatchObject({ horaConfiavel: true, idadeReferenciaMs: 0 });
    expect(a.chamadas.filter(x => x.action === "ponto-sincronizar").length).toBe(sincronizacoesAntes + 2);
    expect((await a.armazem.eventosPendentes(10)).length).toBe(3);                                         // nenhuma batida impedida
  });
});

describe("GPS nunca bloqueia", () => {
  it("GPS inválido ou ausente: o evento é registrado sem GPS", async () => {
    const semGps = await a.bater({ gps: null });
    const invalido = await a.bater({ gps: { lat: 999, lng: "x" } });
    expect(semGps.gps).toBeNull();
    expect(invalido.gps).toBeNull();
    await sincronizar();
    await enviar();
    expect((await s.eventos()).map(e => e.gps)).toEqual([null, null]);
  });

  it("GPS velho não vai nem na batida nem na sincronização", () => {
    const agora = Date.parse("2026-10-01T12:00:00Z");
    const velho = { lat: -8, lng: -35, precisao: 5, em: agora - GPS_IDADE_MAXIMA_MS - 1 };
    expect(gpsRecente(velho, agora)).toBeNull();
    expect(gpsRecente({ ...velho, em: agora - 1000 }, agora)).toEqual({ lat: -8, lng: -35, precisao: 5 });
    expect(montarCorpoSincronizacao({ gps: velho, agoraMs: agora })).not.toHaveProperty("gps");
  });

  it("sincronização sem GPS segue normalmente", async () => {
    const r = await rodada({ corpo: montarCorpoSincronizacao({ app: { versao: "1.0.0" }, agoraMs: s.relogioServidor }) });
    expect(r).toMatchObject({ online: true, cadastroAtualizado: true });
    expect((await dispositivo()).ultimo_gps ?? null).toBeNull();
  });
});

describe("fila de fotografias", () => {
  const comFoto = async () => { await sincronizar(); const b = await a.bater({ fotoSha256: sha256(JPEG), caminhoFoto: "file://a.jpg" }); await enviar(); return b; };

  it("foto só é apagada do aparelho depois do OK do servidor", async () => {
    await comFoto();
    const apagadas = [];
    a.online = false;
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => JPEG.toString("base64"), aposEnviar: async i => apagadas.push(i.caminhoFoto) })).toMatchObject({ enviadas: 0, falhas: 1 });
    expect(apagadas).toEqual([]);
    expect((await a.armazem.contagem()).fotos).toBe(1);
    a.online = true;
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => JPEG.toString("base64"), aposEnviar: async i => apagadas.push(i.caminhoFoto) })).toMatchObject({ enviadas: 1 });
    expect(apagadas).toEqual(["file://a.jpg"]);
  });

  it("erro de leitura do arquivo deixa a foto para a próxima rodada", async () => {
    await comFoto();
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => { throw new Error("EIO"); } })).toMatchObject({ enviadas: 0, falhas: 1 });
    expect((await a.armazem.contagem()).fotos).toBe(1);
  });

  it("arquivo sumido vira 'sem arquivo' (diagnóstico) e não trava a fila", async () => {
    await comFoto();
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => null })).toMatchObject({ semArquivo: 1 });
    expect(await a.armazem.contagem()).toMatchObject({ fotos: 0, fotosComProblema: 1 });
  });

  it("foto acima do limite não é enviada; fica recusada com o arquivo preservado", async () => {
    await comFoto();
    const apagadas = [];
    const grande = Buffer.alloc(LIMITE_FOTO_BYTES + 10, 0xff).toString("base64");
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => grande, aposEnviar: async i => apagadas.push(i) })).toMatchObject({ recusadas: 1, enviadas: 0 });
    expect(a.chamadas.some(x => x.action === "ponto-enviar-foto")).toBe(false);
    expect(apagadas).toEqual([]);
    expect(a.armazem.eventos[0].fotoEstado).toBe(FOTO.RECUSADA);
  });

  it("foto trocada é recusada pelo servidor e não fica tentando para sempre", async () => {
    await comFoto();
    const outra = Buffer.from([0xff, 0xd8, 1, 2, 3]).toString("base64");
    expect(await enviarFotos({ armazem: a.armazem, api: a.api, lerFotoBase64: async () => outra })).toMatchObject({ recusadas: 1 });
    expect((await a.armazem.fotosPendentes(10)).length).toBe(0);
  });

  it("evento sem foto não entra na fila de fotos", async () => {
    await sincronizar();
    await a.bater();
    await enviar();
    expect(await a.armazem.fotosPendentes(10)).toEqual([]);
  });
});

describe("foto dentro do limite do servidor", () => {
  const jpeg = n => { const b = new Uint8Array(n); b[0] = 0xff; b[1] = 0xd8; return b; };

  it("usa a primeira qualidade que cabe e devolve os bytes EXATOS dela", async () => {
    const tamanhos = [2_000_000, 1_600_000, 900_000];
    const descartadas = [];
    let i = 0;
    const r = await fotoDentroDoLimite({ gerar: async passo => ({ passo, bytes: jpeg(tamanhos[i++]) }), descartar: async g => descartadas.push(g.bytes.length) });
    expect(r.bytes.length).toBe(900_000);
    expect(r.tentativas).toBe(3);
    expect(r.passo).toMatchObject({ largura: 600 });
    expect(descartadas).toEqual([2_000_000, 1_600_000]);
  });

  it("nunca devolve foto acima do limite: se nada couber, falha (a batida segue sem foto)", async () => {
    await expect(fotoDentroDoLimite({ gerar: async () => ({ bytes: jpeg(LIMITE_FOTO_BYTES + 1) }) })).rejects.toBeInstanceOf(FotoForaDoLimite);
  });

  it("arquivo que não é JPEG não serve", async () => {
    await expect(fotoDentroDoLimite({ gerar: async () => ({ bytes: new Uint8Array([0x89, 0x50, 0x4e]) }) })).rejects.toBeInstanceOf(FotoForaDoLimite);
  });

  it("primeira tentativa já é boa para auditoria (720 px, qualidade 0,8)", async () => {
    const r = await fotoDentroDoLimite({ gerar: async passo => ({ bytes: jpeg(80_000), passo }) });
    expect(r.passo).toEqual({ largura: 720, qualidade: 0.8 });
  });
});

describe("erros de câmera e de reconhecimento facial", () => {
  it("permissão da câmera: pedir uma vez; negada de vez leva às configurações", () => {
    expect(estadoPermissaoCamera(null)).toBe("carregando");
    expect(estadoPermissaoCamera({ granted: true })).toBe("concedida");
    expect(estadoPermissaoCamera({ granted: false, canAskAgain: true })).toBe("pedir");
    expect(estadoPermissaoCamera({ granted: false, canAskAgain: false })).toBe("configuracoes");
  });

  it("erro do TFLite vira mensagem operacional, sem stack trace Java", () => {
    const java = "java.net.MalformedURLException: no protocol: assets_modelos_face_detection_front\n  at java.net.URL.<init>(URL.java:601)\n  at com.margelo.nitro.tflite.HybridAssetLoader$loadAsset$1.invokeSuspend(HybridAssetLoader.kt:14)";
    const m = mensagemDeErro("modelos", new Error(java));
    expect(m).toContain("encarregado pode registrar");
    expect(m).not.toMatch(/\sat\s|java\.net|HybridAssetLoader|\.kt:/);
    expect(resumirTexto(java)).toBe("no protocol: assets_modelos_face_detection_front");
  });

  it("erro de câmera e de batida dizem o que aconteceu com o ponto", () => {
    expect(mensagemDeErro("camera", new Error("Camera is not running"))).toContain("encarregado");
    expect(mensagemDeErro("batida", new Error("disk I/O error"))).toContain("NÃO foi registrada");
  });
});

describe("encarregado identifica quando o facial não serve", () => {
  it("registro manual não depende de modelo, câmera, GPS nem internet", async () => {
    a.online = false;
    const b = await registrarBatida({
      armazem: a.armazem, relogio: a.relogio(), sha256, gerarId: randomUUID, dispositivoId: a.dispositivoId,
      pessoa: { tipo: "funcionario", id: "e2", cpf: "98765432100" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" }, gps: undefined,
    });
    expect(b).toMatchObject({ metodo: "encarregado", gps: null, fotoSha256: "", localSequence: 1 });
  });

  it("câmera ou gravação da foto falhando: a batida é registrada sem foto e com aviso (caminho do App.js)", async () => {
    const quebra = async () => { throw new Error("ENOSPC: no space left on device"); };
    const naoChamar = async () => { throw new Error("não deveria preparar foto"); };
    const casos = [
      [{ uri: "file:///cache/crua.jpg", width: 1080 }, quebra, AVISO_FOTO_NAO_GUARDADA],
      [{ falhou: true }, naoChamar, AVISO_CAMERA_FALHOU],
      [null, naoChamar, ""],
    ];
    for (const [i, [foto, preparar, aviso]] of casos.entries()) {
      const { preparada, avisoFoto } = await fotoSemBloquear(foto, preparar);
      expect(preparada).toBeNull();
      expect(avisoFoto).toBe(aviso);
      const b = await a.bater({ fotoSha256: preparada?.sha256, caminhoFoto: preparada?.uri });
      expect(b).toMatchObject({ fotoSha256: "", localSequence: i + 1 });
    }
    expect(await a.armazem.contagem()).toMatchObject({ pendentes: 3, fotos: 0 });
    // Foto boa: o hash dos bytes preparados entra na batida e o arquivo vai para a fila.
    const { preparada } = await fotoSemBloquear({ uri: "file:///cache/crua.jpg", width: 1080 }, async () => ({ uri: "file:///docs/b.jpg", sha256: "d".repeat(64) }));
    expect(await a.bater({ fotoSha256: preparada.sha256, caminhoFoto: preparada.uri })).toMatchObject({ fotoSha256: "d".repeat(64), localSequence: 4 });
    expect(await a.armazem.contagem()).toMatchObject({ pendentes: 4, fotos: 1 });
  });
});
