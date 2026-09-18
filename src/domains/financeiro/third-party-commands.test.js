import { describe, expect, it } from "vitest";
import { applyThirdPartyCommand, THIRD_PARTY_COMMAND } from "./third-party-commands.js";

const actor={actorId:"u-1",actorName:"Operador"};
const base=()=>({
  usuarios:[{id:"u-1",nome:"Operador",role:"financeiro",active:true}],
  obras:[{id:"o-1",name:"Obra"}],
  terceirizados:[{
    id:"t-1",name:"Prestador",specialty:"pedreiro",obraId:"o-1",active:true,
    etapas:[{id:"e-1",nome:"Fundação",valor:1000}],
  }],
  medicoesTerc:[],pagsTerceiros:[],notasFiscais:[],
  instanciasAprovacao:[],auditoriaAprovacao:[],politicasAprovacao:[],
  fechamentosFinanceiros:[],
});
const command=(type,payload,key="third-party-command-0001",expectedVersion)=>({
  type,payload,idempotencyKey:key,expectedVersion,...actor,
});
const measurement=(overrides={})=>({
  id:"m-1",tercId:"t-1",obraId:"o-1",data:"2026-07-28",
  numero:1,total:500,status:"aprovada",version:1,pagamentoId:"",
  itens:[{etapaId:"e-1",pctAnterior:0,pctAcum:50,valor:500}],
  fotos:[{id:"f-1",url:"https://evidencia"}],...overrides,
});

