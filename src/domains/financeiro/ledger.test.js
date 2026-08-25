import {
  buildFinancialLedger, selectDRE, selectCashFlow, selectAccountsReceivable, selectCorporateOperatingCosts,
  selectAccountsPayable, selectCommitments, validateFinancialReconciliation,
  recebimentosDaMedicao, toCents,
} from "./ledger";

const julyFixture = () => ({
  obras:[{id:"obra-1",name:"B2-04",cliente:"Cliente"}],
  medicoes:[{
    id:"med-1",obraId:"obra-1",competencia:"2026-07",valorPrevisto:100000,
    recebido:false,valorRecebido:55000,dataVencimento:"2026-07-31",
    recebimentos:[
      {id:"rec-1",valor:40000,data:"2026-07-10"},
      {id:"rec-2",valor:15000,data:"2026-08-05"},
    ],
  }],
  payments:[{id:"av-1",obraId:"obra-1",date:"2026-07-15",amount:5000,description:"Recebimento direto"}],
  pedidos:[
    {id:"ped-1",obraId:"obra-1",numero:"1",status:"aprovado",data:"2026-07-01",valorTotal:30000},
    {id:"ped-cancelado",obraId:"obra-1",status:"cancelado",data:"2026-07-01",valorTotal:7000},
  ],
  notasFiscais:[{
    id:"nf-1",pedidoId:"ped-1",obraId:"obra-1",numero:"10",status:"aprovada",
    emissao:"2026-07-05",valorBruto:24000,
    pagamentos:[
      {id:"pgnf-1",valor:10000,data:"2026-07-20",transacaoId:"tx-1"},
      {id:"pgnf-2",valor:6000,data:"2026-08-10"},
    ],
  }],
  outrasDesp:[{id:"od-1",obraId:"obra-1",competencia:"2026-07",valor:2000,descricao:"Despesa sem pagamento"}],
  medicoesTerc:[{id:"mt-1",obraId:"obra-1",status:"aprovada",data:"2026-07-08",total:8000}],
  pagsTerceiros:[{id:"pgt-1",medicaoTercId:"mt-1",obraId:"obra-1",date:"2026-07-25",amount:3000}],
  transacoes:[{id:"tx-1",data:"2026-07-20",valor:-10000,status:"conciliado",vinculo:{tipo:"nota",id:"nf-1"}}],
  despesasEmpresa:[],rescisoes:[],
});

const supplementalLabor = [
  {id:"labor:obra-1:2026-07",effect:"cost",amountCents:toCents(12000),date:"2026-07-31",competence:"2026-07",obraId:"obra-1",category:"mao_obra",description:"Mão de obra",sourceType:"ponto",sourceId:"obra-1:2026-07"},
  {id:"benefit:obra-1:2026-07",effect:"cost",amountCents:toCents(1500),date:"2026-07-31",competence:"2026-07",obraId:"obra-1",category:"beneficios",description:"Benefícios",sourceType:"ponto",sourceId:"obra-1:2026-07"},
];

