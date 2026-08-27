import { describe, expect, it } from "vitest";
import {
  contarPilares, extrairAnotacoesPosicao, extrairQuadroSapatas, extrairSapatasFundacao,
} from "./estrutural-pdf-extrator";

// Texto real extraído (pdftotext, sem -layout) da folha E-02/13 do projeto
// estrutural do usuário (Estrutural.pdf) - "QUADRO DE ELEMENTOS DE
// FUNDAÇÃO" completo, com o símbolo de diâmetro já substituído por U+FFFD
// (o mesmo caractere de substituição que o poppler devolveu na extração
// real - prova que o parser não depende de um símbolo específico).
const D = "�"; // símbolo de diâmetro, ilegível após extração
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

// Trechos reais das anotações de barra desenhadas junto de cada sapata
// individual (pdftotext, mesma folha). P12: X=6N9, Y=7N10. P17: X=6N15 -
// mesma quantidade+bitola+espaçamento do X de P12 (6${D}10c/20), mas com
// comprimento DIFERENTE (138 contra 173) - a ambiguidade real que o parser
// precisa saber reconhecer e não arriscar.
const ANOTACOES_REAIS = `
P12
6N9${D}10c/20 C=173
7N10${D}10c/20 C=148

P17
6N15${D}10c/20 C=138
4N16${D}12.5c/25 C=168
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
    const anotacoes = extrairAnotacoesPosicao(ANOTACOES_REAIS);
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

describe("extrairSapatasFundacao - integração quadro + anotações (validação real)", () => {
  const texto = QUADRO_REAL + ANOTACOES_REAIS;
  const sapatas = extrairSapatasFundacao(texto);

  it("devolve uma sapata por grupo, com qtd de peças e dimensões em metro", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    expect(p12.qtd).toBe(1);
    expect(p12.largura).toBeCloseTo(1.4);
    expect(p12.comprimento).toBeCloseTo(1.15);
    expect(p12.alturaBase).toBeCloseTo(0.35);
    expect(p12.alturaTronco).toBeCloseTo(0.2);
  });

  it("resolve o comprimento da armadura Y de P12 (7∅10c/20 é único no documento) = 1,48m", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    expect(p12.armaduraY).toEqual({ bitola: "10", quantidade: 7, comprimento: 1.48 });
  });

  it("NÃO arrisca o comprimento da armadura X de P12 - a mesma especificação (6∅10c/20) aparece em P17 com comprimento diferente (138 vs 173)", () => {
    const p12 = sapatas.find(s => s.tipo === "P12");
    const p17 = sapatas.find(s => s.tipo === "P17");
    expect(p12.armaduraX.comprimento).toBe(0);
    expect(p17.armaduraX.comprimento).toBe(0);
  });

  it("conta 7 peças no maior grupo (P1, P4, P5, P6, P10, P11 e P14)", () => {
    const grupo = sapatas.find(s => s.tipo === "P1, P4, P5, P6, P10, P11 e P14");
    expect(grupo.qtd).toBe(7);
  });
});
