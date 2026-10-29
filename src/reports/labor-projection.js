import { marcellReportHtml } from "./marcell-report.js";

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const amount = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const list = value => Array.isArray(value) ? value : [];
const moneyColumn = titulo => ({ titulo, largura: 21, formato: '"R$" #,##0.00;[Red]-"R$" #,##0.00' });
const textColumn = (titulo, largura = 26) => ({ titulo, largura });
const dateColumn = titulo => ({ titulo, largura: 15, formato: "dd/mm/yyyy" });
const percentColumn = titulo => ({ titulo, largura: 17, formato: "0.0%" });
const excelDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? new Date(`${value}T00:00:00.000Z`) : null;

export const laborProjectionMoney = value => amount(value) == null ? "Indisponível" : moneyFormatter.format(value);
export const laborProjectionPercent = value => amount(value) == null ? "Indisponível" : percentFormatter.format(value);
export const laborProjectionDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value.split("-").reverse().join("/") : "Não informado";
export const laborProjectionMode = value => ({ daily: "Diária", clt: "CLT mensal", mei: "MEI", fixed: "Contrato fixo" })[value] || value || "Não informada";
export const laborProjectionRateSource = value => ({ individual: "Individual", group: "Grupo comparável", aggregate: "Consolidado ponderado", unavailable: "Sem taxa confiável" })[value] || "Sem taxa confiável";
export const laborProjectionPartition = value => ({ actual: "Apurado", confirmedFuture: "Futuro confirmado", estimated: "Estimado", pending: "Pendente de conferência" })[value] || "Não informada";
export const laborProjectionComponent = value => ({ daily: "Diária", salary: "Salário CLT de competência", attendance: "Benefícios / presença" })[value] || value || "Parcela informada";
export const laborProjectionStatus = value => ({ P: "Presença", M: "Meio período", F: "Falta registrada", FE: "Férias", AT: "Atestado", FG: "Folga", HOLIDAY: "Feriado" })[value] || value || "Sem classificação";
export const laborProjectionSource = source => {
  const kind = typeof source === "string" ? source : source?.kind;
  const label = ({ live: "Ponto atual", current: "Ponto atual", archive: "Arquivo de quinzena", archived: "Arquivo de quinzena", restored: "Ponto restaurado", simulated: "Simulação", forecast: "Projeção", missing: "Fonte indisponível", conflict: "Fontes em conflito" })[kind] || kind || "Não informada";
  return typeof source === "object" && source?.archiveKey ? `${label} · ${source.archiveKey}` : label;
};
export const laborProjectionTimestamp = report => {
  if (!report?.generatedAt || Number.isNaN(new Date(report.generatedAt).getTime())) return "Não informado";
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: report.timeZone || "America/Bahia", dateStyle: "short", timeStyle: "short" }).format(new Date(report.generatedAt));
  } catch { return String(report.generatedAt); }
};
export const laborProjectionCanViewPeople = report => report?.permissions?.canViewPeople === true;
export const laborProjectionPeople = report => laborProjectionCanViewPeople(report) ? list(report.people) : [];
export const laborProjectionIssueMessage = (issue, report) => !laborProjectionCanViewPeople(report) && issue?.employeeId
  ? "Há uma pendência individual. O detalhe é restrito aos perfis autorizados."
  : issue?.message || "Pendência sem descrição.";

export function laborProjectionFilterSummary(report) {
  const filters = report.filters || {}, options = report.options || {};
  const area = ({ all: "Todas as áreas", works: "Obras", administrative: "Administrativo", unassigned: "Sem lotação" })[filters.area] || "Todas as áreas";
  return [area,
    filters.obraId && (list(options.works).find(work => String(work.id) === String(filters.obraId))?.name || "Obra selecionada"),
    filters.mode && laborProjectionMode(filters.mode), filters.role,
    laborProjectionCanViewPeople(report) && filters.employeeId && (list(options.employees).find(person => String(person.id) === String(filters.employeeId))?.name || "Pessoa selecionada"),
    filters.onlyIssues && "Somente pendências",
  ].filter(Boolean).join(" · ");
}