describe("razão financeiro único — fixture julho/2026", () => {
  const ledger = buildFinancialLedger(julyFixture(), { supplementalEvents: supplementalLabor });
  const period = { obraId:"obra-1", competence:"2026-07", startDate:"2026-07-01", endDate:"2026-07-31", asOfDate:"2026-07-31" };

  test("fecha DRE por competência", () => {
    const dre = selectDRE(ledger, period);
    expect(dre.revenueCents).toBe(toCents(100000));
    expect(dre.costCents).toBe(toCents(47500));
    expect(dre.resultCents).toBe(toCents(52500));
    expect(dre.margin).toBe(52.5);
    expect(dre.costByCategory.mao_obra).toBe(12000);
    expect(dre.costBySource.nota_fiscal).toBe(24000);
  });

  test("fecha caixa sem duplicar transação bancária nem campo espelho", () => {
    const cash = selectCashFlow(ledger, period);
    expect(cash.cashInCents).toBe(toCents(45000));
    expect(cash.cashOutCents).toBe(toCents(13000));
    expect(cash.balanceCents).toBe(toCents(32000));
  });

  test("fecha posições e compromisso", () => {
    expect(selectAccountsReceivable(ledger, period).balanceCents).toBe(toCents(60000));
    expect(selectAccountsPayable(ledger, period).balanceCents).toBe(toCents(19000));
    expect(selectCommitments(ledger, period).balanceCents).toBe(toCents(6000));
    expect(ledger.events.filter(event => event.unallocated && event.effect === "cash_in").reduce((sum,event)=>sum+event.amountCents,0)).toBe(toCents(5000));
  });

  test("payments é somente entrada avulsa, nunca custo ou saída", () => {
    const events = ledger.events.filter(event => event.sourceType === "recebimento_avulso");
    expect(events.map(event => event.effect)).toEqual(["cash_in"]);
  });

  test("despesa administrativa é selecionada pelo razão, com estorno líquido", () => {
    const ledger=buildFinancialLedger({despesasEmpresa:[
      {id:"sede",competencia:"2026-07",categoria:"aluguel",valor:900},
      {id:"estorno",competencia:"2026-07",categoria:"aluguel",valor:-150},
    ]});
    const selected=selectCorporateOperatingCosts(ledger,{competence:"2026-07"});
    expect(selected.costCents).toBe(toCents(750));
    expect(selected.costs).toBe(750);
    expect(selected.events).toHaveLength(2);
  });

  test("pedido não entra no DRE e NF não duplica custo no pagamento", () => {
    const dre = selectDRE(ledger, period);
    expect(dre.events.some(event => event.sourceType === "pedido")).toBe(false);
    expect(dre.events.filter(event => event.sourceType === "nota_fiscal").reduce((sum,event)=>sum+event.amountCents,0)).toBe(toCents(24000));
  });

  test("conferência automática fecha cards e detalhes", () => {
    const conference = validateFinancialReconciliation(ledger, period);
    expect(conference.ok).toBe(true);
    expect(conference.checks.every(check => check.ok)).toBe(true);
  });
});

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): despesa
// lançada direto no caixa da obra (material, mão de obra ou terceirizado
// pago com dinheiro da obra) só gerava efeito de caixa - nunca virava custo
// no DRE, mesmo o campo efeitoDRE já dizendo "custo_obra" (ficava preso em
// metadata, nunca lido). Confirmado com o usuário: despesa do caixa da obra
// deve virar custo (de qualquer categoria); aporte nunca vira receita da
// empresa - é aporte de capital na obra, não faturamento.
describe("caixa da obra - despesa vira custo, aporte nunca vira receita", () => {
  test("despesa sem nota/pedido/medição vinculada gera custo E saída de caixa, sem duplicar", () => {
    const ledger = buildFinancialLedger({ caixaObra: [
      { id: "cx-1", obraId: "obra-1", tipo: "despesa", categoria: "mao_obra", data: "2026-07-10", valor: 400, descricao: "Diarista" },
    ] });
    const custo = ledger.events.filter(e => e.sourceType === "caixa_obra" && e.effect === "cost");
    const saida = ledger.events.filter(e => e.sourceType === "caixa_obra" && e.effect === "cash_out");
    expect(custo).toHaveLength(1);
    expect(custo[0]).toMatchObject({ amountCents: toCents(400), obraId: "obra-1", category: "mao_obra" });
    expect(saida).toHaveLength(1);
    expect(saida[0].amountCents).toBe(toCents(400));
    expect(ledger.issues.some(i => i.code === "WORK_CASH_EXPENSE_WITHOUT_DOCUMENT")).toBe(true);
  });

  test("despesa JÁ vinculada a um pagamento existente não duplica o custo (já reconhecido pela nota/pedido)", () => {
    const ledger = buildFinancialLedger({ caixaObra: [
      { id: "cx-2", obraId: "obra-1", tipo: "despesa", categoria: "material", data: "2026-07-10", valor: 500, descricao: "Pagamento nota X", pagamentoId: "pgnf-1", notaFiscalId: "nf-1" },
    ] });
    expect(ledger.events.filter(e => e.sourceType === "caixa_obra" && e.effect === "cost")).toHaveLength(0);
    expect(ledger.events.filter(e => e.sourceType === "caixa_obra" && e.effect === "cash_out")).toHaveLength(1);
    expect(ledger.issues.some(i => i.code === "WORK_CASH_EXPENSE_WITHOUT_DOCUMENT")).toBe(false);
  });

  test("aporte nunca vira receita nem custo - só entrada de caixa", () => {
    const ledger = buildFinancialLedger({ caixaObra: [
      { id: "cx-3", obraId: "obra-1", tipo: "aporte", data: "2026-07-05", valor: 5000, descricao: "Aporte do cliente" },
    ] });
    const eventos = ledger.events.filter(e => e.sourceType === "caixa_obra");
    expect(eventos.map(e => e.effect)).toEqual(["cash_in"]);
  });
});

