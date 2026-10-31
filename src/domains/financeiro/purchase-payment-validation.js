import {active} from "./ledger.js";
import {saldoPagamentoPedido} from "../compras/calculations.js";
import {saldoPagamentoNota} from "./payables.js";
import {avaliarPagamentoPedido} from "../compras/payment-conference.js";
import {operationalWarning} from '../compras/workflow-advisories.js';

export const validatePurchasePayment=(data,{type,target,value,adiantamento,motivo,actorRole})=>{
  if(!target||!active(target)&&!(type==='pedido'&&target.status==='rascunho'&&target.ativo!==false&&!target.deletedAt))return {error:"A obrigação está cancelada ou inativa."};
  if(!(value>0)||!Number.isFinite(value))return {error:"Informe um valor positivo para o pagamento."};
  const balance=type==="nota"?saldoPagamentoNota(target):saldoPagamentoPedido(target);
  if(value>balance+0.01)return {error:"O pagamento supera o saldo da obrigação."};
  if(type==='pedido')return avaliarPagamentoPedido(data,{pedidoId:target.id,valor:value,adiantamento,motivo,actorRole});
  const pending=target.conferenciaFiscalPendente||!['aprovada','paga'].includes(String(target.status||''));
  const warnings=pending?[operationalWarning('INVOICE_REVIEW_PENDING','documento','Financeiro / conferência fiscal','Pagamento com conferência fiscal pendente.','Revise a ficha fiscal e registre a decisão. Pagar não aprova a nota automaticamente.')]:[];
  const order=(data.pedidos||[]).find(item=>String(item.id)===String(target.pedidoId)&&String(item.obraId)===String(target.obraId));
  const invoicePayments=new Set((target.pagamentos||[]).filter(active).map(item=>String(item.id)));
  if((order?.pagamentos||[]).some(item=>active(item)&&!invoicePayments.has(String(item.id))))warnings.push(operationalWarning('ORDER_PAYMENTS_TO_REVIEW','pagamento','Financeiro','O pedido já tem pagamentos que não estão vinculados a esta nota.','Confira os adiantamentos antes de registrar outro pagamento real. Não repita o mesmo fato nem associe apenas por valor ou descrição.'));
  return {campos:{conferenciaFiscalPendente:pending,workflowWarnings:warnings},warnings};
};
