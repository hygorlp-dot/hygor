import { criarFilaAutomatica, comandoAutomaticoSeguro, REGRA_AUTOMATICA } from "../src/domains/conciliacao/automation.js";
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
import { aplicarRecebimentoMedicao, totalRecebidoMedicao } from "../src/domains/conciliacao/calculations.js";
import { active } from "../src/domains/financeiro/ledger.js";
import { activeCashAllocations, applyCashAllocation, reconciliationHold } from "../src/domains/conciliacao/cash-allocations.js";
import { findReconciliationCategory } from "../src/domains/conciliacao/categories.js";
import { isCompetenceInClosedPeriod, isDateInClosedPeriod } from "../src/domains/financeiro/workflows.js";
import { saldoTituloFolha } from "../src/domains/conciliacao/payroll.js";

export const RECONCILIATION_COMMAND = Object.freeze({
  AUTO_MATCH: "AUTO_MATCH",
  CONFIRM_RECEIPT: "CONFIRM_RECEIPT",
  CONFIRM_MANUAL_ENTRY: "CONFIRM_MANUAL_ENTRY",
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  LINK_EXISTING_PAYMENT: "LINK_EXISTING_PAYMENT",
  CONFIRM_TRANSFER: "CONFIRM_TRANSFER",
  CONFIRM_REVERSAL: "CONFIRM_REVERSAL",
  CONFIRM_ALLOCATION: "CONFIRM_ALLOCATION",
  REVERSE_RECONCILIATION: "REVERSE_RECONCILIATION",
  LINK_PARTIAL_CASH: "LINK_PARTIAL_CASH",
  REVERSE_PARTIAL_CASH: "REVERSE_PARTIAL_CASH",
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
  const isIncome=Number(transaction.valor)>0;
  const direction=isIncome?"entrada":"saida";
  const competence=String(payload.competence||transaction.data?.slice(0,7)||"");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))return invalid(data,"Informe uma competência válida para o lançamento.");
  if(isDateInClosedPeriod(data,transaction.data))return invalid(data,"O período da data bancária está fechado. Reabra o fechamento antes de conciliar.");
  if(allocations.some(item=>!item||!["obra","empresa"].includes(item.destination)))return invalid(data,"Selecione um destino válido para cada rateio.");
  const normalized=allocations.map(item=>({
    destination:item.destination,obraId:item.destination==="obra"?String(item.obraId||""):"",
    category:isIncome&&["aporte","outros"].includes(item.category)?(item.category==="aporte"?"aporte_cliente":"outros_recursos"):(text(item.category)||(isIncome?"receita":"outros")),value:Number(item.value||0),
  }));
  if(normalized.some(item=>!(item.value>0)||!Number.isFinite(item.value)||!Number.isSafeInteger(Math.round(item.value*100))||Math.abs(item.value*100-Math.round(item.value*100))>0.000001))return invalid(data,"Todo rateio precisa ter valor válido, maior que zero e com até dois decimais.");
  const categories=normalized.map(item=>findReconciliationCategory(data,{direction,destination:item.destination,category:item.category}));
  if(categories.some(category=>!category))return invalid(data,"Selecione uma categoria válida para a direção e o destino do movimento.");
  if(normalized.some(item=>item.destination==="obra"&&!positiveId(item.obraId)))return invalid(data,"Selecione a obra de cada rateio.");
  const amountInCents=Math.round(transactionAmount(transaction)*100);
  if(!Number.isSafeInteger(amountInCents)||amountInCents<=0)return invalid(data,"O valor bancário é inválido.");
  const allocatedInCents=normalized.reduce((sum,item)=>sum+Math.round(item.value*100),0);
  if(allocatedInCents!==amountInCents)return invalid(data,"O rateio não fecha exatamente o valor do extrato.");
  const knownWorks=new Set((data.obras||[]).map(work=>String(work.id)));
  if(normalized.some(item=>item.destination==="obra"&&!knownWorks.has(item.obraId)))return invalid(data,"Uma obra selecionada não existe mais no servidor.");

  if(payload.worker?.employeeId){
    const employee=(data.employees||[]).find(item=>String(item.id)===String(payload.worker.employeeId));
    if(!employee||!active(employee)||employee.active===false)return invalid(data,"Selecione um funcionário cadastrado e ativo para confirmar o pagamento.");
    if(isIncome||normalized.length!==1||normalized[0].destination!=="obra"||normalized[0].category!=="mao_obra")return invalid(data,"Para um funcionário, use um único pagamento de mão de obra ou vincule o título da folha com seu rateio original.");
    const relatedTitle=(data.titulosFolha||[]).find(title=>String(title.employeeId)===String(employee.id)&&active(title)
      &&(saldoTituloFolha(title)>0.01||String(title.competencia||title.periodoFim?.slice(0,7)||"")===competence));
    if(relatedTitle)return invalid(data,"Já existe título de folha para este funcionário no período ou com saldo em aberto. Vincule o pagamento ao título da folha para não duplicar o custo no DRE.");
    // O ponto já reconheceu o salário. O cartão PIX registra apenas o caixa,
    // reutilizando a mutação de folha, inclusive antes do fechamento do título.
    const result=registrarPagamentoEConciliar(data,{transacaoId:transaction.id,tipo:"funcionario",entidadeId:employee.id,
      valor:transactionAmount(transaction),dataPagamento:transaction.data,obraId:normalized[0].obraId,operador:actor});
    if(!result.resumo.ok)return result;
    return {...result,data:{...result.data,transacoes:result.data.transacoes.map(item=>item.id===transaction.id?{...item,
      rateios:[{destino:"obra",obraId:normalized[0].obraId,categoria:"mao_obra",valor:transactionAmount(transaction),competencia:competence}],
      recebedorMaoObra:{employeeId:employee.id,employeeName:employee.name||employee.nome||"",pixHolder:employee.pixHolder||"",valorPago:transactionAmount(transaction),
        confirmadoEm:new Date().toISOString(),confirmadoPorId:actor?.id||"",confirmadoPor:actor?.nome||actor?.email||"Operador"},
    }:item)}};
  }
  if(categories.some(category=>["cost","revenue"].includes(category.effect))&&isCompetenceInClosedPeriod(data,competence))return invalid(data,"A competência do lançamento está fechada. Reabra o período antes de conciliar.");

  const measurementId=String(payload.measurementId||"");
  const measurement=measurementId?(data.medicoes||[]).find(item=>String(item.id)===measurementId):null;
  if(measurementId&&!measurement)return invalid(data,"A medição selecionada não existe mais.");
  if(measurement&&(!normalized.some(item=>item.destination==="obra"&&item.obraId===String(measurement.obraId))))return invalid(data,"A medição deve ser rateada para a própria obra.");
  const measurementAmount=measurement?normalized.filter(item=>item.destination==="obra"&&item.obraId===String(measurement.obraId)).reduce((sum,item)=>sum+item.value,0):0;
  if(measurement&&(!isIncome||!active(measurement)))return invalid(data,"A medição deve estar ativa e receber uma entrada bancária.");
  if(measurement&&normalized.some(item=>item.destination==="obra"&&item.obraId===String(measurement.obraId)&&item.category!=="receita"))return invalid(data,"Use a categoria Recebimento de cliente a vincular para liquidar a medição existente sem reconhecer nova receita.");
  if(measurement&&measurementAmount>Number(measurement.valorPrevisto||0)-totalRecebidoMedicao(measurement)+0.01)return invalid(data,"O recebimento supera o saldo da medição.");

  const newOtherExpenses=[];const newCompanyExpenses=[];const newReceipts=[];const generated=[];
  const recognitionDate=String(transaction.data||"").startsWith(competence)?transaction.data:`${competence}-01`;
  normalized.forEach((item,index)=>{
    if(isIncome&&measurement&&item.destination==="obra"&&item.obraId===String(measurement.obraId))return;
    const id=commandId("alloc");
    if(isIncome){
      const effect=categories[index].effect;
      newReceipts.push({id,obraId:item.obraId,date:transaction.data,amount:item.value,description:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),
        categoria:item.category,competencia:competence,dataReconhecimento:recognitionDate,
        efeitoDRE:effect==="revenue"?"receita":effect==="unallocated"?"a_classificar":"sem_efeito",
        naturezaEntrada:effect,tipo:"recebimento_avulso",origem:"conciliacao_bancaria",transacaoId:transaction.id,conciliado:true,
        registradoPorId:actor?.id||"",registradoPor:actor?.nome||actor?.email||"Operador",registradoEm:new Date().toISOString()});
      generated.push({tipo:"payments",id,entidadeId:id});
    }else{
      const expense={id,competencia:competence,data:recognitionDate,dataPagamento:transaction.data,pago:true,categoria:item.category,descricao:`[Extrato] ${text(transaction.descricao)}`.slice(0,120),valor:item.value,transacaoId:transaction.id};
      if(item.destination==="obra"){
        newOtherExpenses.push({...expense,obraId:item.obraId});generated.push({tipo:"outrasDesp",id,entidadeId:id});
      }else{
        newCompanyExpenses.push({...expense,recorrente:false});generated.push({tipo:"despesasEmpresa",id,entidadeId:id});
      }
    }
  });
  const receiptId=measurement?commandId("rec"):"";
  const medicoes=measurement?(data.medicoes||[]).map(item=>String(item.id)===measurementId
    ?aplicarRecebimentoMedicao(item,{id:receiptId,valor:measurementAmount,data:transaction.data,origem:"conciliacao_bancaria",transacaoId:transaction.id,actor})
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
    direction,
  }:null;
  const transactions=(data.transacoes||[]).map(item=>String(item.id)===String(transaction.id)?{
    ...item,status:"conciliado",rateios:normalized.map(row=>({destino:row.destination,obraId:row.obraId,categoria:row.category,valor:row.value,competencia:competence})),gerados:generated,vinculo:measurement?{tipo:"medicao",id:measurement.id}:null,recebedorMaoObra:worker,
    statusAtualizadoEm:new Date().toISOString(),statusAtualizadoPorId:actor?.id||"",statusAtualizadoPor:actor?.nome||actor?.email||"Operador",
  }:item);
  const historico=[...(data.historicoConc||[]),{id:commandId("hist"),criadoEm:new Date().toISOString(),transacaoId:transaction.id,extratoId:transaction.extratoId,acao:"conciliada",statusAnterior:transaction.status,statusNovo:"conciliado",descricao:measurement?`Medição ${measurement.descricao||measurement.id} conciliada`:`${normalized.length} rateio(s) confirmado(s)`,valor:transaction.valor,operadorId:actor?.id||"",operador:actor?.nome||actor?.email||"Operador"}];
  return {data:{...data,transacoes:transactions,medicoes,outrasDesp:[...(data.outrasDesp||[]),...newOtherExpenses],despesasEmpresa:[...(data.despesasEmpresa||[]),...newCompanyExpenses],payments:[...(data.payments||[]),...newReceipts],regrasConc:automaticRule?[...(data.regrasConc||[]),automaticRule]:(data.regrasConc||[]),historicoConc:historico},resumo:{ok:true,criados:generated,vinculo:measurement?{tipo:"medicao",id:measurement.id}:null}};
};

