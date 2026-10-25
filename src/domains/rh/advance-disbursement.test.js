import {it, expect} from 'vitest';
import {applyAdvanceCommand, ADVANCE_COMMAND, advanceDeductionForPeriod} from './advance-commands.js';
import {registrarPagamentoEConciliar, desfazerConciliacao, marcarEstorno} from '../conciliacao/mutations.js';
import {latestClosedPayrollDate} from './attendance-pay-mode.js';
import {buildFinancialLedger, selectAccountsPayable, selectCashFlow, selectDRE} from '../financeiro/ledger.js';

const actor = {id: 'financeiro-qa', nome: 'Financeiro QA', role: 'financeiro'};
function create({amount = 200, installmentCount = 1, firstDueDate = '2026-10-20'} = {}) {
  return applyAdvanceCommand({employees: [{id: 'piloto-k110-siclano', name: 'Siclano — SIMULAÇÃO',
    startDate: '2026-10-06', active: true, obra: 'piloto-k110'}], advances: [], transacoes: []}, {
    type: ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED, actorId: 'rh-qa', actorName: 'RH QA',
    payload: {advance: {id: 'qa-advance-200', empId: 'piloto-k110-siclano', date: '2026-10-14', amount,
      installmentCount, firstDueDate}},
  }, '2026-10-14T12:00:00Z');
}
function pay(data, amount, date = '2026-10-14', id = 'qa-bank-1') {
  const withBank = {...data, transacoes: [...(data.transacoes || []), {id, data: date, valor: -amount, status: 'pendente'}]};
  return registrarPagamentoEConciliar(withBank, {transacaoId: id, tipo: 'tituloFolha',
    entidadeId: data.advances[0].paymentTitleId, operador: actor});
}

it('solicitar adiantamento cria uma obrigação, sem saída de caixa, custo ou desconto antecipado', () => {
  const result = create(); expect(result.ok).toBe(true);
  const data = result.data, advance = data.advances[0], title = data.titulosFolha?.[0];
  expect(title).toMatchObject({id: advance.paymentTitleId, employeeId: advance.empId, liquido: 200,
    valorPago: 0, saldo: 200, snapshotCalculo: {kind: 'advance', advanceId: advance.id}});
  expect(advanceDeductionForPeriod(advance, '2026-10-06', '2026-10-20', data)).toBe(0);
  expect(advanceDeductionForPeriod(advance, '2026-10-06', '2026-10-20')).toBe(0);
  const ledger = buildFinancialLedger(data);
  expect(selectAccountsPayable(ledger, {}).balanceCents).toBe(20000);
  expect(selectCashFlow(ledger, {}).cashOutCents).toBe(0);
  expect(selectDRE(ledger, {}).costCents).toBe(0);
  expect(latestClosedPayrollDate(data, data.employees[0])).toBe('');
});

it('pagamento parcial limita desconto ao efetivamente pago, complemento é único e não duplica custo', () => {
  const initial = create().data;
  const partial = pay(initial, 80); expect(partial.resumo.ok).toBe(true);
  const advance = partial.data.advances[0];
  expect(advanceDeductionForPeriod(advance, '2026-10-06', '2026-10-20', partial.data)).toBe(80);
  const repeated = registrarPagamentoEConciliar(partial.data, {transacaoId: 'qa-bank-1', tipo: 'tituloFolha',
    entidadeId: advance.paymentTitleId, operador: actor});
  expect(repeated.resumo.ok).toBe(false); expect(repeated.data).toEqual(partial.data);
  const paid = pay(partial.data, 120, '2026-10-16', 'qa-bank-2'); expect(paid.resumo.ok).toBe(true);
  expect(advanceDeductionForPeriod(advance, '2026-10-06', '2026-10-20', paid.data)).toBe(200);
  expect(paid.data.titulosFolha[0]).toMatchObject({status: 'pago', saldo: 0});
  expect(paid.data.titulosFolha[0].liquidacoes).toHaveLength(2);
  expect(selectCashFlow(buildFinancialLedger(paid.data), {}).cashOutCents).toBe(20000);
  expect(selectDRE(buildFinancialLedger(paid.data), {}).costCents).toBe(0);
});

it('pagamento depois do vencimento não produz desconto retroativo e preserva as parcelas futuras', () => {
  const initial = create({amount: 300, installmentCount: 3}).data;
  const paid = pay(initial, 300, '2026-10-25').data, advance = paid.advances[0];
  expect(advanceDeductionForPeriod(advance, '2026-10-06', '2026-10-20', paid)).toBe(0);
  expect(advanceDeductionForPeriod(advance, '2026-10-21', '2026-11-05', paid)).toBe(200);
  expect(advanceDeductionForPeriod(advance, '2026-11-06', '2026-11-20', paid)).toBe(100);
  expect(advanceDeductionForPeriod(advance, '2026-10-01', '2026-10-31', paid)).toBe(100);
});

