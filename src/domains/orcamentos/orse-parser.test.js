import { describe, expect, it } from "vitest";
import {
  decodificarLatin1, montarExtracaoOrse, numeroBR,
  parseCatalogoInsumo, parseCatalogoServico, parseComposicoes,
  parsePrecoInsumo, parsePrecoServico,
} from "./orse-parser";

// Fixtures modeladas na estrutura real dos arquivos entregues pelo CEHOP
// (ORSE, 26/08/2026) - mesmos separadores, mesma posição de campo, mesma
// codificação. A composição 4 usa números validados AO VIVO contra a
// raspagem já em produção nesta sessão: R$ 6,74.

const TB_INSUMO = [
  "ORSE;54;Areia lavada tipo media, posta na obra;Areia lavada;m3;m3;1;9;N;dbo;30/07/2002 15:00:00;30/07/2002 15:00:00;S;CEHOP;100",
  "ORSE;2451;Caminhao basc. 9 t/6,0 m3 (m. benz - 1315 -150,0 kw);Caminhao basc. 9 t/6,0 m3 (m. benz - 1315 -150,0 kw);h;un;1;9;N;dbo;30/07/2002 15:28:46;30/07/2002 15:28:46;N;CEHOP;3457",
  "ORSE;2477;Retroescavadeira sobre pneus - 4x2, com tracao dianteira aux.;Retroescavadeira sobre pneus;h;un;1;9;N;dbo;30/07/2002 15:29:00;30/07/2002 15:29:00;N;CEHOP;3458",
  "ORSE;9999;;h;un;1;9;N;dbo;30/07/2002 15:29:00;30/07/2002 15:29:00;N;CEHOP;3459",
].join("\r\n");

const TB_INSUMO_PRECO = [
  "ORSE;54;2026;6;1;0;0;0;0;8,6;8,6;27/07/2026 09:34:28;orse;B;;;N",
  "ORSE;2451;2026;6;1;0;0;0;0;47,16;47,16;27/07/2026 09:34:28;orse;A;474;;N",
  "ORSE;2477;2026;6;1;0;0;0;0;160,11;160,11;27/07/2026 09:34:28;orse;A;474;;N",
  "ORSE;9999;2026;6;1;0;0;0;0;0;0;27/07/2026 09:34:28;orse;B;;;N",
].join("\r\n");

// A quarta linha aqui reproduz de verdade o bloco de RTF encontrado em
// TB_SERVICO .TXT (grep -n "rtf1"), colado direto no fim de uma linha-
// âncora, seguido de linhas de continuação que não começam com
// "ORSE;<código>;" - exatamente o padrão que corrompe o arquivo real.
const TB_SERVICO = [
  "ORSE;4;Limpeza mecanizada do terreno c/ trator esteira (vegetacao rasteira) inclusive carga e transporte - dmt ate 1 km;m2;44;31/01/2003;2;;25/04/2008 09:48:09;N;CEHOP;5",
  "ORSE;16;Demolicao manual de piso cimentado sobre lastro de concreto - Rev 01;m2;45;31/01/2003;2;{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fnil\\fcharset0 Courier New;}}",
  "{\\colortbl ;\\red0\\green0\\blue0;}",
  "\\viewkind4\\uc1\\pard\\cf1\\f0\\fs20 Memorial descritivo longo sem ; no meio\\par",
  "}",
  "ORSE;17;Demolicao manual de piso cimentado sobre lastro de concreto - Rev 02;m2;45;31/01/2003;2;;07/05/2004 12:46:16;N;CEHOP;6",
].join("\r\n");

const TB_SERVICO_PRECO = [
  "ORSE;4;2026;6;1;6,74;6,33;0,07;0,16;0,17;0,01;D;167;1;Usuario: (MAURICIO) na Maquina: (ORSE-001);25/04/2008 09:48:09;",
  "ORSE;16;2026;6;1;12,5;0;5;7,5;8,37;0,58;U;0;1;CEHOP;07/05/2004 12:46:16;",
  "ORSE;17;2026;6;1;13,5;0;5;8,5;9,37;0,58;U;0;1;CEHOP;07/05/2004 12:46:16;",
].join("\r\n");

