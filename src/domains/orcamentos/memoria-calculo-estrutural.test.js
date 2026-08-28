import { describe, expect, it } from "vitest";
import {
  calcularConcretoMagroViga, calcularSapataTipo, novaLajePavimento, novaPilarPavimento, novaSapataTipo, novaVigaPavimento,
  pesoUnitarioAco, resumoSapatas, somaAcoPorBitola,
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
    folgaEscavacao: 0.2, profundidadeEscavacao: 2,
  });

  it("calcula a cova como a sapata + a folga de cada lado (2x a folga por dimensão)", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.larguraEscavacaoUnit).toBeCloseTo(0.85 + 2 * 0.2);
    expect(calc.comprimentoEscavacaoUnit).toBeCloseTo(1.0 + 2 * 0.2);
  });
  it("calcula volume de escavação (L x C da cova x profundidade)", () => {
    expect(calcularSapataTipo(tipo).volumeEscavacaoUnit).toBeCloseTo((0.85 + 0.4) * (1.0 + 0.4) * 2);
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
  it("calcula fôrmas como o perímetro da base x a altura da base", () => {
    expect(calcularSapataTipo(tipo).formaAreaUnit).toBeCloseTo(2 * (0.85 + 1.0) * 0.3);
  });
  it("reaterro = escavação - volume de concreto da sapata", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.reaterroUnit).toBeCloseTo(calc.volumeEscavacaoUnit - calc.volumeSapataUnit);
  });
  it("nunca devolve reaterro negativo (sapata maior que a escavação seria erro de digitação, não reaterro negativo)", () => {
    const tipoInvalido = novaSapataTipo({ largura: 5, comprimento: 5, alturaBase: 5, folgaEscavacao: 0, profundidadeEscavacao: 1 });
    expect(calcularSapataTipo(tipoInvalido).reaterroUnit).toBe(0);
  });
  it("marca escavacaoInsuficiente quando a sapata não cabe na própria cova (achado da crítica Impeccable) em vez de só zerar o reaterro em silêncio", () => {
    const tipoInvalido = novaSapataTipo({ largura: 5, comprimento: 5, alturaBase: 5, folgaEscavacao: 0, profundidadeEscavacao: 1 });
    expect(calcularSapataTipo(tipoInvalido).escavacaoInsuficiente).toBe(true);
    expect(calcularSapataTipo(tipo).escavacaoInsuficiente).toBe(false);
  });
  it("multiplica os totais pela quantidade de peças do tipo", () => {
    const calc = calcularSapataTipo(tipo);
    expect(calc.volumeEscavacaoTotal).toBeCloseTo(calc.volumeEscavacaoUnit * 7);
    expect(calc.volumeSapataTotal).toBeCloseTo(calc.volumeSapataUnit * 7);
  });
});

