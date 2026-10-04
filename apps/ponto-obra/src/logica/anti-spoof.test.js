// @vitest-environment node
//
// Ataques de apresentação contra a prova de vida por MUDANÇA DE POSE
// (avaliarProvaDeVida). Testa a REGRA com as saídas que analisarFoto()
// daria em cada situação - não substitui teste físico com papel, tela e
// vídeo (docs/anti-spoof.md tem o protocolo). Os casos que PASSAM estão aqui
// de propósito: documentam a limitação, não a escondem.
import { describe, expect, it } from "vitest";
import { avaliarProvaDeVida, normalizarL2 } from "./rosto.js";

const rosto = (i, ruido = 0) => normalizarL2(Array.from({ length: 192 }, (_, k) => (k === i ? 1 : 0) + (k === i + 1 ? ruido : 0) + 0.02));
const frente = { vetor: rosto(3), giro: 0.01 };

describe("anti-spoof: o que a prova de vida por pose barra e o que NÃO barra", () => {
  it("pessoa real virando o rosto: passa", () => {
    expect(avaliarProvaDeVida(frente, { vetor: rosto(3, 0.5), giro: 0.32 })).toMatchObject({ vivo: true });
  });

  it("foto impressa parada: a segunda foto não vira - recusada", () => {
    expect(avaliarProvaDeVida(frente, { vetor: rosto(3, 0.05), giro: 0.02 })).toMatchObject({ vivo: false, motivo: "não virou o rosto" });
  });

  it("foto na tela (celular/tablet) parada: mesma situação da foto impressa - recusada", () => {
    expect(avaliarProvaDeVida(frente, { vetor: rosto(3, 0.03), giro: -0.01 })).toMatchObject({ vivo: false });
  });

  it("vídeo / replay da pessoa virando o rosto: PASSA (limitação conhecida - não é liveness forte)", () => {
    // O vídeo mostra a mesma pessoa virando: giro e identidade batem.
    expect(avaliarProvaDeVida(frente, { vetor: rosto(3, 0.45), giro: 0.3 })).toMatchObject({ vivo: true });
  });

  it("troca de pessoa entre as duas fotos: recusada (a segunda não parece a primeira)", () => {
    expect(avaliarProvaDeVida(frente, { vetor: rosto(40), giro: 0.3 })).toMatchObject({ vivo: false, motivo: "outra pessoa na segunda foto" });
  });

  it("rosto parcialmente coberto: sem rosto detectado na segunda foto, recusada (vai para o encarregado)", () => {
    expect(avaliarProvaDeVida(frente, { erro: "Não encontrei um rosto. Olhe para a câmera." })).toMatchObject({ vivo: false, motivo: "segunda foto sem rosto" });
    expect(avaliarProvaDeVida(null, { vetor: rosto(3), giro: 0.3 })).toMatchObject({ vivo: false });
  });
});
