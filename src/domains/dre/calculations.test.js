import { createDreCalculations } from "./calculations";

const dias = ["2026-07-06", "2026-07-20"];
const regras = createDreCalculations({
  getDays: () => dias,
  getQ: () => ({ q1: dias, q2: dias }),
  monthName: () => "Jul",
  calcObraLaborCost: () => ({ laborCost: 600, benefitCost: 100 }),
  calcObraTercCost: () => 200,
  calcTercEmpresaCost: () => 0,
  calcEquipCustoObra: () => 100,
  calcEquipFaturamentoEmpresa: () => ({ receita: 0, lucro: 0 }),
});

const data = {
  obras: [{ id: "obra-1", name: "Obra 1", contractValue: 10000 }],
  medicoes: [{
    obraId: "obra-1",
    competencia: "2026-07",
    valorPrevisto: 5000,
    recebido: true,
    valorRecebido: 3000,
    dataPagamento: "2026-07-10",
  }],
  payments: [],
  rescisoes: [],
  outrasDesp: [{ obraId: "obra-1", competencia: "2026-07", valor: 100 }],
};

describe("domínio do DRE", () => {
  test("fecha faturamento, custos, lucro e caixa da obra", () => {
    const dre = regras.calcDREObra(data, "obra-1", 2026, 6);
    expect(dre.faturamento).toBe(5000);
    expect(dre.totalCustos).toBe(1100);
    expect(dre.lucroBruto).toBe(3900);
    expect(dre.saldoCaixa).toBe(1900);
  });

  test("consolidado preserva a soma das obras", () => {
    const dre = regras.calcDREConsolidado(data, 2026, 6);
    expect(dre.faturamento).toBe(5000);
    expect(dre.totalCustos).toBe(1000);
    expect(dre.lucroBruto).toBe(4000);
  });

  test("mantém os custos de mão de obra de uma quinzena arquivada", () => {
    const dados = {
      ...data,
      archivedLaborCosts: {
        "2026-07-Q1": {
          byDate: {
            "2026-07-10": {
              "obra-1": { laborCost: 800, benefitCost: 120 },
            },
          },
        },
      },
    };
    const regrasArquivo = createDreCalculations({
      getDays: () => ["2026-07-10"],
      getQ: () => ({ q1: ["2026-07-10"], q2: [] }),
      monthName: () => "Jul",
      calcObraLaborCost: (d, obraId, days) => {
        const custo = d.archivedLaborCosts["2026-07-Q1"].byDate[days[0]]?.[obraId];
        return {
          laborCost: Number(custo?.laborCost || 0),
          benefitCost: Number(custo?.benefitCost || 0),
        };
      },
      calcObraTercCost: () => 0,
      calcTercEmpresaCost: () => 0,
      calcEquipCustoObra: () => 0,
      calcEquipFaturamentoEmpresa: () => ({ receita: 0, lucro: 0 }),
    });
    const dre = regrasArquivo.calcDREObra(dados, "obra-1", 2026, 6, "q1");
    expect(dre.moData.laborCost).toBe(800);
    expect(dre.moData.benefitCost).toBe(120);
    expect(dre.totalCustos).toBe(920);
  });
});