describe("novaSapataTipo - padrões", () => {
  it("parte de 20cm de folga de escavação e 1,5m de profundidade", () => {
    const tipo = novaSapataTipo();
    expect(tipo.folgaEscavacao).toBeCloseTo(0.2);
    expect(tipo.profundidadeEscavacao).toBeCloseTo(1.5);
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
      folgaEscavacao: 0.2, profundidadeEscavacao: 2,
      armaduraX: { bitola: "10", quantidade: 4, comprimento: 1.18 },
      armaduraY: { bitola: "10", quantidade: 3, comprimento: 1.33 },
    }),
    novaSapataTipo({
      tipo: "P2 (105x120)", qtd: 1, largura: 1.05, comprimento: 1.2, alturaBase: 0.3, alturaTronco: 0.2,
      folgaEscavacao: 0.2, profundidadeEscavacao: 2,
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

describe("novaPilarPavimento - um único objeto por pavimento, sem lista de tipos (igual viga/laje)", () => {
  it("começa zerado, sem nenhuma bitola", () => {
    expect(novaPilarPavimento()).toEqual({ concretoM3: 0, formaM2: 0, acoPorBitola: [], precisaRevisar: false });
  });

  it("aceita sobrescrever qualquer campo (ex.: soma dos tipos extraídos do PDF)", () => {
    // Térreo real (Estrutural.pdf, E-03/13): soma de todos os tipos de pilar do pavimento.
    const pilar = novaPilarPavimento({ concretoM3: 1.79, formaM2: 34.16, acoPorBitola: [{ bitola: "10", kg: 134 }] });
    expect(pilar.concretoM3).toBe(1.79);
    expect(somaAcoPorBitola(pilar.acoPorBitola)).toBe(134);
  });
});

describe("novaVigaPavimento / novaLajePavimento - um único objeto por pavimento, sem lista de tipos", () => {
  it("começa zerada, sem aviso de valor incorreto, sem nenhuma bitola", () => {
    const viga = novaVigaPavimento();
    expect(viga).toEqual({
      concretoM3: 0, formaM2: 0, acoPorBitola: [], avisoConcretoIncorreto: false,
      areaPlantaVigasM2: 0, larguraVigaM: 0, magroLarguraAcrescidaM: 0, precisaRevisar: false,
    });
  });

  it("aceita sobrescrever qualquer campo (ex.: valores extraídos do PDF)", () => {
    const viga = novaVigaPavimento({
      concretoM3: 11.14, formaM2: 109.7, avisoConcretoIncorreto: true,
      acoPorBitola: [{ bitola: "10", kg: 490 }, { bitola: "5", kg: 156 }],
    });
    expect(viga.avisoConcretoIncorreto).toBe(true);
    expect(viga.concretoM3).toBe(11.14);
    expect(somaAcoPorBitola(viga.acoPorBitola)).toBe(646);

    const laje = novaLajePavimento({ volumeM3: 15.79, volumeMacicasM3: 3.18, volumeVigotasM3: 12.61 });
    expect(laje.volumeM3).toBe(15.79);
    expect(laje.volumeMacicasM3 + laje.volumeVigotasM3).toBeCloseTo(15.79);
  });
});

describe("calcularConcretoMagroViga - lastro sob a viga baldrame/Térreo, comprimento derivado da área em planta (não digitado)", () => {
  it("deriva o comprimento (área em planta / largura da viga) e multiplica pela largura da viga mais a folga de cada lado", () => {
    // Térreo real (Quantitativos.pdf): área em planta 20.20m2. Largura de
    // viga hipotética 0.15m -> comprimento = 20.20/0.15 = 134.67m.
    const viga = novaVigaPavimento({ areaPlantaVigasM2: 20.20, larguraVigaM: 0.15, magroLarguraAcrescidaM: 0.05 });
    const comprimento = 20.20 / 0.15;
    expect(calcularConcretoMagroViga(viga)).toBeCloseTo(comprimento * (0.15 + 2 * 0.05));
  });

  it("devolve 0 quando falta a área em planta ou a largura da viga (padrão inicial, ou pavimento sem viga baldrame)", () => {
    expect(calcularConcretoMagroViga(novaVigaPavimento())).toBe(0);
    expect(calcularConcretoMagroViga(novaVigaPavimento({ areaPlantaVigasM2: 20.20 }))).toBe(0);
    expect(calcularConcretoMagroViga(novaVigaPavimento({ larguraVigaM: 0.15 }))).toBe(0);
  });

  it("funciona sem acréscimo (o magro sai do tamanho exato da área em planta)", () => {
    const viga = novaVigaPavimento({ areaPlantaVigasM2: 20.20, larguraVigaM: 0.15 });
    expect(calcularConcretoMagroViga(viga)).toBeCloseTo(20.20);
  });
});

describe("somaAcoPorBitola", () => {
  it("soma o kg de cada bitola", () => {
    expect(somaAcoPorBitola([{ bitola: "10", kg: 490 }, { bitola: "12.5", kg: 125 }])).toBe(615);
  });

  it("devolve 0 para lista vazia ou ausente", () => {
    expect(somaAcoPorBitola([])).toBe(0);
    expect(somaAcoPorBitola(undefined)).toBe(0);
  });
});
