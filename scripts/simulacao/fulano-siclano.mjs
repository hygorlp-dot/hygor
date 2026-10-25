// A mesma dupla já criada na homologação. Este módulo é uma fixture, não uma
// rotina de produção. A gravação remota exige conferir o destino e o marcador.
import {applyOperationalCommand, OPERATIONAL_COMMAND} from '../../src/domains/sync/operational-commands.js';
import {payModeRegistrationIssues} from '../../src/domains/rh/attendance-pay-mode.js';
import {CARUARU_PROFILE} from '../../src/domains/ponto/clt-payslip.js';

export const SIMULATION_VERSION = 'fulano-siclano-v1';
export const SIMULATION_NOTICE = 'SIMULAÇÃO — SEM VALIDADE';
export const SIMULATION_PROJECT = 'ukkzpttnbyylkyujzwnv';
export const SIMULATION_IDS = Object.freeze({
  company: 'arcd', fulano: 'piloto-k110-fulano', siclano: 'piloto-k110-siclano',
  obraA: 'piloto-k110', obraB: 'piloto-k110-b',
  admin: 'qa-admin', rh: 'qa-rh', financeiro: 'qa-financeiro', encarregado: 'qa-encarregado',
});
export const SIMULATION_TIME = '2026-10-01T10:00:00.000Z';
export const SIMULATION_HOLIDAYS = Object.freeze(['2026-10-12', '2026-11-02']);

