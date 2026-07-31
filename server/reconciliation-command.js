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
import { aplicarRecebimentoMedicao } from "../src/domains/conciliacao/calculations.js";

export const RECONCILIATION_COMMAND = Object.freeze({
  CONFIRM_RECEIPT: "CONFIRM_RECEIPT",
  CONFIRM_MANUAL_ENTRY: "CONFIRM_MANUAL_ENTRY",
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  LINK_EXISTING_PAYMENT: "LINK_EXISTING_PAYMENT",
  CONFIRM_TRANSFER: "CONFIRM_TRANSFER",
  CONFIRM_REVERSAL: "CONFIRM_REVERSAL",
  CONFIRM_ALLOCATION: "CONFIRM_ALLOCATION",
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
const commandId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;

const allocateTransaction = (data, transaction, payload, actor) => {
  const allocations=Array.isArray(payload.allocations)?payload.allocations:[];
  if(!allocations.length)return invalid(data,"Informe ao menos um destino para o rateio.");
  const normalized=allocations.map(item=>({
    destination:item?.destination==="empresa"?"empresa":"obra",obraId:String(item?.obraId||""),
    category:text(item?.category)||"outros",value:Number(item?.value||0),
  }));
  if(normalized.some(item=>!(item.value>0)))return invalid(data,"Todo rateio precisa ter valor maior que zero.");
  if(normalized.some(item=>item.destination==="obra"&&!positiveId(item.obraId)))return invalid(data,"Selecione a obra de cada rateio.");
  const amountInCents=Math.round(transactionAmount(transaction)*100);
  const allocatedInCents=normalized.reduce((sum,item)=>sum+Math.round(item.value*100),0);
  if(allocatedInCents!==amountInCents)return invalid(data,"O rateio não fecha exatamente o valor do extrato.");
  const knownWorks=new Set((data.obras||[]).map(work=>String(work.id)));
  if(normalized.some(item=>item.destination==="obra"&&!knownWorks.has(item.obraId)))return invalid(data,"Uma obra selecionada não existe mais no servidor.");

  const isIncome=Number(transaction.valor)>0;
  const measurementId=String(payload.measurementId||"");
  const measurement=measurementId?(data.medicoes||[]).find(item=>String(item.id)===measurementId):null;
  if(measurementId&&!measurement)return invalid(data,"A medição selecionada não existe mais.");
  if(measurement&&(!normalized.some(item=>item.destination==="obra"&&item.obraId===String(measurement.obraId))))return invalid(data,"A medição deve ser rateada para a própria obra.");

  const newOtherExpenses=[];const newCompanyExpenses=[];const newReceipts=[];const generated=[];
  normalized.forEach(item=>{
    if(isIncome&&measurement&&item.destination==="obra"&&item.obraId===String(measurement.obraId))return;
    const id=commandId("alloc");
    if(item.destination==="obra"){
      if(isIncome){newReceipts.push({id,obraId:item.obraId,date:transaction.data,amount:item.value,description:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),tipo:"recebimento_avulso",origem:"conciliacao_bancaria",transacaoId:transaction.id,conciliado:true,registradoPorId:actor?.id||"",registradoPor:actor?.nome||actor?.email||"Operador",registradoEm:new Date().toISOString()});generated.push({tipo:"payments",id,entidadeId:id});}
      else {newOtherExpenses.push({id,obraId:item.obraId,competencia:String(transaction.data||"").slice(0,7),data:transaction.data,dataPagamento:transaction.data,pago:true,categoria:item.category,descricao:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),valor:item.value,transacaoId:transaction.id});generated.push({tipo:"outrasDesp",id,entidadeId:id});}
    }else{
      // Crédito sem obra/medição é caixa ainda não alocado, não estorno de
      // despesa. Estornar custo para representar uma entrada aumentaria o DRE
      // sem receita por competência correspondente.
      if(isIncome){
        newReceipts.push({id,obraId:"",date:transaction.data,amount:item.value,description:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),tipo:"recebimento_avulso",origem:"conciliacao_bancaria",transacaoId:transaction.id,conciliado:true,registradoPorId:actor?.id||"",registradoPor:actor?.nome||actor?.email||"Operador",registradoEm:new Date().toISOString()});
        generated.push({tipo:"payments",id,entidadeId:id});
      }else{
        newCompanyExpenses.push({id,competencia:String(transaction.data||"").slice(0,7),data:transaction.data,dataPagamento:transaction.data,pago:true,categoria:item.category,descricao:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),valor:item.value,recorrente:false,transacaoId:transaction.id});
        generated.push({tipo:"despesasEmpresa",id,entidadeId:id});
      }
    }
  });
  const receiptId=measurement?commandId("rec"):"";
  const medicoes=measurement?(data.medicoes||[]).map(item=>String(item.id)===measurementId
    ?aplicarRecebimentoMedicao(item,{id:receiptId,valor:transactionAmount(transaction),data:transaction.data,origem:"conciliacao_bancaria",transacaoId:transaction.id,actor})
    :item):(data.medicoes||[]);
  if(measurement)generated.push({tipo:"recebimentoMedicao",id:receiptId,entidadeId:measurement.id});
  const worker=payload.worker&&positiveId(payload.worker.employeeId)?{
    employeeId:String(payload.worker.employeeId),employeeName:text(payload.worker.employeeName),pixHolder:text(payload.worker.pixHolder),valorPago:transactionAmount(transaction),
    confirmadoEm:new Date().toISOString(),confirmadoPorId:actor?.id||"",confirmadoPor:actor?.nome||actor?.email||"Operador",
  }:null;
  const automaticRule=payload.autoRule&&normalized.length===1&&text(payload.autoRule.pattern)?{
    id:commandId("rule"),nome:text(payload.autoRule.name)||`Regra ${text(payload.autoRule.pattern)}`,
    padrao:text(payload.autoRule.pattern),destino:normalized[0].destination,obraId:normalized[0].obraId,
    categoria:normalized[0].category,ativa:true,criadoPorId:actor?.id||"",criadoPor:actor?.nome||actor?.email||"Operador",criadoEm:new Date().toISOString(),
  }:null;
  const transactions=(data.transacoes||[]).map(item=>String(item.id)===String(transaction.id)?{
    ...item,status:"conciliado",rateios:normalized,gerados:generated,vinculo:measurement?{tipo:"medicao",id:measurement.id}:null,recebedorMaoObra:worker,
    statusAtualizadoEm:new Date().toISOString(),statusAtualizadoPorId:actor?.id||"",statusAtualizadoPor:actor?.nome||actor?.email||"Operador",
  }:item);
  const historico=[...(data.historicoConc||[]),{id:commandId("hist"),criadoEm:new Date().toISOString(),transacaoId:transaction.id,extratoId:transaction.extratoId,acao:"conciliada",statusAnterior:transaction.status,statusNovo:"conciliado",descricao:measurement?`Medição ${measurement.descricao||measurement.id} conciliada`:`${normalized.length} rateio(s) confirmado(s)`,valor:transaction.valor,operadorId:actor?.id||"",operador:actor?.nome||actor?.email||"Operador"}];
  return {data:{...data,transacoes:transactions,medicoes,outrasDesp:[...(data.outrasDesp||[]),...newOtherExpenses],despesasEmpresa:[...(data.despesasEmpresa||[]),...newCompanyExpenses],payments:[...(data.payments||[]),...newReceipts],regrasConc:automaticRule?[...(data.regrasConc||[]),automaticRule]:(data.regrasConc||[]),historicoConc:historico},resumo:{ok:true,criados:generated,vinculo:measurement?{tipo:"medicao",id:measurement.id}:null}};
};

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

  if(command.type===RECONCILIATION_COMMAND.CONFIRM_ALLOCATION){
    const checked=mustBePending(data,transactionId);
    if(checked.error)return invalid(data,checked.error);
    return allocateTransaction(data,checked.transaction,payload,actor);
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
