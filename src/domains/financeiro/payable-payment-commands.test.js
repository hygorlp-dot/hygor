import { describe, expect, it } from "vitest";
import {
  applyPayablePaymentCommand,
  PAYABLE_PAYMENT_COMMAND,
  payablePaymentCommandObraId,
} from "./payable-payment-commands.js";
import { saldoPagamentoNota } from "./payables.js";
import { saldoPagamentoPedido } from "../compras/calculations.js";
import { calculateWorkCash } from "./work-cash.js";

const now="2026-07-28T14:00:00.000Z";
const order={
  id:"p-1",numero:"PC-001",obraId:"o-1",fornecedorId:"f-1",status:"enviado",version:1,
  itens:[{id:"i-1",qtd:10,precoUnit:10}],pagamentos:[],
};
const base=()=>({
  obras:[{id:"o-1",name:"Obra 1",hasCaixa:true}],
  fornecedores:[{id:"f-1",nome:"Fornecedor 1"}],
  pedidos:[order],notasFiscais:[],caixaObra:[],transacoes:[],historicoConc:[],
  fechamentosFinanceiros:[],
});
const command=(type,payload,expectedVersion=1)=>({
  type,idempotencyKey:`payable-command-${type}-${payload.paymentId||payload.payment?.id||"one"}`,
  expectedVersion,actorId:"u-1",actorName:"Ana",payload,
});
const payment=(patch={})=>({
  id:"pg-1",data:"2026-07-28",valor:60,origem:"empresa",
  referencia:"PIX",observacao:"",comprovantes:[],...patch,
});

