// Typed integration inputs for field modules. Domain reducers remain authoritative.
const engineering = ['admin', 'engenheiro', 'engenheiro_auditor'];
const production = [...engineering, 'planejamento', 'mestre'];
const spec = (module, type, roles, risk = 'operational') => ({ module, type, roles, scopes: [`${module}:write`], risk });
export const FIELD_COMMAND_SPECS = Object.freeze({
  'save-field-report-draft': spec('rdo', 'RDO_CAMPO_ALTERADO', engineering, 'draft'),
  'update-quality-details': spec('qualidade', 'FICHA_QUALIDADE_ATUALIZADA', [...engineering, 'qualidade']),
  'save-risk-analysis-draft': spec('seguranca', 'APR_SALVA', ['admin', 'engenheiro', 'seguranca'], 'draft'),
  'save-work-permit-draft': spec('seguranca', 'PERMISSAO_TRABALHO_SALVA', ['admin', 'engenheiro', 'seguranca'], 'draft'),
  'create-weekly-commitment': spec('producao', 'COMPROMISSO_SEMANAL_CRIADO', production),
  'record-physical-progress': spec('producao', 'AVANCO_FISICO_REGISTRADO', production),
});
const fail = (status, code) => ({ ok: false, status, code });
const rows = value => Array.isArray(value) ? value : [];
const text = (value, max = 2000) => typeof value === 'string' && value.length > 0 && value.length <= max;
const id = value => text(value, 100);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fieldsOnly = (value, fields) => plain(value) && Object.keys(value).every(k => fields.includes(k));
const sameWork = (row, obraId) => row && String(row.obraId || row.obra || '') === obraId;
const strings = (value, max = 50) => Array.isArray(value) && value.length <= max && value.every(v => text(v));

