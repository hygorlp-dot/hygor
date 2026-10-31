import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_COMMAND_SPECS, prepareFieldCommand } from '../../server/marcell-field-commands.js';
import { applyOperationalCommand } from '../../src/domains/sync/operational-commands.js';
const user = { id: 'u1', role: 'admin' };
const grant = { obraIds: ['o1'], scopes: ['rdo:write', 'qualidade:write', 'seguranca:write', 'producao:write'] };
const data = { obras: [{ id: 'o1' }, { id: 'o2' }], usuarios: [user], scheduleActivities: [{ id: 'a1', obraId: 'o1' }, { id: 'a2', obraId: 'o2' }], qualidadeRegistros: [{ id: 'q1', obraId: 'o1', status: 'planejada', version: 1 }] };
const examples = {
  'save-field-report-draft': { id: 'r1', data: '2026-10-31', descricao: 'Serviços em execução', clima: { manha: 'bom' } },
  'update-quality-details': { id: 'q1', normaProjeto: 'NBR aplicável' },
  'save-risk-analysis-draft': { id: 'apr1', activityId: 'a1', risks: ['Queda'], controls: ['Proteção coletiva'] },
  'save-work-permit-draft': { id: 'pt1', activityId: 'a1', validFrom: '2026-10-31', validUntil: '2026-11-01' },
  'create-weekly-commitment': { id: 'c1', activityId: 'a1', descricao: 'Executar atividade', quantidadePrometida: 10 },
  'record-physical-progress': { id: 'p1', activityId: 'a1', data: '2026-10-31', quantity: 2 },
};
const ctx = (operation, changes = {}) => ({ data, user, grant, body: { operation, obraId: 'o1', expectedVersion: operation === 'update-quality-details' ? 1 : 0, record: examples[operation], ...changes } });
for (const [operation] of Object.entries(examples)) {
  test(`${operation}: typed preparation executes existing domain successfully`, () => {
    const prepared = prepareFieldCommand(ctx(operation));
    assert.equal(prepared.ok, true);
    const result = applyOperationalCommand(data, { ...prepared.command, actorId: user.id, actorName: 'Operador', idempotencyKey: `field_test_${operation}` });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.data.operationalCommandReceipts.at(-1).actorId, 'u1');
  });
}
test('all six operations reject extra fields/authorship/status injection', () => {
  for (const operation of Object.keys(examples)) {
    for (const key of ['status', 'obraId', 'actorId', 'history', 'aprovado']) {
      const input = ctx(operation, { record: { ...examples[operation], [key]: 'evil' } });
      assert.equal(prepareFieldCommand(input).ok, false, `${operation}:${key}`);
    }
  }
});
test('separate scopes and roles are checked for each module', () => {
  for (const operation of Object.keys(examples)) {
    assert.equal(prepareFieldCommand({ ...ctx(operation), grant: { ...grant, scopes: [] } }).status, 403);
    assert.equal(prepareFieldCommand({ ...ctx(operation), user: { ...user, role: 'visualizador' } }).status, 403);
    assert.equal(prepareFieldCommand(ctx(operation, { obraId: 'o2' })).status, 403);
  }
});
test('canonical activities may not reference another obra or unknown ID', () => {
  for (const operation of ['save-risk-analysis-draft', 'save-work-permit-draft', 'create-weekly-commitment', 'record-physical-progress']) {
    for (const activityId of ['a2', 'missing']) assert.equal(prepareFieldCommand(ctx(operation, { record: { ...examples[operation], activityId } })).status, 404);
  }
});
test('existing identifiers in another obra cannot be overwritten', () => {
  for (const [operation, collection] of [['save-field-report-draft','rdos'], ['save-risk-analysis-draft','jobRiskAnalyses'], ['save-work-permit-draft','workPermits'], ['record-physical-progress','progressRecords'], ['create-weekly-commitment','weeklyCommitments']]) {
    assert.equal(prepareFieldCommand({ ...ctx(operation), data: { ...data, [collection]: [{ id: examples[operation].id, obraId: 'o2' }] } }).status, 403);
  }
});
test('final/reviewed field records and approved safety records stay immutable', () => {
  for (const current of [{status:'concluido'}, {status:'preparacao',revisaoEngenheiro:{aprovado:true}}]) assert.equal(prepareFieldCommand({ ...ctx('save-field-report-draft'), data: { ...data, rdos: [{ id:'r1',obraId:'o1',...current }] } }).status,409);
  assert.equal(prepareFieldCommand({ ...ctx('save-risk-analysis-draft'), data: { ...data,jobRiskAnalyses:[{id:'apr1',obraId:'o1',activityId:'a1',status:'aprovada'}] } }).status,409);
  assert.equal(prepareFieldCommand({ ...ctx('update-quality-details'), data: { ...data,qualidadeRegistros:[{id:'q1',obraId:'o1',status:'aprovada'}] } }).status,409);
});
test('responsible actor and progress references remain scoped', () => {
  assert.equal(prepareFieldCommand(ctx('update-quality-details',{record:{id:'q1',responsavelId:'unknown'}})).status,403);
  assert.equal(prepareFieldCommand(ctx('record-physical-progress',{record:{...examples['record-physical-progress'],workerIds:['unknown']}})).status,403);
  assert.equal(prepareFieldCommand(ctx('record-physical-progress',{record:{...examples['record-physical-progress'],commitmentId:'unknown'}})).status,403);
});
test('critical-activity progress cannot bypass existing APR/permit/team gate', () => {
  const scoped = {...data,scheduleActivities:[{id:'a1',obraId:'o1',criticalActivity:true}]};
  const prepared = prepareFieldCommand({...ctx('record-physical-progress'),data:scoped});
  const result = applyOperationalCommand(scoped,{...prepared.command,idempotencyKey:'critical_test_0001',actorId:'u1'});
  assert.equal(result.ok,false);
  assert.match(result.reason,/segurança/);
});
test('invalid dates and non-finite quantities rejected without throws', () => {
  assert.equal(prepareFieldCommand(ctx('save-field-report-draft',{record:{...examples['save-field-report-draft'],data:'2026-99-99'}})).status,400);
  assert.equal(prepareFieldCommand(ctx('record-physical-progress',{record:{...examples['record-physical-progress'],quantity:Infinity}})).status,400);
});
test('stale version remains enforced by existing reducer', () => {
  const prepared = prepareFieldCommand(ctx('update-quality-details',{expectedVersion:0}));
  assert.equal(applyOperationalCommand(data,{...prepared.command,idempotencyKey:'stale_quality_0001'}).ok,false);
});
test('production creates require zero expected version', () => {
  for(const operation of ['create-weekly-commitment','record-physical-progress']) assert.equal(prepareFieldCommand(ctx(operation,{expectedVersion:1})).status,400);
});