export function laborProjectionMethodology(report) {
  const policy = report.policy || {};
  return [
    "Consulta limitada à quinzena ativa. Os filtros preservam o ciclo e a janela histórica definidos pelo servidor.",
    "A taxa histórica é a soma das faltas registradas dividida pelos dias classificados como presença, meio período ou falta. Afastamentos, feriados, dias fora da escala e dados ausentes têm tratamento separado.",
    amount(policy.minimumObservedDays) != null && amount(policy.minimumCoverage) != null
      ? `A referência individual exige ao menos ${policy.minimumObservedDays} dias classificados e ${laborProjectionPercent(policy.minimumCoverage)} de cobertura. Sem base individual suficiente, considera-se grupo comparável; sem base confiável, a taxa fica indisponível. Os limiares são heurísticas de produto, sem garantia estatística.`
      : "A taxa individual ou do grupo comparável depende dos critérios de cobertura da metodologia. Sem base confiável, a taxa fica indisponível.",
    "O custo conhecido permanece apurado. A frequência ajusta somente parcelas futuras dependentes de presença. Salário CLT de competência segue o motor da folha; a projeção não cria descontos nem altera direitos.",
    "A reserva preserva custos apurados e eventos futuros confirmados e considera presença integral apenas nos dias ordinários ainda não apurados. É um cenário de referência; horas extras, substituições e novos eventos podem superá-lo.",
    "Remuneração e encargos já inclui os encargos informados. O total do dia inclui benefícios; os encargos não são somados uma segunda vez.",
    "Custo, líquido e saldo a desembolsar são leituras distintas. Pagamentos e adiantamentos aplicáveis reduzem obrigações de caixa, sem reduzir o custo de competência.",
  ];
}

function historyRows(report) {
  const rows = [];
  const append = (scope, name, history) => {
    if (!history) return;
    const intervals = list(history.intervals);
    for (const interval of intervals.length ? intervals : [history]) rows.push([
      scope, name, excelDate(interval.startDate || report.history?.startDate), excelDate(interval.endDate || report.history?.endDate),
      amount(interval.expectedDays), amount(interval.eligibleDays), amount(interval.observedDays), amount(interval.missingDays), amount(interval.excludedDays),
      amount(interval.absenceDays), amount(interval.halfDays), amount(interval.coverage), amount(interval.representedIntervals),
    ]);
  };
  append("Consulta", "Consolidado", report.history);
  for (const group of list(report.groups)) append("Centro", group.name, group.history);
  for (const person of laborProjectionPeople(report)) append("Pessoa autorizada", person.name, person.history);
  return rows;
}

