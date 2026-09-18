import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectCashFlow, selectDRE } from "./ledger";
import {
  approveThirdPartyMeasurement, cancelThirdPartyMeasurement, createThirdPartyMeasurement, createThirdPartyPayment,
  payThirdPartyMeasurement, rejectThirdPartyMeasurement, resubmitThirdPartyMeasurement, reverseThirdPartyPayment,
} from "./third-party-payment-mutations";

describe("pagamentos auditáveis de terceiros", () => {
  const actor={id:"u-1",nome:"Financeiro"};
  const payment={tercId:"t-1",tercName:"Pedreiro",obraId:"o-1",date:"2026-07-05",amount:800,pagador:"obra",description:"Adiantamento"};

  it("registra pagamento manual como caixa não alocado, sem inventar custo no DRE", () => {
    const data=createThirdPartyPayment({data:{pagsTerceiros:[]},payment,actor,id:"p-1",now:"2026-07-05T10:00:00.000Z"});
    expect(data.pagsTerceiros[0]).toMatchObject({id:"p-1",status:"ativo",reconhecerCusto:false,createdById:"u-1"});
    const ledger=buildFinancialLedger(data);
    expect(selectCashFlow(ledger,{obraId:"o-1",startDate:"2026-07-01",endDate:"2026-07-31"}).cashOut).toBe(800);
    expect(selectDRE(ledger,{obraId:"o-1",competence:"2026-07"}).costCents).toBe(0);
    expect(ledger.issues.some(issue=>issue.code==="THIRD_PARTY_PAYMENT_UNALLOCATED")).toBe(true);
  });

  it("estorna sem apagar o pagamento e bloqueia pagamento conciliado", () => {
    const data=createThirdPartyPayment({data:{pagsTerceiros:[]},payment,actor,id:"p-1"});
    const result=reverseThirdPartyPayment({data,paymentId:"p-1",reason:"Duplicidade",actor,now:"2026-07-06T10:00:00.000Z"});
    expect(result.pagsTerceiros[0]).toMatchObject({status:"estornado",motivoCancelamento:"Duplicidade",canceladoPorId:"u-1"});
    expect(selectCashFlow(buildFinancialLedger(result),{obraId:"o-1",startDate:"2026-07-01",endDate:"2026-07-31"}).cashOut).toBe(0);
    expect(()=>reverseThirdPartyPayment({data:{pagsTerceiros:[{...data.pagsTerceiros[0],transacaoId:"tx-1"}]},paymentId:"p-1",reason:"x",actor})).toThrow("Desfaça a conciliação");
  });

  it("medição nasce rascunho (fora do DRE); só depois de aprovada reconhece custo/obrigação; pagamento apenas liquida", () => {
    const created=createThirdPartyMeasurement({data:{medicoesTerc:[]},actor,id:"m-1",measurement:{tercId:"t-1",obraId:"o-1",data:"2026-07-05",numero:1,total:800,itens:[{etapaId:"e-1",valor:800,pctAcum:50}]}});
    expect(created.medicoesTerc[0]).toMatchObject({status:"rascunho"});
    expect(selectDRE(buildFinancialLedger(created),{obraId:"o-1",competence:"2026-07"}).costCents).toBe(0);

    const approved=approveThirdPartyMeasurement({data:created,measurementId:"m-1",actor,now:"2026-07-05T12:00:00.000Z"});
    expect(approved.medicoesTerc[0]).toMatchObject({status:"aprovada",aprovadoPorId:"u-1"});
    expect(selectDRE(buildFinancialLedger(approved),{obraId:"o-1",competence:"2026-07"}).costCents).toBe(80000);

    const paid=payThirdPartyMeasurement({data:approved,measurementId:"m-1",actor,id:"p-1",payment:{tercName:"Pedreiro",date:"2026-07-06",pagador:"obra"}});
    const cash=selectCashFlow(buildFinancialLedger(paid),{obraId:"o-1",startDate:"2026-07-01",endDate:"2026-07-31"});
    expect(cash.cashOut).toBe(800);
    expect(selectDRE(buildFinancialLedger(paid),{obraId:"o-1",competence:"2026-07"}).costCents).toBe(80000);
    expect(()=>cancelThirdPartyMeasurement({data:paid,measurementId:"m-1",reason:"Erro",actor})).toThrow("Estorne o pagamento");
  });

  it("aprovar/rejeitar só saem do estado rascunho - nunca 'conserta' um estado inesperado", () => {
    const created=createThirdPartyMeasurement({data:{medicoesTerc:[]},actor,id:"m-1",measurement:{tercId:"t-1",obraId:"o-1",data:"2026-07-05",numero:1,total:800,itens:[{etapaId:"e-1",valor:800,pctAcum:50}]}});
    const approved=approveThirdPartyMeasurement({data:created,measurementId:"m-1",actor});
    expect(()=>approveThirdPartyMeasurement({data:approved,measurementId:"m-1",actor})).toThrow("aguardando aprovação");
    expect(()=>rejectThirdPartyMeasurement({data:approved,measurementId:"m-1",reason:"x",actor})).toThrow("aguardando aprovação");
  });

  it("rejeita a medição com motivo obrigatório, sem afetar o DRE, e permite corrigir e reenviar", () => {
    const created=createThirdPartyMeasurement({data:{medicoesTerc:[]},actor,id:"m-1",measurement:{tercId:"t-1",obraId:"o-1",data:"2026-07-05",numero:1,total:800,itens:[{etapaId:"e-1",valor:800,pctAcum:50}]}});
    expect(()=>rejectThirdPartyMeasurement({data:created,measurementId:"m-1",reason:"",actor})).toThrow("Informe o motivo");

    const rejected=rejectThirdPartyMeasurement({data:created,measurementId:"m-1",reason:"Percentual não confere com a obra",actor,now:"2026-07-05T13:00:00.000Z"});
    expect(rejected.medicoesTerc[0]).toMatchObject({status:"rejeitada",motivoRejeicao:"Percentual não confere com a obra",rejeitadoPorId:"u-1"});
    expect(selectDRE(buildFinancialLedger(rejected),{obraId:"o-1",competence:"2026-07"}).costCents).toBe(0);
    expect(()=>approveThirdPartyMeasurement({data:rejected,measurementId:"m-1",actor})).toThrow("aguardando aprovação");

    const resubmitted=resubmitThirdPartyMeasurement({
      data:rejected,measurementId:"m-1",actor,now:"2026-07-06T09:00:00.000Z",
      measurement:{data:"2026-07-06",total:900,itens:[{etapaId:"e-1",valor:900,pctAcum:60}]},
    });
    expect(resubmitted.medicoesTerc[0]).toMatchObject({
      status:"rascunho",total:900,numero:1,reenviadoPorId:"u-1",
      motivoRejeicao:"Percentual não confere com a obra", // histórico preservado, sem efeito no status atual
    });
    expect(selectDRE(buildFinancialLedger(resubmitted),{obraId:"o-1",competence:"2026-07"}).costCents).toBe(0);
    expect(()=>resubmitThirdPartyMeasurement({data:resubmitted,measurementId:"m-1",actor,measurement:{data:"2026-07-06",total:900,itens:[{etapaId:"e-1",valor:900,pctAcum:60}]}})).toThrow("Só uma medição rejeitada");
  });
});
