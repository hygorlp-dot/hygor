// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BLAZEFACE, ancorasBlazeFaceFront, decodificarBlazeFace, giroDaCabeca, identificar, normalizarL2,
  olhosENariz, pixelsParaTensor, recorteParaIdentidade, rostosDistintos, similaridadeCosseno, vetorDoCadastro,
} from "./rosto.js";

// Monta a saída crua do BlazeFace com UM rosto na âncora `i`.
function saidaComRosto(i, { score = 4, cx = 0, cy = 0, w = 40, h = 40, olhos = [[-10, -6], [10, -6]], nariz = [0, 4] } = {}) {
  const scores = new Float32Array(BLAZEFACE.ancoras).fill(-10);
  const caixas = new Float32Array(BLAZEFACE.ancoras * 16);
  scores[i] = score;
  const b = i * 16;
  caixas.set([cx, cy, w, h, olhos[0][0], olhos[0][1], olhos[1][0], olhos[1][1], nariz[0], nariz[1], 0, 14, -20, 0, 20, 0], b);
  return { scores, caixas };
}
const unitario = (n, desvio = 0) => normalizarL2(Array.from({ length: 192 }, (_, i) => Math.sin(i * (n + 1)) + desvio * Math.cos(i)));

describe("BlazeFace", () => {
  it("gera as 896 âncoras do modelo front (16x16x2 + 8x8x6)", () => {
    const a = ancorasBlazeFaceFront();
    expect(a).toHaveLength(896);
    expect(a[0]).toEqual([0.5 / 16, 0.5 / 16]);
    expect(a[511]).toEqual([15.5 / 16, 15.5 / 16]);
    expect(a[512]).toEqual([0.5 / 8, 0.5 / 8]);
    expect(a[895]).toEqual([7.5 / 8, 7.5 / 8]);
  });

  it("decodifica caixa e pontos relativos à âncora e ignora score baixo", () => {
    const ancoras = ancorasBlazeFaceFront();
    const { scores, caixas } = saidaComRosto(300);
    const [r, ...resto] = decodificarBlazeFace(scores, caixas, ancoras);
    expect(resto).toHaveLength(0);
    const [ax, ay] = ancoras[300];
    expect(r.caixa.x1).toBeCloseTo(ax - 20 / 128);
    expect(r.pontos[0].x).toBeCloseTo(ax - 10 / 128);
    expect(r.score).toBeGreaterThan(0.95);
  });

  it("junta âncoras vizinhas do mesmo rosto e separa duas pessoas", () => {
    const ancoras = ancorasBlazeFaceFront();
    const a = decodificarBlazeFace(...Object.values(saidaComRosto(300)), ancoras)[0];
    const vizinho = { ...a, score: 0.7, caixa: { ...a.caixa, x1: a.caixa.x1 + 0.01, x2: a.caixa.x2 + 0.01 } };
    const outro = { ...a, score: 0.8, caixa: { x1: 0.8, y1: 0.8, x2: 0.95, y2: 0.95 } };
    expect(rostosDistintos([vizinho, a, outro])).toHaveLength(2);
    expect(rostosDistintos([vizinho, a])[0]).toBe(a);
  });

  it("giro da cabeça: ~0 de frente, sinal muda com o lado", () => {
    const rosto = (narizX) => ({ pontos: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: narizX, y: 0.5 }] });
    expect(giroDaCabeca(rosto(0.5))).toBeCloseTo(0);
    expect(giroDaCabeca(rosto(0.58))).toBeGreaterThan(0.25);
    expect(giroDaCabeca(rosto(0.42))).toBeLessThan(-0.25);
    expect(olhosENariz({ pontos: [{ x: 0.6, y: 0 }, { x: 0.4, y: 0 }, { x: 0.5, y: 0 }] }).olhoEsquerdo.x).toBe(0.4);
  });
});

describe("recorte e tensor", () => {
  it("recorte: 2,5x a distância entre os olhos, abaixo do meio dos olhos e sem giro com olhos na horizontal", () => {
    const r = recorteParaIdentidade({ x: 100, y: 200 }, { x: 140, y: 200 });
    expect(r).toEqual({ cx: 120, cy: 200 + 100 * 0.15, tamanho: 100, anguloGraus: 0 });
    expect(recorteParaIdentidade({ x: 100, y: 100 }, { x: 140, y: 140 }).anguloGraus).toBeCloseTo(45);
  });

  it("pixels RGBA viram RGB em [-1, 1]", () => {
    const t = pixelsParaTensor(new Uint8Array([0, 255, 127.5, 255, 255, 0, 0, 0]), 2, 1);
    expect(Array.from(t).map(v => Number(v.toFixed(3)))).toEqual([-1, 1, -0.004, 1, -1, -1]);
  });
});

describe("identificação 1:N", () => {
  const cadastros = [{ employeeId: "e1", vetor: unitario(1) }, { employeeId: "e2", vetor: unitario(2) }, { employeeId: "e3", vetor: unitario(3) }];

  it("reconhece a pessoa certa com variação pequena da foto", () => {
    const r = identificar(unitario(2, 0.15), cadastros);
    expect(r).toMatchObject({ reconhecido: true, employeeId: "e2" });
    expect(r.confianca).toBeGreaterThan(0.6);
  });

  it("rosto desconhecido não vira batida de ninguém", () => {
    expect(identificar(unitario(9), cadastros)).toMatchObject({ reconhecido: false, motivo: "rosto não cadastrado nesta obra" });
  });

  it("dois cadastros parecidos demais: manda para o encarregado em vez de chutar", () => {
    const quaseIguais = [{ employeeId: "a", vetor: unitario(1) }, { employeeId: "b", vetor: unitario(1, 0.05) }];
    expect(identificar(unitario(1, 0.02), quaseIguais)).toMatchObject({ reconhecido: false, motivo: "rosto parecido com mais de um cadastro" });
  });

  it("cadastro é a média normalizada das capturas", () => {
    const v = vetorDoCadastro([unitario(1), unitario(1, 0.1), unitario(1, -0.1)]);
    expect(Math.hypot(...v)).toBeCloseTo(1);
    expect(similaridadeCosseno(v, unitario(1))).toBeGreaterThan(0.99);
    expect(() => vetorDoCadastro([])).toThrow();
  });
});
