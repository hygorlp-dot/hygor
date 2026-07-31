import { createDreCalculations } from "./calculations";

const dias = ["2026-07-06", "2026-07-20"];
const regras = createDreCalculations({
  getDays: () => dias,
  getQ: () => ({ q1: dias, q2: dias }),
  monthName: () => "Jul",
  calcObraLaborCost: () => ({ laborCost: 600, benefitCost: 100 }),
  calcObraTercCost: () => 200,
  calcTercEmpresaCost: () => 0,
  calcObraTercEmpresaCost: () => 0,
  calcObraComprasCost: () => 0,
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
    expect(dre.totalCustos).toBe(900);
    expect(dre.lucroBruto).toBe(4100);
    expect(dre.saldoCaixa).toBe(3000);
  });

  test("tercPago soma em caixa apenas o pagamento efetivo, sem duplicar o custo por competência", () => {
    const dados = {
      ...data,
      medicoesTerc: [{
        id: "med-terc-1", obraId: "obra-1", tercId: "terc-1",
        data: "2026-07-10", total: 200, status: "aprovada", pagamentoId: "pag-1",
      }],
      pagsTerceiros: [{
        id: "pag-1", tercId: "terc-1", obraId: "obra-1", medicaoTercId: "med-terc-1",
        amount: 150, date: "2026-07-12", status: "ativo",
      }],
    };
    const dre = regras.calcDREObra(dados, "obra-1", 2026, 6);
    expect(dre.tercCost).toBe(200);
    expect(dre.tercPago).toBe(150);
  });

  test("consolidado preserva a soma das obras", () => {
    const dre = regras.calcDREConsolidado(data, 2026, 6);
    expect(dre.faturamento).toBe(5000);
    expect(dre.totalCustos).toBe(900);
    expect(dre.lucroBruto).toBe(4100);
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
      calcObraTercEmpresaCost: () => 0,
      calcObraComprasCost: () => 0,
      calcEquipCustoObra: () => 0,
      calcEquipFaturamentoEmpresa: () => ({ receita: 0, lucro: 0 }),
    });
    const dre = regrasArquivo.calcDREObra(dados, "obra-1", 2026, 6, "q1");
    expect(dre.moData.laborCost).toBe(800);
    expect(dre.moData.benefitCost).toBe(120);
    expect(dre.totalCustos).toBe(920);
  });

  test("mantém despesa de obra arquivada no total e no detalhamento", () => {
    const dados = {
      ...data,
      outrasDesp:[
        {id:"arq",obraId:"obra-1",competencia:"2026-07",data:"2026-07-10",valor:175,status:"arquivada"},
        {id:"can",obraId:"obra-1",competencia:"2026-07",data:"2026-07-10",valor:90,status:"cancelada"},
      ],
    };
    const dre = regras.calcDREObra(dados,"obra-1",2026,6);
    expect(dre.outrasTotal).toBe(175);
    expect(dre.outrasDesp.map(item=>item.id)).toEqual(["arq"]);
  });

  test("a visão financeira usa as mesmas equações do DRE e separa caixa", () => {
    const dados = {
      ...data,
      payments:[{
        id:"entrada-avulsa",obraId:"obra-1",date:"2026-07-12",amount:250,
        description:"Aporte ainda não alocado",
      }],
    };
    const visao = regras.calcVisaoFinanceira(dados, 2026, 6, "obra-1");
    expect(visao.summary.revenue).toBe(5000);
    expect(visao.summary.costs).toBe(900);
    expect(visao.summary.result).toBe(4100);
    expect(visao.summary.cashIn).toBe(3250);
    expect(visao.summary.unallocatedReceipts).toBe(250);
    expect(visao.rows[0].revenue).toBe(visao.selected.faturamento);
    expect(visao.rows[0].costs).toBe(visao.selected.totalCustos);
    expect(visao.receipts.find(item => item.sourceId === "entrada-avulsa")?.removable).toBe(true);
  });

  test("locação externa separa receita e custo no consolidado", () => {
    const comLocacao = createDreCalculations({
      getDays: () => dias,
      getQ: () => ({ q1: dias, q2: dias }),
      monthName: () => "Jul",
      calcObraLaborCost: () => ({ laborCost:600, benefitCost:100 }),
      calcObraTercCost: () => 0,
      calcTercEmpresaCost: () => 0,
      calcObraTercEmpresaCost: () => 0,
      calcObraComprasCost: () => 0,
      calcEquipCustoObra: () => 100,
      calcEquipFaturamentoEmpresa: () => ({
        receita:1000, custoDono:400, manut:200, lucro:400,
      }),
    });
    const dre = comLocacao.calcDREConsolidado(data, 2026, 6);
    expect(dre.faturamento).toBe(6000);
    expect(dre.totalCustos).toBe(1500);
    expect(dre.lucroBruto).toBe(4500);
    expect(dre.reconciliation.diferencaCents).toBe(0);
  });

  test("consolidado inclui caixa e obrigações sem obra vinculada", () => {
    const dados = {
      ...data,
      despesasEmpresa:[{
        id:"desp-corp",competencia:"2026-07",data:"2026-07-08",
        valor:50,pago:true,categoria:"administrativo",
      }],
      titulosFolha:[{
        id:"folha-corp",competencia:"2026-07",vencimento:"2026-07-20",
        employeeId:"e1",liquido:300,rateiosPorObra:[],
      }],
    };
    const dre = regras.calcDREConsolidado(dados, 2026, 6);
    expect(dre.saidasCaixa).toBe(50);
    expect(dre.contasPagar).toBe(300);
    expect(dre.totalCustos).toBe(950);
    expect(dre.lucroBruto).toBe(4050);
  });
});
