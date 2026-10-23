import { active } from "../financeiro/ledger.js";
import { calcSaldos, custoMedioPonderado, saldoDe } from "../estoque/calculations.js";
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
// Movimentos antigos não guardavam pedidoId; o vínculo era a descrição
// "Pedido <número> · <fornecedor>". Comparar só o prefixo "Pedido PC-1"
// também pegaria "Pedido PC-12", então o número precisa terminar ali.
export const movementOfOrder=(movement,order)=>{
  if(movement?.pedidoId)return movement.pedidoId===order.id;
  if(movement?.obraId!==order.obraId||movement?.tipo!=="entrada")return false;
  const description=String(movement?.descricao||""),label=`Pedido ${order.numero}`;
  return description===label||description.startsWith(`${label} ·`);
};

// Cancelar a entrada de material que a obra já consumiu deixaria o estoque
// negativo, coisa que o consumo e a perda já recusam. Primeiro a obra
// devolve ou ajusta o estoque; depois a compra pode ser cancelada.
const consumedStock=(before,after)=>{
  const saldosAntes=calcSaldos(before),saldosDepois=calcSaldos(after);
  return after.filter((movement,index)=>movement!==before[index]).find(movement=>{
    const depois=saldoDe(saldosDepois,movement.obraId,movement.materialId);
    return depois<-1e-6&&depois<saldoDe(saldosAntes,movement.obraId,movement.materialId)-1e-6;
  });
};

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
  const stockMovements=(next.movEstoque||[]).map(movement=>!movementOfOrder(movement,order)||!active(movement)
    ?movement:{
      ...movement,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,
      canceladoPorId:actor.id,canceladoPor:userName,version:versionOf(movement)+1,
    });
  if(consumedStock(next.movEstoque||[],stockMovements)){
    return fail("Parte do material desta compra já foi consumida na obra. Registre a devolução ou o ajuste de estoque antes de cancelar a compra.");
  }
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
  // Pedidos irmãos (mesmo mapa de cotação) que seguem vivos mantêm a
  // solicitação atendida; só os itens deste pedido voltam a ficar pendentes.
  const siblingAlive=id=>{
    const sibling=(next.pedidos||[]).find(item=>String(item.id)===String(id));
    return sibling&&String(sibling.id)!==String(order.id)&&sibling.status!=="cancelado";
  };
  const requests=(next.solicitacoesCompra||[]).map(request=>{
    const linked=request.pedidoId===order.id||(request.pedidoIds||[]).includes(order.id);
    if(!linked)return request;
    const remaining=(request.pedidoIds||[]).filter(siblingAlive);
    const stamp={version:versionOf(request)+1,updatedAt:now,updatedById:actor.id,updatedBy:userName};
    if(remaining.length)return {...request,...stamp,pedidoId:remaining[0],
      pedidoIds:(request.pedidoIds||[]).filter(id=>id!==order.id)};
    return {...request,...stamp,status:"enviada",pedidoId:"",analisadoEm:"",analisadoPor:"",
      ...(request.pedidoIds?{pedidoIds:[]}:{})};
  });
  const quotes=(next.cotacoes||[]).map(quote=>{
    if(Array.isArray(quote.itens)&&quote.itens.length&&(quote.pedidoIds||[]).includes(order.id)){
      const decisoes=Object.fromEntries(Object.entries(quote.decisoes||{})
        .filter(([,decision])=>decision?.pedidoId!==order.id));
      const pedidoIds=(quote.pedidoIds||[]).filter(id=>id!==order.id);
      return {...quote,status:"aberta",decisoes,pedidoIds,
        economia:Object.values(decisoes).reduce((sum,decision)=>sum+Number(decision?.economia||0),0),
        pedidoId:quote.pedidoId===order.id?(pedidoIds[0]||""):quote.pedidoId,
        version:versionOf(quote)+1,updatedAt:now,updatedById:actor.id,updatedBy:userName};
    }
    return quote.pedidoId!==order.id?quote:{
      ...quote,status:"aberta",pedidoId:"",escolhida:"",
      decididoPorId:"",decididoPorNome:"",decididoEm:"",justificativaEscolha:"",
      version:versionOf(quote)+1,updatedAt:now,updatedById:actor.id,updatedBy:userName,
    };
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
  // O custo médio sai das entradas ativas: sem as desta compra, recalcula.
  // Sem nenhuma entrada restante, fica o valor cadastrado.
  const affectedMaterials=new Set(stockMovements
    .filter((movement,index)=>movement!==(next.movEstoque||[])[index]).map(movement=>movement.materialId));
  const materials=(next.materiais||[]).map(material=>{
    if(!affectedMaterials.has(material.id))return material;
    const average=custoMedioPonderado(stockMovements,material.id);
    return average==null?material:{...material,precoMedio:average};
  });
  return {
    ok:true,entityId:order.id,impact,
    data:{
      ...next,pedidos:(next.pedidos||[]).map(item=>item.id===order.id?cancelledOrder:item),
      movEstoque:stockMovements,caixaObra:workCash,notasFiscais:invoices,
      solicitacoesCompra:requests,cotacoes:quotes,
      ...(next.materiais?{materiais:materials}:{}),
    },
  };
};
