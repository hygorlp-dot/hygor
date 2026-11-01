import { createHash } from 'node:crypto';

// Code-only intake: no free-text errors, stack traces, URLs, headers or recipients.
// An authenticated reporter is not proof that its claimed incident occurred.
export const INCIDENT_CODES = Object.freeze({
  DATA_SAVE_FAILED: { severity: 'critical', summary: 'Falha de persistência reportada; verificar antes de confirmar impacto.' },
  AUTH_SERVICE_UNAVAILABLE: { severity: 'critical', summary: 'Indisponibilidade de autenticação reportada; diagnóstico pendente.' },
  INTEGRATION_DEPENDENCY_FAILED: { severity: 'critical', summary: 'Falha em dependência da integração reportada; diagnóstico pendente.' },
  CLIENT_RUNTIME_ERROR: { severity: 'warning', summary: 'Erro de execução do aplicativo reportado; diagnóstico pendente.' },
  REPORT_GENERATION_FAILED: { severity: 'warning', summary: 'Falha na geração de relatório reportada; diagnóstico pendente.' },
});
const MODULES = new Set(['sistema', 'orcamento', 'planejamento', 'financeiro', 'compras', 'contratos', 'rdo', 'qualidade', 'seguranca', 'producao', 'integracao']);
const ROLES = new Set(['admin', 'engenheiro', 'engenheiro_auditor', 'financeiro', 'compras', 'planejamento', 'mestre', 'qualidade', 'seguranca']);
const MAX_INCIDENTS = 500;
const MAX_WORK_INCIDENTS = 100;
const MAX_COUNTERS = 200;
const LIMIT_PER_MINUTE = 20;
const COUNTER_TTL_MS = 10 * 60 * 1000;
const rows = value => Array.isArray(value) ? value : [];
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code) => ({ kind: 'error', status, error: code });

function authorized({ data, user, grant, obraId, scope }) {
  const actor = rows(data.usuarios).find(u => u.id === grant.userId && u.active !== false);
  return actor && actor.id === user.id && actor.role === user.role && actor.obraId === user.obraId &&
    ROLES.has(actor.role) && rows(grant.scopes).includes(scope) && typeof obraId === 'string' &&
    rows(grant.obraIds).includes(obraId) && (!actor.obraId || actor.obraId === obraId) &&
    rows(data.obras).some(w => w.id === obraId);
}

export function monitoringReadiness() {
  return {
    status: 'not-activated', schedulerActive: false, deliveryActive: false,
    requestedSchedule: { time: '18:00', weekdays: [1, 2, 3, 4, 5], timezone: 'America/Recife' },
    requestedDestination: 'current-chat',
    incidentIntake: 'authenticated-code-only',
    criticalAlerts: 'reported-incidents-awaiting-verification',
    publicClientErrorsPersisted: false,
    prerequisites: ['authorized-deployment', 'least-privilege-grant', 'reachable-endpoint', 'verified-chat-delivery', 'scheduler-activation'],
  };
}

