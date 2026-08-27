import { describe, expect, it } from "vitest";
import {
  contarPilares, extrairAnotacoesPosicao, extrairQuadroSapatas, extrairResumoAcoFundacao, extrairSapatasFundacao,
} from "./estrutural-pdf-extrator";

// Texto real extraído (pdftotext, sem -layout) da folha E-02/13 do projeto
// estrutural do usuário (Estrutural.pdf) - "QUADRO DE ELEMENTOS DE
// FUNDAÇÃO" completo, com o símbolo de diâmetro já substituído por U+FFFD
// (o mesmo caractere de substituição que o poppler devolveu na extração
// real - prova que o parser não depende de um símbolo específico).
const D = "�"; // símbolo de diâmetro, ilegível após extração

// Texto real do "Resumo Aço" no topo da mesma folha (antes do quadro) -
// total já pronto da página inteira: Ø10=164kg, Ø12.5=14kg, total=178kg.
const RESUMO_ACO_REAL = `
Resumo A${D}o

Comp. total Peso+10%

Funda${D}${D}o

(m)

(kg) Total

Detalhamento funda${D}${D}o

CA-50

${D}10 ${D}12.5

242.1 13.0

164 14 178

`;

const QUADRO_REAL = `
QUADRO DE ELEMENTOS DE FUNDA${D}${D}O

Refer${D}ncias

Dimens${D}es (cm) Altura (cm) Armadura inf. X Armadura inf. Y

P1, P4, P5, P6, P10, P11 e P14

85x100

30 / 20

4${D}10c/25

3${D}10c/25

P2

105x120

30 / 20

5${D}10c/25

4${D}12.5c/30

P3, P9, P16, P21 e P22

75x90

30 / 20

4${D}10c/25

3${D}10c/25

P7, P8 e P18

90x90

30 / 20

4${D}10c/25

4${D}10c/25

P12

140x115

35 / 20

6${D}10c/20

7${D}10c/20

P13

110x95

30 / 20

4${D}10c/25

4${D}10c/25

P15 e P19

105x120

30 / 20

5${D}10c/25

5${D}10c/20

P17

105x130

30 / 20

6${D}10c/20

4${D}12.5c/25

P20

95x110

30 / 20

4${D}10c/25

4${D}10c/25

P23

95x120

30 / 20

5${D}10c/25

5${D}10c/20

P24

95x110

30 / 20

4${D}10c/25

4${D}10c/25

A1
`;

// Trechos reais do DESENHO (depois do quadro) - cada sapata individual traz
// sua própria anotação de barra. P12 e P17 compartilham a mesma
// especificação no eixo X (6${D}10c/20) mas com comprimentos DIFERENTES na
// vida real (173 contra 138) - a ordem de aparição (P12 primeiro, P17
// depois) é o que a âncora por posição usa para não confundir os dois.
const DESENHO_REAL = `
P12
P12 45 25 25 45
6N9${D}10c/20 C=173
7N10${D}10c/20 C=148

P17
P17 40 1313 40
6N15${D}10c/20 C=138
4N16${D}12.5c/25 C=168

P7 e P8
P7 e P8 25 20 20 25
4N5${D}10c/25 C=108
3N6${D}10c/25 C=123
4N7${D}10c/25 C=123
4N8${D}10c/25 C=123

P18
P18 25 20 20 25
4N17${D}10c/25 C=123
4N18${D}10c/25 C=123
`;

describe("contarPilares", () => {
  it("conta uma lista com vírgulas e 'e'", () => {
    expect(contarPilares("P1, P4, P5, P6, P10, P11 e P14")).toBe(7);
  });
  it("conta uma referência de um único pilar", () => {
    expect(contarPilares("P2")).toBe(1);
  });
  it("conta 'X e Y'", () => {
    expect(contarPilares("P15 e P19")).toBe(2);
  });
});

describe("extrairQuadroSapatas - contra o texto real do projeto (Estrutural.pdf, folha E-02/13)", () => {
  it("lê os 11 grupos do quadro real", () => {
    expect(extrairQuadroSapatas(QUADRO_REAL)).toHaveLength(11);
  });
  it("lê dimensões, altura e armadura X/Y do primeiro grupo (P1 e cia, 85x100, 30/20)", () => {
    const [grupo] = extrairQuadroSapatas(QUADRO_REAL);
    expect(grupo.referencia).toBe("P1, P4, P5, P6, P10, P11 e P14");
    expect(grupo.larguraCm).toBe(85);
    expect(grupo.comprimentoCm).toBe(100);
    expect(grupo.alturaBaseCm).toBe(30);
    expect(grupo.alturaTroncoCm).toBe(20);
    expect(grupo.armaduraX).toEqual({ quantidade: 4, bitola: 10, espacamento: 25 });
    expect(grupo.armaduraY).toEqual({ quantidade: 3, bitola: 10, espacamento: 25 });
  });
  it("lê bitola decimal (12.5) sem confundir com o espaçamento", () => {
    const grupos = extrairQuadroSapatas(QUADRO_REAL);
    const p2 = grupos.find(g => g.referencia === "P2");
    expect(p2.armaduraY).toEqual({ quantidade: 4, bitola: 12.5, espacamento: 30 });
  });
  it("para no fim da tabela sem tentar ler 'A1' como um novo grupo", () => {
    const grupos = extrairQuadroSapatas(QUADRO_REAL);
    expect(grupos.some(g => g.referencia === "A1")).toBe(false);
  });
  it("devolve lista vazia se a tabela não existir no texto", () => {
    expect(extrairQuadroSapatas("um texto qualquer sem a tabela")).toEqual([]);
  });
});

