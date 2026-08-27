import { describe, expect, it } from "vitest";
import {
  contarPilares, extrairAcoVigasPavimento, extrairAnotacoesPosicao, extrairElementosEstruturais, extrairPilares,
  extrairQuadroSapatas, extrairQuantitativosPavimentos, extrairResumoAco, extrairSapatasFundacao,
} from "./estrutural-pdf-extrator";

// Texto real extraído (pdftotext, sem -layout) da folha E-02/13 do projeto
// estrutural do usuário (Estrutural.pdf) - "QUADRO DE ELEMENTOS DE
// FUNDAÇÃO" completo, com o símbolo de diâmetro já substituído por U+FFFD
// (o mesmo caractere de substituição que o poppler devolveu na extração
// real - prova que o parser não depende de um símbolo específico).
const D = "�"; // símbolo de diâmetro, ilegível após extração

// Texto real (pdfjs-dist, mesmo caminho de produção - um item de texto do
// PDF por linha) do "Resumo Aço" no topo da mesma folha (antes do quadro) -
// total já pronto da página inteira: Ø10=164kg, Ø12.5=14kg, total=178kg.
// Achado real (27/08/2026): a extração de produção NÃO junta as bitolas
// numa linha só como este teste assumia antes (estilo poppler/sem
// -layout) - cada bitola, comprimento e peso vem em sua própria linha.
// Essa forma antiga do fixture fazia o teste passar enquanto a função
// ficava silenciosamente quebrada (sempre null) contra o texto real -
// substituído pelo texto literal extraído de verdade.
const RESUMO_ACO_REAL = "Resumo Aço\nFundação\nDetalhamento fundação\nComp. total\n(m)\nPeso+10%\n(kg)\nCA-50\n \nØ10\n \n242.1\n \n164\nØ12.5\n \n13.0\n \n14\n \n178\nTotal\n\n";

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

describe("extrairResumoAco - conferência/fonte de aço por bitola contra o total real da página", () => {
  it("lê o peso por bitola e o total geral já prontos do projeto (Fundação/sapatas, E-02/13 - formato 'Total' sozinho)", () => {
    const resumo = extrairResumoAco(RESUMO_ACO_REAL + QUADRO_REAL);
    expect(resumo.porBitola).toEqual([{ bitola: "10", pesoKg: 164 }, { bitola: "12.5", pesoKg: 14 }]);
    expect(resumo.totalKg).toBe(178);
  });

  it("lê o formato 'Total <valor> Total' sanduichado (Pilares do Térreo, E-03/13)", () => {
    const real = "Resumo Aço\nPilares\nComp. total\n(m)\nPeso+10%\n(kg)\nCA-50\nØ10\n197.6\n134\nØ12.5\n130.6\n138\n272\nCA-60\nØ5\n361.9\n62\n62\nTotal\n334\nTotal\n05/2026\n";
    const resumo = extrairResumoAco(real);
    expect(resumo.porBitola).toEqual([{ bitola: "5", pesoKg: 62 }, { bitola: "10", pesoKg: 134 }, { bitola: "12.5", pesoKg: 138 }]);
    expect(resumo.totalKg).toBe(334);
  });

  it("não confunde o número extra de subtotal (que sobra depois da última bitola de uma classe) com o comprimento/peso da bitola seguinte", () => {
    // "166" é peso de Ø16, "781" é só o subtotal de CA-50 (166+490+125=781) -
    // não pode virar comprimento/peso de nenhuma bitola.
    const real = "Resumo Aço\nVigas\nCA-50\nØ16\n95.6\n166\n781\nCA-60\nØ5\n901.0\n156\n156\nTotal\n937\nTotal\n";
    const resumo = extrairResumoAco(real);
    expect(resumo.porBitola).toEqual([{ bitola: "5", pesoKg: 156 }, { bitola: "16", pesoKg: 166 }]);
    expect(resumo.totalKg).toBe(937);
  });

  it("soma DOIS blocos 'Resumo Aço' na mesma folha (laje: armadura transversal + longitudinal)", () => {
    const transversal = "Resumo Aço\n1º Pavimento\nArmadura transversal inferior\nCA-50\nØ8\n378.9\n165\nCA-60\nØ5\n124.8\n22\n22\nTotal\n187\nTotal\n";
    const longitudinal = "Resumo Aço\n1º Pavimento\nArmadura longitudinal inferior\nCA-50\nØ8\n85.4\n37\n37\nCA-60\nØ5\n436.3\n75\n75\nTotal\n112\nTotal\n";
    const resumo = extrairResumoAco(transversal + longitudinal);
    expect(resumo.porBitola).toEqual([{ bitola: "5", pesoKg: 97 }, { bitola: "8", pesoKg: 202 }]);
    expect(resumo.totalKg).toBe(299);
  });

  it("devolve null se não achar nenhuma seção Resumo Aço", () => {
    expect(extrairResumoAco(QUADRO_REAL)).toBeNull();
  });
});

