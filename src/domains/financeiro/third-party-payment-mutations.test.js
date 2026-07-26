import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectCashFlow, selectDRE } from "./ledger";
import { createThirdPartyPayment, reverseThirdPartyPayment } from "./third-party-payment-mutations";

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
});
