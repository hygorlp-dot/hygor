import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectAccountsReceivable, selectDRE } from "./ledger";
import { cancelClientMeasurement, saveClientMeasurement, saveGeneratedClientMeasurements } from "./measurement-mutations";

describe("mutações auditáveis de medições financeiras", () => {
  const actor={id:"u-1",nome:"Controladora"};
  const input={obraId:"obra-1",competencia:"2026-07",tipo:"livre",valorPrevisto:1000,percentualAcumulado:0,percentualPeriodo:0,descricao:"Parcela julho"};

  it("cria medição auditável e reconhece receita/conta a receber uma única vez", () => {
    const data=saveClientMeasurement({data:{medicoes:[]},measurement:input,actor,id:"m-1",now:"2026-07-01T10:00:00.000Z"});
    expect(data.medicoes[0]).toMatchObject({id:"m-1",status:"emitida",origem:"medicao_manual",createdById:"u-1",version:1});
    const ledger=buildFinancialLedger(data);
    expect(selectDRE(ledger,{obraId:"obra-1",competence:"2026-07"}).revenueCents).toBe(100000);
    expect(selectAccountsReceivable(ledger,{obraId:"obra-1",asOfDate:"2026-07-31"}).balanceCents).toBe(100000);
  });

  it("preserva recebimento e bloqueia mudança financeira posterior", () => {
    const data=saveClientMeasurement({data:{medicoes:[]},measurement:{...input,recebido:true,valorRecebido:1000,dataPagamento:"2026-07-05"},actor,id:"m-1",receiptId:"r-1"});
    expect(data.medicoes[0].recebimentos[0]).toMatchObject({id:"r-1",createdById:"u-1",valor:1000});
    expect(()=>saveClientMeasurement({data,measurement:{...input,valorPrevisto:1200,recebido:true},actor,id:"m-1"})).toThrow("já possui recebimento");
    expect(()=>cancelClientMeasurement({data,measurementId:"m-1",reason:"Erro",actor})).toThrow("Estorne os recebimentos");
  });

  it("cancela somente medição sem recebimento e a remove do razão sem apagar o fato", () => {
    const data=saveClientMeasurement({data:{medicoes:[]},measurement:input,actor,id:"m-1"});
    const canceled=cancelClientMeasurement({data,measurementId:"m-1",reason:"Duplicidade",actor,now:"2026-07-02T10:00:00.000Z"});
    expect(canceled.medicoes[0]).toMatchObject({status:"cancelada",motivoCancelamento:"Duplicidade",canceladoPorId:"u-1"});
    expect(selectDRE(buildFinancialLedger(canceled),{obraId:"obra-1",competence:"2026-07"}).revenueCents).toBe(0);
  });

  it("regenera parcelas por cancelamento lógico, com autoria e sem duplicar receita", () => {
    const existing={id:"old-1",obraId:"obra-1",competencia:"2026-07",dataVencimento:"2026-07-10",numeroParcela:1,tipo:"mensal_fixo",valorPrevisto:1000,status:"emitida",origem:"geracao_contrato"};
    const data=saveGeneratedClientMeasurements({data:{medicoes:[existing]},obraId:"obra-1",overwrite:true,actor,now:"2026-07-01T10:00:00.000Z",measurements:[{id:"new-1",competencia:"2026-07",dataVencimento:"2026-07-10",numeroParcela:1,tipo:"mensal_fixo",valorPrevisto:1200}]});
    expect(data.medicoes).toHaveLength(2);
    expect(data.medicoes.find(item=>item.id==="old-1")).toMatchObject({status:"cancelada",canceladoPorId:"u-1"});
    expect(data.medicoes.find(item=>item.id==="new-1")).toMatchObject({status:"emitida",origem:"geracao_contrato",createdById:"u-1"});
    expect(selectDRE(buildFinancialLedger(data),{obraId:"obra-1",competence:"2026-07"}).revenueCents).toBe(120000);
  });

  it("bloqueia regeneração quando uma parcela a substituir já foi recebida", () => {
    const existing={id:"old-1",obraId:"obra-1",competencia:"2026-07",dataVencimento:"2026-07-10",numeroParcela:1,tipo:"mensal_fixo",valorPrevisto:1000,status:"emitida",recebimentos:[{id:"r-1",valor:1000,data:"2026-07-10"}]};
    expect(()=>saveGeneratedClientMeasurements({data:{medicoes:[existing]},obraId:"obra-1",overwrite:true,actor,measurements:[{id:"new-1",competencia:"2026-07",dataVencimento:"2026-07-10",numeroParcela:1,valorPrevisto:1000}]})).toThrow("já possuem recebimento");
  });

  it("preserva arquivada no razão, mas bloqueia sua reescrita operacional", () => {
    const archived={
      id:"m-arq",obraId:"obra-1",competencia:"2026-07",valorPrevisto:750,
      status:"arquivada",recebimentos:[],
    };
    expect(selectDRE(buildFinancialLedger({medicoes:[archived]}),{
      obraId:"obra-1",competence:"2026-07",
    }).revenueCents).toBe(75000);
    expect(()=>saveClientMeasurement({
      data:{medicoes:[archived]},measurement:{...input,valorPrevisto:800},actor,id:"m-arq",
    })).toThrow("Não é permitido editar");
  });

  it("ignora todas as variantes de estorno ao conferir recebimentos", () => {
    const measurement={
      ...input,id:"m-1",status:"emitida",recebimentos:[
        {id:"r-1",valor:1000,data:"2026-07-10",status:"ESTORNADA"},
      ],valorRecebido:0,
    };
    expect(()=>cancelClientMeasurement({
      data:{medicoes:[measurement]},measurementId:"m-1",reason:"Duplicidade",actor,
    })).not.toThrow();
  });
});