// Três trechos reais extraídos (pdfjs-dist, mesmo caminho de produção do
// app) do Estrutural.pdf do usuário - um pilar sozinho no Térreo (E-03/13),
// um pilar que atravessa dois pavimentos (Fundação até o 1º Pavimento,
// mesma folha), e um grupo de 9 pilares idênticos na Cobertura (E-10/13) -
// este último é o caso que expôs o bug do corte "primeiro caractere que não
// seja C" (quebrava quando o próprio valor de Planta era "Cobertura").
const PILAR_TERREO_REAL = "P10  Fundação  Térreo  A   A B   B  4N2  A   A B   B  Vista XX  -1.500 +0.000  -0.300  4N2  Vista YY   N1 c/12 12Ø5  5  30   210 4N2Ø10 C=240  4N2  15  30   4N2Ø10  Corte A-A  25 10 5  N1Ø5c/12 C=79  4N2  15  30   4N2Ø10  Corte B-B  25 10 5  N1Ø5c/12 C=79  Aço: CA-50 e CA-60 (1.6 kg). Taxa: 22.05 kg/m3   Planta: Térreo Concreto: C25, usina.rigor (0.07 m3)   Tamanho máximo do agregado: 19 mm   Escala 1:75 Fôrmas: 1.35 m2   Cobrimento: 2.5 cm ";

const PILAR_DOIS_PAVIMENTOS_REAL = "P7=P8  Fundação 1º Pavimento  A   A B   B  4N2  A   A B   B  Vista XX  -1.500 +3.200  +2.700  4N2  Vista YY  N1 c/15 31Ø5  5  30   540 4N2Ø12.5 C=570  4N2  30  30   4N2Ø12.5  Corte A-A  25 25 5  N1Ø5c/15 C=109  4N2  30  30   4N2Ø12.5  Corte B-B  25 25 5  N1Ø5c/15 C=109  Aço: CA-50 e CA-60 (5.8 kg). Taxa: 12.54 kg/m3   Planta: Térreo, 1º Pavimento Concreto: C25, usina.rigor (0.42 m3)   Tamanho máximo do agregado: 19 mm   Escala 1:75 Fôrmas: 5.64 m2   Cobrimento: 2.5 cm ";

const PILAR_GRUPO_COBERTURA_REAL = "P1=P3=P4=P5=P6=P9=P11=P21=P22  1º Pavimento Cobertura  A   A  4N1  A   A  Vista XX  +3.200 +6.400  +5.900  4N1  Vista YY  N2 c/12 27Ø5  5   4N1Ø10 C=318  4N1  15  30   4N1Ø10  Corte A-A  25 10 5  N2Ø5c/12 C=79  Aço: CA-50 e CA-60 (12.3 kg). Taxa: 77.69 kg/m3   Planta: Cobertura Concreto: C25, usina.rigor (0.14 m3)   Tamanho máximo do agregado: 19 mm   Escala 1:75 Fôrmas: 2.88 m2   Cobrimento: 2.5 cm  P10  1";

