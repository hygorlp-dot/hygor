import { describe, expect, test } from "vitest";
import { applyReconciliationCommand, RECONCILIATION_COMMAND } from "./reconciliation-command.js";

const actor={id:"f1",nome:"Financeiro"};
const fixture=()=>({
  transacoes:[
    {id:"credit",valor:500,data:"2026-07-25",status:"pendente"},
    {id:"debit",valor:-300,data:"2026-07-25",status:"pendente"},
  ],
  medicoes:[{id:"m1",obraId:"obra",valorPrevisto:700,recebimentos:[]}],
  notasFiscais:[{id:"n1",valorLiquido:300,pagamentos:[]}],pedidos:[],historicoConc:[],
  outrasDesp:[],despesasEmpresa:[],payments:[],caixaObra:[],pagsTerceiros:[],medicoesTerc:[],pagamentosFolha:[],comercial:{contratos:[]},
});

describe("reconciliation command server boundary",()=>{
  test("confirma uma medição a partir do valor autoritativo da entrada",()=>{
    const result=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_RECEIPT,payload:{transactionId:"credit",targetType:"medicao",targetId:"m1",observacao:"PIX"}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.medicoes[0].recebimentos[0].valor).toBe(500);
    expect(result.data.transacoes[0].status).toBe("conciliado");
  });

  test("recusa usar saída como recebimento e não muda o dado",()=>{
    const data=fixture();
    const result=applyReconciliationCommand(data,{type:RECONCILIATION_COMMAND.CONFIRM_RECEIPT,payload:{transactionId:"debit",targetType:"medicao",targetId:"m1"}},actor);
    expect(result.resumo.ok).toBe(false);
    expect(result.data).toBe(data);
  });

  test("confirma pagamento pelo valor do extrato, sem aceitar valor do navegador",()=>{
    const result=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"debit",targetType:"nota",targetId:"n1",valor:1}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos[0].valor).toBe(300);
  });

  test("exige motivo para reverter uma conciliação",()=>{
    const first=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_RECEIPT,payload:{transactionId:"credit",targetType:"medicao",targetId:"m1"}},actor);
    const result=applyReconciliationCommand(first.data,{type:RECONCILIATION_COMMAND.REVERSE_RECONCILIATION,payload:{transactionId:"credit"}},actor);
    expect(result.resumo.ok).toBe(false);
    expect(result.data.transacoes[0].status).toBe("conciliado");
  });

  test("fecha rateio em centavos e recusa obra que não pertence ao servidor",()=>{
    const data={...fixture(),obras:[{id:"obra"}]};
    const ok=applyReconciliationCommand(data,{type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,payload:{transactionId:"debit",allocations:[{destination:"obra",obraId:"obra",category:"material",value:300}]}},actor);
    expect(ok.resumo.ok).toBe(true);
    expect(ok.data.outrasDesp[0]).toMatchObject({obraId:"obra",valor:300,transacaoId:"debit"});
    const invalid=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,payload:{transactionId:"debit",allocations:[{destination:"obra",obraId:"forjada",category:"material",value:300}]}},actor);
    expect(invalid.resumo.ok).toBe(false);
  });
});
