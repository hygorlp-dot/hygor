const terminal = new Set(["resolvida", "cancelada"]);

const activeConferenceFindings = conference =>
  (conference?.pendencias || []).filter(item => item?.status !== "cancelada");

const openConferenceFindings = conference =>
  activeConferenceFindings(conference).filter(item => !terminal.has(item?.status));

export const conferenceProgress = conference => {
  const findings = activeConferenceFindings(conference);
  if (!findings.length) return conference?.inspectionDeclaration?.confirmedAt ? 100 : 0;
  const resolved = findings.filter(item => item.status === "resolvida").length;
  return Math.round((resolved / findings.length) * 100);
};

export const conferenceCompletionCheck = (conference, declaration = {}) => {
  const open = openConferenceFindings(conference);
  if (open.length) return { ok:false, reason:"Valide todas as correções antes de concluir a vistoria." };
  if (!declaration.scopeReviewed) return { ok:false, reason:"Confirme que todo o escopo previsto foi inspecionado." };
  const findings = activeConferenceFindings(conference);
  if (!findings.length && String(declaration.notes || "").trim().length < 10) {
    return { ok:false, reason:"Descreva o escopo verificado antes de concluir sem inconformidades." };
  }
  return { ok:true };
};

export const conferenceQualityScore = conference => {
  const findings = activeConferenceFindings(conference);
  if (!findings.length) return conference?.inspectionDeclaration?.confirmedAt ? 10 : null;
  const weights = { baixo:1, medio:2, alto:3, critico:5 };
  const totalWeight = findings.reduce((sum, item) => sum + (weights[item.impacto] || 2), 0);
  const unresolvedWeight = findings
    .filter(item => item.status !== "resolvida")
    .reduce((sum, item) => sum + (weights[item.impacto] || 2), 0);
  const recurrencePenalty = findings.filter(item => (item.validacoes || []).some(v => v.resultado === "nao_conforme")).length * .25;
  return Math.max(0, Math.round((10 * (1 - unresolvedWeight / Math.max(1, totalWeight)) - recurrencePenalty) * 10) / 10);
};

export const filterConferenceFindings = (conference, filters = {}, referenceDate = new Date().toISOString().slice(0, 10)) => {
  const query = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");
  const priority = { critico:0, alto:1, medio:2, baixo:3 };
  return (conference?.pendencias || []).filter(item => {
    if (filters.status && filters.status !== "todas" && item.status !== filters.status) return false;
    if (filters.impact && filters.impact !== "todos" && item.impacto !== filters.impact) return false;
    if (filters.ownerId && filters.ownerId !== "todos" && item.responsavelAjusteId !== filters.ownerId) return false;
    if (filters.onlyOverdue && (!item.prazo || item.prazo >= referenceDate || terminal.has(item.status))) return false;
    if (!query) return true;
    return [item.descricao, item.ajusteNecessario, item.responsavelAjusteNome, item.motivoCancelamento]
      .join(" ").toLocaleLowerCase("pt-BR").includes(query);
  }).sort((a, b) => {
    const aOpen = terminal.has(a.status) ? 1 : 0;
    const bOpen = terminal.has(b.status) ? 1 : 0;
    return aOpen - bOpen
      || (priority[a.impacto] ?? 4) - (priority[b.impacto] ?? 4)
      || String(a.prazo || "9999-12-31").localeCompare(String(b.prazo || "9999-12-31"));
  });
};