describe("extrairPilares", () => {
  it("lê concreto/fôrma/aço já prontos de um pilar sozinho (Térreo)", () => {
    const [pilar] = extrairPilares(PILAR_TERREO_REAL);
    expect(pilar).toEqual({ tipo: "P10", qtd: 1, planta: "Térreo", concretoUnit: 0.07, formaUnit: 1.35, acoUnit: 1.6 });
  });

  it("mantém concreto/fôrma/aço como valor UNITÁRIO mesmo num grupo de vários pilares idênticos", () => {
    // P10 sozinho e o grupo de 9 pilares abaixo têm a MESMA seção - o
    // projeto imprime os dois com exatamente os mesmos 0.07/1.35/1.6,
    // provando que não é um total do grupo (senão seria 9x maior aqui).
    const grupo = "P1=P3=P4=P5=P6=P9=P11=P21=P22" + PILAR_TERREO_REAL.slice(PILAR_TERREO_REAL.indexOf(" "));
    const [pilar] = extrairPilares(grupo);
    expect(pilar.qtd).toBe(9);
    expect(pilar.concretoUnit).toBeCloseTo(0.07);
    expect(pilar.formaUnit).toBeCloseTo(1.35);
    expect(pilar.acoUnit).toBeCloseTo(1.6);
  });

  it("guarda os pavimentos que o pilar atravessa quando ele não fica num só (Fundação até o 1º Pavimento)", () => {
    const [pilar] = extrairPilares(PILAR_DOIS_PAVIMENTOS_REAL);
    expect(pilar).toEqual({ tipo: "P7=P8", qtd: 2, planta: "Térreo, 1º Pavimento", concretoUnit: 0.42, formaUnit: 5.64, acoUnit: 5.8 });
  });

  it("lê corretamente quando o valor de Planta é o nome de um só pavimento (Cobertura) - caso que quebrava o corte antigo", () => {
    const [pilar] = extrairPilares(PILAR_GRUPO_COBERTURA_REAL);
    expect(pilar).toEqual({ tipo: "P1=P3=P4=P5=P6=P9=P11=P21=P22", qtd: 9, planta: "Cobertura", concretoUnit: 0.14, formaUnit: 2.88, acoUnit: 12.3 });
  });

  it("devolve array vazio quando não acha nenhum bloco de detalhamento", () => {
    expect(extrairPilares("nada aqui")).toEqual([]);
  });
});

// Trecho real (pdfjs-dist, mesmo caminho de produção - um item de texto do
// PDF por linha, via lerTextoPdf()) da folha "Vigas do 1º Pavimento"
// (Estrutural.pdf, E-08/13): duas vigas completas (V16 e V18) da tabela de
// armadura. Cada bitola do "Resumo Aço" da folha inteira pode virar um
// item de texto separado (uma "linha" só pra ela), por isso não dá pra
// reusar a heurística de `extrairResumoAcoFundacao` (que espera todas as
// bitolas juntas numa linha só, como acontece na folha de Fundação) - daí
// a soma por viga em vez de ler aquele resumo.
const VIGAS_1PAV_REAL = `Elemento

Pos.

Diam.

Q.

Esquema
(cm)

Comp.
(cm)

Total
(cm)

CA-50
(kg)

CA-60
(kg)

V 16

1

Ø10

2

25
583
25

633

1266

7.8
2

Ø10

3

25
135

160

480

3.0
3

Ø16

2

26

583
26

635

1270

20.0
4

Ø16

2

514
26

540

1080

17.0
5

Ø16

2

464
26

490

980

15.5
6

Ø5

47

45
10
5

118

5546

8.7
69.6

9.6
Total+10%:

V 18

1

Ø10

2

370

370

740

4.6
2

Ø10

2

25

370
25

420

840

5.2
3

Ø10

1

250

250

250

1.5
4

Ø5

19

35
10
5

98

1862

2.9
12.4

3.2
Total+10%:`;

describe("extrairAcoVigasPavimento", () => {
  it("soma o CA-50 e o CA-60 de cada bloco de viga (achado real: 2 vigas, 69.6+12.4kg CA-50 e 9.6+3.2kg CA-60)", () => {
    const resumo = extrairAcoVigasPavimento(VIGAS_1PAV_REAL);
    expect(resumo.ca50Kg).toBeCloseTo(69.6 + 12.4);
    expect(resumo.ca60Kg).toBeCloseTo(9.6 + 3.2);
    expect(resumo.totalKg).toBeCloseTo(69.6 + 12.4 + 9.6 + 3.2);
  });

  it("devolve zero em tudo quando não acha nenhum bloco 'Total+10%:'", () => {
    expect(extrairAcoVigasPavimento("nada aqui")).toEqual({ ca50Kg: 0, ca60Kg: 0, totalKg: 0 });
  });
});

