import { isThirdPartyRecordActive, isVisibleThirdPartyContract } from "./lifecycle.js";

// Visão da obra sobre os contratos de terceirizados por medição. "Aprovado"
// segue a mesma regra do razão financeiro (ledger.js): medição ativa que não
// está aguardando aprovação nem rejeitada.

const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clamp = value => Math.min(100, Math.max(0, num(value)));
const round2 = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
const statusOf = record => String(record?.status || "").trim().toLowerCase();
const dateOf = record => String(record?.data || record?.dataMedicao || "");
const chronological = (a, b) => `${dateOf(a)}|${a.id}`.localeCompare(`${dateOf(b)}|${b.id}`);

export const isApprovedThirdPartyMeasurement = measurement =>
  isThirdPartyRecordActive(measurement) && !["rascunho", "rejeitada"].includes(statusOf(measurement));
const isAwaitingApproval = measurement =>
  isThirdPartyRecordActive(measurement) && statusOf(measurement) === "rascunho";

const weightedProgress = (stages, key) => {
  const total = stages.reduce((sum, stage) => sum + Math.max(0, stage.valor), 0);
  if (total > 0) return round2(stages.reduce((sum, stage) => sum + Math.max(0, stage.valor) * stage[key], 0) / total);
  return stages.length ? round2(stages.reduce((sum, stage) => sum + stage[key], 0) / stages.length) : 0;
};

export function thirdPartyMeasurementsForProject(data, obraId) {
  if (!obraId) return [];
  return (data?.terceirizados || [])
    .filter(contract => String(contract?.obraId || "") === String(obraId)
      && isVisibleThirdPartyContract(contract)
      && (contract.tipoContrato === "medicao" || (contract.etapas || []).length > 0))
    .map(contract => {
      const measurements = (data?.medicoesTerc || [])
        .filter(item => String(item?.tercId || "") === String(contract.id) && isThirdPartyRecordActive(item))
        .sort(chronological);
      // Medições são cumulativas: o percentual de uma etapa é o da última
      // medição que a mediu. A enviada inclui as que aguardam aprovação.
      const approvedPct = {}, sentPct = {};
      for (const measurement of measurements) {
        const approved = isApprovedThirdPartyMeasurement(measurement);
        if (!approved && !isAwaitingApproval(measurement)) continue;
        for (const item of measurement.itens || []) {
          sentPct[item.etapaId] = clamp(item.pctAcum);
          if (approved) approvedPct[item.etapaId] = clamp(item.pctAcum);
        }
      }
      const etapas = [...(contract.etapas || [])]
        .sort((a, b) => num(a.ordem) - num(b.ordem))
        .map(stage => ({
          id: String(stage.id),
          nome: String(stage.nome || "Etapa"),
          valor: num(stage.valor),
          tarefaId: String(stage.tarefaId || ""),
          pctAprovado: approvedPct[stage.id] ?? 0,
          pctEnviado: sentPct[stage.id] ?? approvedPct[stage.id] ?? 0,
        }));
      const approved = measurements.filter(isApprovedThirdPartyMeasurement);
      const awaiting = measurements.filter(isAwaitingApproval);
      const valorAprovado = round2(approved.reduce((sum, item) => sum + num(item.total), 0));
      const valorContrato = num(contract.contractValue) || etapas.reduce((sum, stage) => sum + stage.valor, 0);
      return {
        id: String(contract.id),
        nome: String(contract.name || "Terceirizado"),
        especialidade: String(contract.specialty || ""),
        valorContrato,
        etapas,
        valorAprovado,
        valorAguardando: round2(awaiting.reduce((sum, item) => sum + num(item.total), 0)),
        aMedir: round2(Math.max(0, valorContrato - valorAprovado)),
        avancoAprovado: weightedProgress(etapas, "pctAprovado"),
        avancoEnviado: weightedProgress(etapas, "pctEnviado"),
        contagem: {
          aguardando: awaiting.length,
          rejeitadas: measurements.filter(item => statusOf(item) === "rejeitada").length,
          aPagar: approved.filter(item => !item.pagamentoId).length,
          pagas: approved.filter(item => item.pagamentoId).length,
        },
        ultimaMedicao: dateOf(measurements.at(-1)),
      };
    });
}

// Avanço proposto para cada serviço do planejamento, a partir das etapas de
// contrato vinculadas a ele (ponderado pelo valor de cada etapa). É proposta
// para o boletim técnico, nunca o avanço oficial por si só.
export function thirdPartyProgressByTask(contracts, validTaskIds = null) {
  const byTask = new Map();
  for (const contract of contracts || []) {
    for (const stage of contract.etapas || []) {
      if (!stage.tarefaId || (validTaskIds && !validTaskIds.has(stage.tarefaId))) continue;
      const entry = byTask.get(stage.tarefaId) || {stages: [], fontes: []};
      entry.stages.push(stage);
      entry.fontes.push({contratoId: contract.id, contrato: contract.nome, etapaId: stage.id, etapa: stage.nome, pct: stage.pctAprovado, pctEnviado: stage.pctEnviado});
      byTask.set(stage.tarefaId, entry);
    }
  }
  return new Map([...byTask].map(([taskId, entry]) => [taskId, {
    pct: weightedProgress(entry.stages, "pctAprovado"),
    pctEnviado: weightedProgress(entry.stages, "pctEnviado"),
    fontes: entry.fontes,
  }]));
}

// Etapas completas do contrato com o vínculo de uma etapa trocado, prontas
// para o comando THIRD_PARTY_CONTRACT_STAGES_SAVED (que preserva os demais campos).
export function linkStageToTask(contract, stageId, tarefaId) {
  const stages = contract?.etapas || [];
  if (!stages.some(stage => String(stage.id) === String(stageId))) throw new Error("Etapa do contrato não encontrada.");
  return stages.map(stage => String(stage.id) !== String(stageId) ? stage : {...stage, tarefaId: String(tarefaId || "")});
}
