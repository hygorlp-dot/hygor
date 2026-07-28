import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectAccountsReceivable, selectCashFlow } from "../financeiro/ledger.js";
import { activateCommercialContract } from "./contract-activation.js";

const now="2026-07-28T12:00:00.000Z";
const actor={id:"u-commercial",nome:"Comercial"};
const ids={
  clientId:"client-1",obraId:"obra-1",saleId:"sale-1",commissionId:"commission-1",
  kickoffId:"meeting-1",postSaleId:"task-1",entryMeasurementId:"entry-1",
  entryReceiptId:"entry-receipt-1",installmentMeasurementIds:["installment-1","installment-2"],
};
const data=()=>({
  usuarios:[
    {id:"eng-1",nome:"Engenheira"},{id:"seller-1",nome:"Vendedora"},
  ],
  obras:[],medicoes:[],
  comercial:{
    leads:[{
      id:"lead-1",nome:"Cliente",tipoPessoa:"PF",telefone:"81999999999",
      email:"cliente@example.com",endereco:"Rua A",cidade:"Caruaru",
      responsavelId:"seller-1",historico:[],
    }],
    propostas:[{id:"proposal-1",status:"aceita"}],
    contratos:[{
      id:"contract-1",numero:"CONT-0001",leadId:"lead-1",propostaId:"proposal-1",
      contratante:"Cliente",valor:100000,entrada:20000,parcelas:2,diaVencimento:5,
      inicio:"2026-08-05",conclusao:"2026-10-05",responsavelComercialId:"seller-1",
      responsavelTecnicoId:"eng-1",status:"assinado",assinadoEm:now,
      documentosRecebidos:true,entradaPaga:true,escopoValidado:true,
      recebimentosEntrada:[{
        id:"bank-receipt-1",valor:20000,data:"2026-07-28",
        origem:"conciliacao_bancaria",transacaoId:"tx-1",
      }],
    }],
    clientes:[],parceiros:[],vendas:[],comissoes:[],atividades:[],reunioes:[],
  },
});

describe("ativação atômica de contrato comercial",()=>{
  it("cria obra, cliente, venda e títulos preservando o recebimento bancário",()=>{
    const result=activateCommercialContract({
      data:data(),contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    });
    expect(result.ok).toBe(true);
    expect(result.data.obras[0]).toMatchObject({
      id:"obra-1",contractValue:100000,engineerId:"eng-1",hasCaixa:true,
    });
    expect(result.data.medicoes).toHaveLength(3);
    expect(result.data.medicoes[0]).toMatchObject({
      id:"entry-1",valorPrevisto:20000,valorRecebido:20000,recebido:true,
      version:1,createdById:"u-commercial",
    });
    expect(result.data.medicoes[0].recebimentos[0]).toMatchObject({
      id:"bank-receipt-1",transacaoId:"tx-1",origem:"conciliacao_bancaria",
    });
    expect(result.data.comercial.contratos[0]).toMatchObject({
      status:"contratado",obraId:"obra-1",clienteId:"client-1",
    });
    expect(result.data.comercial.vendas).toMatchObject([{id:"sale-1",obraId:"obra-1",valor:100000}]);
    expect(result.data.comercial.leads[0]).toMatchObject({status:"ganho",etapa:"transferido"});

    const ledger=buildFinancialLedger(result.data);
    expect(selectCashFlow(ledger,{obraId:"obra-1",startDate:"2026-07-01",endDate:"2026-07-31"}).cashIn).toBe(20000);
    expect(selectAccountsReceivable(ledger,{obraId:"obra-1"}).balanceCents).toBe(8000000);
  });

  it("materializa evidência da entrada quando o contrato só possui a confirmação legada",()=>{
    const initial=data();
    initial.comercial.contratos[0].recebimentosEntrada=[];
    const result=activateCommercialContract({
      data:initial,contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    });
    expect(result.data.medicoes[0].recebimentos).toMatchObject([{
      id:"entry-receipt-1",valor:20000,origem:"confirmacao_comercial",createdById:"u-commercial",
    }]);
  });

  it("recusa contrato incompleto, repetido ou sem identificadores suficientes",()=>{
    const incomplete=data();
    incomplete.comercial.contratos[0].escopoValidado=false;
    expect(activateCommercialContract({
      data:incomplete,contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    }).error).toMatch(/escopo validado/);
    const first=activateCommercialContract({
      data:data(),contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    });
    expect(activateCommercialContract({
      data:first.data,contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    }).error).toMatch(/já foi transferido/);
    expect(activateCommercialContract({
      data:data(),contractId:"contract-1",obraId:"obra-1",
      ids:{...ids,installmentMeasurementIds:[]},actor,now,
    }).error).toMatch(/Identificadores insuficientes/);
    const collision=data();
    collision.obras=[{id:"obra-1",name:"Outra obra"}];
    expect(activateCommercialContract({
      data:collision,contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    }).error).toMatch(/Já existe uma obra/);
    expect(activateCommercialContract({
      data:data(),contractId:"contract-1",obraId:"obra-1",
      ids:{...ids,saleId:"installment-1"},actor,now,
    }).error).toMatch(/identificadores repetidos/);
    const occupied=data();
    occupied.medicoes=[{id:"installment-1",obraId:"obra-x"}];
    expect(activateCommercialContract({
      data:occupied,contractId:"contract-1",obraId:"obra-1",ids,actor,now,
    }).error).toMatch(/já está em uso/);
  });
});
