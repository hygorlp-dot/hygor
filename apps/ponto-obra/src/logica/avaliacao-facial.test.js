// @vitest-environment node
//
// Avaliação SINTÉTICA da regra de decisão 1:N (limiar + margem sobre o 2º).
// Vetores gerados por semente fixa: mede a LÓGICA, não o modelo com rostos
// reais (isso é a medição de campo - docs/calibracao-facial.md). Os limiares
// não mudam aqui; os números alimentam a documentação.
import { describe, expect, it } from "vitest";
import { CENARIOS, conjuntoSintetico, relatorioSintetico, varreduraELimiarEquilibrado } from "./avaliacao-facial.js";
import { PARAMETROS_FACIAIS } from "./calibracao.js";

const N = { pessoas: 120, impostores: 200, tentativasPorPessoa: 4 };

describe("avaliação sintética do reconhecimento", () => {
  it("FAR e FRR nos cenários favorável e de obra: nenhum falso aceite e falsa rejeição baixa", () => {
    for (const cenario of [CENARIOS.favoravel, CENARIOS.obra]) {
      const r = relatorioSintetico(conjuntoSintetico({ ...N, cenario }));
      expect(r.noCampo.falsoAceite).toBe(0);
      expect(r.noCampo.taxaFalsaRejeicao).toBeLessThanOrEqual(0.02);
      // Separação real entre genuínos e impostores nas distribuições.
      expect(r.distribuicao.genuinas.top1.p05).toBeGreaterThan(r.distribuicao.impostoras.top1.p95);
    }
  });

  it("FAR e FRR em condição adversa: a regra recusa (vai para o encarregado) em vez de aceitar errado", () => {
    const r = relatorioSintetico(conjuntoSintetico({ ...N, cenario: CENARIOS.adverso }));
    expect(r.noCampo.falsoAceite).toBe(0);
    // Falsa rejeição alta é o custo honesto da segurança: documentado.
    expect(r.noCampo.taxaFalsaRejeicao).toBeGreaterThan(0.1);
  });

  it("segundo candidato: gêmeos/parecidos são recusados por ambiguidade, nunca atribuídos ao outro", () => {
    const r = relatorioSintetico(conjuntoSintetico({ pessoas: 40, impostores: 60, gemeos: 10 }));
    expect(r.noCampo.falsoAceite).toBe(0);
    expect(r.recusasPorAmbiguidade).toBeGreaterThan(0);
  });

  it("margem sobre o 2º: sem ela, parecidos viram batida no nome errado", () => {
    const conjunto = conjuntoSintetico({ pessoas: 40, impostores: 60, gemeos: 10 });
    const comMargem = relatorioSintetico(conjunto);
    const semMargem = relatorioSintetico(conjunto, { ...PARAMETROS_FACIAIS, margemSobreSegundo: 0 });
    expect(semMargem.noCampo.falsoAceite).toBeGreaterThan(0);
    expect(comMargem.noCampo.falsoAceite).toBe(0);
  });

  it("varredura de limiares: subir o limiar nunca aumenta o falso aceite nem diminui a falsa rejeição", () => {
    const r = relatorioSintetico(conjuntoSintetico({ ...N, cenario: CENARIOS.adverso }));
    const { curva } = varreduraELimiarEquilibrado(r.amostras);
    for (let i = 1; i < curva.length; i++) {
      expect(curva[i].taxaFalsoAceite).toBeLessThanOrEqual(curva[i - 1].taxaFalsoAceite);
      expect(curva[i].taxaFalsaRejeicao).toBeGreaterThanOrEqual(curva[i - 1].taxaFalsaRejeicao);
    }
    // O limiar atual fica do lado seguro (sem falso aceite) da curva.
    expect(curva.find(c => c.limiar === PARAMETROS_FACIAIS.limiarReconhecimento).falsoAceite).toBe(0);
  });

  it("as amostras do relatório não carregam vetor", () => {
    const r = relatorioSintetico(conjuntoSintetico({ pessoas: 5, impostores: 5 }));
    expect(JSON.stringify(r.amostras)).not.toMatch(/vetor/);
    for (const a of r.amostras) expect(Object.keys(a).sort()).toEqual(["aceito", "esperado", "giro", "larguraRosto", "scoreDeteccao", "top1", "top1Id", "top2"]);
  });
});