export function prepareFieldCommand({ data = {}, user = {}, grant = {}, body = {} } = {}) {
  const definition = Object.hasOwn(FIELD_COMMAND_SPECS, body.operation) ? FIELD_COMMAND_SPECS[body.operation] : null;
  if (!definition) return fail(403, 'OPERATION_NOT_SUPPORTED');
  if (!definition.roles.includes(user.role) || !definition.scopes.every(s => rows(grant.scopes).includes(s))) return fail(403, 'SCOPE_FORBIDDEN');
  const obraId = body.obraId, r = body.record;
  if (!id(obraId) || !rows(grant.obraIds).includes(obraId) || (user.obraId && user.obraId !== obraId) || !rows(data.obras).some(w => w.id === obraId)) return fail(403, 'WORK_FORBIDDEN');
  if (!plain(r) || !id(r.id) || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) return fail(400, 'INVALID_COMMAND');
  const currentFor = collection => rows(data[collection]).find(item => item.id === r.id);
  const foreign = collection => currentFor(collection) && !sameWork(currentFor(collection), obraId);
  let payload;
  if (body.operation === 'save-field-report-draft') {
    if (!fieldsOnly(r, ['id', 'data', 'descricao', 'clima']) || !date(r.data) || !text(r.descricao)) return fail(400, 'INVALID_REPORT');
    if (foreign('rdos')) return fail(403, 'WORK_FORBIDDEN');
    const current = currentFor('rdos');
    // Do not reset an existing workflow, technical review or completion.
    if (current && (current.status !== 'preparacao' || current.revisaoEngenheiro?.aprovado)) return fail(409, 'REPORT_NOT_DRAFT');
    const report = { id: r.id, obraId, data: r.data, descricao: r.descricao, status: 'preparacao' };
    if (r.clima !== undefined) {
      if (!fieldsOnly(r.clima, ['manha', 'tarde', 'noite']) || Object.values(r.clima).some(v => !text(v, 100))) return fail(400, 'INVALID_CLIMATE');
      report.clima = Object.fromEntries(Object.entries(r.clima));
    }
    payload = { report };
  } else if (body.operation === 'update-quality-details') {
    if (!fieldsOnly(r, ['id', 'normaProjeto', 'responsavelId']) || Object.keys(r).length < 2) return fail(400, 'INVALID_QUALITY_PATCH');
    if (!sameWork(currentFor('qualidadeRegistros'), obraId)) return fail(404, 'QUALITY_NOT_FOUND');
    if (currentFor('qualidadeRegistros').status === 'aprovada') return fail(409, 'QUALITY_LOCKED');
    const patch = {};
    if (r.normaProjeto !== undefined) {
      if (!text(r.normaProjeto)) return fail(400, 'INVALID_QUALITY_PATCH');
      patch.normaProjeto = r.normaProjeto;
    }
    if (r.responsavelId !== undefined) {
      const responsible = rows(data.usuarios).find(u => u.id === r.responsavelId && u.active !== false && (!u.obraId || u.obraId === obraId));
      if (!responsible) return fail(403, 'RESPONSIBLE_FORBIDDEN');
      patch.responsavelId = r.responsavelId;
    }
    payload = { recordId: r.id, patch };
  } else if (body.operation === 'save-risk-analysis-draft' || body.operation === 'save-work-permit-draft') {
    const analysis = body.operation === 'save-risk-analysis-draft';
    const fields = analysis ? ['id', 'activityId', 'risks', 'controls'] : ['id', 'activityId', 'validFrom', 'validUntil'];
    if (!fieldsOnly(r, fields) || !id(r.activityId)) return fail(400, 'INVALID_SAFETY_RECORD');
    const activity = rows(data.scheduleActivities).find(a => a.id === r.activityId && sameWork(a, obraId));
    if (!activity) return fail(404, 'ACTIVITY_NOT_FOUND');
    const collection = analysis ? 'jobRiskAnalyses' : 'workPermits';
    if (foreign(collection)) return fail(403, 'WORK_FORBIDDEN');
    const current = currentFor(collection);
    if (current && (current.status !== 'rascunho' || current.activityId !== r.activityId)) return fail(409, 'SAFETY_RECORD_LOCKED');
    const record = { id: r.id, obraId, activityId: r.activityId, status: 'rascunho' };
    if (analysis) {
      if (!strings(r.risks) || !strings(r.controls)) return fail(400, 'INVALID_SAFETY_RECORD');
      record.risks = [...r.risks]; record.controls = [...r.controls];
    } else {
      if (!date(r.validFrom) || !date(r.validUntil) || r.validUntil < r.validFrom) return fail(400, 'INVALID_PERMIT_DATES');
      record.validFrom = r.validFrom; record.validUntil = r.validUntil;
    }
    payload = analysis ? { analysis: record } : { permit: record };
  } else {
    const progress = body.operation === 'record-physical-progress';
    const fields = progress ? ['id', 'activityId', 'commitmentId', 'data', 'quantity', 'workerIds'] : ['id', 'activityId', 'descricao', 'quantidadePrometida', 'blockingReason'];
    if (!fieldsOnly(r, fields) || !id(r.activityId) || body.expectedVersion !== 0) return fail(400, 'INVALID_PRODUCTION_RECORD');
    const activity = rows(data.scheduleActivities).find(a => a.id === r.activityId && sameWork(a, obraId));
    if (!activity) return fail(404, 'ACTIVITY_NOT_FOUND');
    if (foreign(progress ? 'progressRecords' : 'weeklyCommitments')) return fail(403, 'WORK_FORBIDDEN');
    if (progress) {
      if (!date(r.data) || !Number.isFinite(r.quantity) || r.quantity <= 0 || r.quantity > 1e9) return fail(400, 'INVALID_PROGRESS');
      const record = { id: r.id, obraId, activityId: r.activityId, data: r.data, quantity: r.quantity };
      if (r.commitmentId !== undefined) {
        if (!rows(data.weeklyCommitments).some(c => c.id === r.commitmentId && sameWork(c, obraId) && c.activityId === r.activityId)) return fail(403, 'COMMITMENT_FORBIDDEN');
        record.commitmentId = r.commitmentId;
      }
      if (r.workerIds !== undefined) {
        if (!Array.isArray(r.workerIds) || r.workerIds.length > 100 || new Set(r.workerIds).size !== r.workerIds.length || r.workerIds.some(workerId => !id(workerId) || !rows(data.employees).some(e => e.id === workerId && sameWork(e, obraId) && e.active !== false))) return fail(403, 'WORKER_FORBIDDEN');
        record.workerIds = [...r.workerIds];
      }
      payload = { record };
    } else {
      if (!text(r.descricao) || !Number.isFinite(r.quantidadePrometida) || r.quantidadePrometida <= 0 || r.quantidadePrometida > 1e9 || (r.blockingReason !== undefined && !text(r.blockingReason))) return fail(400, 'INVALID_COMMITMENT');
      payload = { commitment: { id: r.id, obraId, activityId: r.activityId, descricao: r.descricao, quantidadePrometida: r.quantidadePrometida, ...(r.blockingReason ? { blockingReason: r.blockingReason } : {}) } };
    }
  }
  return { ok: true, spec: definition, command: { type: definition.type, payload, expectedVersion: body.expectedVersion } };
}
