import { conferenceCompletionCheck, conferenceQualityScore } from "./conference-workflow.js";

// CAS para a Conferência técnica (Onda 5 do raio-X, 26/08/2026) - era a
// última tela do grupo Qualidade/Segurança/Diário/Conferência ainda
// escrevendo com update() direto. O helper cliente `atualizar()` já
// carimbava um auditTrail por edição; aqui o mesmo carimbo passa a exigir
// expectedVersion batendo antes de aceitar a escrita.
export const CONFERENCE_COMMAND = Object.freeze({
  CONFERENCE_CREATED: "CONFERENCIA_CRIADA",
  CONFERENCE_CANCELLED: "CONFERENCIA_CANCELADA",
  CONFERENCE_METADATA_UPDATED: "CONFERENCIA_METADADOS_ATUALIZADOS",
  CONFERENCE_COMPLETED: "CONFERENCIA_CONCLUIDA",
  CONFERENCE_REOPENED: "CONFERENCIA_REABERTA",
  CONFERENCE_FINDING_SAVED: "ACHADO_CONFERENCIA_SALVO",
  CONFERENCE_FINDING_CANCELLED: "ACHADO_CONFERENCIA_CANCELADO",
  CONFERENCE_FINDING_EVIDENCE_ADDED: "EVIDENCIA_ACHADO_ADICIONADA",
  CONFERENCE_FINDING_VALIDATED: "ACHADO_CONFERENCIA_VALIDADO",
});

export const CONFERENCE_COMMAND_TYPES = new Set(Object.values(CONFERENCE_COMMAND));

const fail = reason => ({ ok: false, reason });
const versionOf = item => Number(item?.version || 0);
const terminalFinding = status => ["resolvida", "cancelada"].includes(status);
const isVistoriador = user => user?.active !== false && ["admin", "engenheiro_auditor"].includes(user?.role);

const findConference = (data, id) => (data.conferencias || []).find(item => item.id === id);
const replaceConference = (data, id, record) => ({
  ...data,
  conferencias: (data.conferencias || []).map(item => item.id === id ? record : item),
});
const stampAudit = (record, command, now, action, details = "") => ({
  ...record,
  atualizadoEm: now, atualizadoPorId: command.actorId || "", atualizadoPor: command.actorName || "Usuário autenticado",
  version: versionOf(record) + 1,
  auditTrail: [...(record.auditTrail || []), {
    id: `audit_${command.idempotencyKey}`, action, details,
    actorId: command.actorId || "", actor: command.actorName || "Usuário autenticado", at: now,
  }].slice(-200),
});