describe("extrairAnotacoesPosicao - contra anotações reais de barra do desenho", () => {
  it("lê quantidade, posição, bitola, espaçamento e comprimento de cada anotação", () => {
    const anotacoes = extrairAnotacoesPosicao(DESENHO_REAL);
    expect(anotacoes).toEqual(expect.arrayContaining([
      { quantidade: 6, posicao: 9, bitola: 10, espacamento: 20, comprimentoCm: 173 },
      { quantidade: 7, posicao: 10, bitola: 10, espacamento: 20, comprimentoCm: 148 },
      { quantidade: 6, posicao: 15, bitola: 10, espacamento: 20, comprimentoCm: 138 },
      { quantidade: 4, posicao: 16, bitola: 12.5, espacamento: 25, comprimentoCm: 168 },
    ]));
  });
  it("faz a média de um comprimento em faixa (C=60-70)", () => {
    const anotacoes = extrairAnotacoesPosicao("43N3�5c/20 C=60-70");
    expect(anotacoes[0].comprimentoCm).toBe(65);
  });
});

describe("extrairSapatasFundacao - integração quadro + desenho (âncora por posição, validação real)", () => {
  const texto = QUADRO_REAL + DESENHO_REAL;
  const sapatas = extrairSapatasFundacao(texto);

  it("devolve uma sapata por grupo, com qtd de peças e dimensões em metro", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    expect(p12.qtd).toBe(1);
    expect(p12.largura).toBeCloseTo(1.4);
    expect(p12.comprimento).toBeCloseTo(1.15);
    expect(p12.alturaBase).toBeCloseTo(0.35);
    expect(p12.alturaTronco).toBeCloseTo(0.2);
  });

  it("resolve os DOIS comprimentos de P12 pela âncora de posição (1,73m e 1,48m)", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    expect(p12.armaduraX).toEqual({ bitola: "10", quantidade: 6, comprimento: 1.73 });
    expect(p12.armaduraY).toEqual({ bitola: "10", quantidade: 7, comprimento: 1.48 });
  });

  it("resolve P17 com comprimento DIFERENTE de P12 mesmo compartilhando a mesma especificação (6∅10c/20) no eixo X - é exatamente o caso que a correlação por especificação global não conseguia distinguir", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    const p17 = sapatas.find(s => s.tipo === "P17");
    expect(p12.armaduraX.comprimento).toBe(1.73);
    expect(p17.armaduraX.comprimento).toBe(1.38);
    expect(p12.armaduraX.comprimento).not.toBe(p17.armaduraX.comprimento);
  });

  it("resolve P18 mesmo pertencendo a um grupo de 3 pilares (\"P7, P8 e P18\") desenhado em rótulos separados", () => {
    const p18 = sapatas.find(s => s.tipo === "P7, P8 e P18");
    expect(p18.qtd).toBe(3);
    // A âncora usa o pilar do grupo encontrado mais cedo no desenho - aqui,
    // "P7 e P8" aparece antes de "P18" sozinho, então é dali que vêm os
    // comprimentos usados para representar o tipo inteiro.
    expect(p18.armaduraX.comprimento).toBeCloseTo(1.08);
    expect(p18.armaduraY.comprimento).toBeCloseTo(1.23);
  });

  it("conta 7 peças no maior grupo (P1, P4, P5, P6, P10, P11 e P14)", () => {
    const grupo = sapatas.find(s => s.tipo === "P1, P4, P5, P6, P10, P11 e P14");
    expect(grupo.qtd).toBe(7);
  });

  it("devolve comprimento 0 (não trava) para um grupo cuja referência não aparece em lugar nenhum do desenho", () => {
    const semDesenho = extrairSapatasFundacao(QUADRO_REAL); // sem a seção DESENHO_REAL
    expect(semDesenho.every(s => s.armaduraX.comprimento === 0 && s.armaduraY.comprimento === 0)).toBe(true);
  });
});

describe("extrairResumoAcoFundacao - conferência contra o total real da página (Estrutural.pdf, folha E-02/13)", () => {
  const texto = RESUMO_ACO_REAL + QUADRO_REAL;

  it("lê o peso por bitola e o total geral já prontos do projeto", () => {
    const resumo = extrairResumoAcoFundacao(texto);
    expect(resumo.porBitola).toEqual([{ bitola: "10", pesoKg: 164 }, { bitola: "12.5", pesoKg: 14 }]);
    expect(resumo.totalKg).toBe(178);
  });

  it("devolve null se não achar a seção Resumo Aço", () => {
    expect(extrairResumoAcoFundacao(QUADRO_REAL)).toBeNull();
  });
});
