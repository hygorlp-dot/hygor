import { createHash } from 'node:crypto';
import { calculateBudget, createBudgetRevision } from '../src/domains/orcamentos/calculations.js';
import { authorizeSectionChanges, validateBudgetBaselinePolicy, validateNoPhysicalDeletes } from './section-authorizations.js';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const budgetSourceHash = budget => createHash('sha256').update(JSON.stringify(stable(budget))).digest('hex');
const fail = (status, code) => ({ kind: 'error', status, error: code });

// Only creates a new draft. Original, approval, baseline and ledger remain untouched.
export function reviseIntegrationBudget({ data, user, grant, body, now = new Date().toISOString() }) {
  const actor = (data.usuarios || []).find(u => u.id === grant.userId && u.active !== false);
  if (!actor || actor.role !== user.role || actor.obraId !== user.obraId || !['admin', 'engenheiro', 'engenheiro_auditor'].includes(actor.role) || !grant.scopes.includes('orcamento:write')) return fail(403, 'SCOPE_FORBIDDEN');
  if (!grant.obraIds.includes(body.obraId) || (actor.obraId && actor.obraId !== body.obraId) || !(data.obras || []).some(w => w.id === body.obraId)) return fail(403, 'WORK_FORBIDDEN');
  if (!/^[a-zA-Z0-9_-]{16,160}$/.test(body.idempotencyKey || '') || !/^[a-f0-9]{64}$/.test(body.sourceHash || '') || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.newId || '') || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.newVersionId || '')) return fail(400, 'INVALID_REVISION');
  if (!Array.isArray(body.changes) || body.changes.length > 100) return fail(400, 'INVALID_CHANGES');
  const receipt = createHash('sha256').update(`${grant.id}:${body.obraId}:${body.idempotencyKey}`).digest('hex');
  const fingerprint = budgetSourceHash({ sourceId: body.budgetId, sourceHash: body.sourceHash, newId: body.newId, newVersionId: body.newVersionId, changes: body.changes });
  const previous = (data.orcamentos || []).find(b => b.integrationRevision?.receipt === receipt);
  if (previous) return previous.obraId === body.obraId && previous.integrationRevision.fingerprint === fingerprint ? { kind: 'idempotent', budgetId: previous.id, versionId: previous.versionId } : fail(409, 'IDEMPOTENCY_MISMATCH');
  const source = (data.orcamentos || []).find(b => b.id === body.budgetId && b.obraId === body.obraId);
  if (!source) return fail(404, 'BUDGET_NOT_FOUND');
  if (budgetSourceHash(source) !== body.sourceHash) return fail(409, 'BUDGET_SOURCE_CHANGED');
  if ((data.orcamentos || []).some(b => b.id === body.newId || (b.versionId || b.id) === body.newVersionId)) return fail(409, 'REVISION_ID_EXISTS');
  const changes = new Map();
  for (const change of body.changes) {
    if (!change || changes.has(change.id) || !(source.itens || []).some(i => i.id === change.id) || Object.keys(change).some(k => !['id', 'quantidade', 'precoUnit', 'bdi'].includes(k)) || Object.entries(change).some(([k,v]) => k !== 'id' && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12))) return fail(400, 'INVALID_CHANGES');
    changes.set(change.id, change);
  }
  const revision = createBudgetRevision(structuredClone(source), { id: body.newId, versionId: body.newVersionId, now, actorId: actor.id, actorName: actor.nome || 'Integração MARCELL' });
  revision.itens = revision.itens.map(i => ({ ...i, ...changes.get(i.id) }));
  revision.integrationRevision = { receipt, fingerprint, grantId: grant.id, sourceHash: body.sourceHash };
  const totals = calculateBudget(revision);
  if (![totals.custoDiretoCentavos, totals.valorBDICentavos, totals.totalCentavos].every(Number.isSafeInteger)) return fail(422, 'UNSAFE_MONETARY_PRECISION');
  const next = { ...data, orcamentos: [...(data.orcamentos || []), revision] };
  if (authorizeSectionChanges(actor, { orcamentos: next.orcamentos }) || validateBudgetBaselinePolicy(data, next, actor) || validateNoPhysicalDeletes({orcamentos:data.orcamentos},{orcamentos:next.orcamentos})) return fail(403, 'BUDGET_POLICY_REJECTED');
  return { kind: 'save', data: next, budgetId: revision.id, versionId: revision.versionId,
    before: { sourceId: source.id, sourceHash: body.sourceHash },
    after: { budgetId: revision.id, versionId: revision.versionId, integrationGrantId: grant.id, receipt, status: 'rascunho' } };
}