// Texto real (pdfjs-dist) do "Quantitativos de superfícies e volumes.pdf" -
// gerado à parte pelo mesmo software CAD, exclui a Fundação de propósito
// ("Não medidos: Elementos de fundação", início de cada página) e traz o
// concreto/fôrma de vigas e o volume de laje já prontos por pavimento -
// dado que o Estrutural.pdf sozinho não dá (só o desenho detalhado, sem
// resumo volumétrico de viga/laje). As duas páginas reais, juntas como
// `lerTextoPdf()` realmente junta (`\n\f\n`).
const QUANTITATIVOS_PAGINA_1 = `* Não medidos: Elementos de fundação.

Grupo de Pisos Número 1: Térreo

Número Pisos Iguais: 1

Superfície total:

21.28 m2

Superfície total pavto:

-0.18 m2

Área de aberturas:

-0.18 m2

Superfície em planta de vigas, vigas de borda e cortinas:

20.20 m2

Superfície lateral de vigas, vigas de borda e cortinas:

79.93 m2

Concreto total em vigas:

6.41 m3

Vigas:

6.41 m3

Volume total lajes:

0.00 m3

Grupo de Pisos Número 2: 1º Pavimento

Número Pisos Iguais: 1

Superfície total: 199.74 m2

Superfície total pavto: 175.11 m2

Maciças:

31.83 m2

Vigotas: 143.28 m2

Superfície em planta de vigas, vigas de borda e cortinas:

23.22 m2

Superfície lateral de vigas, vigas de borda e cortinas: 109.70 m2

Concreto total em vigas:

11.14 m3

Valor incorreto do volume de vigas por não dispor dos dados necessários. Deve-se calcular a obra para

realizar os quantitativos corretamente.

Vigas:

11.14 m3

Volume total lajes:

15.79 m3

Maciças:

3.18 m3

Vigotas:

12.61 m3

Grupo de Pisos Número 3: Cobertura

Número Pisos Iguais: 1

Superfície total: 205.20 m2

Superfície total pavto: 184.05 m2

Maciças:

28.24 m2

Vigotas: 155.81 m2

Superfície em planta de vigas, vigas de borda e cortinas:

19.96 m2

Superfície lateral de vigas, vigas de borda e cortinas:

93.06 m2

Concreto total em vigas:

9.57 m3

Vigas:

9.57 m3

Volume total lajes:

16.53 m3

Maciças:

2.82 m3

Vigotas:

13.71 m3

Quantitativos de superfícies e volumes

ARU

Data: 27/08/26

Página 1`;

const QUANTITATIVOS_PAGINA_2 = `* Não medidos: Elementos de fundação.

Resumo total obra

Superfície total: 426.22 m2

Superfície total pavto: 358.98 m2

Área de aberturas:

-0.18 m2

Maciças:

60.07 m2

Vigotas: 299.09 m2

Superfície em planta de vigas, vigas de borda e cortinas:

63.38 m2

Superfície lateral de vigas, vigas de borda e cortinas: 282.69 m2

Concreto total em vigas:

27.12 m3

Valor incorreto do volume de vigas por não dispor dos dados necessários. Deve-se calcular a obra para

realizar os quantitativos corretamente.

Vigas:

27.12 m3

Volume total lajes:

32.32 m3

Maciças:

6.00 m3

Vigotas:

26.32 m3

Quantitativos de superfícies e volumes

ARU

Data: 27/08/26

Página 2`;

const QUANTITATIVOS_REAL = `${QUANTITATIVOS_PAGINA_1}\n\f\n${QUANTITATIVOS_PAGINA_2}`;

describe("extrairQuantitativosPavimentos", () => {
  it("lê concreto/fôrma de vigas e volume de laje por pavimento, sem o aviso de valor incorreto quando ele não existe", () => {
    const [terreo] = extrairQuantitativosPavimentos(QUANTITATIVOS_REAL);
    expect(terreo).toEqual({
      pavimento: "Térreo", concretoVigasM3: 6.41, formaVigasM2: 79.93, avisoConcretoIncorreto: false,
      volumeLajesM3: 0, lajeMacicasM3: null, lajeVigotasM3: null,
    });
  });

  it("carrega o aviso do próprio projeto quando o volume de vigas pode estar incorreto (1º Pavimento)", () => {
    const [, pav1] = extrairQuantitativosPavimentos(QUANTITATIVOS_REAL);
    expect(pav1.pavimento).toBe("1º Pavimento");
    expect(pav1.avisoConcretoIncorreto).toBe(true);
    expect(pav1.concretoVigasM3).toBeCloseTo(11.14);
    expect(pav1.volumeLajesM3).toBeCloseTo(15.79);
    expect(pav1.lajeMacicasM3).toBeCloseTo(3.18);
    expect(pav1.lajeVigotasM3).toBeCloseTo(12.61);
  });

  it("para na próxima página (Resumo total obra) e não confunde o total geral com um pavimento", () => {
    const pavimentos = extrairQuantitativosPavimentos(QUANTITATIVOS_REAL);
    expect(pavimentos).toHaveLength(3);
    expect(pavimentos.map(p => p.pavimento)).toEqual(["Térreo", "1º Pavimento", "Cobertura"]);
    const cobertura = pavimentos[2];
    expect(cobertura.concretoVigasM3).toBeCloseTo(9.57);
    expect(cobertura.avisoConcretoIncorreto).toBe(false);
  });

  it("devolve array vazio quando não acha nenhum grupo de pisos", () => {
    expect(extrairQuantitativosPavimentos("nada aqui")).toEqual([]);
  });
});

