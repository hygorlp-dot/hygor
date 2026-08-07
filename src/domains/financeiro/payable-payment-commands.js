import {
  saldoPagamentoPedido,
  totalPedido,
  totalPagoPedido,
} from "../compras/calculations.js";
import { vincularPagamentoExistente } from "../conciliacao/mutations.js";
import { active } from "./ledger.js";
import { saldoPagamentoNota, totalPagoNota } from "./payables.js";
import {
  applyWorkCashCommand,
  cancelWorkCashMovementFromPayment,
  WORK_CASH_COMMAND,
} from "./work-cash-commands.js";
import { isDateInClosedPeriod } from "./workflows.js";
import { workCashIsEnabled } from "./work-cash.js";

export const PAYABLE_PAYMENT_COMMAND=Object.freeze({
  PAYABLE_PAYMENT_RECORDED:"PAGAMENTO_OBRIGACAO_REGISTRADO",
  PURCHASE_PAYMENT_RECLASSIFIED:"PAGAMENTO_COMPRA_RECLASSIFICADO",
  PAYABLE_PAYMENT_REVERSED:"PAGAMENTO_OBRIGACAO_ESTORNADO",
});
export const PAYABLE_PAYMENT_COMMAND_TYPES=new Set(Object.values(PAYABLE_PAYMENT_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const validOrigin=value=>["empresa","caixa_obra","cliente_direto"].includes(value);
const collections={pedido:"pedidos",nota:"notasFiscais"};
const targetBy=(data,type,id)=>(data?.[collections[type]]||[]).find(item=>String(item.id)===String(id));
const paymentBy=(target,id)=>(target?.pagamentos||[]).find(item=>String(item.id)===String(id));
const replace=(items,id,value)=>(items||[]).map(item=>String(item.id)===String(id)?value:item);
const activePayments=target=>(target?.pagamentos||[]).filter(active);
const totalOf=(type,target)=>type==="nota"
  ?Number(target?.valorLiquido||target?.valorBruto||0):totalPedido(target);
const paidOf=(type,target)=>type==="nota"?totalPagoNota(target):totalPagoPedido(target);
const balanceOf=(type,target)=>type==="nota"?saldoPagamentoNota(target):saldoPagamentoPedido(target);
const actorOf=command=>({id:String(command.actorId||""),nome:String(command.actorName||"")});
const actorName=actor=>actor.nome||"Usuário autenticado";
const paymentIdUsed=(data,id)=>
  [...(data?.pedidos||[]),...(data?.notasFiscais||[])]
    .some(target=>(target.pagamentos||[]).some(payment=>String(payment.id)===id));
const transactionUsed=(data,id)=>
  [...(data?.pedidos||[]),...(data?.notasFiscais||[])]
    .some(target=>activePayments(target).some(payment=>String(payment.transacaoId||"")===id));
const updateWorkspace=(data,obraId,workspace)=>{
  if(!workspace||typeof workspace!=="object")return data;
  return {
    ...data,
    obras:(data.obras||[]).map(obra=>String(obra.id)!==String(obraId)?obra:{
      ...obra,
      oneDriveDriveId:String(workspace.driveId||obra.oneDriveDriveId||""),
      oneDriveFolderId:String(workspace.folderId||obra.oneDriveFolderId||""),
      oneDriveFolders:workspace.folders&&typeof workspace.folders==="object"
        ?workspace.folders:obra.oneDriveFolders,
      oneDriveUrl:String(workspace.webUrl||obra.oneDriveUrl||""),
    }),
  };
};
const updateTarget=(data,type,id,value)=>({
  ...data,[collections[type]]:replace(data[collections[type]],id,value),
});
const cashMovementForPayment=(data,paymentId)=>
  (data?.caixaObra||[]).find(item=>String(item.pagamentoId||"")===String(paymentId)&&active(item));
const transactionForPayment=(data,payment)=>
  payment?.transacaoId?(data?.transacoes||[]).find(item=>String(item.id)===String(payment.transacaoId)):null;
const blockLinkedTransaction=(data,payment)=>
  transactionForPayment(data,payment)?.status==="conciliado"
    ?"Desfaça a conciliação bancária antes de reclassificar ou estornar este pagamento.":"";

export const payablePaymentCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  const type=payload.targetType||"pedido";
  return String(targetBy(data,type,payload.targetId)?.obraId||payload.obraId||"");
};

const appendAdjustment=(target,{id,reason,summary,actor,now})=>({
  ...target,
  ajustes:[...(target.ajustes||[]),{
    id,motivo:reason,usuarioId:actor.id,usuario:actorName(actor),criadoEm:now,
    totalAnterior:totalOf("pedido",target),totalNovo:totalOf("pedido",target),resumo:summary,
  }],
});

const buildPayment=(raw,actor,now)=>({
  ...raw,
  id:String(raw.id||""),data:String(raw.data||""),valor:Number(raw.valor),
  origem:String(raw.origem||""),conciliado:Boolean(raw.transacaoId)&&raw.origem==="empresa",
  transacaoId:raw.origem==="empresa"?String(raw.transacaoId||""):"",
  referencia:String(raw.referencia||""),observacao:String(raw.observacao||""),
  comprovantes:Array.isArray(raw.comprovantes)?raw.comprovantes:[],
  status:"ativo",version:1,
  registradoPorId:actor.id,registradoPor:actorName(actor),registradoEm:now,
  updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
});

const updatePaidTarget=(type,target,payment,actor,now)=>{
  const payments=[...(target.pagamentos||[]),payment];
  const paid=type==="nota"
    ?payments.filter(active).reduce((sum,item)=>sum+Number(item.valor||0),0)
    :payments.filter(active).reduce((sum,item)=>sum+Number(item.valor||0),0);
  const settled=paid>=totalOf(type,target)-0.01;
  if(type==="nota")return {
    ...target,pagamentos:payments,status:settled?"paga":"aprovada",
    transacaoId:payment.transacaoId||target.transacaoId||"",
    atualizadoEm:now,version:versionOf(target)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
  };
  return {
    ...target,pagamentos:payments,origemPagamento:payment.origem,
    liberadoEntregaEm:settled?now:target.liberadoEntregaEm||"",
    liberadoEntregaPor:settled?actorName(actor):target.liberadoEntregaPor||"",
    version:versionOf(target)+1,updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
  };
};

const validateBase=({data,command,target,type,actor})=>{
  if(!actor.id)return "Sessão do usuário indisponível para registrar o pagamento.";
  if(!collections[type])return "Tipo de obrigação inválido.";
  if(!target)return "A obrigação financeira não foi encontrada.";
  if(!active(target))return "A obrigação está cancelada ou inativa.";
  if(command.expectedVersion!=null&&versionOf(target)!==Number(command.expectedVersion)){
    return "A obrigação foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.";
  }
  return "";
};

const recordPayment=(data,command,now)=>{
  const payload=command.payload||{},type=payload.targetType;
  const target=targetBy(data,type,payload.targetId),actor=actorOf(command);
  const baseError=validateBase({data,command,target,type,actor});
  if(baseError)return fail(baseError);
  if(type==="nota"&&!["aprovada","paga"].includes(String(target.status||""))){
    return fail("A nota fiscal precisa estar aprovada antes do pagamento.");
  }
  const raw=payload.payment||{},id=String(raw.id||""),value=Number(raw.valor);
  if(!id)return fail("Pagamento sem identificação.");
  if(paymentIdUsed(data,id))return fail("Já existe um pagamento com esta identificação.");
  if(!validDate(raw.data))return fail("Informe uma data válida para o pagamento.");
  if(isDateInClosedPeriod(data,raw.data))return fail("O período financeiro deste pagamento está fechado.");
  if(!(value>0)||!Number.isFinite(value))return fail("Informe um valor positivo para o pagamento.");
  if(value>balanceOf(type,target)+0.01)return fail("O pagamento supera o saldo da obrigação.");
  if(!validOrigin(raw.origem))return fail("Origem do pagamento inválida.");

  const transactionId=String(raw.transacaoId||"");
  if(transactionId){
    if(raw.origem!=="empresa")return fail("Somente pagamentos da conta da empresa podem usar uma transação bancária.");
    const transaction=(data.transacoes||[]).find(item=>String(item.id)===transactionId);
    if(!transaction)return fail("A transação bancária selecionada não existe.");
    if(transaction.status==="conciliado"||transactionUsed(data,transactionId)){
      return fail("A transação bancária já está conciliada.");
    }
    if(Number(transaction.valor)>=0)return fail("O pagamento precisa ser vinculado a uma saída bancária.");
    if(Math.abs(Math.abs(Number(transaction.valor||0))-value)>0.02){
      return fail("O valor da transação bancária diverge do pagamento.");
    }
  }

  if(raw.origem==="caixa_obra"&&!workCashIsEnabled(data,target.obraId))return fail("O caixa desta obra não está ativado.");
  if(raw.origem==="caixa_obra"&&!String(payload.workCashMovementId||"")){
    return fail("O pagamento pelo caixa precisa identificar seu movimento.");
  }

  const payment=buildPayment(raw,actor,now);
  let next=updateWorkspace(data,target.obraId,payload.workspace);
  const current=targetBy(next,type,target.id);
  next=updateTarget(next,type,target.id,updatePaidTarget(type,current,payment,actor,now));

  if(type==="nota"&&target.pedidoId){
    const order=targetBy(next,"pedido",target.pedidoId);
    if(order&&active(order)){
      const orderValue=Math.min(value,balanceOf("pedido",order));
      if(orderValue>0.001){
        const orderPayment={...payment,valor:orderValue,notaFiscalId:target.id};
        next=updateTarget(next,"pedido",order.id,updatePaidTarget("pedido",order,orderPayment,actor,now));
      }
    }
  }

  if(payment.origem==="caixa_obra"){
    const supplier=type==="nota"
      ?target.fornecedorNome||"Fornecedor"
      :(data.fornecedores||[]).find(item=>item.id===target.fornecedorId)?.nome||"Fornecedor";
    const cashResult=applyWorkCashCommand(next,{
      type:WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      actorId:actor.id,actorName:actor.nome,
      payload:{movement:{
        id:String(payload.workCashMovementId),obraId:target.obraId,data:payment.data,
        tipo:"despesa",categoria:type==="nota"?(target.categoria||"outros"):"material",
        descricao:type==="nota"
          ?`Pagamento ${target.numero||"de nota fiscal"} · ${supplier}`
          :`Pagamento do pedido ${target.numero||target.id} · ${supplier}`,
        valor:payment.valor,comprovante:payment.comprovantes[0]?.legenda||payment.referencia||"",
        pedidoId:type==="pedido"?target.id:target.pedidoId||"",
        notaFiscalId:type==="nota"?target.id:"",
        pagamentoId:payment.id,documentos:payment.comprovantes,
      }},
    },now);
    if(!cashResult?.ok)return cashResult||fail("Não foi possível registrar a saída no caixa da obra.");
    next=cashResult.data;
  }

  if(payment.transacaoId){
    const category=type==="nota"?(target.categoria||"outros"):"material";
    next={...next,transacoes:(next.transacoes||[]).map(item=>
      item.id===payment.transacaoId&&!item.rateios?.length
        ?{...item,rateios:[{destino:"obra",obraId:target.obraId,categoria:category,valor:Math.abs(Number(item.valor||value))}]}
        :item)};
    const linked=vincularPagamentoExistente(next,{
      transacaoId:payment.transacaoId,tipo:type==="nota"?"nota_fiscal":"pedido",
      entidadeId:target.id,pagamentoId:payment.id,operador:actor,observacao:payment.referencia,
    });
    if(!linked.resumo?.ok)return fail(linked.resumo?.motivo||"Não foi possível conciliar o pagamento.");
    next=linked.data;
  }

  return {ok:true,data:next,entityId:payment.id};
};

const reclassifyPayment=(data,command,now)=>{
  const payload=command.payload||{},type=payload.targetType||"pedido";
  const target=targetBy(data,type,payload.targetId),actor=actorOf(command);
  const baseError=validateBase({data,command,target,type,actor});
  if(baseError)return fail(baseError);
  const payment=paymentBy(target,payload.paymentId);
  if(!payment||!active(payment))return fail("Pagamento não encontrado ou já estornado.");
  const newOrigin=String(payload.newOrigin||"");
  if(!validOrigin(newOrigin))return fail("Nova origem do pagamento inválida.");
  if(payment.origem===newOrigin)return {ok:true,data,entityId:payment.id};
  const transactionError=blockLinkedTransaction(data,payment);
  if(transactionError&&newOrigin!=="empresa")return fail(transactionError);
  if(newOrigin==="caixa_obra"&&!workCashIsEnabled(data,target.obraId))return fail("O caixa desta obra não está ativado.");
  if(newOrigin==="caixa_obra"&&!String(payload.workCashMovementId||"")){
    return fail("A reclassificação para o caixa precisa identificar seu movimento.");
  }

  let next=data;
  const oldCash=cashMovementForPayment(next,payment.id);
  if(oldCash){
    const cashCancelled=cancelWorkCashMovementFromPayment(next,{
      movementId:oldCash.id,paymentId:payment.id,
      reason:"Origem do pagamento reclassificada.",actor,now,
    });
    if(!cashCancelled?.ok)return cashCancelled;
    next=cashCancelled.data;
  }
  if(newOrigin==="caixa_obra"){
    const supplier=type==="nota"
      ?target.fornecedorNome||"Fornecedor"
      :(data.fornecedores||[]).find(item=>item.id===target.fornecedorId)?.nome||"Fornecedor";
    const cashCreated=applyWorkCashCommand(next,{
      type:WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      actorId:actor.id,actorName:actor.nome,
      payload:{movement:{
        id:String(payload.workCashMovementId),obraId:target.obraId,data:payment.data,
        tipo:"despesa",categoria:type==="nota"?(target.categoria||"outros"):"material",
        descricao:type==="nota"
          ?`Pagamento ${target.numero||"de nota fiscal"} · ${supplier}`
          :`Pagamento do pedido ${target.numero||target.id} · ${supplier}`,
        valor:Number(payment.valor||0),comprovante:payment.comprovantes?.[0]?.legenda||payment.referencia||"",
        pedidoId:type==="pedido"?target.id:target.pedidoId||"",
        notaFiscalId:type==="nota"?target.id:"",
        pagamentoId:payment.id,documentos:payment.comprovantes||[],
        reclassificadoEm:now,
      }},
    },now);
    if(!cashCreated?.ok)return cashCreated;
    next=cashCreated.data;
  }
  const current=targetBy(next,type,target.id);
  const changedPayment={
    ...payment,origem:newOrigin,conciliado:newOrigin==="empresa"&&!!payment.transacaoId,
    origemAnterior:payment.origem,reclassificadoEm:now,reclassificadoPorId:actor.id,
    reclassificadoPor:actorName(actor),updatedAt:now,updatedById:actor.id,
    updatedBy:actorName(actor),version:versionOf(payment)+1,
  };
  let changedTarget={
    ...current,
    pagamentos:replace(current.pagamentos,payment.id,changedPayment),
    origemPagamento:newOrigin,version:versionOf(current)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
  };
  if(type==="pedido")changedTarget=appendAdjustment(changedTarget,{
    id:String(payload.adjustmentId||`ajuste-${payment.id}`),
    reason:`Origem do pagamento alterada para ${newOrigin}.`,
    summary:"Reclassificação auditável da origem do pagamento.",
    actor,now,
  });
  next=updateTarget(next,type,target.id,changedTarget);
  if(type==="nota"&&target.pedidoId){
    const order=targetBy(next,"pedido",target.pedidoId);
    const linked=paymentBy(order,payment.id);
    if(linked)next=updateTarget(next,"pedido",order.id,{
      ...order,pagamentos:replace(order.pagamentos,payment.id,{...linked,...changedPayment,valor:linked.valor}),
      origemPagamento:newOrigin,version:versionOf(order)+1,updatedAt:now,
      updatedById:actor.id,updatedBy:actorName(actor),
    });
  }
  return {ok:true,data:next,entityId:payment.id};
};

const reversePayment=(data,command,now)=>{
  const payload=command.payload||{},type=payload.targetType||"pedido";
  const target=targetBy(data,type,payload.targetId),actor=actorOf(command);
  const baseError=validateBase({data,command,target,type,actor});
  if(baseError)return fail(baseError);
  const payment=paymentBy(target,payload.paymentId);
  if(!payment||!active(payment))return fail("Pagamento não encontrado ou já estornado.");
  const reason=String(payload.reason||"").trim();
  if(!reason)return fail("Informe o motivo do estorno do pagamento.");
  if(isDateInClosedPeriod(data,payment.data))return fail("O período financeiro deste pagamento está fechado.");
  const transactionError=blockLinkedTransaction(data,payment);
  if(transactionError)return fail(transactionError);
  const reversed={
    ...payment,status:"estornado",motivoEstorno:reason,estornadoEm:now,
    estornadoPorId:actor.id,estornadoPor:actorName(actor),
    updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),version:versionOf(payment)+1,
  };
  let next=data;
  const current=targetBy(next,type,target.id);
  const projectedPayments=replace(current.pagamentos,payment.id,reversed);
  const projectedPaid=projectedPayments.filter(active).reduce((sum,item)=>sum+Number(item.valor||0),0);
  const settled=projectedPaid>=totalOf(type,current)-0.01;
  let changed={
    ...current,pagamentos:projectedPayments,version:versionOf(current)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
  };
  if(type==="nota")changed={...changed,status:settled?"paga":"aprovada",atualizadoEm:now};
  else changed={
    ...changed,
    liberadoEntregaEm:settled?(current.liberadoEntregaEm||now):"",
    liberadoEntregaPor:settled?(current.liberadoEntregaPor||actorName(actor)):"",
  };
  if(type==="pedido")changed=appendAdjustment(changed,{
    id:String(payload.adjustmentId||`ajuste-${payment.id}`),
    reason:`Pagamento estornado: ${reason}`,
    summary:"Estorno lógico de pagamento no Financeiro de Compras.",actor,now,
  });
  next=updateTarget(next,type,target.id,changed);
  if(type==="nota"&&target.pedidoId){
    const order=targetBy(next,"pedido",target.pedidoId);
    const linked=paymentBy(order,payment.id);
    if(linked){
      const linkedReversed={...linked,...reversed,valor:linked.valor};
      const orderPayments=replace(order.pagamentos,payment.id,linkedReversed);
      const orderSettled=orderPayments.filter(active).reduce((sum,item)=>sum+Number(item.valor||0),0)>=totalPedido(order)-0.01;
      next=updateTarget(next,"pedido",order.id,{
        ...order,pagamentos:orderPayments,version:versionOf(order)+1,
        liberadoEntregaEm:orderSettled?(order.liberadoEntregaEm||now):"",
        liberadoEntregaPor:orderSettled?(order.liberadoEntregaPor||actorName(actor)):"",
        updatedAt:now,updatedById:actor.id,updatedBy:actorName(actor),
      });
    }
  }
  const cash=cashMovementForPayment(next,payment.id);
  if(cash){
    const cancelled=cancelWorkCashMovementFromPayment(next,{
      movementId:cash.id,paymentId:payment.id,
      reason:`Pagamento estornado: ${reason}`,actor,now,
    });
    if(!cancelled?.ok)return cancelled;
    next=cancelled.data;
  }
  return {ok:true,data:next,entityId:payment.id};
};

export const applyPayablePaymentCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PAYABLE_PAYMENT_COMMAND_TYPES.has(command.type))return null;
  if(command.type===PAYABLE_PAYMENT_COMMAND.PAYABLE_PAYMENT_RECORDED){
    return recordPayment(data,command,now);
  }
  if(command.type===PAYABLE_PAYMENT_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED){
    return reclassifyPayment(data,command,now);
  }
  return reversePayment(data,command,now);
};