it('estorno antes da compensação retira a elegibilidade, preservando pagamento e histórico', () => {
  const paid = pay(create().data, 200).data;
  const reversed = desfazerConciliacao(paid, 'qa-bank-1', actor, 'Correção QA antes da folha');
  expect(reversed.resumo.ok).toBe(true);
  expect(advanceDeductionForPeriod(reversed.data.advances[0], '2026-10-01', '2026-10-31', reversed.data)).toBe(0);
  expect(reversed.data.titulosFolha[0].liquidacoes[0].status).toBe('estornado');
  const repaid=pay(reversed.data,120,'2026-10-15','qa-bank-corrected');
  expect(repaid.resumo.ok).toBe(true);
  expect(repaid.data.titulosFolha[0]).toMatchObject({valorPago:120,saldo:80,status:'parcial'});
  expect(advanceDeductionForPeriod(repaid.data.advances[0],'2026-10-01','2026-10-31',repaid.data)).toBe(120);
});

it('demonstrativo confirmado preserva desconto e complemento pago depois segue a competência seguinte',()=>{
  const partial=pay(create().data,80).data;
  partial.employees[0].cltPayroll={drafts:{'2026-10':{confirmed:true,advanceIds:[partial.advances[0].id]}}};
  expect(desfazerConciliacao(partial,'qa-bank-1',actor,'Tentativa depois da conferência').resumo.ok).toBe(false);
  expect(pay(partial,120,'2026-10-30','qa-backdated').resumo.ok).toBe(false);
  const next=pay(partial,120,'2026-11-03','qa-next-month');expect(next.resumo.ok).toBe(true);
  expect(advanceDeductionForPeriod(next.data.advances[0],'2026-10-01','2026-10-31',next.data)).toBe(80);
  expect(advanceDeductionForPeriod(next.data.advances[0],'2026-11-01','2026-11-30',next.data)).toBe(120);
});

it('título da competência anterior pago em corte entre meses não bloqueia adiantamento do mês seguinte',()=>{
  const initial=create().data;
  initial.titulosFolha.push({id:'october-title',employeeId:initial.employees[0].id,competencia:'2026-10',
    periodoInicio:'2026-10-21',periodoFim:'2026-11-05',status:'em_aberto',snapshotCalculo:{kind:'clt'}});
  expect(latestClosedPayrollDate(initial,initial.employees[0])).toBe('2026-10-31');
  expect(pay(initial,200,'2026-11-03','qa-november').resumo.ok).toBe(true);
});

it('não desfaz pagamento já compensado nem permite disfarçar a devolução como estorno bancário', () => {
  const paid = pay(create().data, 200).data;
  paid.titulosFolha.push({id: 'qa-fechamento', employeeId: paid.advances[0].empId,
    competencia: '2026-10', periodoFim: '2026-10-31', status: 'em_aberto', liquido: 1000,
    snapshotCalculo: {kind: 'clt', advanceRefs: [{id: 'qa-advance-200', date: '2026-10-20', amount: 200}]}});
  const snapshot = structuredClone(paid);
  const reversed = desfazerConciliacao(paid, 'qa-bank-1', actor, 'Tentativa de apagar desconto aprovado');
  expect(reversed.resumo.ok).toBe(false); expect(reversed.resumo.motivo).toMatch(/compensado|demonstrativo|folha/);
  expect(reversed.data).toEqual(snapshot);
  const withRefund = {...paid, transacoes: [...paid.transacoes, {id: 'refund', data: '2026-10-25', valor: 200, status: 'pendente'}]};
  expect(marcarEstorno(withRefund, {transacaoId: 'refund', transacaoOrigemId: 'qa-bank-1', operador: actor}).resumo.ok).toBe(false);
});

it('cancelar obrigação não paga cancela o título; valor já entregue exige reversão identificada', () => {
  const initial = create().data;
  const command = {type: ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED, actorId: 'rh-qa', expectedVersion: 1,
    payload: {advanceId: initial.advances[0].id, reason: 'Cancelamento QA antes do pagamento'}};
  const cancelled = applyAdvanceCommand(initial, command, '2026-10-15T12:00:00Z');
  expect(cancelled.ok).toBe(true); expect(cancelled.data.titulosFolha[0].status).toBe('cancelado');
  const paid = pay(initial, 80).data;
  expect(applyAdvanceCommand(paid, command, '2026-10-15T12:00:00Z').ok).toBe(false);
});

it('adiantamentos legados mantêm o contrato e a falta do título novo nunca vira pagamento presumido', () => {
  const legacy = {id: 'legacy', empId: 'e', date: '2026-10-14', amount: 200, status: 'ativo'};
  expect(advanceDeductionForPeriod(legacy, '2026-10-01', '2026-10-31')).toBe(200);
  expect(advanceDeductionForPeriod({...legacy, paymentTitleId: 'missing'}, '2026-10-01', '2026-10-31', {})).toBe(0);
});