describe("comandos transacionais de pagamentos de obrigações",()=>{
  it("registra pagamento parcial no pedido com autoria e versão",()=>{
    const result=applyPayablePaymentCommand(base(),command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"pedido",targetId:"p-1",payment:payment()},
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({version:2,origemPagamento:"empresa"});
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({
      id:"pg-1",status:"ativo",version:1,registradoPorId:"u-1",
    });
    expect(saldoPagamentoPedido(result.data.pedidos[0])).toBe(40);
    expect(payablePaymentCommandObraId(result.data,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_REVERSED,
      {targetType:"pedido",targetId:"p-1",paymentId:"pg-1"},
    ))).toBe("o-1");
  });

  it("debita o caixa sem permitir saldo negativo",()=>{
    const withCash={...base(),caixaObra:[
      {id:"a-1",obraId:"o-1",tipo:"aporte",valor:50,data:"2026-07-20",status:"ativo"},
    ]};
    const blocked=applyPayablePaymentCommand(withCash,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"pedido",targetId:"p-1",payment:payment({origem:"caixa_obra"}),workCashMovementId:"cx-1"},
    ),now);
    expect(blocked).toMatchObject({ok:false});
    expect(blocked.reason).toMatch(/saldo suficiente/);
    const enough={...withCash,caixaObra:[
      {id:"a-1",obraId:"o-1",tipo:"aporte",valor:100,data:"2026-07-20",status:"ativo"},
    ]};
    const paid=applyPayablePaymentCommand(enough,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"pedido",targetId:"p-1",payment:payment({origem:"caixa_obra"}),workCashMovementId:"cx-1"},
    ),now);
    expect(paid.ok).toBe(true);
    expect(calculateWorkCash(paid.data,"o-1").saldo).toBe(40);
    expect(paid.data.caixaObra[1]).toMatchObject({pagamentoId:"pg-1",status:"ativo",version:1});
  });

  it("sincroniza nota e pedido vinculado sem duplicar o id financeiro",()=>{
    const data={...base(),notasFiscais:[{
      id:"n-1",numero:"10",obraId:"o-1",pedidoId:"p-1",status:"aprovada",
      valorBruto:100,valorLiquido:100,pagamentos:[],version:1,
    }]};
    const result=applyPayablePaymentCommand(data,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"nota",targetId:"n-1",payment:payment()},
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos[0].id).toBe("pg-1");
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({id:"pg-1",notaFiscalId:"n-1"});
    expect(saldoPagamentoNota(result.data.notasFiscais[0])).toBe(40);
    expect(saldoPagamentoPedido(result.data.pedidos[0])).toBe(40);
  });

  it("valida valor e concilia uma saída bancária existente",()=>{
    const data={...base(),transacoes:[
      {id:"t-1",data:"2026-07-28",valor:-60,status:"pendente",descricao:"PIX"},
    ]};
    const result=applyPayablePaymentCommand(data,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"pedido",targetId:"p-1",payment:payment({transacaoId:"t-1"})},
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.transacoes[0]).toMatchObject({
      status:"conciliado",vinculo:{tipo:"pedido",id:"p-1"},
    });
    expect(result.data.pedidos[0].pagamentos[0].conciliado).toBe(true);
    const mismatch=applyPayablePaymentCommand({
      ...base(),transacoes:[{id:"t-2",data:"2026-07-28",valor:-55,status:"pendente"}],
    },command(PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,{
      targetType:"pedido",targetId:"p-1",payment:payment({transacaoId:"t-2"}),
    }),now);
    expect(mismatch.reason).toMatch(/diverge/);
  });

  it("reclassifica a origem preservando o movimento anterior como estornado",()=>{
    const paid=applyPayablePaymentCommand({
      ...base(),caixaObra:[{id:"a-1",obraId:"o-1",tipo:"aporte",valor:100,data:"2026-07-20",status:"ativo"}],
    },command(PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,{
      targetType:"pedido",targetId:"p-1",payment:payment({origem:"caixa_obra"}),workCashMovementId:"cx-1",
    }),now);
    const result=applyPayablePaymentCommand(paid.data,command(
      PAYABLE_PAYMENT_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED,
      {targetType:"pedido",targetId:"p-1",paymentId:"pg-1",newOrigin:"cliente_direto",adjustmentId:"aj-1"},
      2,
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({
      origem:"cliente_direto",origemAnterior:"caixa_obra",version:2,
    });
    expect(result.data.caixaObra.find(item=>item.id==="cx-1").status).toBe("estornado");
    expect(calculateWorkCash(result.data,"o-1").saldo).toBe(100);
  });

  it("estorna logicamente pagamento e saída do caixa",()=>{
    const paid=applyPayablePaymentCommand({
      ...base(),caixaObra:[{id:"a-1",obraId:"o-1",tipo:"aporte",valor:100,data:"2026-07-20",status:"ativo"}],
    },command(PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,{
      targetType:"pedido",targetId:"p-1",payment:payment({origem:"caixa_obra"}),workCashMovementId:"cx-1",
    }),now);
    const result=applyPayablePaymentCommand(paid.data,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_REVERSED,
      {targetType:"pedido",targetId:"p-1",paymentId:"pg-1",reason:"Duplicado",adjustmentId:"aj-2"},
      2,
    ),now);
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({
      status:"estornado",motivoEstorno:"Duplicado",version:2,
    });
    expect(saldoPagamentoPedido(result.data.pedidos[0])).toBe(100);
    expect(calculateWorkCash(result.data,"o-1").saldo).toBe(100);
  });

  it("bloqueia estorno conciliado e período fechado",()=>{
    const reconciled={...base(),pedidos:[{
      ...order,pagamentos:[payment({transacaoId:"t-1",conciliado:true,status:"ativo",version:1})],
      version:2,
    }],transacoes:[{id:"t-1",data:"2026-07-28",valor:-60,status:"conciliado"}]};
    const blocked=applyPayablePaymentCommand(reconciled,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_REVERSED,
      {targetType:"pedido",targetId:"p-1",paymentId:"pg-1",reason:"Erro"},2,
    ),now);
    expect(blocked.reason).toMatch(/Desfaça a conciliação/);
    const closed={...base(),fechamentosFinanceiros:[{
      id:"f-1",status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31",
    }]};
    const record=applyPayablePaymentCommand(closed,command(
      PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED,
      {targetType:"pedido",targetId:"p-1",payment:payment()},
    ),now);
    expect(record.reason).toMatch(/fechado/);
  });
});
