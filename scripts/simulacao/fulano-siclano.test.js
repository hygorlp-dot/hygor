import {describe, it, expect} from 'vitest';
import {completeSimulationEmployees, createLocalSimulation, simulationEmployees, simulationWorkdays,
  simulationAllocations, SIMULATION_IDS, SIMULATION_VERSION} from './fulano-siclano.mjs';
import {payModeRegistrationIssues} from '../../src/domains/rh/attendance-pay-mode.js';
import {validateCPF} from '../../src/domains/data/brazilian-documents.js';

const placeholders = () => ({
  obras: [{id: SIMULATION_IDS.obraA, name: 'K1-10', testData: true}],
  employees: [SIMULATION_IDS.fulano, SIMULATION_IDS.siclano].map(id => ({id, name: id,
    obra: SIMULATION_IDS.obraA, active: true, testData: true, cadastroPendente: true})),
  transacoes: [{id: 'preservar-extrato', valor: -10}],
  titulosFolha: [{id: 'preservar-titulo', employeeId: 'outra-pessoa', liquido: 10}],
  attendance: {outro: {'2026-10-01': {status: 'P'}}},
});

describe('massa única Fulano e Siclano', () => {
  it('completa os dois IDs existentes com vínculo e remuneração distintos e preserva outros domínios', () => {
    const before = placeholders(), snapshot = structuredClone(before);
    const result = completeSimulationEmployees(before, {environment: 'homologacao'});
    expect(before).toEqual(snapshot);
    expect(result.changes).toEqual([SIMULATION_IDS.fulano, SIMULATION_IDS.siclano]);
    expect(result.data.employees).toHaveLength(2);
    expect(result.data.employees[0]).toMatchObject({employmentRelationship: 'clt', remunerationMode: 'clt', monthlySalary: 3300, dailyRate: 150, version: 1});
    expect(result.data.employees[1]).toMatchObject({employmentRelationship: 'clt', remunerationMode: 'daily', dailyRate: 120, version: 1});
    expect(result.data.employees[1].monthlySalary).toBeUndefined();
    expect(result.data.transacoes).toEqual(snapshot.transacoes);
    expect(result.data.titulosFolha).toEqual(snapshot.titulosFolha);
    expect(result.data.attendance).toEqual(snapshot.attendance);
    expect(result.data.obras[0]).toEqual(snapshot.obras[0]);
    for (const employee of result.data.employees) {
      expect(validateCPF(employee.cpf)).toBe(true);
      expect(payModeRegistrationIssues(employee, employee.remunerationMode, employee.startDate)).toEqual([]);
      expect(employee.simulation.version).toBe(SIMULATION_VERSION);
      expect(employee.pendingFields).toEqual(['documentos_a_enviar']);
      expect(employee.remunerationValuesHistory.every(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date))).toBe(true);
    }
  });
  it('repetir a carga não cria pessoas nem apaga o trabalho realizado depois dela', () => {
    const first = completeSimulationEmployees(placeholders(), {environment: 'homologacao'}).data;
    first.employees[0].phone = '00900000999';
    first.employees[0].cltPayroll.drafts['2026-10'] = {notes: 'Trabalho posterior preservado'};
    first.attendance[SIMULATION_IDS.fulano] = {'2026-10-01': {status: 'P'}};
    const second = completeSimulationEmployees(first, {environment: 'homologacao'});
    expect(second.changes).toEqual([]);
    expect(second.data).toEqual(first);
  });
  it('recusa destino sem marcador, pessoa/obra sem marca de teste e edição concorrente', () => {
    expect(() => completeSimulationEmployees(placeholders(), {environment: 'producao'})).toThrow(/homologação/);
    const real = placeholders(); real.employees[0].testData = false;
    expect(() => completeSimulationEmployees(real, {environment: 'homologacao'})).toThrow(/pessoa/);
    const work = placeholders(); work.obras[0].testData = false;
    expect(() => completeSimulationEmployees(work, {environment: 'homologacao'})).toThrow(/obra/);
    const edited = placeholders(); edited.employees[0].dailyRate = 170;
    expect(() => completeSimulationEmployees(edited, {environment: 'homologacao'})).toThrow(/concorrente/);
  });
  it('não deixa o nome de outro funcionário substituir a identidade canônica', () => {
    const initial = placeholders(); initial.employees.push({id: 'outro', name: 'Fulano', active: true});
    const result = completeSimulationEmployees(initial, {environment: 'homologacao'});
    expect(result.data.employees).toHaveLength(3);
    expect(result.data.employees.find(e => e.id === 'outro')).toEqual(initial.employees[2]);
  });
  it('fecha calendário, jornada e apropriação por obra sem duplicar diária', () => {
    const [fulano, siclano] = simulationEmployees();
    expect(simulationWorkdays(fulano, '2026-10-01', '2026-10-31')).toHaveLength(21);
    expect(simulationWorkdays(siclano, '2026-10-01', '2026-10-31')).toHaveLength(18);
    const first = simulationWorkdays(siclano, '2026-10-06', '2026-10-20');
    expect(first).toHaveLength(10);
    expect(first.length * 120).toBe(1200);
    const hours = first.flatMap(simulationAllocations).reduce((sum, row) => ({...sum, [row.obraId]: (sum[row.obraId] || 0) + row.hours}), {});
    expect(hours).toEqual({[SIMULATION_IDS.obraA]: 48, [SIMULATION_IDS.obraB]: 32});
    const second = simulationWorkdays(siclano, '2026-10-21', '2026-11-05');
    expect(second.filter(d => d.startsWith('2026-10'))).toHaveLength(8);
    expect(second.filter(d => d.startsWith('2026-11'))).toHaveLength(3);
  });
  it('base local começa sem ponto, pagamento, fechamento ou documento falsamente enviado', () => {
    const data = createLocalSimulation();
    expect(data.employees).toHaveLength(2);
    expect(data.advances).toEqual([]);
    expect(data.titulosFolha).toEqual([]);
    expect(data.transacoes).toEqual([]);
    expect(data.attendance).toEqual({});
    expect(data.employees.every(e => e.simulation.documentsStatus === 'preparados_para_envio')).toBe(true);
  });
});
