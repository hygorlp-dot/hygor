import {active, toCents, fromCents} from '../financeiro/ledger.js';
import {validDate} from './date-validation.js';
import {latestClosedPayrollDate} from './attendance-pay-mode.js';

// New advances are requests to pay. The bank settlement is the evidence that
// money was delivered; a cached balance or an advance's status is not evidence.
export function advancePaymentTitle(advance, data = {}) {
  if (!advance?.paymentTitleId) return null;
  return (data.titulosFolha || []).find(title => String(title.id) === String(advance.paymentTitleId)
    && String(title.employeeId) === String(advance.empId)
    && title.snapshotCalculo?.kind === 'advance'
    && String(title.snapshotCalculo.advanceId) === String(advance.id)) || null;
}

function paymentsFor(advance, data) {
  const title = advancePaymentTitle(advance, data);
  if (!title || !active(title) || !active(advance)) return [];
  return (title.liquidacoes || []).filter(payment => active(payment)
    && validDate(payment.data) && payment.data >= advance.date && toCents(payment.valor) > 0)
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)));
}

export function advancePaymentStatus(advance, data = {}) {
  const requestedCents = Math.max(0, toCents(advance?.amount));
  const paidCents = Math.min(requestedCents, paymentsFor(advance, data)
    .reduce((sum, payment) => sum + toCents(payment.valor), 0));
  return {requested: fromCents(requestedCents), paid: fromCents(paidCents),
    balance: fromCents(requestedCents - paidCents),
    status: !active(advance) ? 'cancelled' : paidCents === 0 ? 'pending'
      : paidCents >= requestedCents ? 'paid' : 'partial'};
}

// Allocate paid cents in the agreed installment order. An overdue installment
// only becomes eligible on the actual payment date, never in a closed past day.
export function paidAdvanceDeductions(advance, data = {}) {
  if (!active(advance) || !advance?.paymentTitleId) return [];
  const installments = (advance.installments || []).filter(item => active(item)
    && validDate(item.dueDate) && toCents(item.amount) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || Number(a.number) - Number(b.number));
  const rows = [];
  let index = 0, allocated = 0, installmentAllocated = 0;
  const total = Math.max(0, toCents(advance.amount));
  for (const payment of paymentsFor(advance, data)) {
    let remaining = Math.min(toCents(payment.valor), total - allocated);
    while (remaining > 0 && index < installments.length) {
      const installment = installments[index];
      const cents = Math.min(remaining, toCents(installment.amount) - installmentAllocated);
      rows.push({advanceId: advance.id, installmentId: installment.id, paymentId: payment.id,
        date: payment.data > installment.dueDate ? payment.data : installment.dueDate,
        amount: fromCents(cents)});
      remaining -= cents; allocated += cents; installmentAllocated += cents;
      if (installmentAllocated >= toCents(installment.amount)) {index += 1; installmentAllocated = 0;}
    }
  }
  return rows;
}

export function advanceClaimedInPayroll(data, advance) {
  const id = String(advance.id);
  const references = snapshot => (snapshot?.advanceRefs || []).some(item => String(item.id) === id)
    || (snapshot?.advanceIds || []).some(item => String(item) === id)
    || (snapshot?.advances || []).some(item => String(item.id) === id);
  if ((data.titulosFolha || []).some(title => active(title)
    && title.snapshotCalculo?.kind !== 'advance' && references(title.snapshotCalculo))) return true;
  const employee = (data.employees || []).find(item => String(item.id) === String(advance.empId));
  return Object.values(employee?.cltPayroll?.drafts || {}).some(draft => draft.confirmed && references(draft));
}

export function advancePaymentIssue(data, title, date) {
  if (title?.snapshotCalculo?.kind !== 'advance') return '';
  const advance = (data.advances || []).find(item => String(item.paymentTitleId) === String(title.id));
  if (!advance || !active(advance) || !advancePaymentTitle(advance, data)) return 'O adiantamento de origem está ausente ou cancelado.';
  if (!validDate(date) || date < advance.date) return 'O pagamento do adiantamento deve ter data válida, igual ou posterior à solicitação.';
  const employee = (data.employees || []).find(item => String(item.id) === String(advance.empId));
  const closed = employee ? latestClosedPayrollDate(data, employee) : '';
  if (closed && date <= closed) return 'O pagamento alteraria desconto de folha já fechada. Registre o pagamento na data efetiva e um ajuste identificado.';
  return '';
}

export function advancePaymentReversalIssue(data, transactionId, {bankRefund = false} = {}) {
  for (const advance of data.advances || []) {
    const title = advancePaymentTitle(advance, data);
    if (!title || !active(title) || !(title.liquidacoes || []).some(payment => active(payment)
      && String(payment.transacaoId) === String(transactionId))) continue;
    if (bankRefund) return 'O adiantamento ainda consta como pago. Reverta a liquidação identificada antes de vincular a devolução bancária.';
    if (advanceClaimedInPayroll(data, advance)) return 'O adiantamento já está compensado em demonstrativo ou título de folha. Registre um ajuste identificado, preservando o desconto aprovado.';
    const employee = (data.employees || []).find(item => String(item.id) === String(advance.empId));
    const closed = employee ? latestClosedPayrollDate(data, employee) : '';
    if (closed && paidAdvanceDeductions(advance, data).some(row => row.date <= closed)) {
      return 'O pagamento do adiantamento participa de folha já fechada. Registre um ajuste identificado.';
    }
  }
  return '';
}
