import { describe, expect, it } from "vitest";
import {detectarColunasImportacao,indexarReferenciasImportacao,montarLinhasImportacao,resumoImportacao} from "./budget-import-mapping";

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

it('reconcilia a planilha com o motor e preserva o preço da fonte correta em código repetido',()=>{
  const rows=[['Nível corrigido','Item','Fonte','Código','Descrição','Unidade','Quantidade','Custo unitário (sem BDI)','BDI (%)','Preço unitário (com BDI)','Preço total (R$)'],
    ['LOTE','1','','','Fundação'],['Serviço','1.1','SINAPI','96532','Fôrma de sapata','M2',102.495,203.73,.2212,248.795076,25500.26],
    ['Serviço','1.2','ORSE','96532','Unidade a conferir','UN',2,'',.2212,'',0],
    ['','','','','CUSTO DIRETO (SEM BDI)'],['','','','','BDI (22.12%)'],['','','','','TOTAL GERAL DO ORÇAMENTO']];
  const {hIdx,col}=detectarColunasImportacao(rows);
  const index=indexarReferenciasImportacao([{codigo:'96532',fonte:'ORSE',unidade:'M2',precoUnit:70},{codigo:'96532',fonte:'SINAPI',unidade:'M²',precoUnit:205,dataBase:'2026-07'}]);
  const lines=montarLinhasImportacao({rows,hIdx,col,basePorCodigo:index,precoDoItem,orc:{bdi:22.12},parseNumero:Number});
  expect(lines).toHaveLength(3);
  expect(lines[1]).toMatchObject({precoUnit:205,original:{valores:{qtd:102.495,preco:203.73,bdi:22.12,total:25500.26},calculado:{total:25500.26}},referencia:{fonte:'SINAPI',baseData:'2026-07'}});
  expect(lines[1].original.divergences).toEqual(['Custo unitário do Excel difere do preço da referência.']);
  expect(lines[2]).toMatchObject({precoUnit:0,unidade:'UN',semPreco:true,original:{valores:{preco:null}},referencia:{preco:70}});
  expect(lines[2].original.divergences[0]).toMatch(/Unidade da referência/);
  expect(resumoImportacao(lines,22.12,false)).toMatchObject({ok:1,origemTotal:25500.26,origemRecalculada:25500.26,valor:21011.48,total:25659.22});
});

it('deixa dados inválidos e referências ambíguas como pendências sem trocar a fonte',()=>{
  const rows=[['Fonte','Código','Descrição','Quantidade','Custo unitário','BDI','Preço total'],
    ['SINAPI','8','Ambíguo','10 m',15,.2212,100],['ORSE','8','Fonte ausente na base',10,20,10,230]];
  const {hIdx,col}=detectarColunasImportacao(rows);
  const basePorCodigo=indexarReferenciasImportacao(['PE','AL'].map(uf=>({codigo:'8',fonte:'SINAPI',uf,precoUnit:15})));
  const lines=montarLinhasImportacao({rows,hIdx,col,basePorCodigo,precoDoItem,orc:{bdi:10},parseNumero:Number,percentCells:new Set(['1:5'])});
  expect(lines[0]).toMatchObject({achou:false,quantidade:0,original:{valores:{qtd:null,bdi:22.12}}});
  expect(lines[0].original.missing).toContain('Código ambíguo nas referências carregadas.');
  expect(lines[1]).toMatchObject({achou:false,fonte:'ORSE',precoUnit:0,original:{calculado:{total:220}}});
  expect(lines[1].original.divergences).toContain('Total do Excel difere do recálculo dos dados originais.');
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
