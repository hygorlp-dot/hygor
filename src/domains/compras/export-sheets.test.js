import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { workbookFromTables } from "../../lib/spreadsheet.js";
import {
  dataExcel, planilhaFila, planilhaItensDosPedidos, planilhaNotas, planilhaOrcadoComprado, planilhaOrcadoPorObra, planilhaPedidos,
} from "./export-sheets.js";

const data = () => ({
  obras: [{ id: "a", name: "Alameda" }, { id: "b", name: "Horizonte" }],
  materiais: [{ id: "cim", descricao: "CIMENTO CP II" }],
  fornecedores: [{ id: "f1", nome: "Depósito Central" }],
  pedidos: [
    { id: "p1", numero: "PC-0001", obraId: "a", fornecedorId: "f1", status: "enviado", data: "2026-10-20", previsao: "2026-10-24",
      origemPagamento: "empresa", cotacaoId: "c1", pagamentos: [{ id: "pg", valor: 100, status: "ativo" }],
      itens: [{ id: "i1", materialId: "cim", qtd: 10, qtdRecebida: 4, precoUnit: 32.5, unidadeCompra: "SC" }] },
    { id: "p2", numero: "PC-0002", obraId: "b", fornecedorId: "f1", status: "enviado", data: "2026-10-21", itens: [] },
  ],
  notasFiscais: [
    { id: "n1", numero: "901", pedidoId: "p1", obraId: "a", fornecedorId: "f1", emissao: "2026-10-22", vencimento: "2026-11-21",
      valorBruto: 325, valorLiquido: 320.12, divergencias: ["CIMENTO: preço acima do pedido."] },
    { id: "n2", numero: "902", pedidoId: "p2", obraId: "b", emissao: "2026-10-22", valorBruto: 10 },
    { id: "n3", numero: "903", obraId: "a", emissao: "2026-10-22", valorBruto: 50 },
  ],
});

// Gera o .xlsx de verdade e lê de volta, como o Excel faria.
const ida_e_volta = async planilha => {
  const buffer = await workbookFromTables([planilha]).xlsx.writeBuffer();
  const lido = new ExcelJS.Workbook();
  await lido.xlsx.load(buffer);
  return lido.worksheets[0];
};

describe("exportar Compras para o Excel (A0.3)", () => {
  it("pedidos: só os da tela, valores em número e datas como data", async () => {
    const d = data();
    const planilha = planilhaPedidos(d, [d.pedidos[0]]);
    expect(planilha.linhas).toHaveLength(1);
    expect(planilha.linhas[0]).toEqual([
      "PC-0001", "Alameda", "Depósito Central", dataExcel("2026-10-20"), dataExcel("2026-10-24"), "Parcial",
      325, 130, 100, 225, "Pago em parte", "Empresa", "Sim", "Não",
    ]);
    const aba = await ida_e_volta(planilha);
    expect(aba.getRow(1).getCell(7).value).toBe("Valor do pedido");
    expect(aba.getCell("G2").value).toBe(325);
    expect(typeof aba.getCell("G2").value).toBe("number");
    expect(aba.getCell("G2").numFmt).toContain("R$");
    expect(aba.getCell("D2").value).toBeInstanceOf(Date);
    expect(aba.getCell("D2").value.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(aba.getCell("D2").numFmt).toBe("dd/mm/yyyy");
    expect(aba.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("itens dos pedidos: quantidade, recebido e falta em número", () => {
    const d = data();
    expect(planilhaItensDosPedidos(d, d.pedidos).linhas).toEqual([
      ["PC-0001", "Depósito Central", "CIMENTO CP II", "SC", 10, 4, 6, 32.5, 325],
    ]);
  });

  it("notas: só as dos pedidos exportados, com divergência legível", () => {
    const d = data();
    const notas = planilhaNotas(d, [d.pedidos[0]]);
    expect(notas.linhas).toEqual([[
      "901", "PC-0001", "Alameda", "Depósito Central", dataExcel("2026-10-22"), dataExcel("2026-11-21"), 325, 320.12, "Ativa",
      "CIMENTO: preço acima do pedido.",
    ]]);
  });

  it("orçado × comprometido: percentual como fração (0,5 = 50%) e vazio sem orçado", async () => {
    const modelo = { linhas: [
      { it: { descricao: "FUNDAÇÕES" }, etapa: "1º nível do orçamento", orcado: 1000, comprometido: 1100, recebido: 400, saldo: -100, pct: 110, alerta: "estourou" },
      { it: { descricao: "COBERTURA" }, etapa: "1º nível do orçamento", orcado: 0, comprometido: 50, recebido: 0, saldo: -50, pct: 999, alerta: "estourou" },
    ] };
    const planilha = planilhaOrcadoComprado(modelo, "Alameda");
    expect(planilha.linhas[0]).toEqual(["Alameda", "1º nível do orçamento", "FUNDAÇÕES", 1000, 1100, 400, -100, 1.1, "Estourou"]);
    expect(planilha.linhas[1][7]).toBeNull();
    const aba = await ida_e_volta(planilha);
    expect(aba.getCell("H2").value).toBe(1.1);
    expect(aba.getCell("H2").numFmt).toBe("0.0%");
    expect(aba.getCell("H3").value).toBeNull();
  });

  it("orçado por obra: obra sem orçamento de controle fica sem orçado", () => {
    const planilha = planilhaOrcadoPorObra({ linhas: [
      { obra: "Alameda", temControle: true, orcado: 1000, comprometido: 500, pctOrcado: 50, aReceber: 200, aPagar: 300, atrasados: 1, estouradas: 0 },
      { obra: "Horizonte", temControle: false, orcado: 0, comprometido: 80, pctOrcado: null, aReceber: 0, aPagar: 80, atrasados: 0, estouradas: 0 },
    ] });
    expect(planilha.linhas).toEqual([
      ["Alameda", 1000, 500, 0.5, 200, 300, 1, 0],
      ["Horizonte", null, 80, null, 0, 80, 0, 0],
    ]);
  });

  it("fila: etapa por extenso, prazo como data e valor só de pedido", () => {
    const linhas = planilhaFila([
      { stage: "recebimentos", code: "PC-0001", obra: "Alameda", title: "CIMENTO", detail: "Aguardando entrega", date: "2026-10-24",
        deadline: { label: "Vence em 1 dia" }, responsible: "Depósito Central", total: 325, action: "Receber materiais" },
      { stage: "solicitacoes", code: "SC-0001", obra: "Alameda", title: "Areia", detail: "Aguardando análise", date: "",
        deadline: { label: "Sem prazo" }, responsible: "Ana", total: null, action: "Analisar solicitação" },
    ]).linhas;
    expect(linhas[0]).toEqual(["Recebimento", "PC-0001", "Alameda", "CIMENTO", "Aguardando entrega", dataExcel("2026-10-24"),
      "Vence em 1 dia", "Depósito Central", 325, "Receber materiais"]);
    expect(linhas[1][5]).toBeNull();
    expect(linhas[1][8]).toBeNull();
  });
});