export const applyReconciliationCommand = (data, command = {}, actor = {}) => {
  const payload=command.payload || {};
  const transactionId=String(payload.transactionId || "");
  if(!positiveId(transactionId))return invalid(data,"Identificador da transação inválido.");
  const hold = reconciliationHold(findTransaction(data, transactionId));
  if(hold)return invalid(data,hold);
  if([RECONCILIATION_COMMAND.LINK_PARTIAL_CASH,RECONCILIATION_COMMAND.REVERSE_PARTIAL_CASH].includes(command.type)){
    return applyCashAllocation(data,{...payload,idempotencyKey:command.idempotencyKey},actor,command.type===RECONCILIATION_COMMAND.REVERSE_PARTIAL_CASH);
  }
  const partialLinks=activeCashAllocations(data);
  if(partialLinks.some(link=>link.transactionId===transactionId))return invalid(data,"Este movimento possui vínculos parciais. Desfaça os vínculos pelo gestor do DRE antes de reclassificá-lo.");
  if(command.type===RECONCILIATION_COMMAND.LINK_EXISTING_PAYMENT&&partialLinks.some(link=>[link.sourceId,link.sourceSubId].filter(Boolean).includes(String(payload.paymentId||payload.targetId))))return invalid(data,"O pagamento já possui vínculos parciais no DRE.");
  if(command.type===RECONCILIATION_COMMAND.CONFIRM_TRANSFER&&reconciliationHold(findTransaction(data,payload.counterpartyTransactionId)))return invalid(data,"A outra ponta está bloqueada para conferência da composição do aporte.");
  if(command.type===RECONCILIATION_COMMAND.CONFIRM_TRANSFER&&partialLinks.some(link=>link.transactionId===payload.counterpartyTransactionId))return invalid(data,"A outra ponta possui vínculos parciais no DRE.");

  if(command.type===RECONCILIATION_COMMAND.AUTO_MATCH){
    if(!["admin", "financeiro"].includes(actor.role))return invalid(data,"A automação exige perfil Financeiro ou Administrador.");
    const row=criarFilaAutomatica(data).find(item=>String(item.tr.id)===transactionId);
    const automatic=comandoAutomaticoSeguro(row);
    if(!automatic)return invalid(data,row?.motivo||"Movimento indisponível para conciliação automática.");
    const result=applyReconciliationCommand(data,automatic,actor);
    if(!result.resumo.ok)return result;
    const auditoria={regra:REGRA_AUTOMATICA,evidencias:row.analise.melhorCandidata.motivos,contraparte:row.analise.identidadeProvavel,executadaEm:new Date().toISOString()};
    return {...result,data:{...result.data,transacoes:result.data.transacoes.map(tr=>String(tr.id)===transactionId?{...tr,automacaoConciliacao:auditoria}:tr)},resumo:{...result.resumo,automatica:true,regra:REGRA_AUTOMATICA}};
  }

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
    // Só usada por tipo==="terceiro" (o único destino sem obra própria já
    // cadastrada) - achado de 25/08/2026: sem isso, pagamento direto a
    // terceiro sem medição sempre caía como custo da empresa no DRE, mesmo
    // a candidata do motor já sabendo a obra certa (ver selectors.js).
    // Validada contra data.obras para nunca persistir um id inventado -
    // mesmo padrão de knownWorks em allocateTransaction (acima).
    const knownWorks=new Set((data.obras||[]).map(work=>String(work.id)));
    const targetObraId=positiveId(payload.targetObraId)&&knownWorks.has(String(payload.targetObraId))?String(payload.targetObraId):"";
    return registrarPagamentoEConciliar(data,{
      transacaoId:transactionId,tipo:payload.targetType,entidadeId:payload.targetId,
      valor:transactionAmount(checked.transaction),dataPagamento:checked.transaction.data,
      obraId:targetObraId,observacao:text(payload.observacao),operador:actor,
      adiantamento:payload.adiantamento,motivoAdiantamento:text(payload.motivoAdiantamento),
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
