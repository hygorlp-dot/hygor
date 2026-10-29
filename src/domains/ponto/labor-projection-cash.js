// Consulta derivada: títulos substituem a previsão, sem gerar lançamento nem
// transformar custo de competência (incluindo encargos) em líquido salarial.
import { active, buildFinancialLedger, fromCents, toCents } from "../financeiro/ledger.js";
import { advanceDeductionForPeriod } from "../rh/advance-commands.js";
import { totalLiquidadoFolha } from "../conciliacao/payroll.js";
import { allocateAdvancesByWork } from "./advance-allocation.js";
import { allocateNetByWork } from "./payroll-closing.js";
import { splitPayrollResponsibility } from "./payroll-responsibility.js";
import { allocateUnionDueByWork, calculatePayrollSettlement, calculateUnionDue } from "./union-dues.js";

export const LABOR_PROJECTION_CASH_ISSUE_MESSAGES = Object.freeze({
  "LABOR_CASH_FILTER_PARTIAL": "O filtro seleciona apenas parte das parcelas desta pessoa. O líquido é apurado por quinzena; remova esse filtro para conferir o caixa completo.",
  "LABOR_TITLE_DEDUCTIONS_UNALLOCATED": "O título fechado não discrimina adiantamentos e retenções por obra. O líquido e o pagamento têm rateio, mas esses descontos não foram distribuídos por aproximação.",
  "LABOR_PAYMENT_LEGACY_OVERLAP": "Há pagamento vinculado junto de um total pago legado sem transação identificada. Confira a possível sobreposição antes de concluir o saldo.",
  "LABOR_PAYMENT_ALLOCATION_MISSING": "Um pagamento vinculado não identifica a obra e há mais de um centro na quinzena. O valor não foi distribuído por aproximação.",
  "LABOR_TITLE_WITHOUT_PERIOD_PARCELS": "Há obrigação da quinzena sem parcelas identificáveis na população deste recorte. Confira os vínculos da folha antes de concluir o saldo.",
  "LABOR_MIXED_MODE_NET_UNAVAILABLE": "A pessoa mudou de modalidade no ciclo. O título do fechamento de diaristas cobre essa obrigação; o líquido CLT restante exige holerite vinculado e permanece indisponível.",
  "LABOR_PAYMENT_DUPLICATED": "Uma liquidação repetida foi contada uma única vez.",
  "LABOR_PAYMENT_DATE_MISSING": "Há pagamento vinculado sem data verificável.",
  "LABOR_TITLE_AMBIGUOUS": "Há mais de um título ativo para a mesma pessoa e quinzena; confira as obrigações.",
  "LABOR_TITLE_MODE_UNALLOCATED": "O título da quinzena não separa o líquido das modalidades selecionadas.",
  "LABOR_TITLE_ALLOCATION_MISSING": "O rateio do título não permite identificar o líquido deste recorte com segurança.",
  "LABOR_CLT_NET_UNAVAILABLE": "O líquido CLT exige holerite ou título válido vinculado a esta quinzena; salário de competência não é líquido a transferir.",
  "LABOR_NET_PARTIAL_SOURCE": "Há parcelas sem remuneração ou estimativa confiável; o líquido desta pessoa está indisponível.",
  "LABOR_PAYMENT_PERIOD_UNLINKED": "Há pagamento no ciclo sem vínculo inequívoco com a quinzena. Ele não foi abatido automaticamente.",
  "LABOR_PAYMENT_EXCEEDS_NET": "Os pagamentos vinculados superam o líquido desta parcela; confira o saldo e possíveis estornos.",
  "LABOR_WITHHOLDING_DUE_UNAVAILABLE": "A retenção sindical reduz o líquido ao trabalhador. O repasse tem vencimento e obrigação próprios, ainda não identificados nesta consulta."
});

const idOf = value => String(value ?? "");
const amount = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const dateOf = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10))
  ? String(value).slice(0, 10) : "";
const samePeriod = (item, period) => item.periodKey
  ? item.periodKey === period.key
  : item.periodoInicio === period.startDate && item.periodoFim === period.endDate;