export const applyConferenceCommand = (data = {}, command = {}, now = new Date().toISOString()) => {
  if (!CONFERENCE_COMMAND_TYPES.has(command.type)) return null;

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_CREATED) {
    const raw = command.payload?.conference || {};
    const id = String(raw.id || "").trim();
    const obraId = String(raw.obraId || "").trim();
    if (!id || !obraId || !raw.data) return fail("Conferência sem identificação, obra ou data.");
    if (!(data.obras || []).some(item => String(item.id) === obraId)) return fail("A obra da conferência não existe.");
    if ((data.conferencias || []).some(item => item.id === id)) return fail("Já existe uma conferência com esta identificação.");
    if (command.expectedVersion != null && Number(command.expectedVersion) !== 0) return fail("A conferência ainda não existe na versão esperada.");
    const responsavel = (data.usuarios || []).find(item => item.id === raw.responsavelId && isVistoriador(item));
    if (!responsavel) return fail("Selecione o engenheiro auditor responsável ou o administrador.");
    const codigo = Math.max(0, ...(data.conferencias || []).filter(item => item.obraId === obraId).map(item => Number(item.codigo || 0))) + 1;
    const record = {
      id, obraId, data: raw.data, codigo, responsavelId: responsavel.id, responsavel: responsavel.nome,
      status: "nao_iniciada", notaGeral: null, observacoesGerais: "", pendencias: [], version: 1,
      criadoEm: now, criadoPorId: command.actorId || "", criadoPor: command.actorName || "",
      atualizadoEm: now, concluidoEm: "",
      auditTrail: [{ id: `audit_${command.idempotencyKey}`, action: "Vistoria criada", details: `Responsável: ${responsavel.nome}`, actorId: command.actorId || "", actor: command.actorName || "Usuário autenticado", at: now }],
    };
    return { ok: true, entityId: id, data: { ...data, conferencias: [...(data.conferencias || []), record] } };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_CANCELLED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const reason = String(command.payload?.reason || "").trim();
    if (!reason) return fail("Informe o motivo do cancelamento da conferência.");
    const cancelled = stampAudit({
      ...current, status: "cancelada", motivoCancelamento: reason, canceladaEm: now,
      canceladaPorId: command.actorId || "", canceladaPor: command.actorName || "",
      pendencias: (current.pendencias || []).map(item => terminalFinding(item.status) ? item : {
        ...item, status: "cancelada", motivoCancelamento: `Conferência cancelada: ${reason}`,
        canceladaEm: now, canceladaPor: command.actorName || "",
      }),
    }, command, now, "Vistoria cancelada", reason);
    return { ok: true, entityId: id, data: replaceConference(data, id, cancelled) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_METADATA_UPDATED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const patch = command.payload?.patch || {};
    if (!patch.data) return fail("Informe a data da vistoria.");
    let responsavel = null;
    if (Object.hasOwn(patch, "responsavelId") && patch.responsavelId) {
      responsavel = (data.usuarios || []).find(item => item.id === patch.responsavelId && isVistoriador(item));
      if (!responsavel) return fail("Selecione o responsável pela vistoria.");
    }
    const changed = [];
    if (patch.data !== current.data) changed.push(`data: ${current.data} → ${patch.data}`);
    if (responsavel && patch.responsavelId !== current.responsavelId) changed.push(`responsável: ${current.responsavel || "não definido"} → ${responsavel.nome}`);
    if (Object.hasOwn(patch, "observacoesGerais") && patch.observacoesGerais !== current.observacoesGerais) changed.push("observações gerais atualizadas");
    if (!changed.length) return { ok: true, entityId: id, data, idempotent: true };
    const updated = stampAudit({
      ...current, data: patch.data,
      responsavelId: responsavel ? responsavel.id : current.responsavelId,
      responsavel: responsavel ? responsavel.nome : current.responsavel,
      observacoesGerais: Object.hasOwn(patch, "observacoesGerais") ? patch.observacoesGerais : current.observacoesGerais,
    }, command, now, "Metadados da vistoria atualizados", changed.join("; "));
    return { ok: true, entityId: id, data: replaceConference(data, id, updated) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_COMPLETED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const declaration = command.payload?.declaration || {};
    const check = conferenceCompletionCheck(current, declaration);
    if (!check.ok) return fail(check.reason);
    const score = conferenceQualityScore({ ...current, inspectionDeclaration: { ...declaration, confirmedAt: now } });
    const completed = stampAudit({
      ...current, status: "concluida", notaGeral: score, concluidoEm: now,
      concluidoPorId: command.actorId || "", concluidoPor: command.actorName || "",
      inspectionDeclaration: {
        scopeReviewed: true, notes: String(declaration.notes || "").trim(), confirmedAt: now,
        confirmedById: command.actorId || "", confirmedBy: command.actorName || "",
      },
    }, command, now, "Vistoria concluída", `Nota técnica calculada: ${score}/10`);
    return { ok: true, entityId: id, score, data: replaceConference(data, id, completed) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_REOPENED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    if (current.status !== "concluida") return fail("Somente uma vistoria concluída pode ser reaberta.");
    const reopened = stampAudit({ ...current, status: "em_andamento", concluidoEm: "" }, command, now, "Vistoria reaberta", "Reaberta para nova análise");
    return { ok: true, entityId: id, data: replaceConference(data, id, reopened) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_FINDING_SAVED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const raw = command.payload?.finding || {};
    const findingId = String(raw.id || "").trim();
    if (!findingId) return fail("Achado sem identificação.");
    if (!String(raw.descricao || "").trim() || !String(raw.ajusteNecessario || "").trim()) return fail("Descreva o problema e o ajuste necessário.");
    if (!raw.responsavelAjusteId) return fail("Defina quem será responsável pelo ajuste.");
    const existing = (current.pendencias || []).find(item => item.id === findingId);
    const record = {
      ...raw, id: findingId, itemOrcamentoId: "",
      criadoPorId: existing?.criadoPorId || command.actorId || "",
      criadoPor: existing?.criadoPor || command.actorName || "",
      criadoEm: existing?.criadoEm || now,
      resolvidoEm: raw.status === "resolvida" ? (raw.resolvidoEm || now) : "",
    };
    const pendencias = existing
      ? (current.pendencias || []).map(item => item.id === findingId ? record : item)
      : [...(current.pendencias || []), record];
    const updated = stampAudit({
      ...current, status: current.status === "nao_iniciada" ? "em_andamento" : current.status, pendencias,
    }, command, now, existing ? "Pendência atualizada" : "Pendência registrada", record.descricao);
    return { ok: true, entityId: findingId, data: replaceConference(data, id, updated) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_FINDING_CANCELLED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const findingId = String(command.payload?.findingId || "").trim();
    const finding = (current.pendencias || []).find(item => item.id === findingId);
    if (!finding) return fail("Achado não encontrado.");
    const reason = String(command.payload?.reason || "").trim();
    if (!reason) return fail("Informe o motivo do cancelamento.");
    const updated = stampAudit({
      ...current,
      pendencias: (current.pendencias || []).map(item => item.id !== findingId ? item : {
        ...item, status: "cancelada", motivoCancelamento: reason, canceladaEm: now,
        canceladaPorId: command.actorId || "", canceladaPor: command.actorName || "",
      }),
    }, command, now, "Pendência cancelada", reason);
    return { ok: true, entityId: findingId, data: replaceConference(data, id, updated) };
  }

  if (command.type === CONFERENCE_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED) {
    const id = String(command.payload?.conferenceId || "").trim();
    const current = findConference(data, id);
    if (!current) return fail("Conferência não encontrada.");
    if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    const findingId = String(command.payload?.findingId || "").trim();
    const finding = (current.pendencias || []).find(item => item.id === findingId);
    if (!finding) return fail("Achado não encontrado.");
    if (finding.status === "resolvida") return fail("Esta pendência já está resolvida.");
    const novasFotos = Array.isArray(command.payload?.fotos) ? command.payload.fotos : [];
    if (!novasFotos.length) return fail("Nenhuma evidência foi enviada.");
    const resetValidation = !!command.payload?.resetValidation;
    const updated = stampAudit({
      ...current,
      pendencias: (current.pendencias || []).map(item => item.id !== findingId ? item : {
        ...item,
        fotos: [...(item.fotos || []), ...novasFotos],
        ...(resetValidation ? { status: "aguardando_validacao", validacaoStatus: "", validacaoObservacao: "", validadoPorId: "", validadoPor: "", validadoEm: "", resolvidoEm: "" } : {}),
      }),
    }, command, now, "Evidência técnica adicionada", finding.descricao);
    return { ok: true, entityId: findingId, data: replaceConference(data, id, updated) };
  }

  const id = String(command.payload?.conferenceId || "").trim();
  const current = findConference(data, id);
  if (!current) return fail("Conferência não encontrada.");
  if (versionOf(current) !== Number(command.expectedVersion || 0)) return fail("A conferência foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
  const findingId = String(command.payload?.findingId || "").trim();
  const finding = (current.pendencias || []).find(item => item.id === findingId);
  if (!finding) return fail("Achado não encontrado.");
  if (finding.status !== "aguardando_validacao") return fail("Esta pendência não está aguardando validação.");
  if (!(finding.fotos || []).some(item => item.tipo === "ajuste")) return fail("A validação exige uma foto de correção enviada pelo responsável do ajuste.");
  const resultado = command.payload?.resultado;
  if (!["conforme", "nao_conforme"].includes(resultado)) return fail("Resultado de validação inválido.");
  const observacao = String(command.payload?.observacao || "").trim();
  if (!observacao) return fail(resultado === "conforme" ? "Registre o critério verificado para aprovar a correção." : "Informe o motivo da não conformidade e a orientação para a nova correção.");
  const registro = { id: `val_${command.idempotencyKey}`, resultado, observacao, vistoriadorId: command.actorId || "", vistoriador: command.actorName || current.responsavel || "", criadoEm: now };
  const updated = stampAudit({
    ...current,
    pendencias: (current.pendencias || []).map(item => item.id !== findingId ? item : {
      ...item, status: resultado === "conforme" ? "resolvida" : "em_ajuste", validacaoStatus: resultado,
      validacaoObservacao: observacao, validadoPorId: registro.vistoriadorId, validadoPor: registro.vistoriador,
      validadoEm: now, validacoes: [...(item.validacoes || []), registro], resolvidoEm: resultado === "conforme" ? now : "",
    }),
  }, command, now, resultado === "conforme" ? "Correção aprovada" : "Correção reprovada", observacao);
  return { ok: true, entityId: findingId, data: replaceConference(data, id, updated) };
};
