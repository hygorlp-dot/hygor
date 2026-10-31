import {describe,expect,it} from "vitest";
import {buildDreProjectionRows,buildRequestedDreProjectionRows} from "./dre-projection.js";

// Regressão: `yearsInData` usava uma regex com barra invertida duplicada
// (`/^(20\\d{2})-\\d{2}/`), que nunca casa com uma data real. Isso fazia a
// materialização integral do DRE (usada na sincronização/homologação da
// sombra financeira) ignorar todo ano anterior ao ano corrente, mesmo
// havendo pedidos, medições, despesas ou ponto lançados em anos passados.
describe("buildDreProjectionRows — cobertura de anos anteriores", () => {
  it("inclui competências de um ano anterior quando há pedidos datados nele", () => {
    const previousYear = new Date().getFullYear() - 1;
    const data = {
      obras: [],
      pedidos: [
        {id: "p1", obraId: "obra-1", status: "aprovado", data: `${previousYear}-03-10`, valor: 1000},
      ],
    };
    const rows = buildDreProjectionRows(data);
    const hasPreviousYearRow = rows.some(row => row.year === previousYear);
    expect(hasPreviousYearRow).toBe(true);
  });
});

describe("buildDreProjectionRows — pagamento direto do cliente (D-C)", () => {
  it("a DRE do servidor também deixa o cliente_direto fora das saídas de caixa", () => {
    const year = new Date().getFullYear() - 1;
    const build = origem => buildDreProjectionRows({
      obras: [{id: "obra-1", name: "Obra 1"}],
      pedidos: [{id: "p1", obraId: "obra-1", numero: "PC-1", status: "enviado", data: `${year}-03-01`, itens: [{id: "i", qtd: 1, precoUnit: 800}]}],
      notasFiscais: [{id: "nf1", pedidoId: "p1", obraId: "obra-1", numero: "10", status: "aprovada", emissao: `${year}-03-05`, valorBruto: 800,
        pagamentos: [{id: "pg1", valor: 800, data: `${year}-03-20`, origem}]}],
    });
    const saidas = rows => rows.filter(row => row.year === year).reduce((soma, row) => soma + JSON.stringify(row).split('"saidasCaixa":').slice(1).reduce((s, trecho) => s + Number(trecho.match(/^-?[\d.]+/)?.[0] || 0), 0), 0);
    expect(saidas(build("cliente_direto"))).toBe(0);
    expect(saidas(build("empresa"))).toBeGreaterThan(0);
  });
});

// Mesmo cenário de src/domains/dre/calculations.test.js (avanço físico oficial):
// a DRE gravada pelo servidor usa a medição técnica aprovada e ignora canceladas.
describe("buildRequestedDreProjectionRows — avanço físico oficial", () => {
  it("medição técnica aprovada manda e a medição cancelada não conta", () => {
    const [row] = buildRequestedDreProjectionRows({
      obras: [{id: "o1", name: "Obra 1"}],
      medicoesObra: [{id: "t1", obraId: "o1", status: "aprovada", avancoFisico: 60}, {id: "t2", obraId: "o1", status: "cancelada", avancoFisico: 95}],
      medicoes: [{id: "m1", obraId: "o1", tipo: "percentual", percentualAcumulado: 80, status: "cancelada"}],
    }, [{year: 2026, month: 8, period: "mes", scope: "o1"}]);
    expect(row.payload.pctAvanco).toBe(60);
  });
});

// Mesmo cenário de src/domains/dre/calculations.test.js ("documento emitido
// depois do mês da competência"): a DRE gravada pelo servidor também põe a NF e
// a medição no mês da competência, e não no mês da emissão.
describe("buildRequestedDreProjectionRows — documento emitido depois da competência", () => {
  it("NF e medição de competência julho emitidas em agosto entram em julho", () => {
    const dados = {
      obras: [{id: "obra-1", name: "Obra 1"}],
      notasFiscais: [{id: "nf-atrasada", obraId: "obra-1", numero: "77", valorBruto: 500, competencia: "2026-07", emissao: "2026-08-03"}],
      medicoes: [{id: "med-atrasada", obraId: "obra-1", competencia: "2026-07", valorPrevisto: 2000, dataEmissao: "2026-08-02"}],
    };
    const [julho, agosto] = buildRequestedDreProjectionRows(dados, [
      {year: 2026, month: 6, period: "mes", scope: "obra-1"},
      {year: 2026, month: 7, period: "mes", scope: "obra-1"},
    ]);
    expect(julho.payload).toMatchObject({totalCustos: 500, faturamento: 2000});
    expect(agosto.payload).toMatchObject({totalCustos: 0, faturamento: 0});
  });
});
