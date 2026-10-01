// @vitest-environment node
import { describe, expect, it } from "vitest";
import { montarDiagnostico, estadoReferenciaHora } from "./diagnostico.js";
import { amostraDeCalibracao, relatorioCalibracao, varrerLimiares } from "./relatorio-calibracao.js";
import { PARAMETROS_FACIAIS } from "./calibracao.js";
import { LIMIAR_RECONHECIMENTO, MARGEM_SOBRE_SEGUNDO, BLAZEFACE, identificar } from "./rosto.js";
import { montarCorpoSincronizacao } from "./sincronizacao.js";

describe("diagnóstico do aparelho", () => {
  const entrada = {
    app: { versao: "1.0.0", build: "4", commit: "abc1234" },
    aparelho: { plataforma: "android", marca: "samsung", modelo: "SM-A155M", android: "14" },
    sessao: { nome: "Portaria", token: "TOKEN-SECRETO", dispositivoId: "d", obra: { nome: "W1-22" } },
    contagem: { pendentes: 3, fotos: 2, fotosComProblema: 1 },
    ultimaSincronizacao: { em: Date.parse("2026-10-01T13:00:00Z"), ok: true, ultimoOkEm: Date.parse("2026-10-01T13:00:00Z") },
    modelos: { estado: "ok" }, hora: { horaConfiavel: true, relogioAlterado: false }, gps: { estado: "ok" },
  };

  it("traz o que o suporte precisa", () => {
    const d = Object.fromEntries(montarDiagnostico(entrada).map(i => [i.rotulo, i.valor]));
    expect(d).toMatchObject({
      "Versão do app": "1.0.0", "Build (versionCode)": "4", Commit: "abc1234", Plataforma: "android", Android: "14",
      Aparelho: "samsung SM-A155M", "Batidas a enviar": "3", "Fotos a enviar": "2", "Fotos com problema": "1",
      "Reconhecimento facial": "carregado", "Referência de hora": "sincronizada", GPS: "ok", Obra: "W1-22",
    });
    expect(d["Última sincronização"]).toMatch(/01\/10\/2026/);
  });

  it("nunca inclui token, PIN, CPF, vetor ou foto, mesmo se vierem na entrada", () => {
    const texto = JSON.stringify(montarDiagnostico({ ...entrada, cadastro: { biometrias: [{ vetor: [0.1, 0.2] }] }, pin: "2468", cpf: "12345678909" }));
    for (const proibido of ["TOKEN-SECRETO", "2468", "12345678909", "vetor", "0.1", "base64", "pinHash"]) expect(texto).not.toContain(proibido);
  });

  it("estado da referência de hora", () => {
    expect(estadoReferenciaHora({ horaConfiavel: false, motivo: "aparelho reiniciou desde a última sincronização" })).toMatch(/reiniciou/);
    expect(estadoReferenciaHora({ horaConfiavel: true, relogioAlterado: true })).toMatch(/diferente/);
    expect(estadoReferenciaHora(null)).toBe("desconhecido");
  });
});

describe("payload da sincronização", () => {
  it("versão do app, marca, modelo, Android e GPS válido; nada pessoal", () => {
    const agoraMs = Date.parse("2026-10-01T12:00:00Z");
    expect(montarCorpoSincronizacao({
      app: { versao: "1.0.0", build: "7", commit: "abcdef1234567" }, aparelho: { marca: "motorola", modelo: "moto g54", android: "14", serial: "NAO-VAI" },
      gps: { lat: -8.1, lng: -34.9, precisao: 8, em: agoraMs - 5000 }, agoraMs,
    })).toEqual({
      appVersao: "1.0.0 (7)",
      aparelho: { marca: "motorola", modelo: "moto g54", android: "14", build: "7", commit: "abcdef123456" },
      gps: { lat: -8.1, lng: -34.9, precisao: 8 },
    });
  });

  it("sem informação nenhuma ainda sai um corpo válido", () => {
    expect(montarCorpoSincronizacao()).toEqual({ appVersao: "", aparelho: { marca: "", modelo: "", android: "", build: "", commit: "" } });
  });
});

describe("calibração facial", () => {
  it("parâmetros centralizados com os MESMOS valores da versão anterior", () => {
    expect(PARAMETROS_FACIAIS).toMatchObject({
      scoreMinimoDeteccao: 0.5, limiarReconhecimento: 0.6, margemSobreSegundo: 0.08, giroMaximoDeFrente: 0.15,
      giroMinimoVirado: 0.2, similaridadeMinimaVirado: 0.35, segundoRostoScoreMaximo: 0.75, larguraMinimaRosto: 0.22,
      inclinacaoMaximaGraus: 15, capturasCadastro: 3,
    });
    expect([LIMIAR_RECONHECIMENTO, MARGEM_SOBRE_SEGUNDO, BLAZEFACE.scoreMinimo]).toEqual([0.6, 0.08, 0.5]);
    expect(Object.isFrozen(PARAMETROS_FACIAIS)).toBe(true);
  });

  it("amostra guarda só números e ids - vetor e foto são descartados", () => {
    const resultado = { reconhecido: true, employeeId: "e1", melhor: { employeeId: "e1", similaridade: 0.81, vetor: [1, 2] }, segundo: { employeeId: "e2", similaridade: 0.4 } };
    const a = amostraDeCalibracao({ esperado: "e1", resultado, deteccao: { score: 0.97, larguraRosto: 0.4, giro: 0.02, foto: "base64..." } });
    expect(a).toEqual({ esperado: "e1", aceito: "e1", top1Id: "e1", top1: 0.81, top2: 0.4, scoreDeteccao: 0.97, larguraRosto: 0.4, giro: 0.02 });
  });

  it("mede falso aceite, falsa rejeição e as distribuições", () => {
    const cad = [{ employeeId: "e1", vetor: [1, 0, 0] }, { employeeId: "e2", vetor: [0, 1, 0] }];
    const tentar = (esperado, vetor) => amostraDeCalibracao({ esperado, resultado: identificar(vetor, cad), deteccao: { score: 0.9 } });
    const amostras = [
      tentar("e1", [1, 0.1, 0]),        // genuína aceita
      tentar("e1", [0.5, 0.5, 0.7]),    // genuína rejeitada (falsa rejeição)
      tentar(null, [0.9, 0.05, 0.1]),   // impostor aceito como e1 (falso aceite)
      tentar(null, [0, 0, 1]),          // impostor rejeitado
    ];
    const r = relatorioCalibracao(amostras);
    expect(r.noCampo).toMatchObject({ tentativas: 4, genuinas: 2, impostoras: 2, falsoAceite: 1, falsaRejeicao: 1, acertos: 1, taxaFalsoAceite: 0.25, taxaFalsaRejeicao: 0.5 });
    expect(r.distribuicao.genuinas.top1.n).toBe(2);
    expect(r.parametros).toEqual({ limiarReconhecimento: 0.6, margemSobreSegundo: 0.08 });
    const curva = varrerLimiares(amostras, [{ limiar: 0.6, margem: 0.08 }, { limiar: 0.999, margem: 0.08 }]);
    expect(curva[0]).toMatchObject({ falsoAceite: 1 });
    expect(curva[1]).toMatchObject({ falsoAceite: 0, falsaRejeicao: 2 });
  });
});
