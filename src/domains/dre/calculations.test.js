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

  test("tercEmpresaObra soma só o que a empresa pagou, sem afetar o custo reconhecido nem os demais pagamentos", () => {
    const dados = {
      ...data,
      medicoesTerc: [{
        id: "med-terc-1", obraId: "obra-1", tercId: "terc-1",
        data: "2026-07-10", total: 200, status: "aprovada",
      }],
      pagsTerceiros: [
        {
          id: "pag-empresa", tercId: "terc-1", obraId: "obra-1", medicaoTercId: "med-terc-1",
          amount: 100, date: "2026-07-12", status: "ativo", pagador: "empresa",
        },
        {
          id: "pag-obra", tercId: "terc-1", obraId: "obra-1", medicaoTercId: "med-terc-1",
          amount: 50, date: "2026-07-15", status: "ativo", pagador: "obra",
        },
      ],
    };
    const dre = regras.calcDREObra(dados, "obra-1", 2026, 6);
    expect(dre.tercCost).toBe(200);
    expect(dre.tercPago).toBe(150);
    expect(dre.tercEmpresaObra).toBe(100);
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

// Regime de competência: o documento entra no mês da competência mesmo quando é
// emitido depois do fim desse mês. Antes, o corte por data (asOfDate) tirava a
// nota do mês da competência e a competência a tirava do mês da emissão, e ela
// não aparecia em DRE nenhuma.
describe("documento emitido depois do mês da competência", () => {
  const atrasados = {
    ...data,
    notasFiscais: [{ id: "nf-atrasada", obraId: "obra-1", numero: "77", valorBruto: 500, competencia: "2026-07", emissao: "2026-08-03" }],
    medicoes: [...data.medicoes, { id: "med-atrasada", obraId: "obra-1", competencia: "2026-07", valorPrevisto: 2000, dataEmissao: "2026-08-02" }],
  };

  test("entra na DRE do mês da competência", () => {
    const julho = regras.calcDREObra(atrasados, "obra-1", 2026, 6);
    expect(julho.totalCustos).toBe(900 + 500);
    expect(julho.faturamento).toBe(5000 + 2000);
  });

  test("não entra na DRE do mês da emissão nem é contado duas vezes", () => {
    const julho = regras.calcDREObra(atrasados, "obra-1", 2026, 6);
    const agosto = regras.calcDREObra(atrasados, "obra-1", 2026, 7);
    const semAtraso = regras.calcDREObra(data, "obra-1", 2026, 7);
    expect(agosto.totalCustos).toBe(semAtraso.totalCustos);
    expect(agosto.faturamento).toBe(semAtraso.faturamento);
    expect(julho.dreEvents.filter(event => event.sourceId === "nf-atrasada")).toHaveLength(1);
  });

  test("detalhamento de outras despesas e faturado acumulado batem com o total do mês", () => {
    const comDespesa = { ...atrasados, outrasDesp: [...data.outrasDesp, { id: "od-atrasada", obraId: "obra-1", competencia: "2026-07", data: "2026-08-05", valor: 300 }] };
    const julho = regras.calcDREObra(comDespesa, "obra-1", 2026, 6);
    const agosto = regras.calcDREObra(comDespesa, "obra-1", 2026, 7);
    expect(julho.outrasDesp.map(item => item.valor)).toEqual([100, 300]);
    expect(agosto.outrasDesp).toEqual([]);
    expect(julho.faturadoAcum).toBe(julho.faturamento);
    expect(julho.conference.ok).toBe(true);
  });

  test("o consolidado da empresa também recebe o documento atrasado", () => {
    expect(regras.calcDREConsolidado(atrasados, 2026, 6).totalCustos)
      .toBe(regras.calcDREConsolidado(data, 2026, 6).totalCustos + 500);
  });
});

describe("calcProjecaoContratoObra — base de administração de materiais", () => {
  const obra = { id: "obra-1", name: "Obra 1", contractType: "admin_only", adminPercentage: 10 };
  const base = { obras: [obra], medicoes: [], payments: [], rescisoes: [] };

  test("despesa de material marcada 'não entra' continua no custo total, mas não aumenta a base de administração", () => {
    const semDespesa = regras.calcProjecaoContratoObra({ ...base, outrasDesp: [] }, "obra-1", 2026, 6);
    const comDespesaExcluida = regras.calcProjecaoContratoObra({ ...base, outrasDesp: [
      { obraId: "obra-1", competencia: "2026-07", valor: 5000, categoria: "material", contaAdmin: false },
    ] }, "obra-1", 2026, 6);
    expect(comDespesaExcluida.materialCost).toBe(semDespesa.materialCost + 5000);
    expect(comDespesaExcluida.adminBase).toBe(semDespesa.adminBase);
  });

  test("despesa de material sem contaAdmin explícito entra na base por padrão", () => {
    const semDespesa = regras.calcProjecaoContratoObra({ ...base, outrasDesp: [] }, "obra-1", 2026, 6);
    const comDespesa = regras.calcProjecaoContratoObra({ ...base, outrasDesp: [
      { obraId: "obra-1", competencia: "2026-07", valor: 5000, categoria: "material" },
    ] }, "obra-1", 2026, 6);
    expect(comDespesa.materialCost).toBe(semDespesa.materialCost + 5000);
    expect(comDespesa.adminBase).toBe(semDespesa.adminBase + 5000);
  });

  test("a diferença de valorAdmin entre os dois casos é exatamente o percentual sobre o material excluído", () => {
    const comAdmin = regras.calcProjecaoContratoObra(
      { ...base, outrasDesp: [{ obraId: "obra-1", competencia: "2026-07", valor: 5000, categoria: "material", contaAdmin: true }] },
      "obra-1", 2026, 6,
    );
    const semAdmin = regras.calcProjecaoContratoObra(
      { ...base, outrasDesp: [{ obraId: "obra-1", competencia: "2026-07", valor: 5000, categoria: "material", contaAdmin: false }] },
      "obra-1", 2026, 6,
    );
    expect(comAdmin.valorAdmin - semAdmin.valorAdmin).toBe(500);
  });

  test("adminEligibleMaterialCost é o material líquido usado pelo relatório de cobrança ao cliente", () => {
    const projecao = regras.calcProjecaoContratoObra({ ...base, outrasDesp: [
      { obraId: "obra-1", competencia: "2026-07", valor: 5000, categoria: "material", contaAdmin: true },
      { obraId: "obra-1", competencia: "2026-07", valor: 2000, categoria: "material", contaAdmin: false },
    ] }, "obra-1", 2026, 6);
    // O bruto (materialCost) inclui os dois lançamentos; o líquido usado na
    // base de administração exclui só o marcado "não entra". O relatório de
    // cobrança ao cliente (RelatorioAdministracao, em LegacyApp.jsx) exibe
    // este valor líquido, não o bruto - senão a soma das linhas "Sim" da
    // composição de custos não bateria com a base de fato cobrada.
    expect(projecao.materialCost).toBe(7000);
    expect(projecao.adminEligibleMaterialCost).toBe(5000);
  });
});

describe("pagamento direto do cliente no DRE da obra (D-C)", () => {
  const comPagamento = origem => ({
    ...data,
    pedidos:[{id:"p1",obraId:"obra-1",numero:"PC-1",status:"enviado",data:"2026-07-01",itens:[{id:"i",qtd:1,precoUnit:800}]}],
    notasFiscais:[{id:"nf1",pedidoId:"p1",obraId:"obra-1",numero:"10",status:"aprovada",emissao:"2026-07-05",valorBruto:800,
      pagamentos:[{id:"pg1",valor:800,data:"2026-07-20",origem}]}],
  });

  test("cliente_direto baixa a conta a pagar sem entrar em saidasCaixa nem reduzir o saldo de caixa", () => {
    const cliente = regras.calcDREObra(comPagamento("cliente_direto"), "obra-1", 2026, 6);
    const empresa = regras.calcDREObra(comPagamento("empresa"), "obra-1", 2026, 6);
    expect(cliente.saidasCaixa).toBe(0);
    expect(cliente.pagoPeloCliente).toBe(800);
    expect(cliente.contasPagar).toBe(0);
    expect(empresa.saidasCaixa).toBe(800);
    expect(empresa.pagoPeloCliente).toBe(0);
    expect(cliente.saldoCaixa - empresa.saldoCaixa).toBe(800);
    // quem pagou não muda o custo reconhecido
    expect(cliente.totalCustos).toBe(empresa.totalCustos);
  });
});
