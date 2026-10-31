// Conferência pedido × recebimento × nota antes de pagar (C1.4).
//
// O pagamento de um pedido fica coberto até o que já foi conferido: o menor
// valor entre o material recebido e as notas fiscais lançadas para o pedido,
// mais uma tolerância. Acima disso é adiantamento: permitido (sinal é comum
// em obra), com avisos e motivo recomendado. As permissões são da fronteira
// de comando, sem nova trava de aprovação neste cálculo.
import { analyzePurchaseThreeWayMatch } from "../financeiro/workflows.js";
import { active, toCents } from "../financeiro/ledger.js";
import {operationalWarning} from './workflow-advisories.js';

export const TOLERANCIA_CONFERENCIA_PADRAO=Object.freeze({percentual:2,valor:50});
export const PAPEIS_ADIANTAMENTO_COMPRA=Object.freeze(["admin","financeiro"]);

export const toleranciaConferencia=data=>{
  const config=data?.configCompras?.toleranciaConferencia||{};
  const percentual=Number(config.percentual);
  const valor=Number(config.valor);
  return {
    percentual:Number.isFinite(percentual)&&percentual>=0?percentual:TOLERANCIA_CONFERENCIA_PADRAO.percentual,
    valor:Number.isFinite(valor)&&valor>=0?valor:TOLERANCIA_CONFERENCIA_PADRAO.valor,
  };
};

// Quanto do pedido pode ser pago sem ser adiantamento, em centavos.
export const conferenciaPagamentoPedido=(data,pedidoId)=>{
  const order=(data?.pedidos||[]).find(item=>String(item.id)===String(pedidoId));
  if(!order)return null;
  const match=analyzePurchaseThreeWayMatch(data,order.id);
  const {percentual,valor}=toleranciaConferencia(data);
  const conferidoCents=Math.min(match.receivedCents||0,match.invoicedCents||0,match.orderedCents||0);
  const toleranciaCents=Math.max(Math.round((match.orderedCents||0)*percentual/100),toCents(valor));
  const pagoCents=(order.pagamentos||[]).filter(active).reduce((sum,item)=>sum+toCents(item.valor),0);
  return {
    status:match.status,orderedCents:match.orderedCents,receivedCents:match.receivedCents,
    invoicedCents:match.invoicedCents,conferidoCents,toleranciaCents,pagoCents,
    liberadoCents:Math.max(0,conferidoCents+toleranciaCents-pagoCents),
  };
};

// Valida um novo pagamento do pedido. Devolve o erro, ou os campos que marcam
// o pagamento como adiantamento quando ele passa do conferido.
export const avaliarPagamentoPedido=(data,{pedidoId,valor,adiantamento,motivo,actorRole})=>{
  const conferencia=conferenciaPagamentoPedido(data,pedidoId);
  if(!conferencia)return {error:"Pedido não encontrado."};
  const valorCents=toCents(valor);
  if(valorCents<=conferencia.liberadoCents)return {campos:{tipo:"conferido",workflowWarnings:[]},conferencia,warnings:[]};
  const justificativa=String(motivo||"").trim();
  const warnings=[operationalWarning('PAYMENT_AHEAD_OF_CONFERENCE','pagamento','Financeiro','Pagamento anterior à conferência completa de entrega e nota.','Confira o adiantamento e regularize a entrega e o documento fiscal; a pendência não impede o registro.')];
  if(!justificativa)warnings.push(operationalWarning('ADVANCE_REASON_MISSING','pagamento','Responsável pelo pagamento','O adiantamento está sem motivo informado.','Complete a observação do pagamento para explicar a antecipação.'));
  return {campos:{tipo:"adiantamento",motivoAdiantamento:justificativa,
    conferidoNoPagamentoCents:conferencia.conferidoCents,workflowWarnings:warnings},conferencia,warnings};
};