describe("status econômicos do razão", () => {
  test("arquivamento preserva o compromisso econômico", () => {
    const ledger=buildFinancialLedger({pedidos:[{
      id:"ped-arquivado",obraId:"obra-1",numero:"ARQ-01",status:"arquivado",data:"2026-07-10",valorTotal:1250,
    }]});
    expect(ledger.events).toEqual(expect.arrayContaining([
      expect.objectContaining({effect:"commitment_increase",amountCents:125000,sourceId:"ped-arquivado"}),
    ]));
  });

  // Regressão: purchase-order-commands.js só grava status "rascunho" ou
  // "enviado" para um pedido ativo (nunca "aprovado"/"emitido"). Sem
  // "enviado" em APPROVED_ORDER, todo pedido de compra real ficava
  // permanentemente invisível em "comprometido".
  test("pedido enviado (status real gravado pelo comando de compras) gera compromisso econômico", () => {
    const ledger=buildFinancialLedger({pedidos:[{
      id:"ped-enviado",obraId:"obra-1",numero:"1",status:"enviado",data:"2026-07-10",valorTotal:1250,
    }]});
    expect(ledger.events).toEqual(expect.arrayContaining([
      expect.objectContaining({effect:"commitment_increase",amountCents:125000,sourceId:"ped-enviado"}),
    ]));
  });

  test.each(["estornada","ESTORNADA","reversed","cancelled","rejeitado"]) (
    "status %s não deixa uma despesa produzir custo",status=>{
      const ledger=buildFinancialLedger({outrasDesp:[{
        id:"desp-inativa",obraId:"obra-1",competencia:"2026-07",valor:500,status,
      }]});
      expect(ledger.events.filter(event=>event.sourceId==="desp-inativa")).toEqual([]);
    },
  );
});

describe("compatibilidade e pendências financeiras", () => {
  test("recebimento parcial vale mesmo com booleano falso", () => {
    const data={obras:[{id:"o"}],medicoes:[{id:"m",obraId:"o",competencia:"2026-07",valorPrevisto:1000,recebido:false,recebimentos:[{id:"r",valor:400,data:"2026-07-10"}]}]};
    const ledger=buildFinancialLedger(data);
    expect(selectCashFlow(ledger,{obraId:"o",startDate:"2026-07-01",endDate:"2026-07-31"}).cashInCents).toBe(toCents(400));
    const receivable=selectAccountsReceivable(ledger,{obraId:"o",asOfDate:"2026-07-31"});
    expect(receivable.balanceCents).toBe(toCents(600));
    expect(receivable.items[0].status).toBe("parcial");
  });

  test("campo espelho gera um único recebimento legado", () => {
    const measurement={id:"m",valorPrevisto:1000,valorRecebido:400,dataPagamento:"2026-07-10",recebimentos:[]};
    expect(recebimentosDaMedicao(measurement)).toHaveLength(1);
    const mirrored={...measurement,recebimentos:[{id:"r",valor:400,data:"2026-07-10"}]};
    expect(recebimentosDaMedicao(mirrored)).toHaveLength(1);
  });

  test("pagamento maior que obrigação é rastreado e impede conferência OK", () => {
    const data={notasFiscais:[{id:"nf",obraId:"o",status:"aprovada",emissao:"2026-07-01",valorBruto:100,pagamentos:[{id:"p",valor:120,data:"2026-07-02"}]}]};
    const ledger=buildFinancialLedger(data);
    expect(selectAccountsPayable(ledger,{obraId:"o",asOfDate:"2026-07-31"}).overpaidCents).toBe(toCents(20));
    expect(ledger.issues.find(issue=>issue.code==="PAYABLE_OVERPAID")?.differenceCents).toBe(toCents(20));
    expect(validateFinancialReconciliation(ledger,{obraId:"o",asOfDate:"2026-07-31"}).ok).toBe(false);
  });

  test("rateio divergente registra diferença exata", () => {
    const ledger=buildFinancialLedger({notasFiscais:[{id:"nf",status:"aprovada",emissao:"2026-07-01",valorBruto:10000,rateios:[{id:"r",obraId:"o",valor:9500}]}]});
    expect(ledger.issues.find(issue=>issue.code==="NF_ALLOCATION_MISMATCH")?.differenceCents).toBe(toCents(-500));
    expect(validateFinancialReconciliation(ledger,{obraId:"o"}).ok).toBe(false);
  });
});