const sameEmployee = (item, id) => idOf(item.employeeId || item.empId) === id;
const sum = (rows, field) => rows.reduce((total, row) => total + toCents(row[field]), 0);
const centsByGroup = (cents, rows, field = "netObra") => new Map(
  allocateNetByWork(cents, rows.map(row => ({ ...row, netObra: amount(row[field]) })))
    .map(row => [row.groupId, row.cents]),
);

const dailyAllocations = person => {
  const groups = new Map();
  for (const day of person.days || []) {
    if (!groups.has(day.groupId)) groups.set(day.groupId, {
      groupId: day.groupId, obraId: idOf(day.obraId), bruto: 0, vt: 0, vr: 0, diasTrabalhados: 0,
    });
    const row = groups.get(day.groupId);
    row.bruto += amount(day.laborCost) - amount(day.chargesCost);
    row.vt += amount(day.benefitCost);
    row.diasTrabalhados += Number.isFinite(day.workedDaysWeight) ? day.workedDaysWeight
      : day.status === "M" ? 0.5 : day.status === "P" || day.partition === "pending" ? 1 : 0;
  }
  return [...groups.values()].map(row => ({ ...row,
    bruto: fromCents(toCents(row.bruto)), vt: fromCents(toCents(row.vt)),
  })).sort((a, b) => b.diasTrabalhados - a.diasTrabalhados || a.groupId.localeCompare(b.groupId));
};

// A alocação é sempre feita sobre a pessoa inteira antes de aplicar o filtro
// de obra. Usar só os dias visíveis abateria o adiantamento inteiro em cada obra.
const projectedAllocations = (data, person, employee, period) => {
  const allocations = dailyAllocations(person);
  const gross = fromCents(sum(allocations, "bruto"));
  const benefits = fromCents(sum(allocations, "vt"));
  const advances = (data.advances || []).filter(item => sameEmployee(item, idOf(person.id)))
    .reduce((total, item) => total + advanceDeductionForPeriod(item, period.startDate, period.endDate), 0);
  const union = calculateUnionDue({ employee, config: data.config?.unionDues,
    payrollCycle: period.fortnight, periodEnd: period.endDate, periodKey: period.key,
    hasPayrollMovement: gross > 0 || advances > 0 });
  const settlement = calculatePayrollSettlement({ gross, benefits, advances, unionDue: union.amount });
  const rows = allocateUnionDueByWork(allocateAdvancesByWork(allocations, advances), settlement.appliedUnionDue);
  const net = centsByGroup(toCents(settlement.netPayable), rows);
  const applied = centsByGroup(toCents(gross + benefits - settlement.netBeforeUnion), rows, "advancesObra");
  const withheld = centsByGroup(toCents(settlement.appliedUnionDue), rows, "unionDueObra");
  return rows.map(row => ({ ...row, netCents: net.get(row.groupId) || 0,
    advancesCents: applied.get(row.groupId) || 0, withheldCents: withheld.get(row.groupId) || 0 }));
};

const titleAllocations = (title, person) => {
  const days = person.days || [];
  const rates = Array.isArray(title.rateiosPorObra) ? title.rateiosPorObra : [];
  if (!rates.length) return null;
  const grouped = new Map();
  for (const rate of rates) {
    const obraId = idOf(rate.obraId);
    const candidates = [...new Set(days.filter(day => idOf(day.obraId) === obraId).map(day => day.groupId))];
    // Uma obrigação sem centro identificável não é redistribuída pela lotação
    // atual; preserve a pendência para o fechamento poder ser conferido.
    if (candidates.length !== 1) return null;
    const groupId = candidates[0];
    const previous = grouped.get(groupId) || { groupId, obraId, netCents: 0 };
    previous.netCents += toCents(rate.valor);
    grouped.set(groupId, previous);
  }
  const rows = [...grouped.values()];
  if (rows.reduce((total, row) => total + row.netCents, 0) !== toCents(title.liquido)) return null;
  return rows;
};

