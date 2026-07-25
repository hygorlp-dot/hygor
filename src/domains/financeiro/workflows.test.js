import {
  analyzePurchaseThreeWayMatch,
  createBillingFromTechnicalMeasurement,
  createMonthlyClosingSnapshot,
  isDateInClosedPeriod,
  linkThirdPartyInvoice,
} from "./workflows.js";
import {
  buildFinancialLedger,
  selectAccountsPayable,
  selectCashFlow,
  selectDRE,
  toCents,
} from "./ledger.js";

describe("cadeia pedido → recebimento físico → NF",()=>{
  test("concilia as três pontas sem usar pagamento",()=>{
    const data={
      pedidos:[{id:"p1",status:"enviado",itens:[{qtd:10,qtdRecebida:10,precoUnit:100}]}],
      notasFiscais:[{id:"nf1",pedidoId:"p1",status:"aprovada",valorBruto:1000}],
    };
    expect(analyzePurchaseThreeWayMatch(data,"p1")).toMatchObject({
      ok:true,status:"conciliado",orderedCents:100000,receivedCents:100000,invoicedCents:100000,
    });
  });

  test("sinaliza NF acima do recebimento físico",()=>{
    const data={
      pedidos:[{id:"p1",status:"enviado",itens:[{qtd:10,qtdRecebida:6,precoUnit:100}]}],
      notasFiscais:[{id:"nf1",pedidoId:"p1",status:"aprovada",valorBruto:1000}],
    };
    const match=analyzePurchaseThreeWayMatch(data,"p1");
    expect(match.status).toBe("nf_acima_recebimento");
    expect(match.issues.find(issue=>issue.code==="INVOICE_EXCEEDS_PHYSICAL_RECEIPT")?.differenceCents).toBe(40000);
  });
});

describe("medição técnica → faturamento",()=>{
  test("gera uma medição financeira rastreável e bloqueia duplicidade",()=>{
    const data={medicoesObra:[{
      id:"mt1",obraId:"o1",status:"confirmada",data:"2026-07-20",numero:2,avancoFisico:35,
      itens:[{tarefaId:"t1",nome:"Estrutura",pctConfirmado:35}],
    }],medicoes:[]};
    const created=createBillingFromTechnicalMeasurement(data,{
      medicaoTecnicaId:"mt1",valor:25000,competencia:"2026-07",dataVencimento:"2026-08-10",
    });
    expect(created.ok).toBe(true);
    expect(created.measurement).toMatchObject({
      id:"fat-mt1",obraId:"o1",medicaoTecnicaId:"mt1",valorPrevisto:25000,competencia:"2026-07",
    });
    expect(createBillingFromTechnicalMeasurement(
      {...data,medicoes:[created.measurement]},
      {medicaoTecnicaId:"mt1",valor:25000,competencia:"2026-07"},
    ).ok).toBe(false);
  });
});

describe("folha → título → pagamento",()=>{
  test("reconhece obrigação e caixa sem duplicar o custo do ponto",()=>{
    const data={
      titulosFolha:[{
        id:"tf1",employeeId:"e1",funcionarioNome:"Operador",competencia:"2026-07",
        vencimento:"2026-07-31",liquido:2000,rateiosPorObra:[{obraId:"o1",valor:2000}],
        liquidacoes:[{id:"l1",valor:800,data:"2026-07-30",transacaoId:"tx1"}],
      }],
      pagamentosFolha:[{id:"espelho",employeeId:"e1",valor:800,data:"2026-07-30",transacaoId:"tx1"}],
      transacoes:[{id:"tx1",data:"2026-07-30",valor:-800,status:"conciliado"}],
    };
    const ledger=buildFinancialLedger(data);
    expect(selectAccountsPayable(ledger,{obraId:"o1",asOfDate:"2026-07-31"}).balanceCents).toBe(toCents(1200));
    expect(selectCashFlow(ledger,{obraId:"o1",startDate:"2026-07-01",endDate:"2026-07-31"}).cashOutCents).toBe(toCents(800));
    expect(selectDRE(ledger,{obraId:"o1",competence:"2026-07"}).costCents).toBe(0);
  });
});

describe("terceiro → medição → NF",()=>{
  test("NF vinculada documenta a medição sem duplicar custo e obrigação",()=>{
    const linked=linkThirdPartyInvoice({
      medicoesTerc:[{id:"m1",obraId:"o1",total:5000,status:"aprovada",data:"2026-07-10"}],
      notasFiscais:[{id:"nf1",obraId:"o1",valorBruto:5000,status:"aprovada",emissao:"2026-07-12"}],
    },{medicaoTercId:"m1",notaFiscalId:"nf1"});
    expect(linked.ok).toBe(true);
    const ledger=buildFinancialLedger({
      medicoesTerc:linked.medicoesTerc,notasFiscais:linked.notasFiscais,
    });
    expect(selectDRE(ledger,{obraId:"o1",competence:"2026-07"}).costCents).toBe(toCents(5000));
    expect(selectAccountsPayable(ledger,{obraId:"o1",asOfDate:"2026-07-31"}).balanceCents).toBe(toCents(5000));
  });
});

describe("fechamento mensal imutável",()=>{
  test("congela IDs e saldos conferidos e impede segundo fechamento",()=>{
    const data={
      obras:[{id:"o1"}],
      medicoes:[{id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000}],
      outrasDesp:[{id:"d1",obraId:"o1",competencia:"2026-07",valor:200}],
    };
    const result=createMonthlyClosingSnapshot(data,{
      competencia:"2026-07",actor:{id:"admin",nome:"Administrador"},closedAt:"2026-08-01T10:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(result.closing.snapshot).toMatchObject({
      revenueCents:100000,costCents:20000,resultCents:80000,
    });
    expect(isDateInClosedPeriod(
      {...data,fechamentosFinanceiros:[result.closing]},"2026-07-15",
    )).toBe(true);
    expect(createMonthlyClosingSnapshot(
      {...data,fechamentosFinanceiros:[result.closing]},
      {competencia:"2026-07"},
    ).ok).toBe(false);
  });
});
