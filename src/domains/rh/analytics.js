import { employeeLifecycleStatus } from "./employee-commands";
import { employeeComplianceStatus } from "./compliance";
import { isAdvanceActive } from "./advance-commands";
import {advancePaymentStatus} from './advance-settlements.js';
import {fromCents,toCents} from '../financeiro/ledger.js';

const monthOf = dateStr => String(dateStr || "").slice(0, 7);

// Contagem de funcionários por situação de ciclo de vida (reaproveita
// employeeLifecycleStatus, mesma régua já usada em Equipe/Rescisão - não
// reimplementa a classificação aqui).
export const rhHeadcountSummary = (employees = [], asOf = "") => {
  const counts = { ativo: 0, desligamento_agendado: 0, desligado: 0, arquivado: 0 };
  employees.forEach(employee => {
    const status = employeeLifecycleStatus(employee, asOf);
    counts[status] = (counts[status] || 0) + 1;
  });
  return { ...counts, total: employees.length };
};

// Admissões e desligamentos cujo mês (YYYY-MM) bate com monthStr. É uma
// leitura simples de turnover por competência, não uma taxa anualizada -
// serve para o painel mostrar "o que mudou neste mês", não para RH
// estatístico avançado.
export const rhTurnoverForMonth = (employees = [], monthStr = "") => {
  const admissions = employees.filter(employee => monthOf(employee.startDate) === monthStr).length;
  const terminations = employees.filter(employee => employee.endDate && monthOf(employee.endDate) === monthStr).length;
  return { admissions, terminations };
};

// Com o estado financeiro, o painel mostra o que falta pagar. Legados sem
// título mantêm sua semântica de valor já adiantado e não criam nova obrigação.
// A assinatura antiga permanece disponível para consumidores de totais brutos.
export const rhOpenAdvancesSummary = (advances = [], data = null) => {
  const active = (advances || []).filter(isAdvanceActive);
  if(data){
    const legacy=active.filter(advance=>!advance.paymentTitleId);
    const pending=active.filter(advance=>advance.paymentTitleId).map(advance=>advancePaymentStatus(advance,data))
      .filter(payment=>['pending','partial'].includes(payment.status)&&payment.balance>0);
    return {count:pending.length,total:fromCents(pending.reduce((sum,payment)=>sum+toCents(payment.balance),0)),
      legacyCount:legacy.length,legacyTotal:fromCents(legacy.reduce((sum,advance)=>sum+toCents(advance.amount),0))};
  }
  return {
    count: active.length,
    total: active.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
  };
};

// Quantos funcionários ativos têm ao menos um documento/NR vencido (ASO ou
// treinamento), reaproveitando employeeComplianceStatus - mesma regra usada
// no alerta por funcionário em EquipeView.
export const rhComplianceSummary = (employees = [], asOf = "") => {
  const active = (employees || []).filter(employee => ['ativo','desligamento_agendado'].includes(employeeLifecycleStatus(employee, asOf)));
  const withExpired = active.filter(employee => employeeComplianceStatus(employee, asOf).expired.length > 0);
  return { activeCount: active.length, withExpiredCount: withExpired.length };
};