// TB_COMPOSICAO é o único dos cinco arquivos separado por TAB, não ";"
// (confirmado por hexdump nos arquivos reais - byte 0x09, não 0x3b).
const TB_COMPOSICAO = [
  ["ORSE", "4", "2026", "6", "1", "I", "ORSE", "54", "0,5", "0", "0", "P", "8,6", "18,19", "0", "0", "4,3", "9,09"].join("\t"),
  ["ORSE", "4", "2026", "6", "1", "I", "ORSE", "2451", "2", "0,75", "0,25", "E", "47,16", "0", "300,25", "21,05", "460,9", "460,9"].join("\t"),
  ["ORSE", "4", "2026", "6", "1", "I", "ORSE", "2477", "1", "1", "0", "E", "160,11", "0", "287,25", "70,83", "287,25", "287,25"].join("\t"),
  ["ORSE", "4", "2026", "6", "1", "I", "SINAPI", "6111", "0,25", "0", "0", "P", "7,37", "15,59", "0", "0", "1,84", "3,9"].join("\t"),
].join("\r\n");

describe("numeroBR", () => {
  it("converte número com vírgula decimal", () => {
    expect(numeroBR("6,74")).toBeCloseTo(6.74);
    expect(numeroBR("0,5")).toBeCloseTo(0.5);
  });
  it("devolve 0 para valor vazio ou inválido", () => {
    expect(numeroBR("")).toBe(0);
    expect(numeroBR(undefined)).toBe(0);
  });
});

describe("decodificarLatin1", () => {
  it("decodifica acentuação ISO-8859-1 corretamente (0xE7 = ç, 0xB3 = ³)", () => {
    const bytes = new Uint8Array([0x41, 0x70, 0x6c, 0x69, 0x63, 0x61, 0xe7, 0xe3, 0x6f, 0x3b, 0x6d, 0xb3]);
    expect(decodificarLatin1(bytes)).toBe("Aplicação;m³");
  });
});

describe("parseCatalogoInsumo", () => {
  it("le codigo, descricao e unidade, ignorando linha sem descricao", () => {
    const catalogo = parseCatalogoInsumo(TB_INSUMO);
    expect(catalogo.get("54")).toEqual({ codigo: "54", descricao: "Areia lavada tipo media, posta na obra", unidade: "m3" });
    expect(catalogo.has("9999")).toBe(false); // descrição vazia no arquivo real também não deve virar item
  });
});

describe("parsePrecoInsumo", () => {
  it("le o preco unico (sem distincao onerado/desonerado) e a competencia", () => {
    const { precos, competencia } = parsePrecoInsumo(TB_INSUMO_PRECO);
    expect(precos.get("54")).toBeCloseTo(8.6);
    expect(precos.get("2451")).toBeCloseTo(47.16);
    expect(competencia).toBe("2026-06");
  });
  it("descarta insumo com preco zero", () => {
    const { precos } = parsePrecoInsumo(TB_INSUMO_PRECO);
    expect(precos.has("9999")).toBe(false);
  });
});

describe("parseCatalogoServico - reconstrução por âncora (RTF poluído)", () => {
  it("le uma composicao limpa normalmente", () => {
    const catalogo = parseCatalogoServico(TB_SERVICO);
    expect(catalogo.get("4")).toEqual({
      codigo: "4",
      descricao: "Limpeza mecanizada do terreno c/ trator esteira (vegetacao rasteira) inclusive carga e transporte - dmt ate 1 km",
      unidade: "m2",
    });
  });
  it("extrai os campos limpos de uma linha poluida com RTF, sem engolir o bloco binario", () => {
    const catalogo = parseCatalogoServico(TB_SERVICO);
    const item = catalogo.get("16");
    expect(item.descricao).toBe("Demolicao manual de piso cimentado sobre lastro de concreto - Rev 01");
    expect(item.unidade).toBe("m2");
    expect(item.descricao).not.toContain("rtf1");
  });
  it("nao deixa as linhas de continuacao do RTF virarem registros falsos", () => {
    const catalogo = parseCatalogoServico(TB_SERVICO);
    // as linhas de continuacao (colortbl, viewkind4, "}") nao comecam com
    // "ORSE;<numero>;" - nenhuma delas deve gerar entrada no catalogo
    expect(catalogo.size).toBe(3); // 4, 16, 17 - nao 4 registros fantasmas a mais
  });
  it("continua lendo corretamente o registro seguinte ao bloco poluido", () => {
    const catalogo = parseCatalogoServico(TB_SERVICO);
    expect(catalogo.get("17")).toEqual({
      codigo: "17",
      descricao: "Demolicao manual de piso cimentado sobre lastro de concreto - Rev 02",
      unidade: "m2",
    });
  });
});