// Reaproveita os dígitos do gerador sintético do cenário anterior. Validade
// matemática não significa faixa oficial reservada. Nenhuma consulta externa.
export function syntheticCpf(index) {
  const base = `000${String(100000 + index).slice(-6)}`;
  const digit = (value, weight) => {
    const remainder = [...value].reduce((sum, d, i) => sum + Number(d) * (weight - i), 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(base, 10);
  return `${base}${first}${digit(`${base}${first}`, 11)}`;
}

export function simulationEmployees() {
  return [
    {id: SIMULATION_IDS.fulano, firstName: 'Fulano', role: 'Pedreiro', category: 'professional',
      startDate: '2026-10-01', remunerationMode: 'clt', monthlySalary: 3300, dailyRate: 150,
      birthDate: '1988-03-15', cbo: '715210', registration: 'QA-0001',
      asoIssuedAt: '2026-09-28', examExpiresAt: '2027-09-27'},
    {id: SIMULATION_IDS.siclano, firstName: 'Siclano', role: 'Servente de obras / ajudante', category: 'helper',
      startDate: '2026-10-06', remunerationMode: 'daily', dailyRate: 120,
      birthDate: '1998-08-20', cbo: '717020', registration: 'QA-0002',
      asoIssuedAt: '2026-10-02', examExpiresAt: '2027-10-01'},
  ].map((persona, index) => ({
    id: persona.id, name: `${persona.firstName} de Tal — SIMULAÇÃO`, role: persona.role,
    cpf: syntheticCpf(index + 1), phone: `0090000000${index + 1}`,
    email: `${persona.firstName.toLowerCase()}@example.invalid`, birthDate: persona.birthDate,
    maritalStatus: 'solteiro', dependents: [],
    address: {street: 'Rua de Testes', number: String((index + 1) * 100), district: 'Bairro Simulação',
      city: 'Caruaru', state: 'PE', postalCode: '00000000'},
    emergencyContact: {name: `Contato QA ${persona.firstName}`, phone: `0090000010${index + 1}`},
    active: true, status: 'ativo', startDate: persona.startDate, endDate: '',
    workArea: 'campo', obra: SIMULATION_IDS.obraA,
    employmentRelationship: 'clt', employmentRelationshipEffectiveFrom: persona.startDate,
    employmentRelationshipReason: 'Premissa fictícia explícita da simulação autorizada.',
    remunerationMode: persona.remunerationMode, remunerationEffectiveFrom: persona.startDate,
    ...(persona.monthlySalary ? {monthlySalary: persona.monthlySalary} : {}),
    dailyRate: persona.dailyRate, vtDaily: 0, vrDaily: 0,
    workdayHours: 8, workStart: '08:00', overtimeAdditionalPercent: 70,
    remunerationValueEffectiveFrom: persona.startDate,
    remunerationValueReason: 'Preenchimento inicial autorizado do cadastro fictício de homologação.',
    paymentInstructions: 'Pagamento exclusivamente simulado na conta de teste; nenhuma transferência bancária.',
    examExpiresAt: persona.examExpiresAt,
    trainings: {nr18: {expiresAt: persona.examExpiresAt}, nr06: {expiresAt: persona.examExpiresAt}},
    cltPayroll: {profile: {registration: persona.registration, cbo: persona.cbo, category: persona.category,
      ...(persona.monthlySalary ? {salary: persona.monthlySalary} : {}),
      rules: {...CARUARU_PROFILE, divisor: 200},
      attendancePolicy: {saturdays: false, dsrPolicy: 'none'}}, drafts: {}},
    testData: true, source: 'piloto_homologacao', cadastroPendente: false,
    pendingFields: ['documentos_a_enviar'],
    simulation: {version: SIMULATION_VERSION, notice: SIMULATION_NOTICE,
      firstName: persona.firstName, identification: `DOC-QA-${persona.firstName.toUpperCase()}-001`,
      asoIssuedAt: persona.asoIssuedAt, documentsStatus: 'preparados_para_envio',
      employmentPremise: 'CLT de teste; não classifica trabalhadores reais.',
      schedule: {weekdays: [1, 2, 3, 4, 5], times: ['08:00', '12:00', '13:00', '17:00'],
        hoursPerWeek: 40, divisor: 200, timezone: 'America/Recife'},
      benefits: {transport: 'Fornecido pela empresa, sem desconto na massa.',
        meals: 'Fornecidas na obra, sem desconto na massa.', basket: 'Revisar elegibilidade na apuração.'},
      activities: 'Serviços no solo; NR-10, NR-33 e NR-35 não aplicáveis a esta massa.',
      externalDelivery: false},
  }));
}

export function simulationWorks() {
  return [
    {id: SIMULATION_IDS.obraA, name: 'K1-10 — SIMULAÇÃO', status: 'active', testData: true, source: 'piloto_homologacao'},
    {id: SIMULATION_IDS.obraB, name: 'Obra B — SIMULAÇÃO', status: 'active', testData: true, source: 'piloto_homologacao'},
  ];
}

export function simulationActors() {
  return [
    {id: SIMULATION_IDS.admin, nome: 'Administrador QA', role: 'admin'},
    {id: SIMULATION_IDS.rh, nome: 'RH QA', role: 'rh'},
    {id: SIMULATION_IDS.financeiro, nome: 'Financeiro QA', role: 'financeiro'},
    {id: SIMULATION_IDS.encarregado, nome: 'Encarregado QA', role: 'engenheiro', obraId: SIMULATION_IDS.obraA},
    {id: 'qa-auditor', nome: 'Auditor QA', role: 'auditor'},
  ].map(actor => ({...actor, active: true, testData: true}));
}

// Completa os placeholders pelos comandos reais. Não reseta registros existentes,
// não toca em ponto/financeiro e não assume que um nome parecido é a mesma pessoa.
export function completeSimulationEmployees(current, {environment, now = SIMULATION_TIME} = {}) {
  if (environment !== 'homologacao') throw new Error('A massa só pode ser preparada em homologação isolada.');
  let data = structuredClone(current);
  const changes = [];
  for (const work of simulationWorks()) {
    const previous = (data.obras || []).find(item => String(item.id) === work.id);
    if (previous && previous.testData !== true) throw new Error('A obra de destino não está identificada como dado de teste.');
    if (!previous) data.obras = [...(data.obras || []), work];
  }
  for (const persona of simulationEmployees()) {
    const previous = (data.employees || []).find(item => String(item.id) === persona.id);
    if (previous && previous.testData !== true) throw new Error('A pessoa de destino não está identificada como dado de teste.');
    if (previous?.simulation?.version === SIMULATION_VERSION) continue;
    if (previous && previous.cadastroPendente !== true) throw new Error('O cadastro de teste já foi trabalhado; preserve seu histórico e revise a atualização.');
    if (previous && (previous.startDate || Number(previous.dailyRate) > 0 || Number(previous.monthlySalary) > 0)) {
      throw new Error('O placeholder já recebeu dados contratuais; não sobrescrever uma edição concorrente.');
    }
    const employee = {...previous, ...persona};
    const issues = payModeRegistrationIssues(employee, employee.remunerationMode, employee.startDate);
    if (issues.length) throw new Error(`Cadastro de teste incompleto: ${issues.join('; ')}.`);
    const result = applyOperationalCommand(data, {
      type: OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
      idempotencyKey: `${SIMULATION_VERSION}:admissao:${employee.id}`,
      expectedVersion: Number(previous?.version || 0),
      actorId: SIMULATION_IDS.rh, actorName: 'RH QA — simulação', now,
      payload: {employee},
    });
    if (!result.ok) throw new Error(result.reason);
    data = result.data;
    changes.push(employee.id);
  }
  return {data, changes, version: SIMULATION_VERSION};
}

export function createLocalSimulation() {
  const initial = {homologacaoSintetica: true, aviso: SIMULATION_NOTICE, usuarios: simulationActors(),
    config: {companyName: 'MARCELL Construção — SIMULAÇÃO', cnpj: '00.000.001/0001-36'},
    obras: simulationWorks(), employees: [], attendance: {}, attendanceLocks: {}, advances: [],
    titulosFolha: [], pagamentosFolha: [], transacoes: [], financialSettlements: []};
  return completeSimulationEmployees(initial, {environment: 'homologacao'}).data;
}

export function simulationWorkdays(employee, start = '2026-10-01', end = '2026-11-05') {
  const dates = [];
  for (let day = new Date(`${start}T12:00:00Z`); day.toISOString().slice(0, 10) <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6 || SIMULATION_HOLIDAYS.includes(date)) continue;
    if (date < employee.startDate || employee.endDate && date > employee.endDate) continue;
    dates.push(date);
  }
  return dates;
}

// Cenários de múltiplas obras são derivados, sem trocar o total da jornada.
export function simulationAllocations(date) {
  if (['2026-10-19', '2026-10-20'].includes(date)) return [
    {obraId: SIMULATION_IDS.obraA, hours: 4}, {obraId: SIMULATION_IDS.obraB, hours: 4},
  ];
  return [{obraId: ['2026-10-14', '2026-10-15', '2026-10-16'].includes(date) ? SIMULATION_IDS.obraB : SIMULATION_IDS.obraA, hours: 8}];
}
