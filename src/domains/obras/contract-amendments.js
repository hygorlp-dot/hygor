import {forecastDuplicationWarnings} from '../financeiro/forecast-duplication.js';
import {getActiveBudgetBaseline} from '../orcamentos/calculations.js';
// Aditivos do contrato do cliente (Onda 4.1 do roadmap de correção).
//
// Até aqui "aditivo" só existia em equipamentos: toda mudança de escopo do
// cliente ficava fora do contrato, da receita projetada e do portal (que
// publicava approvedChanges = 0). O aditivo mora na própria obra
// (obra.aditivosContrato) e só passa a valer depois de aprovado.
//
// Decisão do dono (28/10/2026, D5): o cliente aprova aditivos pelo portal
// (4.3). Enquanto isso não existe, o administrador registra a aprovação dada
// fora do sistema (origem "interno"), com data e responsável.

export const AMENDMENT_COMMAND = Object.freeze({
  CONTRACT_AMENDMENT_SAVED:"ADITIVO_CONTRATO_SALVO",
  CONTRACT_AMENDMENT_DECIDED:"ADITIVO_CONTRATO_DECIDIDO",
  CONTRACT_AMENDMENT_CANCELLED:"ADITIVO_CONTRATO_CANCELADO",
});
export const AMENDMENT_COMMAND_TYPES = new Set(Object.values(AMENDMENT_COMMAND));

export const AMENDMENT_STATUS = Object.freeze({
  PROPOSED:"proposto", APPROVED:"aprovado", REJECTED:"recusado", CANCELLED:"cancelado",
});

const money = value => Math.round(Number(value || 0) * 100) / 100;
const lista = obra => Array.isArray(obra?.aditivosContrato) ? obra.aditivosContrato : [];

export const aditivosAprovados = obra => lista(obra).filter(item => item?.status === AMENDMENT_STATUS.APPROVED);
export const valorAditivosAprovados = obra => money(aditivosAprovados(obra).reduce((soma, item) => soma + Number(item.valor || 0), 0));
export const prazoAditivosAprovados = obra => aditivosAprovados(obra).reduce((soma, item) => soma + Math.trunc(Number(item.prazoDias || 0)), 0);

// Contrato vigente = original + aditivos aprovados (supressão entra negativa).
export const valorContratoVigente = obra => money(Number(obra?.contractValue || 0) + valorAditivosAprovados(obra));

