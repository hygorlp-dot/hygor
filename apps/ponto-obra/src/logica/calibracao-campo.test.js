// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RESULTADO, criarSessaoCalibracao, relatorioDeCampo, resumoDeCampo } from "./calibracao-campo.js";
import { luminanciaMedia } from "./rosto.js";

describe("calibração de campo (modo técnico)", () => {
  it("sessão de calibração guarda só métricas: vetor, foto, nome, id e CPF nunca entram", () => {
    const s = criarSessaoCalibracao();
    s.registrar({ top1: 0.7312, top2: 0.4123, confiancaDeteccao: 0.98, larguraRosto: 0.31, luminancia: 121.4, resultado: RESULTADO.RECONHECIDO, duracaoMs: 2412.7,
      vetor: [0.1, 0.2], foto: "file:///x.jpg", employeeId: "e1", nome: "Zé", cpf: "12345678909" });
    const [linha] = s.linhas();
    expect(Object.keys(linha).sort()).toEqual(["confiancaDeteccao", "duracaoMs", "larguraRosto", "luminancia", "margem", "resultado", "top1", "top2"]);
    expect(linha).toMatchObject({ top1: 0.7312, top2: 0.4123, margem: 0.3189, duracaoMs: 2413 });
    expect(JSON.stringify(s.linhas())).not.toMatch(/vetor|file:|e1|Zé|12345678909/);
    s.registrar({ resultado: "inventado" });                      // resultado fora da lista: ignorado
    expect(s.total).toBe(1);
  });

  it("sessão tem limite (não cresce sem fim na memória)", () => {
    const s = criarSessaoCalibracao({ limite: 3 });
    for (let i = 0; i < 5; i++) s.registrar({ top1: 0.7, resultado: RESULTADO.RECONHECIDO, duracaoMs: i });
    expect(s.total).toBe(3);
    expect(s.linhas().map(l => l.duracaoMs)).toEqual([2, 3, 4]);
  });

  it("relatório anônimo: contagens, distribuições e aceitas perto do limiar", () => {
    const s = criarSessaoCalibracao();
    [0.62, 0.64, 0.72, 0.81].forEach(t => s.registrar({ top1: t, top2: 0.4, luminancia: 110, resultado: RESULTADO.RECONHECIDO, duracaoMs: 2000 }));
    s.registrar({ top1: 0.52, top2: 0.4, resultado: RESULTADO.NAO_CADASTRADO, duracaoMs: 1500 });
    s.registrar({ top1: 0.66, top2: 0.61, resultado: RESULTADO.AMBIGUO, duracaoMs: 1500 });
    s.registrar({ resultado: RESULTADO.SEM_ROSTO, duracaoMs: 900 });
    const r = relatorioDeCampo(s.linhas());
    expect(r.tentativas).toBe(7);
    expect(r.porResultado).toMatchObject({ reconhecido: 4, nao_cadastrado: 1, ambiguo: 1, sem_rosto: 1 });
    expect(r.taxaReconhecimento).toBeCloseTo(4 / 6, 3);
    expect(r.aceitasPertoDoLimiar).toBe(2);                         // 0,62 e 0,64 (< 0,65)
    const texto = JSON.stringify([r, resumoDeCampo(r)]);
    expect(texto).not.toMatch(/vetor|employeeId|nome|cpf/i);
    expect(resumoDeCampo(r).find(l => l.rotulo === "Aceitas perto do limiar").valor).toBe("2");
  });

  it("luminância média do recorte: número só, de 0 a 255", () => {
    const preto = new Uint8Array(4 * 4).fill(0);
    const branco = new Uint8Array(4 * 4).fill(255);
    const cinza = new Uint8Array([100, 100, 100, 255, 100, 100, 100, 255]);
    expect(luminanciaMedia(preto)).toBe(0);
    expect(luminanciaMedia(branco)).toBe(255);
    expect(luminanciaMedia(cinza)).toBe(100);
  });
});