const titlePayments = (title, asOf, warn) => {
  const transactions = new Set();
  const seen = new Set();
  let complete = true;
  if (Array.isArray(title.liquidacoes) && title.liquidacoes.length) {
    const liquidacoes = title.liquidacoes.filter(item => {
      if (!active(item)) return false;
      const key = idOf(item.transacaoId || item.id);
      if (key && seen.has(key)) { warn("LABOR_PAYMENT_DUPLICATED"); return false; }
      if (key) seen.add(key);
      const date = dateOf(item.data || item.date);
      if (!date) { complete = false; warn("LABOR_PAYMENT_DATE_MISSING"); return false; }
      if (date > asOf) return false;
      if (item.transacaoId) transactions.add(idOf(item.transacaoId));
      return true;
    });
    return { cents: toCents(totalLiquidadoFolha({ ...title, liquidacoes, valorPago: 0 })), complete, transactions, liquidacoes };
  }
  const paid = toCents(totalLiquidadoFolha(title));
  if (paid > 0) {
    const date = dateOf(title.dataPagamento || title.pagoEm);
    if (!date) { warn("LABOR_PAYMENT_DATE_MISSING"); return { cents: 0, complete: false, transactions }; }
    if (date <= asOf && title.transacaoId) transactions.add(idOf(title.transacaoId));
    return { cents: date <= asOf ? paid : 0, complete, transactions, legacy: true,
      liquidacoes: date <= asOf ? [{ id: "projection-legacy-payment", data: date, valor: fromCents(paid), transacaoId: title.transacaoId || "" }] : [] };
  }
  return { cents: 0, complete, transactions };
};

const allocatedTitlePayments = (title, liquidacoes, rows) => {
  // Consumir os eventos evita uma segunda regra para os centavos: o razão
  // arredonda cada liquidação e deixa o resto no último rateio do título.
  const ledger = buildFinancialLedger({ titulosFolha: [{ ...title, liquidacoes: liquidacoes || [] }] });
  const byGroup = new Map();
  for (const event of ledger.events.filter(item => item.effect === "cash_out")) {
    const row = rows.find(item => item.obraId === idOf(event.obraId));
    if (row) byGroup.set(row.groupId, (byGroup.get(row.groupId) || 0) + event.amountCents);
  }
  return byGroup;
};

/** Valores em reais. null significa parcela indisponível, nunca custo zero.
 * _cashBasis é interno ao servidor e é descartado pela whitelist de resposta.
 * remainingToPay refere-se aos trabalhadores; recolhimentos têm campo próprio.
 */
