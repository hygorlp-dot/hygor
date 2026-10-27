import {describe,expect,it} from "vitest";
import {buildDreProjectionRows} from "./dre-projection.js";

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