describe("parsePrecoServico", () => {
  it("le o preco final da composicao (coluna 6) - validado ao vivo contra producao para o codigo 4", () => {
    const { precos, competencia } = parsePrecoServico(TB_SERVICO_PRECO);
    expect(precos.get("4")).toBeCloseTo(6.74);
    expect(competencia).toBe("2026-06");
  });
});

describe("parseComposicoes", () => {
  it("le tipo, fonte, coeficiente e valores de cada filho, sem tentar somar", () => {
    const linhas = parseComposicoes(TB_COMPOSICAO);
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toEqual({
      compositionCode: "4", itemType: "INSUMO", fonte: "ORSE", itemCode: "54",
      coeficiente: 0.5, valorSem: 8.6, valorCom: 18.19,
    });
  });
  it("preserva filhos de outra fonte (SINAPI) sem descartar a linha", () => {
    const linhas = parseComposicoes(TB_COMPOSICAO);
    const filhoSinapi = linhas.find(l => l.itemCode === "6111");
    expect(filhoSinapi.fonte).toBe("SINAPI");
  });
});

describe("montarExtracaoOrse", () => {
  it("junta os cinco arquivos no formato {itens, insumos, componentes, dataBase}", () => {
    const extraida = montarExtracaoOrse({
      insumoTxt: TB_INSUMO, insumoPrecoTxt: TB_INSUMO_PRECO,
      servicoTxt: TB_SERVICO, servicoPrecoTxt: TB_SERVICO_PRECO,
      composicaoTxt: TB_COMPOSICAO,
    });
    expect(extraida.dataBase).toBe("2026-06");

    const composicao4 = extraida.itens.find(item => item.codigo === "4");
    expect(composicao4).toBeDefined();
    expect(composicao4.fonte).toBe("ORSE");
    expect(composicao4.precoDes).toBeCloseTo(6.74);
    expect(composicao4.precoNao).toBeCloseTo(6.74); // ORSE nao distingue - mesmo valor nos dois campos

    const insumo54 = extraida.insumos.find(item => item.codigo === "54");
    expect(insumo54.precoDes).toBeCloseTo(8.6);
    expect(insumo54.precoNao).toBeCloseTo(8.6);

    expect(extraida.componentes.filter(c => c.compositionCode === "4")).toHaveLength(4);
  });

  it("nao inclui na saida final um item cujo codigo so existe no catalogo, sem preco", () => {
    const extraida = montarExtracaoOrse({
      insumoTxt: TB_INSUMO, insumoPrecoTxt: TB_INSUMO_PRECO,
      servicoTxt: TB_SERVICO, servicoPrecoTxt: TB_SERVICO_PRECO,
      composicaoTxt: TB_COMPOSICAO,
    });
    expect(extraida.insumos.some(item => item.codigo === "9999")).toBe(false);
  });

  it("resolve a descricao de um componente ORSE a partir do catalogo correspondente", () => {
    const extraida = montarExtracaoOrse({
      insumoTxt: TB_INSUMO, insumoPrecoTxt: TB_INSUMO_PRECO,
      servicoTxt: TB_SERVICO, servicoPrecoTxt: TB_SERVICO_PRECO,
      composicaoTxt: TB_COMPOSICAO,
    });
    const componente54 = extraida.componentes.find(c => c.itemCode === "54");
    expect(componente54.descricao).toBe("Areia lavada tipo media, posta na obra");
  });

  it("nunca deixa a descricao de um componente de outra fonte em branco (senao a linha some do lote de gravacao)", () => {
    const extraida = montarExtracaoOrse({
      insumoTxt: TB_INSUMO, insumoPrecoTxt: TB_INSUMO_PRECO,
      servicoTxt: TB_SERVICO, servicoPrecoTxt: TB_SERVICO_PRECO,
      composicaoTxt: TB_COMPOSICAO,
    });
    const componenteSinapi = extraida.componentes.find(c => c.itemCode === "6111");
    expect(componenteSinapi.fonte).toBe("SINAPI");
    expect(componenteSinapi.descricao.length).toBeGreaterThan(0);
  });
});