export const fimContratoVigente = obra => {
  const fim = String(obra?.contractEnd || "");
  const dias = prazoAditivosAprovados(obra);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim) || !dias) return fim;
  const data = new Date(`${fim}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
};

export const amendmentCommandObraId = (data = {}, command = {}) => String(command?.payload?.obraId || "");

const fail = reason => ({ ok:false, reason });
const versionOf = item => Number(item?.version || 0);
const warning = message => ({code:'AMENDMENT_REVIEW',blocking:false,stage:'Mudanças e aditivos',owner:'Responsável pelo contrato',message,resolution:'Confira e complemente o acompanhamento da mudança.'});
export function amendmentWarnings(item) {
  const messages=[];
  if(!item.responsavel)messages.push('Mudança sem responsável definido.');
  if(!item.etapaId)messages.push('Impacto acompanhado em Sem apropriação; escolha a etapa quando disponível.');
  if(item.execucaoStatus==='em_andamento'&&item.status!==AMENDMENT_STATUS.APPROVED)messages.push('Execução em andamento sem aprovação vigente do cliente.');
  if(item.status===AMENDMENT_STATUS.APPROVED&&!item.evidenciaDecisao)messages.push('Aprovação registrada sem evidência da decisão do cliente.');
  if(item.impactoCustoRestante==null)messages.push('Custo restante da mudança ainda não estimado.');
  if(item.status===AMENDMENT_STATUS.CANCELLED&&item.execucaoStatus==='em_andamento')messages.push('Mudança cancelada com execução em andamento; confira custos remanescentes.');
  if(item.execucaoStatus==='concluida'&&Number(item.impactoCustoRestante||0)!==0)messages.push('Execução concluída com custo restante estimado; confira o que ainda falta incorrer.');
  if(['recusado','cancelado'].includes(item.status)&&item.impactoNaPrevisao==='adicional')messages.push('Impacto ainda incluído na previsão apesar da decisão; confira custos remanescentes antes de retirar.');
  return messages.map(warning);
}

const withAmendments = (data, obraId, map) => ({
  ...data,
  obras:(data.obras || []).map(obra => String(obra.id) === obraId ? { ...obra, aditivosContrato:map(lista(obra)) } : obra),
});

export const applyAmendmentCommand = (data = {}, command = {}, now = new Date().toISOString()) => {
  if (!AMENDMENT_COMMAND_TYPES.has(command.type)) return null;
  const payload = command.payload || {};
  const obraId = String(payload.obraId || "");
  const obra = (data.obras || []).find(item => String(item.id) === obraId);
  if (!obra) return fail("Obra do aditivo não encontrada.");
  const actor = { id:String(command.actorId || ""), nome:String(command.actorName || "") };
  const warningsFor=registro=>{
    const updated={...obra,aditivosContrato:lista(obra).some(a=>a.id===registro.id)?lista(obra).map(a=>a.id===registro.id?registro:a):[...lista(obra),registro]};
    const candidate=getActiveBudgetBaseline(data,obraId,'controle').budget;
    return [...amendmentWarnings(registro),...forecastDuplicationWarnings(updated,candidate?.obraId===obraId?candidate:null)];
  };

  if (command.type === AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED) {
    const raw = payload.amendment || {};
    const id = String(raw.id || "").trim();
    const atual = lista(obra).find(item => item.id === id);
    const operationalOnly = payload.operationalOnly === true;
    if(operationalOnly&&!atual)return fail('Mudança não encontrada para acompanhamento.');
    const descricao = String((operationalOnly?atual.descricao:raw.descricao) || "").trim();
    const valor = Number(operationalOnly?atual.valor:raw.valor||0);
    const prazoDias = Number((operationalOnly?atual.prazoDias:raw.prazoDias) || 0);
    if (!id) return fail("Aditivo sem identificação.");
    if (!descricao) return fail("Descreva o que muda no contrato.");
    if (!Number.isFinite(valor)) return fail("Informe o valor do aditivo (negativo para supressão).");
    if (!Number.isInteger(prazoDias) || Math.abs(prazoDias) > 3650) return fail("Informe o prazo do aditivo em dias inteiros.");
    if (!operationalOnly && Number(obra.contractValue || 0) + valorAditivosAprovados(obra) + Math.min(0, valor) < 0) return fail("A supressão deixaria o contrato negativo.");
    if (atual) {
      if (!operationalOnly && atual.status !== AMENDMENT_STATUS.PROPOSED) return fail("Os termos decididos estão preservados. Atualize o acompanhamento ou registre outra mudança.");
      if (versionOf(atual) !== Number(command.expectedVersion || 0)) return fail("O aditivo foi alterado por outra pessoa. Atualize a tela.");
    }
    const impactoCustoRestante=raw.impactoCustoRestante===undefined?(atual?.impactoCustoRestante??null):raw.impactoCustoRestante==null||raw.impactoCustoRestante===''?null:Number(raw.impactoCustoRestante);
    if(impactoCustoRestante!=null&&(!Number.isFinite(impactoCustoRestante)||!Number.isSafeInteger(Math.round(impactoCustoRestante*100))))return fail('Informe um impacto de custo válido.');
    const execucaoStatus=raw.execucaoStatus||atual?.execucaoStatus||'planejada';
    const impactoNaPrevisao=raw.impactoNaPrevisao||atual?.impactoNaPrevisao||'nao_incluir';
    if(!['planejada','em_andamento','concluida'].includes(execucaoStatus)||!['adicional','ja_incluido','nao_incluir'].includes(impactoNaPrevisao))return fail('Acompanhamento da mudança inválido.');
    const registro = {
      ...(atual || { id, numero:lista(obra).length + 1, status:AMENDMENT_STATUS.PROPOSED, criadoEm:now, criadoPorId:actor.id, criadoPor:actor.nome }),
      descricao, justificativa:operationalOnly?atual.justificativa:String(raw.justificativa || "").trim(),
      valor:money(valor), prazoDias, orcamentoRevisaoId:operationalOnly?atual.orcamentoRevisaoId:String(raw.orcamentoRevisaoId || ""),
      evidenciaDecisao:operationalOnly?String(raw.evidenciaDecisao??atual.evidenciaDecisao??'').trim():atual?.evidenciaDecisao,
      execucaoStatus, impactoNaPrevisao, impactoCustoRestante:impactoCustoRestante==null?null:money(impactoCustoRestante),responsavel:String(raw.responsavel??atual?.responsavel??'').trim(),etapaId:String(raw.etapaId??atual?.etapaId??''),
      acompanhamentoHistorico:[...(atual?.acompanhamentoHistorico||[]),{at:now,byId:actor.id,by:actor.nome,evidenciaDecisao:String(raw.evidenciaDecisao??atual?.evidenciaDecisao??''),descricao,valor:money(valor),prazoDias,execucaoStatus,impactoNaPrevisao,impactoCustoRestante,responsavel:String(raw.responsavel??atual?.responsavel??''),etapaId:String(raw.etapaId??atual?.etapaId??'')}].slice(-100),
      version:versionOf(atual) + 1, atualizadoEm:now,
    };
    return { ok:true, entityId:id, summary:{workflowWarnings:warningsFor(registro)}, data:withAmendments(data, obraId, itens => atual ? itens.map(item => item.id === id ? registro : item) : [...itens, registro]) };
  }

  const id = String(payload.amendmentId || "");
  const atual = lista(obra).find(item => item.id === id);
  if (!atual) return fail("Aditivo não encontrado.");
  if (payload.expectedVersion != null && versionOf(atual) !== Number(payload.expectedVersion)) return fail("O aditivo foi alterado por outra pessoa. Atualize a tela.");

  if (command.type === AMENDMENT_COMMAND.CONTRACT_AMENDMENT_DECIDED) {
    const decisao = payload.decision;
    if (![AMENDMENT_STATUS.APPROVED, AMENDMENT_STATUS.REJECTED].includes(decisao)) return fail("Decisão do aditivo inválida.");
    if (atual.status !== AMENDMENT_STATUS.PROPOSED) return fail("Este aditivo já foi decidido.");
    const origem = payload.origem === "portal" ? "portal" : "interno";
    const registro = {
      ...atual, status:decisao, decididoEm:now, decididoPorId:actor.id, decididoPor:actor.nome,
      origemDecisao:origem, evidenciaDecisao:String(payload.evidencia || "").trim(),
      version:versionOf(atual) + 1,
    };
    return { ok:true, entityId:id, summary:{workflowWarnings:warningsFor(registro)}, data:withAmendments(data, obraId, itens => itens.map(item => item.id === id ? registro : item)) };
  }

  const motivo = String(payload.reason || "").trim();
  if (atual.status === AMENDMENT_STATUS.CANCELLED) return fail("Este aditivo já está cancelado.");
  const registro = { ...atual, status:AMENDMENT_STATUS.CANCELLED, statusAnterior:atual.status, motivoCancelamento:motivo, canceladoEm:now, canceladoPorId:actor.id, canceladoPor:actor.nome, version:versionOf(atual) + 1 };
  return { ok:true, entityId:id, summary:{workflowWarnings:[...warningsFor(registro),...(!motivo?[warning('Cancelamento sem motivo registrado.')]:[])]}, data:withAmendments(data, obraId, itens => itens.map(item => item.id === id ? registro : item)) };
};
