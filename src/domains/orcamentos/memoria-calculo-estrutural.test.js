import { describe, expect, it } from "vitest";
import {
  calcularSapataTipo, novaSapataTipo, pesoUnitarioAco, resumoSapatas,
} from "./memoria-calculo-estrutural";

describe("pesoUnitarioAco", () => {
  it("devolve o kg/m nominal da bitola (NBR 7480)", () => {
    expect(pesoUnitarioAco("10")).toBeCloseTo(0.617);
    expect(pesoUnitarioAco("6.3")).toBeCloseTo(0.245);
  });
  it("aceita bitola com vírgula decimal", () => {
    expect(pesoUnitarioAco("12,5")).toBeCloseTo(0.963);
  });
  it("devolve 0 para bitola desconhecida", () => {
    expect(pesoUnitarioAco("999")).toBe(0);
  });
});

describe("calcularSapataTipo - quantidades de concreto/escavação", () => {
  const tipo = novaSapataTipo({
    largura: 0.85, comprimento: 1.0, alturaBase: 0.3, alturaTronco: 0.2, qtd: 7,
    larguraEscavacao: 1.25, comprimentoEscavacao: 1.4, profundidadeEscavacao: 2,
  });

  it("calcula volume de escavação (L x C x profundidade)", () => {
    expect(calcularSapataTipo(tipo).volumeEscavacaoUnit).toBeCloseTo(1.25 * 1.4 * 2);
  });
  it("calcula área de concreto magro (L x C da sapata)", () => {
    expect(calcularSapataTipo(tipo).areaConcretoMagroUnit).toBeCloseTo(0.85);
  });
  it("calcula concretagem da base e do tronco separadas, e a soma como concretagem da sapata", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.volumeBaseUnit).toBeCloseTo(0.85 * 1.0 * 0.3);
    expect(calc.volumeTroncoUnit).toBeCloseTo(0.85 * 1.0 * 0.2);
    expect(calc.volumeSapataUnit).toBeCloseTo(calc.volumeBaseUnit + calc.volumeTroncoUnit);
  });
  it("reaterro = escavação - volume de concreto da sapata", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.reaterroUnit).toBeCloseTo(calc.volumeEscavacaoUnit - calc.volumeSapataUnit);
  });
  it("nunca devolve reaterro negativo (sapata maior que a escavação seria erro de digitação, não reaterro negativo)", () => {
    const tipoInvalido = novaSapataTipo({ largura: 5, comprimento: 5, alturaBase: 5, larguraEscavacao: 1, comprimentoEscavacao: 1, profundidadeEscavacao: 1 });
    expect(calcularSapataTipo(tipoInvalido).reaterroUnit).toBe(0);
  });
  it("multiplica os totais pela quantidade de peças do tipo", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.volumeEscavacaoTotal).toBeCloseTo(calc.volumeEscavacaoUnit * 7);
    expect(calc.volumeSapataTotal).toBeCloseTo(calc.volumeSapataUnit * 7);
  });
});

describe("calcularSapataTipo - armadura, validado contra o projeto estrutural real (Estrutural.pdf, folha E-02/13)", () => {
  // Tipo "P1, P4, P5, P6, P10, P11 e P14" (85x100, altura 30/20): o próprio
  // projeto já traz, prontos, "4N1∅10c/25 C=118" (armadura X) e
  // "3N2∅10c/25 C=133" (armadura Y), com resumo de aço "Total+10%: 5,9
  // (x7): 41,3" - usado aqui como validação de ponta a ponta (mesmo padrão
  // já usado nesta sessão para validar o motor do ORSE contra a raspagem
  // em produção).
  const tipo = novaSapataTipo({
    tipo: "P1, P4, P5, P6, P10, P11 e P14", qtd: 7,
    armaduraX: { bitola: "10", quantidade: 4, comprimento: 1.18 },
    armaduraY: { bitola: "10", quantidade: 3, comprimento: 1.33 },
  });

  it("calcula o peso de aço de UMA sapata já com 10% de perda ≈ 5,9 kg (valor do projeto)", () => {
    expect(calcularSapataTipo(tipo).pesoAcoUnit).toBeCloseTo(5.9, 1);
  });
  it("multiplica pelas 7 peças do tipo ≈ 41,3 kg (valor do projeto, com folga para o arredondamento do próprio PDF)", () => {
    expect(calcularSapataTipo(tipo).pesoAcoTotal).toBeCloseTo(41.3, 0);
  });
});

describe("resumoSapatas", () => {
  const tipos = [
    novaSapataTipo({
      tipo: "P1 e cia (85x100)", qtd: 7, largura: 0.85, comprimento: 1.0, alturaBase: 0.3, alturaTronco: 0.2,
      larguraEscavacao: 1.25, comprimentoEscavacao: 1.4, profundidadeEscavacao: 2,
      armaduraX: { bitola: "10", quantidade: 4, comprimento: 1.18 },
      armaduraY: { bitola: "10", quantidade: 3, comprimento: 1.33 },
    }),
    novaSapataTipo({
      tipo: "P2 (105x120)", qtd: 1, largura: 1.05, comprimento: 1.2, alturaBase: 0.3, alturaTronco: 0.2,
      larguraEscavacao: 1.45, comprimentoEscavacao: 1.6, profundidadeEscavacao: 2,
      armaduraX: { bitola: "10", quantidade: 5, comprimento: 1.38 },
      armaduraY: { bitola: "12.5", quantidade: 4, comprimento: 1.58 },
    }),
  ];

  it("soma os totais de todos os tipos", () => {
    const { totais } = resumoSapatas(tipos);
    const [t1, t2] = tipos.map(calcularSapataTipo);
    expect(totais.volumeEscavacao).toBeCloseTo(t1.volumeEscavacaoTotal + t2.volumeEscavacaoTotal);
    expect(totais.pesoAco).toBeCloseTo(t1.pesoAcoTotal + t2.pesoAcoTotal);
  });

  it("agrupa o aço por bitola, somando armadura X e Y de tipos diferentes na mesma bitola", () => {
    const { acoPorBitola } = resumoSapatas(tipos);
    const bitola10 = acoPorBitola.find(l => l.bitola === "10");
    const bitola125 = acoPorBitola.find(l => l.bitola === "12.5");
    expect(bitola10).toBeDefined();
    expect(bitola125).toBeDefined();
    // bitola 10 recebe armaduraX dos dois tipos + armaduraY do primeiro tipo
    const [t1, t2] = tipos.map(calcularSapataTipo);
    expect(bitola10.kg).toBeCloseTo(t1.pesoXTotal + t1.pesoYTotal + t2.pesoXTotal);
    expect(bitola125.kg).toBeCloseTo(t2.pesoYTotal);
  });

  it("devolve zero em tudo para uma lista vazia, sem quebrar", () => {
    const { totais, acoPorBitola, linhas } = resumoSapatas([]);
    expect(linhas).toEqual([]);
    expect(acoPorBitola).toEqual([]);
    expect(Object.values(totais).every(v => v === 0)).toBe(true);
  });
});
