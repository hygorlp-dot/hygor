// Comandos de conciliação executados exclusivamente sobre a fotografia
// autoritativa do servidor. O navegador informa a intenção e os IDs; ele não
// envia nem recompõe o blob financeiro inteiro.
import {
  criarLancamentoPelaTransacao,
  desfazerConciliacao,
  marcarEstorno,
  marcarTransferenciaInterna,
  registrarPagamentoEConciliar,
  vincularPagamentoExistente,
} from "../src/domains/conciliacao/mutations.js";

export const RECONCILIATION_COMMAND = Object.freeze({
  CONFIRM_RECEIPT: "CONFIRM_RECEIPT",
  CONFIRM_MANUAL_ENTRY: "CONFIRM_MANUAL_ENTRY",
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  LINK_EXISTING_PAYMENT: "LINK_EXISTING_PAYMENT",
  CONFIRM_TRANSFER: "CONFIRM_TRANSFER",
  CONFIRM_REVERSAL: "CONFIRM_REVERSAL",
  REVERSE_RECONCILIATION: "REVERSE_RECONCILIATION",
});

const findTransaction = (data, id) => (data?.transacoes || []).find(item => String(item.id) === String(id));
const positiveId = value => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200;
const text = value => String(value || "").trim().slice(0, 500);

const invalid = (data, motivo) => ({ data, resumo: { ok:false, motivo } });

const mustBePending = (data, transactionId, sign) => {
  const transaction=findTransaction(data, transactionId);
  if(!transaction)return { error:"Transação não encontrada." };
  if(transaction.status!=="pendente")return { error:"A transação já não está pendente para conciliação." };
  if(sign && Math.sign(Number(transaction.valor||0))!==sign)return { error:sign>0?"Esta ação exige uma entrada bancária.":"Esta ação exige uma saída bancária." };
  return { transaction };
};

// Todas as liquidações simples usam o valor integral do movimento importado.
// Um rateio parcial deve passar pelo comando N:N, que confere os centavos e
// mantém saldo explícito — nunca por um campo numérico livre na interface.
const transactionAmount = transaction => Math.abs(Number(transaction?.valor || 0));

export const applyReconciliationCommand = (data, command = {}, actor = {}) => {
  const payload=command.payload || {};
  const transactionId=String(payload.transactionId || "");
  if(!positiveId(transactionId))return invalid(data,"Identificador da transação inválido.");

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_RECEIPT){
    const checked=mustBePending(data,transactionId,1);
    if(checked.error)return invalid(data,checked.error);
    if(!["medicao","entradaContrato"].includes(payload.targetType))return invalid(data,"Origem de recebimento inválida.");
    if(!positiveId(payload.targetId))return invalid(data,"Selecione a parcela, medição ou contrato.");
    return registrarPagamentoEConciliar(data,{
      transacaoId:transactionId,tipo:payload.targetType,entidadeId:payload.targetId,
      valor:transactionAmount(checked.transaction),dataPagamento:checked.transaction.data,
      observacao:text(payload.observacao),operador:actor,
    });
  }

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_MANUAL_ENTRY){
    const checked=mustBePending(data,transactionId,1);
    if(checked.error)return invalid(data,checked.error);
    const allowed=new Set(["recebimento_administracao","recebimento_avulso","adiantamento","entrada_caixa_obra","aporte_socio","emprestimo","outra_entrada"]);
    if(!allowed.has(payload.entryType))return invalid(data,"Tipo de entrada manual inválido.");
    if(["recebimento_administracao","entrada_caixa_obra"].includes(payload.entryType)&&!positiveId(payload.obraId))return invalid(data,"Selecione a obra que recebeu o valor.");
    return criarLancamentoPelaTransacao(data,{
      transacaoId:transactionId,tipoLancamento:payload.entryType,obraId:payload.obraId||"",
      categoria:text(payload.categoria)||"outros",descricao:text(payload.descricao),operador:actor,duplicidadeRevisada:true,
    });
  }

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_PAYMENT){
    const checked=mustBePending(data,transactionId,-1);
    if(checked.error)return invalid(data,checked.error);
    if(!["nota","pedido","medicaoTerc","terceiro","funcionario","tituloFolha"].includes(payload.targetType))return invalid(data,"Origem de pagamento inválida.");
    if(!positiveId(payload.targetId))return invalid(data,"Selecione a obrigação a pagar.");
    return registrarPagamentoEConciliar(data,{
      transacaoId:transactionId,tipo:payload.targetType,entidadeId:payload.targetId,
      valor:transactionAmount(checked.transaction),dataPagamento:checked.transaction.data,
      observacao:text(payload.observacao),operador:actor,
    });
  }

  if(command.type===RECONCILIATION_COMMAND.LINK_EXISTING_PAYMENT){
    const checked=mustBePending(data,transactionId);
    if(checked.error)return invalid(data,checked.error);
    if(!positiveId(payload.targetType)||!positiveId(payload.targetId))return invalid(data,"Vínculo financeiro inválido.");
    return vincularPagamentoExistente(data,{transacaoId:transactionId,tipo:payload.targetType,entidadeId:payload.targetId,pagamentoId:payload.paymentId||"",observacao:text(payload.observacao),operador:actor});
  }

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_TRANSFER){
    const origin=mustBePending(data,transactionId);
    if(origin.error)return invalid(data,origin.error);
    if(!positiveId(payload.counterpartyTransactionId))return invalid(data,"Selecione a outra ponta da transferência.");
    return marcarTransferenciaInterna(data,{transacaoOrigemId:transactionId,transacaoDestinoId:payload.counterpartyTransactionId,operador:actor});
  }

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_REVERSAL){
    const checked=mustBePending(data,transactionId);
    if(checked.error)return invalid(data,checked.error);
    return marcarEstorno(data,{transacaoId:transactionId,transacaoOrigemId:payload.originalTransactionId||"",operador:actor});
  }

  if(command.type===RECONCILIATION_COMMAND.REVERSE_RECONCILIATION){
    const transaction=findTransaction(data,transactionId);
    if(!transaction)return invalid(data,"Transação não encontrada.");
    const reason=text(payload.reason);
    if(!reason)return invalid(data,"Informe o motivo do estorno da conciliação.");
    return desfazerConciliacao(data,transactionId,actor,reason);
  }

  return invalid(data,"Comando de conciliação inválido.");
};
