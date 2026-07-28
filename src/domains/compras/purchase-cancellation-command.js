import { active } from "../financeiro/ledger.js";
import { cancelWorkCashMovementFromPayment } from "../financeiro/work-cash-commands.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { totalPagoPedido } from "./calculations.js";

export const PURCHASE_CANCELLATION_COMMAND=Object.freeze({
  PURCHASE_CANCELLED:"COMPRA_CANCELADA",
});
export const PURCHASE_CANCELLATION_COMMAND_TYPES=
  new Set(Object.values(PURCHASE_CANCELLATION_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const movementOfOrder=(movement,order)=>
  movement?.pedidoId===order.id||
  (!movement?.pedidoId&&movement?.obraId===order.obraId&&movement?.tipo==="entrada"
    &&String(movement?.descricao||"").startsWith(`Pedido ${order.numero}`));

export const purchaseCancellationCommandObraId=(data={},command={})=>
  String((data.pedidos||[]).find(item=>item.id===command.payload?.orderId)?.obraId||"");

export const applyPurchaseCancellationCommand=(
  data={},command={},now=new Date().toISOString(),
)=>{
  if(!PURCHASE_CANCELLATION_COMMAND_TYPES.has(command.type))return null;
  const actor={id:String(command.actorId||""),nome:String(command.actorName||"")};
  if(!actor.id)return fail("Sessão do usuário indisponível para cancelar a compra.");
  const orderId=String(command.payload?.orderId||"");
  const order=(data.pedidos||[]).find(item=>String(item.id)===orderId);
  if(!order)return fail("Pedido de compra não encontrado.");
  if(order.status==="cancelado"||order.deletedAt!=null||order.ativo===false){
    return fail("Esta compra já está cancelada.");
  }
  if(command.expectedVersion!=null&&versionOf(order)!==Number(command.expectedVersion)){
    return fail("A compra foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
  }
  const reason=String(command.payload?.reason||"").trim();
  if(!reason)return fail("Informe o motivo do cancelamento da compra.");
  if(isDateInClosedPeriod(data,order.data)){
    return fail("O período financeiro desta compra está fechado.");
  }

  const invoicePaymentIds=new Set((data.notasFiscais||[])
    .flatMap(invoice=>(invoice.pagamentos||[]).filter(active).map(payment=>payment.id))
    .filter(Boolean));
  const directPayments=(order.pagamentos||[])
    .filter(payment=>active(payment)&&!invoicePaymentIds.has(payment.id)&&!payment.notaFiscalId);
  for(const payment of directPayments){
    const transaction=(data.transacoes||[])
      .find(item=>String(item.id)===String(payment.transacaoId||""));
    if(transaction?.status==="conciliado"){
      return fail("Desfaça a conciliação dos pagamentos deste pedido antes de cancelar a compra.");
    }
    if(isDateInClosedPeriod(data,payment.data)){
      return fail("Um pagamento desta compra pertence a período financeiro fechado.");
    }
  }

  const userName=actor.nome||"Usuário autenticado";
  let next=data;
  for(const payment of directPayments){
    const movement=(next.caixaObra||[]).find(item=>
      active(item)&&item.pedidoId===order.id&&!item.notaFiscalId&&item.pagamentoId===payment.id);
    if(!movement)continue;
    const cancelled=cancelWorkCashMovementFromPayment(next,{
      movementId:movement.id,paymentId:payment.id,
      reason:`Compra cancelada: ${reason}`,actor,now,
    });
    if(!cancelled.ok)return cancelled;
    next=cancelled.data;
  }

  const directPaymentIds=new Set(directPayments.map(item=>item.id));
  const payments=(order.pagamentos||[]).map(payment=>!directPaymentIds.has(payment.id)?payment:{
    ...payment,status:"estornado",motivoEstorno:`Compra cancelada: ${reason}`,
    estornadoEm:now,estornadoPorId:actor.id,estornadoPor:userName,
    updatedAt:now,updatedById:actor.id,updatedBy:userName,version:versionOf(payment)+1,
  });
  const stockMovements=(next.movEstoque||[]).map(movement=>!movementOfOrder(movement,order)
    ?movement:{
      ...movement,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,
      canceladoPorId:actor.id,canceladoPor:userName,version:versionOf(movement)+1,
    });
  // Movimento antigo sem pagamentoId também precisa perder efeito, mas nunca
  // é removido do histórico.
  const workCash=(next.caixaObra||[]).map(movement=>
    movement.pedidoId!==order.id||movement.notaFiscalId||!active(movement)
      ?movement:{
        ...movement,status:"estornado",motivoCancelamento:`Compra cancelada: ${reason}`,
        canceladoEm:now,canceladoPorId:actor.id,canceladoPor:userName,
        updatedAt:now,updatedById:actor.id,updatedBy:userName,version:versionOf(movement)+1,
      });
  const invoices=(next.notasFiscais||[]).map(invoice=>invoice.pedidoId!==order.id?invoice:{
    ...invoice,pedidoId:"",
    divergencias:[...new Set([
      ...(invoice.divergencias||[]),
      `O pedido ${order.numero} vinculado a esta nota foi cancelado pelo setor de Compras.`,
    ])],
    atualizadoEm:now,version:versionOf(invoice)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:userName,
  });
  const requests=(next.solicitacoesCompra||[]).map(request=>request.pedidoId!==order.id?request:{
    ...request,status:"enviada",pedidoId:"",analisadoEm:"",analisadoPor:"",
    version:versionOf(request)+1,updatedAt:now,updatedById:actor.id,updatedBy:userName,
  });
  const quotes=(next.cotacoes||[]).map(quote=>quote.pedidoId!==order.id?quote:{
    ...quote,status:"aberta",pedidoId:"",escolhida:"",
    decididoPorId:"",decididoPorNome:"",decididoEm:"",justificativaEscolha:"",
    version:versionOf(quote)+1,updatedAt:now,updatedById:actor.id,updatedBy:userName,
  });
  const impact={
    pagamentos:directPayments.length,valorPago:totalPagoPedido(order),
    recebimentos:(order.itens||[]).reduce((sum,item)=>sum+(item.recebimentos||[]).length,0),
    movimentosEstoque:(next.movEstoque||[]).filter(item=>movementOfOrder(item,order)).length,
    movimentosCaixa:(next.caixaObra||[])
      .filter(item=>item.pedidoId===order.id&&!item.notaFiscalId).length,
    notasFiscais:(next.notasFiscais||[]).filter(item=>item.pedidoId===order.id).length,
  };
  const cancelledOrder={
    ...order,pagamentos:payments,status:"cancelado",canceladoEm:now,
    canceladoPorId:actor.id,canceladoPor:userName,motivoCancelamento:reason,
    impactoCancelamento:impact,version:versionOf(order)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:userName,
  };
  return {
    ok:true,entityId:order.id,impact,
    data:{
      ...next,pedidos:(next.pedidos||[]).map(item=>item.id===order.id?cancelledOrder:item),
      movEstoque:stockMovements,caixaObra:workCash,notasFiscais:invoices,
      solicitacoesCompra:requests,cotacoes:quotes,
    },
  };
};