export const buildLaborProjectionCash = (data = {}, report = {}, { access } = {}) => {
  const period = report.period || {};
  const basis = new Map((report._cashBasis?.people || report.people || []).map(person => [idOf(person.id), person]));
  const employees = new Map((data.employees || []).map(employee => [idOf(employee.id), employee]));
  const issues = [];
  const responsibilities = new Map();
  let netComplete = true, balanceComplete = true, advancesComplete = true, withheldComplete = true;
  let knownNet = 0, knownBalance = 0, paidTotal = 0, existing = 0, advancesTotal = 0, withheldTotal = 0;
  const visibleIds = new Set((report.people || []).map(person => idOf(person.id)));
  for (const title of data.titulosFolha || []) {
    if (!active(title) || !samePeriod(title, period) || visibleIds.has(idOf(title.employeeId))) continue;
    const filters = report.filters || {}, employee = employees.get(idOf(title.employeeId));
    if (filters.employeeId && filters.employeeId !== idOf(title.employeeId)) continue;
    if (filters.role && employee?.role !== filters.role) continue;
    if (filters.mode && (employee?.remunerationMode || "daily") !== filters.mode) continue;
    if (filters.onlyIssues) continue;
    const workIds = (title.rateiosPorObra || []).map(row => idOf(row.obraId));
    if (access?.allowedWorkIds != null && !workIds.some(id => access.allowedWorkIds.map(String).includes(id))) continue;
    if (filters.obraId && !workIds.includes(filters.obraId)) continue;
    if (filters.area === "works" && !workIds.some(Boolean)) continue;
    if (filters.area === "administrative" && (employee?.workArea !== "administrativo" || workIds.some(Boolean))) continue;
    if (filters.area === "unassigned" && (employee?.workArea === "administrativo" || workIds.some(Boolean))) continue;
    netComplete = false; balanceComplete = false;
    issues.push({ code: "LABOR_TITLE_WITHOUT_PERIOD_PARCELS", severity: "warning",
      message: LABOR_PROJECTION_CASH_ISSUE_MESSAGES.LABOR_TITLE_WITHOUT_PERIOD_PARCELS });
    break;
  }
  for (const visible of report.people || []) {
    const employeeId = idOf(visible.id);
    const person = basis.get(employeeId) || visible;
    const employee = employees.get(employeeId) || {};
    const selected = new Set((visible.days || []).map(day => day.groupId));
    const visibleWorks = new Set((visible.days || []).map(day => idOf(day.obraId)));
    const warn = code => issues.push({ code, severity: "warning", message: LABOR_PROJECTION_CASH_ISSUE_MESSAGES[code], employeeId,
      ...(visibleWorks.size === 1 ? { obraId: [...visibleWorks][0] } : {}) });
    const unavailable = code => { netComplete = false; balanceComplete = false; warn(code); };
    const parcelKey = item => `${item.date}|${item.groupId}|${item.component || "daily"}`;
    const visibleParcels = new Set((visible.days || []).map(parcelKey));
    if ((person.days || []).some(item => selected.has(item.groupId) && !visibleParcels.has(parcelKey(item)))) {
      unavailable("LABOR_CASH_FILTER_PARTIAL"); continue;
    }
    const titles = (data.titulosFolha || []).filter(item => active(item) && sameEmployee(item, employeeId) && samePeriod(item, period));
    if (titles.length > 1) { unavailable("LABOR_TITLE_AMBIGUOUS"); continue; }
    let rows, payments = { cents: 0, complete: true, transactions: new Set() };
    if (titles.length) {
      const title = titles[0];
      if (report.filters?.mode && new Set((person.days || []).map(day => day.mode)).size > 1) {
        unavailable("LABOR_TITLE_MODE_UNALLOCATED"); continue;
      }
      rows = titleAllocations(title, person);
      if (!rows || !Number.isFinite(Number(title.liquido)) || Number(title.liquido) < 0) {
        unavailable("LABOR_TITLE_ALLOCATION_MISSING"); continue;
      }
      rows = rows.map(row => ({ ...row, netObra: fromCents(row.netCents) }));
      const advances = centsByGroup(toCents(title.adiantamentos), rows);
      // O fechamento canônico grava a retenção sindical em descontos. Para
      // títulos externos sem closingId, não atribua outra retenção ao sindicato.
      const withheld = centsByGroup(title.closingId ? toCents(title.descontos) : 0, rows);
      if (rows.some(row => !selected.has(row.groupId))) {
        if (amount(title.adiantamentos) > 0) advancesComplete = false;
        if (title.closingId && amount(title.descontos) > 0) withheldComplete = false;
        if (amount(title.adiantamentos) > 0 || title.closingId && amount(title.descontos) > 0) {
          warn("LABOR_TITLE_DEDUCTIONS_UNALLOCATED");
        }
      }
      rows = rows.map(row => ({ ...row, advancesCents: advances.get(row.groupId) || 0,
        withheldCents: withheld.get(row.groupId) || 0 }));
      if (title.closingId && (visible.days || []).some(day => day.mode === "clt")
        && (person.days || []).some(day => day.mode === "daily")) {
        unavailable("LABOR_MIXED_MODE_NET_UNAVAILABLE");
      }
      payments = titlePayments(title, report.asOf, warn);
      existing += rows.filter(row => selected.has(row.groupId)).reduce((total, row) => total + row.netCents, 0);
    } else {
      if ((person.days || []).some(day => day.mode === "clt")) {
        unavailable("LABOR_CLT_NET_UNAVAILABLE"); continue;
      }
      if (!(person.days || []).length || (person.days || []).some(day => day.totalCost == null || day.laborCost == null || day.benefitCost == null)) {
        unavailable("LABOR_NET_PARTIAL_SOURCE"); continue;
      }
      rows = projectedAllocations(data, person, employee, period);
    }
    const paidByGroup = titles.length ? allocatedTitlePayments(titles[0], payments.liquidacoes, rows) : new Map();
    const seenPayments = new Set(payments.transactions);
    for (const payment of data.pagamentosFolha || []) {
      if (!active(payment) || !sameEmployee(payment, employeeId)) continue;
      const date = dateOf(payment.data || payment.date);
      if (date && date > report.asOf) continue;
      const transaction = idOf(payment.transacaoId || payment.id);
      if (transaction && seenPayments.has(transaction)) continue;
      if (payment.periodKey && payment.periodKey !== period.key) continue;
      if (payment.obraId && !rows.some(row => row.obraId === idOf(payment.obraId))) continue;
      if (!samePeriod(payment, period) && !(titles.length && idOf(payment.payrollTitleId) === idOf(titles[0].id))) {
        if (date >= period.startDate && date <= report.asOf && (!payment.obraId || visibleWorks.has(idOf(payment.obraId)))) {
          payments.complete = false;
          warn("LABOR_PAYMENT_PERIOD_UNLINKED");
        }
        continue;
      }
      if (!date) { payments.complete = false; warn("LABOR_PAYMENT_DATE_MISSING"); continue; }
      if (payments.legacy) {
        payments.complete = false;
        warn("LABOR_PAYMENT_LEGACY_OVERLAP");
        continue;
      }
      if (transaction) seenPayments.add(transaction);
      const candidates = payment.obraId ? rows.filter(row => row.obraId === idOf(payment.obraId)) : rows;
      if (candidates.length !== 1) {
        payments.complete = false;
        warn("LABOR_PAYMENT_ALLOCATION_MISSING");
        continue;
      }
      const amounts = centsByGroup(toCents(payment.valor), candidates.map(row => ({ ...row, netObra: fromCents(row.netCents) })));
      for (const [group, cents] of amounts) paidByGroup.set(group, (paidByGroup.get(group) || 0) + cents);
    }
    if (!payments.complete) balanceComplete = false;
    const split = splitPayrollResponsibility({ works: data.obras || [], allocations: rows
      .filter(row => selected.has(row.groupId)).map(row => ({ ...row, netObra: fromCents(row.netCents) })) });
    for (const row of split.rows) {
      const paid = paidByGroup.get(row.groupId) || 0;
      const balance = Math.max(0, row.netCents - paid);
      knownNet += row.netCents;
      paidTotal += paid;
      if (payments.complete) knownBalance += balance;
      advancesTotal += row.advancesCents || 0;
      withheldTotal += row.withheldCents || 0;
      const id = `${row.payer}:${row.groupId}`;
      const summary = responsibilities.get(id) || { id, payer: row.payer, label: row.payer === "construtora" ? `Construtora · ${(report.groups || []).find(group => group.id === row.groupId)?.name || (data.obras || []).find(work => idOf(work.id) === row.obraId)?.name || "Sem lotação definida"}` : row.payerLabel,
        obraId: row.obraId, projectedNet: 0, paidAmount: 0, remainingToPay: 0, knownRemainingToPay: 0, partial: false };
      summary.projectedNet += row.netCents;
      summary.paidAmount += paid;
      summary.remainingToPay += balance;
      if (payments.complete) summary.knownRemainingToPay += balance;
      summary.partial ||= !payments.complete;
      responsibilities.set(id, summary);
      if (paid > row.netCents) warn("LABOR_PAYMENT_EXCEEDS_NET");
    }
  }
  if (withheldTotal > 0) issues.push({ code: "LABOR_WITHHOLDING_DUE_UNAVAILABLE", severity: "warning",
    message: LABOR_PROJECTION_CASH_ISSUE_MESSAGES.LABOR_WITHHOLDING_DUE_UNAVAILABLE });
  return {
    available: netComplete, partial: !netComplete || !balanceComplete || !advancesComplete || !withheldComplete,
    projectedNet: netComplete ? fromCents(knownNet) : null,
    remainingToPay: netComplete && balanceComplete ? fromCents(knownBalance) : null,
    knownNetAmount: fromCents(knownNet), knownRemainingToPay: fromCents(knownBalance),
    paidAmount: fromCents(paidTotal), existingObligations: fromCents(existing),
    advancesApplied: advancesComplete ? fromCents(advancesTotal) : null,
    unionWithheldAmount: withheldComplete ? fromCents(withheldTotal) : null,
    withheldTransfer: withheldTotal > 0 || !withheldComplete ? null : 0,
    responsibilities: [...responsibilities.values()].map(row => ({ ...row,
      projectedNet: fromCents(row.projectedNet), paidAmount: fromCents(row.paidAmount),
      knownRemainingToPay: fromCents(row.knownRemainingToPay),
      remainingToPay: row.partial ? null : fromCents(row.remainingToPay) })),
    issues,
  };
};
