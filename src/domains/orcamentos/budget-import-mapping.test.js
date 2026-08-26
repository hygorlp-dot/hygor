import { describe, expect, it } from "vitest";
import { detectarColunasImportacao, montarLinhasImportacao, resumoImportacao } from "./budget-import-mapping";

// Reproduz o achado real de 26/08/2026: um orçamentista externo exportou um
// CSV com cabeçalho "Ordem";"Código";"Tipo";"Nome";"Unidade";"Quantidade";
// "Custo unitário";"Preço total" - "Nome" (não "Descrição") é a coluna de
// descrição, e a taxonomia de Tipo usa "Nível"/"Subnível"/"Composição"/
// "Produto"/"Serviço", diferente de qualquer exportação atual do ARCD.
const CABECALHO = ["Ordem", "Código", "Tipo", "Nome", "Unidade", "Quantidade", "Custo unitário", "Preço total"];
const LINHAS_EXEMPLO = [
  ["1", "", "Nível", "SERVIÇOS PRELIMINARES", "", "", "", 83368.33],
  ["1.1", "", "Subnível", "PREPARAÇÃO DO CANTEIRO", "", "", "", 20639.21],
  ["1.1.1", "100600", "Composição", "ASSENTAMENTO DE POSTE DE CONCRETO", "un", 1, 581.86, 669.14],
  ["10.5.1", "", "Serviço", "INFRAESTRUTURA ELÉTRICA", "", 1, 13500, 15525],
  ["13.4", "", "Produto", "ESTIMATIVA GRANITO", "", 1, 60000, 69000],
];

const basePorCodigo = new Map([
  ["100600", { descricao: "Assentamento de poste (base SINAPI)", unidade: "un", fonte: "SINAPI", precoUnit: 581.86 }],
]);
const precoDoItem = item => item.precoUnit ?? 0;
const orc = { fonte: "SINAPI", desonerado: true };

describe("detecção automática de colunas (palpite inicial, nunca a fonte da verdade)", () => {
  it("acha a linha de cabeçalho e reconhece Código/Tipo/Unidade/Quantidade", () => {
    const { hIdx, col } = detectarColunasImportacao([CABECALHO, ...LINHAS_EXEMPLO]);
    expect(hIdx).toBe(0);
    expect(col.codigo).toBe(1);
    expect(col.tipo).toBe(2);
    expect(col.unidade).toBe(4);
    expect(col.qtd).toBe(5);
  });

  it("reconhece 'Nome' como coluna de descrição (era o gap real: só 'Item'/'Descri*' eram aceitos)", () => {
    const { col } = detectarColunasImportacao([CABECALHO, ...LINHAS_EXEMPLO]);
    expect(col.descricao).toBe(3);
  });
});

describe("montarLinhasImportacao com mapeamento confirmado pelo usuário", () => {
  it("usa o nome real de Nível/Subnível, não o genérico 'Etapa', quando a coluna de descrição está correta", () => {
    const rows = [CABECALHO, ...LINHAS_EXEMPLO];
    const { col } = detectarColunasImportacao(rows);
    const linhas = montarLinhasImportacao({ rows, hIdx: 0, col, basePorCodigo, precoDoItem, orc, parseNumero: Number });
    const etapas = linhas.filter(l => l.kind === "etapa");
    expect(etapas.map(e => e.nome)).toEqual(["SERVIÇOS PRELIMINARES", "PREPARAÇÃO DO CANTEIRO"]);
  });

  it("preserva a descrição real de um Produto/Serviço sem código, em vez de '(código não localizado — sem descrição)'", () => {
    const rows = [CABECALHO, ...LINHAS_EXEMPLO];
    const { col } = detectarColunasImportacao(rows);
    const linhas = montarLinhasImportacao({ rows, hIdx: 0, col, basePorCodigo, precoDoItem, orc, parseNumero: Number });
    const semCodigo = linhas.filter(l => l.kind === "item" && !l.codigo);
    expect(semCodigo.map(i => i.descricao)).toEqual(["INFRAESTRUTURA ELÉTRICA", "ESTIMATIVA GRANITO"]);
  });

  it("com código válido, a descrição vem da base carregada (não da planilha) - comportamento já correto, preservado", () => {
    const rows = [CABECALHO, ...LINHAS_EXEMPLO];
    const { col } = detectarColunasImportacao(rows);
    const linhas = montarLinhasImportacao({ rows, hIdx: 0, col, basePorCodigo, precoDoItem, orc, parseNumero: Number });
    const item = linhas.find(l => l.kind === "item" && l.codigo === "100600");
    expect(item.descricao).toBe("Assentamento de poste (base SINAPI)");
    expect(item.achou).toBe(true);
  });

  it("se a descrição for mapeada para a coluna errada (ex.: 'Ordem'), etapas viram 'Etapa' genérica - prova por que a confirmação humana existe", () => {
    const rows = [CABECALHO, ...LINHAS_EXEMPLO];
    const { col } = detectarColunasImportacao(rows);
    const colErrado = { ...col, descricao: 0 }; // aponta para "Ordem" em vez de "Nome"
    const linhas = montarLinhasImportacao({ rows, hIdx: 0, col: colErrado, basePorCodigo, precoDoItem, orc, parseNumero: Number });
    const etapas = linhas.filter(l => l.kind === "etapa");
    // "1" e "1.1" (valores da coluna Ordem) não são texto vazio, então o
    // nome da etapa vira o número da ordem, não "Etapa" - mas de qualquer
    // forma NÃO é o nome real, confirmando que o mapeamento importa.
    expect(etapas.map(e => e.nome)).not.toEqual(["SERVIÇOS PRELIMINARES", "PREPARAÇÃO DO CANTEIRO"]);
  });

  it("resumoImportacao contabiliza etapas e itens corretamente", () => {
    const rows = [CABECALHO, ...LINHAS_EXEMPLO];
    const { col } = detectarColunasImportacao(rows);
    const linhas = montarLinhasImportacao({ rows, hIdx: 0, col, basePorCodigo, precoDoItem, orc, parseNumero: Number });
    const stats = resumoImportacao(linhas);
    expect(stats.etapas).toBe(2);
    expect(stats.itens).toBe(3);
    expect(stats.ok).toBe(1); // só o item com código encontrado na base
    expect(stats.naoAchou).toBe(2); // os dois Produto/Serviço sem código
  });
});