describe("comandos de terceiros",()=>{
  it("salva etapas no contrato com versão e impede remover etapa já medida",()=>{
    const saved=applyThirdPartyCommand(base(),command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED,{
        contractId:"t-1",stages:[{id:"e-1",nome:"Fundação",valor:1200},{id:"e-2",nome:"Estrutura",valor:800}],
      },"third-party-stages-0001",0,
    ));
    expect(saved.ok).toBe(true);
    expect(saved.data.terceirizados[0]).toMatchObject({version:1,etapas:[
      {id:"e-1",valor:1200,ordem:0},{id:"e-2",valor:800,ordem:1},
    ]});
    const measured={...saved.data,medicoesTerc:[measurement()]};
    expect(applyThirdPartyCommand(measured,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED,{
        contractId:"t-1",stages:[{id:"e-2",nome:"Estrutura",valor:800}],
      },"third-party-stages-0002",1,
    )).reason).toMatch(/já medida/i);
  });
  it("recalcula a medição pelo contrato e bloqueia percentual anterior obsoleto",()=>{
    const created=applyThirdPartyCommand(base(),command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,{
        measurement:measurement({version:undefined}),
      },
    ));
    expect(created.ok).toBe(true);
    expect(created.data.medicoesTerc[0]).toMatchObject({
      total:500,numero:1,version:1,createdById:"u-1",status:"rascunho",
    });
    const stale=applyThirdPartyCommand(created.data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,{
        measurement:measurement({
          id:"m-2",data:"2026-07-29",total:250,
          itens:[{etapaId:"e-1",pctAnterior:0,pctAcum:75,valor:250}],
        }),
      },"third-party-command-0002",
    ));
    expect(stale.ok).toBe(false);
    expect(stale.reason).toMatch(/avanço anterior mudou/i);
  });

  // Achado de 18/09/2026: activeMeasurements precisa continuar contando uma
  // medição "rascunho" (aguardando aprovação) para calcular o percentual
  // anterior/sequência da próxima - sem isso, medição 2 "esquece" que
  // medição 1 (ainda pendente) já avançou até 50%.
  it("uma medição pendente (rascunho) continua servindo de base para a próxima medição do contrato",()=>{
    const created=applyThirdPartyCommand(base(),command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,{measurement:measurement({version:undefined})},
    ));
    expect(created.data.medicoesTerc[0].status).toBe("rascunho");
    const next=applyThirdPartyCommand(created.data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,{
        measurement:measurement({
          id:"m-2",data:"2026-07-29",total:100,
          itens:[{etapaId:"e-1",pctAnterior:50,pctAcum:60,valor:100}],
        }),
      },"third-party-command-0002",
    ));
    expect(next.ok).toBe(true);
    expect(next.data.medicoesTerc[1]).toMatchObject({numero:2,status:"rascunho"});
  });

  it("financeiro aprova a medição pendente, o pagamento passa a ser permitido",()=>{
    const data={...base(),medicoesTerc:[measurement({status:"rascunho"})]};
    expect(applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,{
        measurementId:"m-1",payment:{id:"p-1",date:"2026-07-28",pagador:"obra"},
      },"third-party-payment-0001",1,
    )).reason).toMatch(/ainda não foi aprovada/i);
    const approved=applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_APPROVED,{measurementId:"m-1"},
      "third-party-approve-0001",1,
    ));
    expect(approved.ok).toBe(true);
    expect(approved.data.medicoesTerc[0]).toMatchObject({status:"aprovada",aprovadoPorId:"u-1",version:2});
    const paid=applyThirdPartyCommand(approved.data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,{
        measurementId:"m-1",payment:{id:"p-1",date:"2026-07-28",pagador:"obra"},
      },"third-party-payment-0002",2,
    ));
    expect(paid.ok).toBe(true);
  });

  it("financeiro rejeita com motivo obrigatório; engenheiro corrige e reenvia a mesma medição",()=>{
    const data={...base(),medicoesTerc:[measurement({status:"rascunho"})]};
    expect(applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_REJECTED,{measurementId:"m-1",reason:""},
      "third-party-reject-0001",1,
    )).reason).toMatch(/motivo da rejeição/i);
    const rejected=applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_REJECTED,{measurementId:"m-1",reason:"Percentual não confere"},
      "third-party-reject-0002",1,
    ));
    expect(rejected.ok).toBe(true);
    expect(rejected.data.medicoesTerc[0]).toMatchObject({status:"rejeitada",motivoRejeicao:"Percentual não confere",version:2});

    const resubmitted=applyThirdPartyCommand(rejected.data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RESUBMITTED,{
        measurementId:"m-1",
        measurement:{data:"2026-07-30",total:500,itens:[{etapaId:"e-1",pctAnterior:0,pctAcum:50,valor:500}],fotos:[{id:"f-2"}]},
      },"third-party-resubmit-0001",2,
    ));
    expect(resubmitted.ok).toBe(true);
    expect(resubmitted.data.medicoesTerc[0]).toMatchObject({status:"rascunho",numero:1,version:3,reenviadoPorId:"u-1"});
  });

  it("registra pagamento manual com aprovação criada no servidor",()=>{
    const result=applyThirdPartyCommand(base(),command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_RECORDED,{
        payment:{
          id:"p-1",tercId:"t-1",date:"2026-07-28",amount:300,
          pagador:"empresa",description:"Adiantamento",
        },
      },
    ));
    expect(result.ok).toBe(true);
    expect(result.data.pagsTerceiros[0]).toMatchObject({
      id:"p-1",obraId:"o-1",version:1,origem:"manual_sem_medicao",
      issRetido:0,inssRetido:0,liquido:300,
    });
    expect(result.data.pagsTerceiros[0].aprovacaoInstanciaId).toBeTruthy();
    expect(result.data.instanciasAprovacao).toHaveLength(1);
  });

  it("paga, estorna e libera a medição para novo pagamento",()=>{
    const data={...base(),medicoesTerc:[measurement()]};
    const paid=applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,{
        measurementId:"m-1",
        payment:{id:"p-1",date:"2026-07-28",pagador:"obra"},
      },"third-party-payment-0001",1,
    ));
    expect(paid.ok).toBe(true);
    expect(paid.data.medicoesTerc[0]).toMatchObject({pagamentoId:"p-1",version:2});
    expect(paid.data.pagsTerceiros[0]).toMatchObject({
      medicaoTercId:"m-1",origem:"liquidacao_medicao",version:1,
    });
    const reversed=applyThirdPartyCommand(paid.data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,{
        paymentId:"p-1",reason:"Pagamento duplicado",
      },"third-party-payment-0002",1,
    ));
    expect(reversed.ok).toBe(true);
    expect(reversed.data.pagsTerceiros[0]).toMatchObject({status:"estornado",version:2});
    expect(reversed.data.medicoesTerc[0]).toMatchObject({pagamentoId:"",version:3});
  });

  it("só cancela a última medição ativa e respeita período fechado",()=>{
    const data={...base(),medicoesTerc:[
      measurement(),
      measurement({
        id:"m-2",data:"2026-07-29",numero:2,version:1,total:200,
        itens:[{etapaId:"e-1",pctAnterior:50,pctAcum:70,valor:200}],
      }),
    ]};
    expect(applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED,{
        measurementId:"m-1",reason:"Erro",
      },"third-party-cancel-0001",1,
    )).reason).toMatch(/última medição/i);
    const closed={...data,fechamentosFinanceiros:[{
      status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31",
    }]};
    expect(applyThirdPartyCommand(closed,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED,{
        measurementId:"m-2",reason:"Erro",
      },"third-party-cancel-0002",1,
    )).reason).toMatch(/período financeiro/i);
  });

  it("vincula nota e medição com versões nos dois lados",()=>{
    const data={
      ...base(),medicoesTerc:[measurement()],
      notasFiscais:[{
        id:"nf-1",valorBruto:500,status:"aprovada",version:0,
      }],
    };
    const result=applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_INVOICE_LINKED,{
        measurementId:"m-1",invoiceId:"nf-1",
        expectedMeasurementVersion:1,expectedInvoiceVersion:0,
      },
    ));
    expect(result.ok).toBe(true);
    expect(result.data.medicoesTerc[0]).toMatchObject({notaFiscalId:"nf-1",version:2});
    expect(result.data.notasFiscais[0]).toMatchObject({medicaoTercId:"m-1",obraId:"o-1",version:1});
  });

  it("recusa versões divergentes e pagamentos conciliados",()=>{
    const data={
      ...base(),
      pagsTerceiros:[{
        id:"p-1",obraId:"o-1",tercId:"t-1",date:"2026-07-28",
        amount:100,status:"ativo",version:2,transacaoId:"tx-1",
      }],
    };
    expect(applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,{
        paymentId:"p-1",reason:"Erro",
      },"third-party-reverse-0001",1,
    )).reason).toMatch(/alterado por outra pessoa/i);
    expect(applyThirdPartyCommand(data,command(
      THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,{
        paymentId:"p-1",reason:"Erro",
      },"third-party-reverse-0002",2,
    )).reason).toMatch(/conciliação bancária/i);
  });
});