export function buildLaborProjectionTables(report) {
  const totals = report.totals || {}, cash = report.cash || {}, people = laborProjectionPeople(report);
  const summary = [
    [totals.partial ? "Subtotal parcial de custo" : "Custo esperado", amount(totals.projectedCost), null, null, totals.partial ? "Subtotal disponível; existem parcelas sem base suficiente." : "Total da consulta"],
    ["Condição da estimativa", null, null, null, totals.provisional ? "Provisória: há parcelas com condição ou conferência pendente." : "Conforme a cobertura e as premissas da consulta."],
    ["Custo já apurado", amount(totals.actualCost)], ["Futuro confirmado", amount(totals.confirmedFutureCost)],
    ["Estimativa de dias futuros", amount(totals.estimatedCost)], ["Reserva provisória de pendências", amount(totals.pendingCost)],
    ["Referência com presença integral", amount(totals.fullAttendanceReserve), null, null, "Cenário de referência; não é teto absoluto."],
    ["Pessoas distintas consideradas", null, amount(totals.employeeCount)], ["Dias futuros", null, amount(totals.futureDays)],
    ["Dias pendentes de conferência", null, amount(totals.pendingDays)], ["Dias sem valor calculável", null, amount(totals.unpricedDays)],
    ["Início do ciclo", null, null, excelDate(report.period?.startDate)], ["Fim do ciclo", null, null, excelDate(report.period?.endDate)],
    ["Corte dos dados", null, null, excelDate(report.asOf)], ["Pagamento previsto", null, null, excelDate(report.period?.paymentDate)],
    ["Histórico: início", null, null, excelDate(report.history?.startDate)], ["Histórico: fim", null, null, excelDate(report.history?.endDate)],
    ["Ciclo", null, null, null, report.period?.key], ["Consulta", null, null, null, `${laborProjectionTimestamp(report)} · ${report.timeZone || "America/Bahia"}`],
    ["Filtros confirmados", null, null, null, laborProjectionFilterSummary(report)],
    ["Versão da metodologia", null, null, null, report.methodologyVersion],
    ["Versão das fontes", null, null, null, typeof report.sourceVersion === "string" ? report.sourceVersion : JSON.stringify(report.sourceVersion ?? "")],
    ["Caixa: líquido previsto", amount(cash.projectedNet), null, null, cash.projectedNet == null ? "Indisponível; confira as pendências de caixa." : "Segundo obrigações e descontos válidos"],
    ["Caixa: saldo aos funcionários", amount(cash.remainingToPay), null, null, cash.remainingToPay == null ? "Indisponível; base incompleta." : "Pagamentos vinculados já considerados; não inclui tributos e repasses"],
    ["Caixa: líquido conhecido", amount(cash.knownNetAmount), null, null, "Subtotal conhecido; não completa parcelas indisponíveis."],
    ["Caixa: saldo conhecido", amount(cash.knownRemainingToPay), null, null, "Subtotal conhecido; não é o saldo completo quando há pendências."],
    ["Caixa: pagamentos vinculados", amount(cash.paidAmount)], ["Caixa: obrigações existentes", amount(cash.existingObligations)],
    ["Caixa: adiantamentos aplicados ao ciclo", amount(cash.advancesApplied)], ["Caixa: retenção sindical prevista", amount(cash.unionWithheldAmount)], ["Caixa: retenções a repassar", amount(cash.withheldTransfer)],
  ];
  for (const responsibility of list(cash.responsibilities)) {
    summary.push([`Responsável: ${responsibility.label} · líquido`, amount(responsibility.projectedNet)],
      [`Responsável: ${responsibility.label} · pago`, amount(responsibility.paidAmount)],
      [`Responsável: ${responsibility.label} · saldo`, amount(responsibility.remainingToPay), null, null, responsibility.partial ? "Parcial" : ""]);
  }
  for (const message of laborProjectionMethodology(report)) summary.push(["Metodologia", null, null, null, message]);
  for (const assumption of list(report.assumptions)) summary.push(["Premissa", null, null, null, typeof assumption === "string" ? assumption : assumption.message || ""]);
  const restricted = !laborProjectionCanViewPeople(report);
  const groups = new Map(list(report.groups).map(group => [String(group.id), group.name]));
  const issueRows = [...list(report.issues).map(issue => ["Projeção", issue]), ...list(cash.issues).map(issue => ["Caixa", issue])].map(([scope, issue]) => [
    scope, issue.code, issue.severity, laborProjectionIssueMessage(issue, report), excelDate(issue.date),
    restricted ? null : people.find(person => String(person.id) === String(issue.employeeId))?.name || null,
    groups.get(String(issue.groupId)) || list(report.options?.works).find(work => String(work.id) === String(issue.obraId))?.name || null,
  ]);
  return [
    { nome: "Resumo", colunas: [textColumn("Indicador", 43), moneyColumn("Valor"), textColumn("Quantidade", 16), dateColumn("Data"), textColumn("Informação / fonte", 95)], linhas: summary },
    { nome: "Obras e Administrativo", colunas: [textColumn("Centro", 34), textColumn("Tipo", 20), textColumn("Pessoas distintas", 19), textColumn("Dias futuros", 16), percentColumn("Taxa histórica"), textColumn("Origem da taxa", 27), moneyColumn("Apurado"), moneyColumn("Futuro confirmado"), moneyColumn("Estimado"), moneyColumn("Pendências"), moneyColumn("Custo esperado"), moneyColumn("Reserva integral"), percentColumn("Cobertura"), textColumn("Qualidade", 32)],
      linhas: list(report.groups).map(group => [group.name, ({ work: "Obra", administrative: "Administrativo", unassigned: "Sem lotação" })[group.kind] || group.kind, amount(group.employeeCount), amount(group.futureDays), amount(group.rate?.value), laborProjectionRateSource(group.rate?.source), amount(group.actualCost), amount(group.confirmedFutureCost), amount(group.estimatedCost), amount(group.pendingCost), amount(group.projectedCost), amount(group.fullAttendanceReserve), amount(group.history?.coverage), group.partial ? "Parcial" : group.rate?.limitedClassification ? "Histórico com classificação limitada" : group.provisional ? "Estimativa provisória" : "Conforme cobertura informada"]) },
    { nome: "Pessoas autorizadas", colunas: [textColumn("Pessoa", 32), textColumn("Função"), textColumn("Modalidade", 19), textColumn("Área", 20), percentColumn("Taxa aplicada"), textColumn("Origem da taxa", 27), textColumn("Faltas da amostra", 20), textColumn("Dias classificados", 20), percentColumn("Cobertura da taxa"), moneyColumn("Apurado"), moneyColumn("Futuro confirmado"), moneyColumn("Estimado"), moneyColumn("Pendências"), moneyColumn("Custo esperado"), moneyColumn("Reserva integral"), textColumn("Observação", 65)],
      linhas: restricted ? [["Detalhe individual restrito a perfis autorizados."]] : people.map(person => [person.name, person.role, laborProjectionMode(person.mode), person.workArea, amount(person.rate?.value), laborProjectionRateSource(person.rate?.source), amount(person.rate?.numerator), amount(person.rate?.denominator), amount(person.rate?.coverage), amount(person.actualCost), amount(person.confirmedFutureCost), amount(person.estimatedCost), amount(person.pendingCost), amount(person.projectedCost), amount(person.fullAttendanceReserve), [person.rate?.limitedClassification && "Histórico com classificação limitada; estimativa provisória.", person.rate?.reason].filter(Boolean).join(" ")]) },
    { nome: "Histórico", colunas: [textColumn("Escopo", 20), textColumn("Referência", 32), dateColumn("Início"), dateColumn("Fim"), textColumn("Dias previstos", 18), textColumn("Dias elegíveis", 18), textColumn("Observados P/M/F", 20), textColumn("Dados pendentes", 20), textColumn("Afastamentos excluídos", 25), textColumn("Faltas registradas", 20), textColumn("Meios períodos", 18), percentColumn("Cobertura"), textColumn("Intervalos com dados", 24)], linhas: historyRows(report) },
    { nome: "Memória de cálculo", colunas: [textColumn("Pessoa", 32), dateColumn("Data"), textColumn("Centro", 30), textColumn("Parcela", 25), textColumn("Componente", 30), textColumn("Situação", 23), textColumn("Modalidade", 18), moneyColumn("Remuneração e encargos"), moneyColumn("Encargos já incluídos"), moneyColumn("Benefícios"), moneyColumn("Custo da parcela"), moneyColumn("Reserva da parcela"), textColumn("Origem", 34), textColumn("Premissas e pendências", 95)],
      linhas: restricted ? [["Memória individual restrita a perfis autorizados."]] : people.flatMap(person => list(person.days).map(day => [person.name, excelDate(day.date), groups.get(String(day.groupId)) || (day.obraId ? "Obra do registro" : "Sem lotação"), laborProjectionPartition(day.partition), laborProjectionComponent(day.component), laborProjectionStatus(day.status), laborProjectionMode(day.mode), amount(day.laborCost), amount(day.chargesCost), amount(day.benefitCost), amount(day.totalCost), amount(day.reserveCost), laborProjectionSource(day.source), [...list(day.assumptions), ...list(day.issues)].map(item => typeof item === "string" ? item : item.message || "").join(" · ")])) },
    { nome: "Pendências", colunas: [textColumn("Leitura", 18), textColumn("Código", 28), textColumn("Severidade", 18), textColumn("Pendência", 95), dateColumn("Data"), textColumn("Pessoa autorizada", 32), textColumn("Centro", 32)], linhas: issueRows.length ? issueRows : [["Consulta", null, null, "Nenhuma pendência identificada nesta consulta."]] },
  ];
}