export function prepareIncidentMutation({ data = {}, user = {}, grant = {}, body = {}, now = new Date().toISOString() } = {}) {
  if (!authorized({ data, user, grant, obraId: body.obraId, scope: 'monitoramento:write' })) return fail(403, 'MONITORING_FORBIDDEN');
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['action', 'eventId', 'obraId', 'code', 'module'].includes(k)) ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(body.eventId || '') || !Object.hasOwn(INCIDENT_CODES, body.code) || !MODULES.has(body.module)) return fail(400, 'INVALID_INCIDENT');
  const ms = Date.parse(now);
  if (!Number.isFinite(ms)) return fail(500, 'INVALID_SERVER_TIME');
  const receipt = hash(`${grant.id}:${body.obraId}:${body.eventId}`);
  const fingerprint = hash(JSON.stringify({ code: body.code, module: body.module }));
  const previous = rows(data.integrationIncidents).find(i => i.receipt === receipt);
  if (previous) return previous.obraId === body.obraId && previous.fingerprint === fingerprint
    ? { kind: 'idempotent', incidentId: previous.id }
    : fail(409, 'IDEMPOTENCY_MISMATCH');
  // Stored with the incident in the same audited mutation. Never evict an active
  // rate bucket to make room: cardinality pressure fails closed instead.
  const bucket = Math.floor(ms / 60_000);
  const subject = hash(`monitoring:${grant.id}`);
  const counters = rows(data.integrationMonitoringCounters).filter(c => Number.isSafeInteger(c.bucket) && c.bucket * 60_000 > ms - COUNTER_TTL_MS && c.bucket <= bucket);
  const counter = counters.find(c => c.subject === subject && c.bucket === bucket);
  if (counter && (!Number.isSafeInteger(counter.count) || counter.count < 0 || counter.count >= LIMIT_PER_MINUTE)) return fail(429, 'INCIDENT_RATE_LIMIT');
  if (!counter && counters.length >= MAX_COUNTERS) return fail(503, 'INCIDENT_COUNTER_CAPACITY');
  const nextCounters = counter ? counters.map(c => c === counter ? { ...c, count: c.count + 1 } : c) : [...counters, { subject, bucket, count: 1 }];
  const fixed = INCIDENT_CODES[body.code];
  const incident = {
    id: `incident_${receipt.slice(0, 32)}`, obraId: body.obraId,
    code: body.code, module: body.module, severity: fixed.severity, summary: fixed.summary,
    source: 'authenticated-integration', verification: 'reported-unverified',
    status: 'reported', recordedAt: new Date(ms).toISOString(),
    actorId: user.id, integrationGrantId: grant.id, receipt, fingerprint,
  };
  const oldIncidents = rows(data.integrationIncidents);
  const recentWork = new Set(oldIncidents.filter(i => i.obraId === body.obraId).slice(-(MAX_WORK_INCIDENTS - 1)));
  const retained = oldIncidents.filter(i => i.obraId !== body.obraId || recentWork.has(i));
  return {
    kind: 'save', incidentId: incident.id,
    data: { ...data, integrationIncidents: [...retained, incident].slice(-MAX_INCIDENTS), integrationMonitoringCounters: nextCounters },
    before: { eventCount: rows(data.integrationIncidents).length },
    after: { incidentId: incident.id, obraId: body.obraId, code: body.code, severity: fixed.severity, verification: 'reported-unverified', integrationGrantId: grant.id },
  };
}

export function readMonitoring({ data = {}, user = {}, grant = {}, body = {} } = {}) {
  if (!authorized({ data, user, grant, obraId: body.obraId, scope: 'monitoramento:read' })) return { ok: false, status: 403, code: 'MONITORING_FORBIDDEN' };
  const offset = body.offset ?? 0, limit = body.limit ?? 50;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return { ok: false, status: 400, code: 'INVALID_PAGE' };
  if (body.severity !== undefined && !['critical', 'warning'].includes(body.severity)) return { ok: false, status: 400, code: 'INVALID_SEVERITY' };
  const items = rows(data.integrationIncidents).filter(i => i.obraId === body.obraId && (!body.severity || INCIDENT_CODES[i.code]?.severity === body.severity)).slice().reverse();
  return {
    ok: true, obraId: body.obraId, availability: Array.isArray(data.integrationIncidents) ? 'available' : 'not-initialized',
    total: Array.isArray(data.integrationIncidents) ? items.length : null,
    nextOffset: offset + limit < items.length ? offset + limit : null,
    incidents: items.slice(offset, offset + limit).map(i => ({
      id: typeof i.id === 'string' && /^incident_[a-f0-9]{32}$/.test(i.id) ? i.id : 'unrecognized-record', obraId: body.obraId, code: Object.hasOwn(INCIDENT_CODES, i.code) ? i.code : 'UNRECOGNIZED', module: MODULES.has(i.module) ? i.module : 'sistema',
      severity: INCIDENT_CODES[i.code]?.severity || 'warning',
      summary: INCIDENT_CODES[i.code]?.summary || 'Incidente sem classificação reconhecida.',
      recordedAt: typeof i.recordedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(i.recordedAt) ? i.recordedAt.slice(0, 30) : null, source: 'authenticated-integration', verification: 'reported-unverified', status: 'reported',
    })),
    retention: { kind: 'rolling-diagnostic-feed-not-audit-ledger', maxRecordsCompanyWide: MAX_INCIDENTS, maxRecordsPerWork: MAX_WORK_INCIDENTS, deduplicationWindow: 'retained-records-only' },
    readiness: monitoringReadiness(),
  };
}
