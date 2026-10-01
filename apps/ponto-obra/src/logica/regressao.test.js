// @vitest-environment node
//
// Regressão do app Ponto de Obra (rodada de estabilização, out/2026).
// Aparelho e servidor reais sobre banco em memória (cenario.test-helper.js).
// Cada bloco corresponde a um item da lista de regressão do app.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { registrarBatida } from "./terminal.js";
import {
  GPS_IDADE_MAXIMA_MS, alinharCadeia, enviarFotos, enviarPendentes, gpsRecente, montarCorpoSincronizacao,
  rodadaDeSincronizacao, sincronizarCadastro,
} from "./sincronizacao.js";
import { identificar, vetorDoCadastro } from "./rosto.js";
import { resumoCadastro } from "./cadastro.js";
import { classificarResposta, estadoPermissaoCamera, mensagemDeErro, resumirTexto, TIPO_FALHA } from "./falhas.js";
import { FotoForaDoLimite, fotoDentroDoLimite } from "./foto.js";
import { FOTO } from "./armazem-memoria.js";
import { LIMITE_FOTO_BYTES } from "../../../../src/domains/ponto-eletronico/foto.js";
import { JPEG, criarCenario, sha256 } from "./cenario.test-helper.js";

let c;
beforeEach(async () => { c = await criarCenario(); });
const sincronizar = (extra = {}) => sincronizarCadastro({ armazem: c.armazem, api: c.api, monotonico: c.monotonico, sha256, ...extra });
const rodada = (extra = {}) => rodadaDeSincronizacao({
  armazem: c.armazem, api: c.api, sha256, monotonico: c.monotonico, corpo: {}, cadastroVencido: true,
  lerFotoBase64: async () => JPEG.toString("base64"), aposEnviarFoto: async () => {}, ...extra,
});
const vetor = (i, ruido = 0) => { const v = Array.from({ length: 192 }, (_, k) => (k === i ? 1 : 0) + (k === i + 1 ? ruido : 0)); const n = Math.hypot(...v); return v.map(x => x / n); };

describe("pareamento", () => {
  it("válido: aparelho fica ativo, preso à obra, e só o hash do token vai para o banco", async () => {
    const d = c.db.tabelas.ponto_dispositivos[0];
    expect(d).toMatchObject({ obra_id: "obra-a", status: "ativo", ultimo_nsr: 0 });
    expect(d.token_hash).toBe(sha256(c.token));
    expect(JSON.stringify(c.db.tabelas)).not.toContain(c.token);
  });

  it("código expirado ou já usado é recusado com mensagem clara", async () => {
    const { json: { codigo } } = await c.tratar({ action: "ponto-codigo-pareamento", body: { accessToken: "admin", obraId: "obra-a" } });
    c.relogioServidor += 31 * 60_000;
    const expirado = await c.tratar({ action: "ponto-parear", body: { codigo } });
    expect(expirado.json.code).toBe("CODIGO_EXPIRADO");
    expect(classificarResposta({ ok: false, status: expirado.status, ...expirado.json })).toMatchObject({ tipo: TIPO_FALHA.RECUSADO, mensagem: expect.stringContaining("expirado") });
  });
});

describe("primeira sincronização e situação do cadastro", () => {
  it("baixa a base única e envia versão do app, aparelho e GPS válido", async () => {
    const corpo = montarCorpoSincronizacao({
      app: { versao: "1.0.0", build: "4", commit: "abc1234" }, aparelho: { marca: "samsung", modelo: "SM-A155M", android: "14" },
      gps: { lat: -8.28, lng: -35.97, precisao: 12, em: c.relogioServidor - 60_000 }, agoraMs: c.relogioServidor,
    });
    const r = await rodada({ corpo });
    expect(r).toMatchObject({ online: true, cadastroAtualizado: true, erro: null });
    expect(c.chamadas.find(x => x.action === "ponto-sincronizar").corpo).toEqual(corpo);
    const d = c.db.tabelas.ponto_dispositivos[0];
    expect(d.app_versao).toBe("1.0.0 (4)");
    expect(d.aparelho).toEqual({ marca: "samsung", modelo: "SM-A155M", android: "14", build: "4", commit: "abc1234" });
    expect(d.ultimo_gps).toMatchObject({ lat: -8.28, lng: -35.97, precisao: 12 });
    expect((await c.armazem.cadastro()).funcionarios.map(f => f.id)).toEqual(["e2", "e1"]);
  });

  it("cadastro sem responsáveis: a tela leva primeiro ao ARCD", async () => {
    c = await criarCenario({ comResponsavel: false });
    await sincronizar();
    expect(resumoCadastro(await c.armazem.cadastro())).toMatchObject({ temResponsavel: false, semRostos: true, totalFuncionarios: 2, sincronizado: true });
  });

  it("cadastro sem biometria: obra sem rostos, com responsável", async () => {
    await sincronizar();
    expect(resumoCadastro(await c.armazem.cadastro())).toMatchObject({ temResponsavel: true, semRostos: true, comRosto: 0 });
  });

  it("biometria de quem saiu da obra não conta como rosto cadastrado", () => {
    expect(resumoCadastro({ funcionarios: [{ id: "e1" }], biometrias: [{ employeeId: "x" }] }).semRostos).toBe(true);
  });
});