export async function buildLaborProjectionWorkbook(report) {
  const { workbookFromTables } = await import("../lib/spreadsheet.js");
  return workbookFromTables(buildLaborProjectionTables(report));
}

const htmlTable = (caption, headers, rows) => `<table><caption>${escapeHtml(caption)}</caption><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => `<${index ? "td" : "th scope=\"row\""}>${escapeHtml(cell)}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table>`;

function personMemoryHtml(person, personIndex, groups) {
  const money = laborProjectionMoney, date = laborProjectionDate, percent = laborProjectionPercent;
  const notes = [], noteNumbers = new Map();
  const dailyRows = list(person.days).map(day => {
    const messages = [...new Set([...list(day.assumptions), ...list(day.issues)]
      .map(item => typeof item === "string" ? item : item.message || "").filter(Boolean))];
    const references = messages.map(message => {
      if (!noteNumbers.has(message)) { notes.push(message); noteNumbers.set(message, notes.length); }
      return `[${noteNumbers.get(message)}]`;
    });
    return [date(day.date), groups.get(String(day.groupId)) || "Sem lotação",
      `${laborProjectionPartition(day.partition)} · ${laborProjectionComponent(day.component)} · ${laborProjectionStatus(day.status)}`,
      money(day.laborCost), money(day.chargesCost), money(day.benefitCost), money(day.totalCost), money(day.reserveCost),
      [laborProjectionSource(day.source), references.length ? `Notas ${references.join(", ")}` : ""].filter(Boolean).join(" · ")];
  });
  return `<section class="person">
    ${personIndex === 0 ? "<h2>Detalhe autorizado por pessoa</h2>" : ""}
    <h3>${escapeHtml(person.name)} · ${escapeHtml(person.role || "Função não informada")}</h3>
    <p>${escapeHtml(laborProjectionMode(person.mode))} · Taxa: ${escapeHtml(percent(person.rate?.value))} (${escapeHtml(laborProjectionRateSource(person.rate?.source))}) · Amostra: ${escapeHtml(person.rate?.numerator ?? "—")} faltas / ${escapeHtml(person.rate?.denominator ?? "—")} dias classificados · Cobertura: ${escapeHtml(percent(person.rate?.coverage))}.</p>
    ${person.rate?.limitedClassification ? "<p>Histórico com classificação limitada. Estimativa provisória; não gera desconto em folha.</p>" : ""}
    <p>${escapeHtml(person.rate?.reason || "")}</p>
    ${htmlTable("Resumo da pessoa", ["Apurado", "Futuro confirmado", "Estimado", "Pendências", "Custo esperado", "Reserva integral"], [[money(person.actualCost), money(person.confirmedFutureCost), money(person.estimatedCost), money(person.pendingCost), money(person.projectedCost), money(person.fullAttendanceReserve)]])}
    ${htmlTable("Histórico individual", ["Intervalo", "Previstos", "Observados", "Pendentes", "Afastamentos", "Faltas", "Meios períodos", "Cobertura"], list(person.history?.intervals).map(interval => [`${date(interval.startDate)} a ${date(interval.endDate)}`, interval.expectedDays ?? "—", interval.observedDays ?? "—", interval.missingDays ?? "—", interval.excludedDays ?? "—", interval.absenceDays ?? "—", interval.halfDays ?? "—", percent(interval.coverage)]))}
    ${htmlTable("Memória diária por componente · encargos já incluídos na remuneração", ["Data", "Centro", "Parcela / componente", "Remuneração e encargos", "Encargos incluídos", "Benefícios", "Custo", "Reserva", "Fonte / notas"], dailyRows)}
    ${notes.length ? `<div class="memory-notes"><h3>Premissas e pendências da memória diária</h3><p>As referências entre colchetes na tabela correspondem às notas abaixo.</p><ol>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}</ol></div>` : ""}
  </section>`;
}

export function buildLaborProjectionPdfHtml(report) {
  const totals = report.totals || {}, cash = report.cash || {}, people = laborProjectionPeople(report);
  const money = laborProjectionMoney, date = laborProjectionDate, percent = laborProjectionPercent;
  const groups = new Map(list(report.groups).map(group => [String(group.id), group.name]));
  const summary = [[totals.partial ? "Subtotal parcial de custo" : "Custo esperado", money(totals.projectedCost)], ["Já apurado", money(totals.actualCost)], ["Futuro confirmado", money(totals.confirmedFutureCost)], ["Estimativa futura", money(totals.estimatedCost)], ["Pendências: reserva provisória", money(totals.pendingCost)], ["Reserva com presença integral", money(totals.fullAttendanceReserve)]];
  const groupRows = list(report.groups).map(group => [group.name, group.employeeCount ?? "—", group.futureDays ?? "—", `${percent(group.rate?.value)} · ${laborProjectionRateSource(group.rate?.source)}`, money(group.actualCost), money(group.confirmedFutureCost), money(group.estimatedCost), money(group.pendingCost), money(group.projectedCost), money(group.fullAttendanceReserve), `${percent(group.history?.coverage)}${group.partial ? " · parcial" : ""}`]);
  const history = list(report.history?.intervals).map(interval => [`${date(interval.startDate)} a ${date(interval.endDate)}`, interval.expectedDays ?? "—", interval.observedDays ?? "—", interval.missingDays ?? "—", interval.excludedDays ?? "—", interval.absenceDays ?? "—", interval.halfDays ?? "—", percent(interval.coverage)]);
  const responsibilities = list(cash.responsibilities).map(item => [item.label, money(item.projectedNet), money(item.paidAmount), money(item.remainingToPay), item.partial ? "Parcial" : "Conforme obrigações informadas"]);
  const issues = [...list(report.issues), ...list(cash.issues)];
  const individual = !laborProjectionCanViewPeople(report)
    ? "<h2>Detalhe autorizado por pessoa</h2><p>O detalhe individual e a memória diária são restritos aos perfis autorizados.</p>"
    : people.length ? people.map((person, index) => personMemoryHtml(person, index, groups)).join("")
      : "<h2>Detalhe autorizado por pessoa</h2><p>Nenhuma pessoa neste recorte.</p>";
  return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Projeção de mão de obra · ${escapeHtml(report.period?.key)}</title><style>@page{size:A4 landscape;margin:12mm}body{padding:12px}header p{margin:4px 0}h2{margin-top:24px;break-after:avoid}h3{margin-top:18px;break-after:avoid}table{width:100%;border-collapse:collapse;margin:10px 0 18px}caption{text-align:left;font-weight:600;margin-bottom:6px;break-after:avoid;page-break-after:avoid}.memory-notes{font-size:10px}.memory-notes li{margin:5px 0}td,th{border-bottom:1px solid #d9dde2;padding:6px;text-align:left;vertical-align:top}td{font-variant-numeric:tabular-nums}p,li{overflow-wrap:anywhere}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.summary div{padding:8px 0;border-bottom:1px solid #d9dde2}.summary strong{display:block;font-size:16px}.note{padding:10px;border:1px solid #d9dde2}.person{break-before:page}.metadata{font-size:10px;color:#536171}.toolbar{margin:12px 0}</style></head><body><header><h1>Projeção de mão de obra</h1><p>Quinzena ativa: ${escapeHtml(date(report.period?.startDate))} a ${escapeHtml(date(report.period?.endDate))} · ${escapeHtml(report.period?.key)}</p><p>Corte: ${escapeHtml(date(report.asOf))} · Pagamento previsto: ${escapeHtml(date(report.period?.paymentDate))}</p><p>Histórico: ${escapeHtml(date(report.history?.startDate))} a ${escapeHtml(date(report.history?.endDate))} · Consulta: ${escapeHtml(laborProjectionTimestamp(report))} (${escapeHtml(report.timeZone || "America/Bahia")})</p><p>Filtros confirmados: ${escapeHtml(laborProjectionFilterSummary(report))}</p></header><div class="toolbar"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div>${totals.partial ? "<p class=\"note\">Subtotal parcial: existem parcelas sem base suficiente. Confira as pendências antes de definir a reserva.</p>" : ""}${totals.provisional ? "<p class=\"note\">Estimativa provisória: há parcelas com condição ou conferência pendente, separadas do custo apurado.</p>" : ""}<div class="summary">${summary.map(([label, value]) => `<div>${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></div>`).join("")}</div><p>${escapeHtml(totals.employeeCount ?? "—")} pessoa(s) distinta(s) · ${escapeHtml(totals.pendingDays ?? "—")} dia(s) a conferir · ${escapeHtml(totals.unpricedDays ?? "—")} dia(s) sem valor calculável. A referência de presença integral é um cenário, não um teto.</p><h2>Obras e Administrativo</h2>${htmlTable("Composição por centro", ["Centro", "Equipe", "Dias futuros", "Taxa histórica", "Apurado", "Confirmado", "Estimado", "Pendências", "Esperado", "Reserva", "Cobertura"], groupRows)}<h2>Histórico e cobertura</h2><p>Cobertura consolidada: ${escapeHtml(percent(report.history?.coverage))}. ${escapeHtml(report.history?.observedDays ?? "—")} dias observados de ${escapeHtml(report.history?.eligibleDays ?? "—")} elegíveis; ${escapeHtml(report.history?.missingDays ?? "—")} pendentes e ${escapeHtml(report.history?.excludedDays ?? "—")} afastamentos excluídos.</p>${htmlTable("Três intervalos anteriores à abertura da quinzena", ["Intervalo", "Previstos", "Observados", "Pendentes", "Afastamentos", "Faltas", "Meios períodos", "Cobertura"], history)}<h2>Caixa e obrigações</h2><p>${cash.partial || !cash.available ? "A previsão de caixa está incompleta. Valores conhecidos são subtotais, sem substituir parcelas indisponíveis." : "Líquido e saldo aos funcionários, segundo obrigações válidas e pagamentos vinculados ao ciclo. Tributos e repasses exigem obrigações próprias."}</p>${htmlTable("Valores de caixa, separados do custo", ["Leitura", "Valor"], [["Líquido previsto aos funcionários", money(cash.projectedNet)], ["Saldo a desembolsar aos funcionários", money(cash.remainingToPay)], ["Líquido conhecido (subtotal)", money(cash.knownNetAmount)], ["Saldo conhecido (subtotal)", money(cash.knownRemainingToPay)], ["Pagamentos vinculados", money(cash.paidAmount)], ["Obrigações existentes", money(cash.existingObligations)], ["Adiantamentos aplicados ao ciclo", money(cash.advancesApplied)], ["Retenção sindical prevista", money(cash.unionWithheldAmount)], ["Retenções a repassar", money(cash.withheldTransfer)]])}${responsibilities.length ? htmlTable("Responsáveis pelo pagamento", ["Responsável", "Líquido", "Pago", "Saldo", "Cobertura"], responsibilities) : ""}<h2>Pendências e premissas</h2>${issues.length ? `<ul>${issues.map(issue => `<li>${escapeHtml(laborProjectionIssueMessage(issue, report))}${issue.date ? ` · ${escapeHtml(date(issue.date))}` : ""}</li>`).join("")}</ul>` : "<p>Nenhuma pendência identificada nesta consulta.</p>"}<ul>${list(report.assumptions).map(item => `<li>${escapeHtml(typeof item === "string" ? item : item.message || "")}</li>`).join("")}</ul><h2>Metodologia</h2><ul>${laborProjectionMethodology(report).map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul><p class="metadata">Metodologia: ${escapeHtml(report.methodologyVersion)} · Fontes: ${escapeHtml(typeof report.sourceVersion === "string" ? report.sourceVersion : JSON.stringify(report.sourceVersion ?? ""))}. A exportação preserva os valores e o corte da consulta, sem novo cálculo.</p>${individual}</body></html>`);
}

export function exportLaborProjectionPdf(report) {
  const html = buildLaborProjectionPdfHtml(report);
  const preview = window.open("", "_blank");
  if (!preview) throw new Error("Permita a abertura de janelas para visualizar e salvar o PDF.");
  preview.opener = null;
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
  return preview;
}

export async function exportLaborProjectionExcel(report) {
  const { writeTables } = await import("../lib/spreadsheet.js");
  const stamp = String(report.generatedAt || "consulta").replace(/[^\dA-Za-z]/g, "");
  await writeTables(buildLaborProjectionTables(report), `Projecao-mao-de-obra-${report.period?.key || "quinzena"}-${stamp}.xlsx`);
}
