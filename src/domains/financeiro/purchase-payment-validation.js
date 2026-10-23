import {active} from "./ledger.js";
import {saldoPagamentoPedido} from "../compras/calculations.js";
import {saldoPagamentoNota} from "./payables.js";
import {avaliarPagamentoPedido} from "../compras/payment-conference.js";

export const validatePurchasePayment=(data,{type,target,value,adiantamento,motivo,actorRole})=>{
  if(!target||!active(target))return {error:"A obrigação está cancelada ou inativa."};
  if(!(value>0)||!Number.isFinite(value))return {error:"Informe um valor positivo para o pagamento."};
  if(type==="nota"&&!["aprovada","paga"].includes(String(target.status||"")))return {error:"A nota fiscal precisa estar aprovada antes do pagamento."};
  const balance=type==="nota"?saldoPagamentoNota(target):saldoPagamentoPedido(target);
  if(value>balance+0.01)return {error:"O pagamento supera o saldo da obrigação."};
  return type==="pedido"?avaliarPagamentoPedido(data,{pedidoId:target.id,valor:value,adiantamento,motivo,actorRole}):{campos:{}};
};