describe("cadastro facial e ponto facial", () => {
  it("cadastra o rosto com consentimento, sincroniza e o ponto facial chega ao servidor", async () => {
    const r = await c.api("ponto-cadastrar-biometria", {
      employeeId: "e1", modelo: "mobilefacenet-192-apache2", vetor: vetorDoCadastro([vetor(3), vetor(3, 0.05), vetor(3, -0.05)]),
      fotos: [JPEG.toString("base64")], consentimento: { termoVersao: "2026-10", aceitoEm: "2026-10-01T10:00:00.000Z", textoSha256: "x" }, responsavelId: "u-enc",
    });
    expect(r.ok).toBe(true);
    await sincronizar();
    const cad = await c.armazem.cadastro();
    expect(resumoCadastro(cad)).toMatchObject({ semRostos: false, comRosto: 1 });
    const id = identificar(vetor(3, 0.1), cad.biometrias);
    expect(id).toMatchObject({ reconhecido: true, employeeId: "e1" });
    await c.bater({ identificacao: { metodo: "facial", confianca: id.confianca } });
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(c.db.tabelas.ponto_marcacoes[0]).toMatchObject({ employee_id: "e1", metodo: "facial", confianca: id.confianca });
  });

  it("ponto pelo encarregado registra quem identificou", async () => {
    await sincronizar();
    await c.bater({ identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(c.db.tabelas.ponto_marcacoes[0]).toMatchObject({ metodo: "encarregado", encarregado_id: "u-enc", confianca: null });
  });

  it("terceirizado entra como acesso, fora do ponto CLT", async () => {
    await sincronizar();
    await c.bater({ pessoa: { tipo: "terceiro", id: "t1" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" } });
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(c.db.tabelas.ponto_marcacoes[0]).toMatchObject({ tipo_registro: "acesso_terceiro", terceiro_id: "t1", employee_id: null });
    expect(c.armazem.marcacoes[0].cpf).toBe("");
  });
});

describe("offline, reconexão, revogação e servidor fora do ar", () => {
  it("sem internet a rodada não lança, nada é perdido e a reconexão envia tudo", async () => {
    await sincronizar();
    c.online = false;
    await c.bater(); await c.bater();
    const off = await rodada();
    expect(off).toMatchObject({ online: false });
    expect((await c.armazem.contagem()).pendentes).toBe(2);
    c.online = true;
    const on = await rodada();
    expect(on).toMatchObject({ online: true, erro: null });
    expect(c.db.tabelas.ponto_marcacoes.map(m => m.nsr)).toEqual([1, 2]);
    expect((await c.armazem.contagem()).pendentes).toBe(0);
  });

  it("servidor fora do ar (503): batidas continuam pendentes e a mensagem diz que o envio será repetido", async () => {
    await sincronizar();
    await c.bater();
    c.statusForaDoAr = 503;
    const r = await rodada();
    expect(r.erro).toBeTruthy();
    expect((await c.armazem.contagem()).pendentes).toBe(1);
    expect(classificarResposta({ ok: false, status: 503 })).toMatchObject({ tipo: TIPO_FALHA.SERVIDOR });
  });

  it("aparelho revogado: a rodada avisa e as batidas não enviadas continuam guardadas", async () => {
    await sincronizar();
    await c.bater(); await c.bater();
    await c.tratar({ action: "ponto-dispositivo-revogar", body: { accessToken: "admin", dispositivoId: c.dispositivoId } });
    const r = await rodada();
    expect(r.revogado).toBe(true);
    expect((await c.armazem.marcacoesPendentes(10)).map(m => m.nsr)).toEqual([1, 2]);
    expect(classificarResposta({ ok: false, status: 403, code: "APARELHO_REVOGADO" }).tipo).toBe(TIPO_FALHA.REVOGADO);
  });

  it("token desconhecido leva a parear de novo", async () => {
    c.token = "token-que-nao-existe";
    expect((await rodada()).desconhecido).toBe(true);
  });
});

describe("fila de marcações e cadeia", () => {
  it("lote grande: 450 batidas offline saem em lotes, em ordem, sem buraco", async () => {
    await sincronizar();
    c.online = false;
    for (let i = 0; i < 450; i++) await c.bater();
    c.online = true;
    const r = await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(r).toMatchObject({ enviadas: 450, erro: null });
    expect(c.chamadas.filter(x => x.action === "ponto-enviar-marcacoes").length).toBeGreaterThanOrEqual(3);
    expect(c.db.tabelas.ponto_marcacoes.map(m => m.nsr)).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
  });

  it("batidas simultâneas nunca pegam o mesmo NSR", async () => {
    const feitas = await Promise.all(Array.from({ length: 8 }, () => c.bater()));
    expect(feitas.map(b => b.nsr).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("BUG corrigido: banco perdido com o MESMO número de batidas do servidor não marca as novas como enviadas sem gravar", async () => {
    await sincronizar();
    await c.bater(); await c.bater();
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });     // servidor em NSR 2
    c.novoArmazem();                                                     // banco do aparelho recriado
    const novas = [await c.bater(), await c.bater()];                    // NSR 1 e 2 de novo, outra cadeia
    const r = await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(r).toMatchObject({ erro: null, realinhou: true });
    const ids = c.db.tabelas.ponto_marcacoes.map(m => m.id);
    expect(ids).toEqual(expect.arrayContaining(novas.map(b => b.id)));   // antes: nunca chegavam ao servidor
    expect(c.db.tabelas.ponto_marcacoes.map(m => m.nsr)).toEqual([1, 2, 3, 4]);
  });

  it("BUG corrigido: batida feita durante o realinhamento não é apagada", async () => {
    await c.bater(); await c.bater();
    let liberar;
    const travado = new Promise(r => { liberar = r; });
    let primeira = true;
    const sha256Lento = async v => { if (primeira) { primeira = false; await travado; } return sha256(v); };
    const realinhando = alinharCadeia({ armazem: c.armazem, servidor: { nsr: 10, hash: "a".repeat(64) }, sha256: sha256Lento });
    const durante = c.bater();                 // entra na fila da transação
    liberar();
    await realinhando;
    const b = await durante;
    const pendentes = await c.armazem.marcacoesPendentes(10);
    expect(pendentes.map(m => m.nsr)).toEqual([11, 12, 13]);
    expect(pendentes.at(-1).id).toBe(b.id);
  });

  it("realinhamento que perderia batida é abortado", async () => {
    await c.bater(); await c.bater();
    await expect(c.armazem.realinharPendentes({ base: { nsr: 5, hash: "b".repeat(64) }, recalcular: async p => p.slice(0, 1) })).rejects.toThrow(/perderia/);
    expect((await c.armazem.marcacoesPendentes(10)).length).toBe(2);
  });

  it("marcação nunca é marcada como enviada antes da confirmação do servidor", async () => {
    await sincronizar();
    await c.bater();
    c.statusForaDoAr = 500;
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect((await c.armazem.contagem()).pendentes).toBe(1);
  });
});

describe("hora: reboot e relógio do celular alterado", () => {
  it("reboot: bate com a hora do celular sinalizada; depois de sincronizar volta a ser confiável", async () => {
    await sincronizar();
    c.bootId = "boot-2"; c.monotonicoMs = 1_000;
    const antes = await c.bater();
    expect(antes.horaConfiavel).toBe(false);
    await sincronizar();
    const depois = await c.bater();
    expect(depois.horaConfiavel).toBe(true);
    expect(depois.marcadoEm).toBe(new Date(c.relogioServidor).toISOString());
    expect((await c.armazem.marcacoesPendentes(5))[0]).toMatchObject({ id: antes.id, marcadoEm: antes.marcadoEm, hash: antes.hash });
  });

  it("mudar a hora do celular não altera batidas existentes e não muda a hora das novas", async () => {
    await sincronizar();
    const b1 = await c.bater();
    const guardada = { ...(await c.armazem.marcacoesPendentes(1))[0] };
    c.paredeAdiantadaMs = 3 * 3_600_000;                       // alguém adiantou o relógio 3 h
    c.passar(60_000);
    const b2 = await c.bater();
    expect((await c.armazem.marcacoesPendentes(1))[0]).toEqual(guardada);
    expect(b2.marcadoEm).toBe(new Date(c.relogioServidor).toISOString());
    expect(b2).toMatchObject({ horaConfiavel: true, relogioAlterado: true });
    expect(b1.relogioAlterado).toBe(false);
  });
});

describe("GPS nunca bloqueia", () => {
  it("GPS inválido ou ausente: a batida é registrada sem GPS", async () => {
    const semGps = await c.bater({ gps: null });
    const invalido = await c.bater({ gps: { lat: 999, lng: "x" } });
    expect(semGps.gps).toBeNull();
    expect(invalido.gps).toBeNull();
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(c.db.tabelas.ponto_marcacoes.map(m => m.gps)).toEqual([null, null]);
  });

  it("GPS velho não vai nem na batida nem na sincronização", () => {
    const agora = Date.parse("2026-10-01T12:00:00Z");
    const velho = { lat: -8, lng: -35, precisao: 5, em: agora - GPS_IDADE_MAXIMA_MS - 1 };
    expect(gpsRecente(velho, agora)).toBeNull();
    expect(gpsRecente({ ...velho, em: agora - 1000 }, agora)).toEqual({ lat: -8, lng: -35, precisao: 5 });
    expect(montarCorpoSincronizacao({ gps: velho, agoraMs: agora })).not.toHaveProperty("gps");
  });

  it("sincronização sem GPS segue normalmente", async () => {
    const r = await rodada({ corpo: montarCorpoSincronizacao({ app: { versao: "1.0.0" }, agoraMs: c.relogioServidor }) });
    expect(r).toMatchObject({ online: true, cadastroAtualizado: true });
    expect(c.db.tabelas.ponto_dispositivos[0].ultimo_gps ?? null).toBeNull();
  });
});

describe("fila de fotografias", () => {
  const comFoto = async () => { await sincronizar(); const b = await c.bater({ fotoSha256: sha256(JPEG), caminhoFoto: "file://a.jpg" }); await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 }); return b; };

  it("foto só é apagada do aparelho depois do OK do servidor", async () => {
    await comFoto();
    const apagadas = [];
    c.online = false;
    expect(await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => JPEG.toString("base64"), aposEnviar: async i => apagadas.push(i.caminhoFoto) })).toMatchObject({ enviadas: 0, falhas: 1 });
    expect(apagadas).toEqual([]);
    expect((await c.armazem.contagem()).fotos).toBe(1);
    c.online = true;
    expect(await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => JPEG.toString("base64"), aposEnviar: async i => apagadas.push(i.caminhoFoto) })).toMatchObject({ enviadas: 1 });
    expect(apagadas).toEqual(["file://a.jpg"]);
  });

  it("erro de leitura do arquivo deixa a foto para a próxima rodada", async () => {
    await comFoto();
    const r = await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => { throw new Error("EIO"); } });
    expect(r).toMatchObject({ enviadas: 0, falhas: 1 });
    expect((await c.armazem.contagem()).fotos).toBe(1);
  });

  it("arquivo sumido vira 'sem arquivo' (diagnóstico) e não trava a fila", async () => {
    await comFoto();
    expect(await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => null })).toMatchObject({ semArquivo: 1 });
    expect(await c.armazem.contagem()).toMatchObject({ fotos: 0, fotosComProblema: 1 });
  });

  it("foto acima do limite não é enviada; fica recusada com o arquivo preservado", async () => {
    await comFoto();
    const apagadas = [];
    const grande = Buffer.alloc(LIMITE_FOTO_BYTES + 10, 0xff).toString("base64");
    const r = await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => grande, aposEnviar: async i => apagadas.push(i) });
    expect(r).toMatchObject({ recusadas: 1, enviadas: 0 });
    expect(c.chamadas.some(x => x.action === "ponto-enviar-foto")).toBe(false);
    expect(apagadas).toEqual([]);
    expect(c.armazem.marcacoes[0].fotoEstado).toBe(FOTO.RECUSADA);
  });

  it("foto trocada é recusada pelo servidor e não fica tentando para sempre", async () => {
    await comFoto();
    const outra = Buffer.from([0xff, 0xd8, 1, 2, 3]).toString("base64");
    expect(await enviarFotos({ armazem: c.armazem, api: c.api, lerFotoBase64: async () => outra })).toMatchObject({ recusadas: 1 });
    expect((await c.armazem.fotosPendentes(10)).length).toBe(0);
  });

  it("batida sem foto não entra na fila de fotos", async () => {
    await sincronizar();
    await c.bater();
    await enviarPendentes({ armazem: c.armazem, api: c.api, sha256 });
    expect(await c.armazem.fotosPendentes(10)).toEqual([]);
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
  it("registro manual não depende de modelo, câmera nem GPS", async () => {
    const b = await registrarBatida({
      armazem: c.armazem, relogio: c.relogio(), sha256, gerarId: randomUUID, dispositivoId: c.dispositivoId,
      pessoa: { tipo: "funcionario", id: "e2", cpf: "98765432100" }, identificacao: { metodo: "encarregado", encarregadoId: "u-enc" }, gps: undefined,
    });
    expect(b).toMatchObject({ metodo: "encarregado", gps: null, fotoSha256: "" });
  });
});