describe("extrairElementosEstruturais - lê o Estrutural.pdf inteiro de uma vez, roteando cada página pelo próprio título", () => {
  // Documento sintético de 2 "páginas" (separadas por \f, igual lerTextoPdf
  // junta as páginas de verdade) - uma folha de Pilares do Térreo e uma de
  // Vigas do 1º Pavimento, cada uma com o título real da folha na frente
  // dos blocos reais já usados nos testes acima.
  const DOCUMENTO = `Pilares do Térreo\n${PILAR_TERREO_REAL}\f Vigas do 1º Pavimento\n${VIGAS_1PAV_REAL}`;

  it("roteia cada página pro pavimento certo, por conteúdo (pilares) e por aço (vigas)", () => {
    const r = extrairElementosEstruturais(DOCUMENTO);
    expect(r.pilares.terreo).toHaveLength(1);
    expect(r.pilares.terreo[0].tipo).toBe("P10");
    expect(r.pilares.pavimento1).toEqual([]);
    expect(r.pilares.cobertura).toEqual([]);

    expect(r.vigasAcoCruzado.pavimento1.totalKg).toBeCloseTo(69.6 + 12.4 + 9.6 + 3.2);
    expect(r.vigasAcoCruzado.terreo).toBeNull();
    expect(r.vigasAcoCruzado.cobertura).toBeNull();

    // Nem PILAR_TERREO_REAL nem VIGAS_1PAV_REAL trazem um bloco "Resumo
    // Aço" próprio (só a tabela de armadura por elemento) - o teste
    // seguinte cobre a leitura do "Resumo Aço" quando ele existe na folha.
    expect(r.vigasAcoPorBitola.pavimento1).toBeNull();
    expect(r.pilaresAcoPorBitola.terreo).toBeNull();
    expect(r.lajesAcoPorBitola).toEqual({ terreo: null, pavimento1: null, cobertura: null });
  });

  it("também lê o aço por bitola de pilares e de laje quando a folha tem um 'Resumo Aço'", () => {
    const pilarComResumo = "Pilares do Térreo\n" + PILAR_TERREO_REAL
      + "\nResumo Aço\nPilares\nCA-50\nØ10\n197.6\n134\nTotal\n134\nTotal\n";
    const lajeComResumo = "Lajes do 1º Pavimento\nResumo Aço\n1º Pavimento\nCA-50\nØ8\n378.9\n165\nTotal\n165\nTotal\n";
    const r = extrairElementosEstruturais(`${pilarComResumo}\f${lajeComResumo}`);
    expect(r.pilaresAcoPorBitola.terreo).toEqual({ porBitola: [{ bitola: "10", pesoKg: 134 }], totalKg: 134 });
    expect(r.lajesAcoPorBitola.pavimento1).toEqual({ porBitola: [{ bitola: "8", pesoKg: 165 }], totalKg: 165 });
    expect(r.lajesAcoPorBitola.cobertura).toBeNull();
  });

  it("ignora páginas sem nenhum título reconhecido (ex.: folha de detalhes/observações)", () => {
    const r = extrairElementosEstruturais(`Alguma folha qualquer sem título de pilar ou viga\f${DOCUMENTO}`);
    expect(r.pilares.terreo).toHaveLength(1);
  });

  it("devolve tudo vazio/nulo para um documento sem nenhuma folha reconhecida", () => {
    const r = extrairElementosEstruturais("nada aqui");
    expect(r.pilares).toEqual({ terreo: [], pavimento1: [], cobertura: [] });
    expect(r.vigasAcoPorBitola).toEqual({ terreo: null, pavimento1: null, cobertura: null });
    expect(r.vigasAcoCruzado).toEqual({ terreo: null, pavimento1: null, cobertura: null });
    expect(r.pilaresAcoPorBitola).toEqual({ terreo: null, pavimento1: null, cobertura: null });
    expect(r.lajesAcoPorBitola).toEqual({ terreo: null, pavimento1: null, cobertura: null });
  });
});
