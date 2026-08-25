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

  test("recusa baixa para uma obrigação que não existe mais",()=>{
    const data=fixture();
    const result=applyReconciliationCommand(data,{type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"debit",targetType:"nota",targetId:"nota-apagada"}},actor);
    expect(result.resumo).toMatchObject({ok:false,motivo:"Nota fiscal não encontrado"});
    expect(result.data).toBe(data);
    expect(result.data.transacoes.find(item=>item.id==="debit")?.status).toBe("pendente");
  });

  test("confirma pagamento pelo valor do extrato, sem aceitar valor do navegador",()=>{
    const result=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"debit",targetType:"nota",targetId:"n1",valor:1}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos[0].valor).toBe(300);
  });

  // Achado de 25/08/2026: pagamento a terceiro sem obra validada sempre
  // caía como custo da empresa no DRE. targetObraId corrige isso, mas só
  // quando aponta para uma obra que realmente existe (mesma cautela de
  // knownWorks em allocateTransaction) - um id inventado é ignorado, nunca
  // persistido cru.
  test("confirma pagamento a terceiro usando a obra informada, quando ela existe",()=>{
    const data={...fixture(),obras:[{id:"obra-77",name:"Obra 77"}],terceirizados:[{id:"tc1",nome:"João",obraId:"obra-77"}]};
    const result=applyReconciliationCommand(data,{type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"debit",targetType:"terceiro",targetId:"tc1",targetObraId:"obra-77"}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.pagsTerceiros[0].obraId).toBe("obra-77");
  });

  test("ignora targetObraId que não corresponde a nenhuma obra existente",()=>{
    const data={...fixture(),obras:[{id:"obra-77",name:"Obra 77"}],terceirizados:[{id:"tc1",nome:"João",obraId:"obra-77"}]};
    const result=applyReconciliationCommand(data,{type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"debit",targetType:"terceiro",targetId:"tc1",targetObraId:"obra-inventada"}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.pagsTerceiros[0].obraId).toBeFalsy();
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

  test("concilia PIX de mão de obra com funcionário, obra e valor do extrato",()=>{
    const data={
      ...fixture(),
      obras:[{id:"alphaville",nome:"ALPHAVILLE"}],
      transacoes:[{id:"pix-jose",valor:-1000,data:"2026-07-20",status:"pendente",descricao:"Pix enviado: José Silva de Lima"}],
    };
    const result=applyReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,
      payload:{
        transactionId:"pix-jose",
        allocations:[{destination:"obra",obraId:"alphaville",category:"mao_obra",value:1000}],
        worker:{employeeId:"jose-henrique",employeeName:"JOSÉ HENRIQUE DE LIRA LIMA",pixHolder:"José Silva de Lima"},
      },
    },actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.transacoes[0]).toMatchObject({
      status:"conciliado",
      recebedorMaoObra:{
        employeeId:"jose-henrique",
        employeeName:"JOSÉ HENRIQUE DE LIRA LIMA",
        pixHolder:"José Silva de Lima",
        valorPago:1000,
      },
    });
    expect(result.data.outrasDesp[0]).toMatchObject({
      obraId:"alphaville",
      categoria:"mao_obra",
      valor:1000,
      transacaoId:"pix-jose",
    });
  });

  test("entrada rateada para a empresa permanece caixa não alocado, sem estornar custo",()=>{
    const result=applyReconciliationCommand(fixture(),{type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,payload:{transactionId:"credit",allocations:[{destination:"empresa",category:"aporte",value:500}]}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.payments).toMatchObject([{obraId:"",amount:500,transacaoId:"credit"}]);
    expect(result.data.despesasEmpresa).toEqual([]);
  });
});
