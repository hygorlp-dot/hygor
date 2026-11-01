import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authenticateIntegration, integrationActor, readIntegration, previewBudget, prepareIntegrationCommand, sanitizeIntegrationWriteResponse, integrationCapabilities } from '../../server/marcell-integration.js';
import { applyOperationalCommand } from '../../src/domains/sync/operational-commands.js';
import { validateOperationalCommandScope } from '../../server/operational-command-policy.js';

const token = 'a'.repeat(43);
const grant = { id: 'marcell', enabled: true, userId: 'u1', companyId: 'arcd', expiresAt: '2099-01-01T00:00:00Z', tokenSha256: createHash('sha256').update(token).digest('hex'), obraIds: ['o1'], scopes: ['orcamento:read', 'orcamento:preview', 'planejamento:read', 'planejamento:write', 'financeiro:read', 'compras:read', 'contratos:read'] };
const user = { id: 'u1', role: 'admin', active: true };
const data = { usuarios: [user], obras: [{ id: 'o1' }, { id: 'o2' }],
  orcamentos: [{ id: 'b1', obraId: 'o1', bdi: 20, versionStatus: 'aprovado', lockedAt: '2026-01-01', itens: [{ id: 'i1', quantidade: 2, precoUnit: 100, pin: 'SECRET' }] }, { id: 'b2', obraId: 'o2' }],
  lookaheadWindows: [{ id: 'l1', obraId: 'o1', version: 1, pacotes: [{ id: 'p1' }], restricoes: [] }, { id: 'l2', obraId: 'o2', version: 1 }],
  pedidos: [{ id: 'order', obraId: 'o1', bankAccount: 'SECRET', itens: [{ id: 'i', descricao: 'Aço', pix: 'SECRET' }] }, { id: 'other', obraId: 'o2' }],
  payments: [{ id: 'pay', obraId: 'o1', valor: 42, pix: 'SECRET' }, { id: 'global', valor: 90 }, { id: 'other', obraId: 'o2' }],
  contratosFornecimento: [{ id: 'c1', obraId: 'o1', portalCliente: { token: 'SECRET' } }],
};
const ctx = body => ({ data, user, grant, body });
const write = { operation: 'add-planning-constraint', obraId: 'o1', lookaheadId: 'l1', expectedVersion: 1, idempotencyKey: 'unique_request_0001', constraint: { id: 'r1', pacoteId: 'p1', categoria: 'material', descricao: 'Falta aço', dataIdentificacao: '2026-10-31', dataNecessidade: '2026-11-02' } };
const auth = (changes = {}, headers = { authorization: `Bearer ${token}` }) => authenticateIntegration(headers, JSON.stringify([{ ...grant, ...changes }]), 'arcd');

test('valid high-entropy token maps server-selected grant', () => assert.equal(auth().grant.userId, 'u1'));
test('missing or malformed configuration fails closed', () => {
  for (const config of [undefined, '{}', 'oops', '[]']) assert.equal(authenticateIntegration({}, config, 'arcd').status, 503);
});
test('missing/wrong token rejected, PIN and supplied user cannot authenticate', () => {
  for (const h of [{}, { authorization: `Bearer ${'b'.repeat(43)}` }, { pin: '1234', userId: 'u1' }, { authorization: 'Bearer short' }]) assert.equal(auth({}, h).status, 401);
});
test('expired/disabled/wrong company/wildcard/empty scopes config rejected', () => {
  for (const change of [{ expiresAt: '2020-01-01' }, { enabled: false }, { companyId: 'other' }, { obraIds: [] }, { obraIds: ['*'] }, { scopes: ['admin'] }]) assert.equal(auth(change).status, 401);
});
test('duplicate token grants fail closed', () => assert.equal(authenticateIntegration({ authorization: `Bearer ${token}` }, JSON.stringify([grant, grant]), 'arcd').status, 401));
test('disabled or missing application actor cannot connect', () => {
  assert.equal(integrationActor({ usuarios: [{ ...user, active: false }] }, grant), null);
  assert.equal(integrationActor({ usuarios: [] }, grant), null);
});
test('all five modules are supported and no critical write advertised', () => {
  assert.equal(integrationCapabilities(grant, user, true).readModules.length, 5);
  assert.deepEqual(integrationCapabilities(grant, user, true).writes, ['add-planning-constraint','create-lookahead']);
});
test('admin reads still use obra and scalar positive schema', () => {
  for (const module of ['orcamento', 'planejamento', 'financeiro', 'compras', 'contratos']) {
    const result = readIntegration(ctx({ module, obraId: 'o1' }));
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
    assert.equal(JSON.stringify(result).includes('"o2"'), false);
  }
  assert.equal(readIntegration(ctx({ module: 'financeiro', obraId: 'o1' })).sections.payments.total, 1);
});
test('cross-obra and conflicting actor scope denied including admin', () => {
  assert.equal(readIntegration(ctx({ module: 'orcamento', obraId: 'o2' })).status, 403);
  assert.equal(readIntegration({ ...ctx({ module: 'orcamento', obraId: 'o1' }), user: { ...user, obraId: 'o2' } }).status, 403);
});
test('grant read scope and application role are both enforced', () => {
  assert.equal(readIntegration({ ...ctx({ module: 'financeiro', obraId: 'o1' }), grant: { ...grant, scopes: ['compras:read'] } }).status, 403);
  assert.equal(readIntegration({ ...ctx({ module: 'financeiro', obraId: 'o1' }), user: { ...user, role: 'visualizador' }, data: { ...data, usuarios: [{ ...user, role: 'visualizador' }] } }).sections.payments.total, null);
});
test('bounded paging with explicit next offset', () => {
  assert.equal(readIntegration(ctx({ module: 'orcamento', obraId: 'o1', limit: 101 })).status, 400);
  assert.equal(readIntegration(ctx({ module: 'orcamento', obraId: 'o1', offset: -1 })).status, 400);
});
test('budget preview uses existing engine and never mutates approved baseline', () => {
  const before = JSON.stringify(data);
  const preview = previewBudget(ctx({ obraId: 'o1', budgetId: 'b1', changes: [{ id: 'i1', quantidade: 3 }] }));
  assert.equal(preview.before.totalCentavos, 24000);
  assert.equal(preview.proposed.totalCentavos, 36000);
  assert.equal(preview.persisted, false);
  assert.equal(preview.approvalRequired, true);
  assert.equal(JSON.stringify(data), before);
});
test('budget preview rejects identity, approval and invalid value injection', () => {
  for (const changes of [[{ id: 'i1', quantidade: -1 }], [{ id: 'i1', versionStatus: 'aprovado' }], [{ id: 'i1', precoUnit: NaN }], [{ id: 'unknown', precoUnit: 1 }]]) assert.equal(previewBudget(ctx({ obraId: 'o1', budgetId: 'b1', changes })).status, 400);
  assert.equal(previewBudget(ctx({ obraId: 'o2', budgetId: 'b2', changes: [] })).status, 403);
});
test('writes require separate grant and explicit operation', () => {
  assert.equal(prepareIntegrationCommand({ ...ctx(write), grant: { ...grant, scopes: ['planejamento:read'] } }).status, 403);
  for (const operation of ['pay', 'approve-purchase', 'activate-contract', 'delete', 'save-sections']) assert.equal(prepareIntegrationCommand(ctx({ ...write, operation, approved: true })).status, 403);
});
test('command actor/obra/history/status are not client-controlled', () => {
  const prepared = prepareIntegrationCommand(ctx({ ...write, actorId: 'attacker' }));
  assert.equal(prepared.command.actorId, undefined);
  assert.equal(prepared.command.payload.constraint.obraId, 'o1');
  assert.equal(prepared.command.payload.constraint.status, 'aberta');
  for (const field of ['obraId', 'status', 'historico']) assert.equal(prepareIntegrationCommand(ctx({ ...write, constraint: { ...write.constraint, [field]: 'evil' } })).status, 400);
});
test('current target checked again after snapshot changes', () => {
  assert.equal(prepareIntegrationCommand(ctx({ ...write, lookaheadId: 'l2' })).status, 404);
  const moved = { ...data, lookaheadWindows: [{ ...data.lookaheadWindows[0], obraId: 'o2' }] };
  assert.equal(prepareIntegrationCommand({ ...ctx(write), data: moved }).status, 404);
});
test('missing optimistic version or idempotency key rejected', () => {
  assert.equal(prepareIntegrationCommand(ctx({ ...write, expectedVersion: undefined })).status, 400);
  assert.equal(prepareIntegrationCommand(ctx({ ...write, idempotencyKey: '' })).status, 400);
});
test('existing domain reducer enforces stale version and validation', () => {
  const command = prepareIntegrationCommand(ctx(write)).command;
  assert.equal(applyOperationalCommand(data, { ...command, expectedVersion: 0 }).ok, false);
  assert.equal(applyOperationalCommand(data, { ...command, payload: { ...command.payload, constraint: { ...command.payload.constraint, categoria: 'invalid' } } }).ok, false);
});
test('existing domain handles valid write and duplicate idempotent replay', () => {
  const command = { ...prepareIntegrationCommand(ctx(write)).command, actorId: user.id, actorName: 'Operador' };
  assert.equal(validateOperationalCommandScope({ data, user, command }).ok, true);
  const result = applyOperationalCommand(data, command);
  assert.equal(result.ok, true);
  assert.equal(result.data.lookaheadWindows[0].version, 2);
  assert.equal(result.data.lookaheadWindows[0].restricoes.length, 1);
  const repeated = applyOperationalCommand(result.data, command);
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.data.lookaheadWindows[0].restricoes.length, 1);
});
test('write responses strip full blobs and sensitive error detail', () => {
  assert.deepEqual(sanitizeIntegrationWriteResponse({ data, sections: data, idempotent: true }, 200), { ok: true, idempotent: true, updatedAt: null });
  assert.equal(JSON.stringify(sanitizeIntegrationWriteResponse({ error: 'SECRET', data }, 409)).includes('SECRET'), false);
});
test('handler wiring preserves audited path and rechecks inside lock/retry (structural regression)', () => {
  const source = readFileSync(new URL('../../api/data.js', import.meta.url), 'utf8');
  assert.match(source, /command,usuario,financial:persistenciaFinanceira,integration/);
  assert.match(source, /prepareIntegrationCommand\(\{data:current,user:usuario/);
  assert.match(source, /prepareIntegrationCommand\(\{data:base.payload,user:usuario/);
  assert.match(source, /action:`operational_\$\{command.type.toLowerCase\(\)\}`/);
  assert.match(source, /const save=persistenciaFinanceira\s*\?salvarFinanceiroComAuditoria\s*:salvarComAuditoria/);
});

test('fresh key cannot append duplicate constraint ID, same key remains idempotent', () => {
  const command = prepareIntegrationCommand(ctx(write)).command;
  const saved = applyOperationalCommand(data, command).data;
  assert.equal(prepareIntegrationCommand({ ...ctx(write), data: saved }).ok, true);
  assert.equal(prepareIntegrationCommand({ ...ctx({ ...write, idempotencyKey: 'different_request_123' }), data: saved }).status, 409);
});
test('actor deactivation or role change during retry blocks mutation', () => {
  assert.equal(prepareIntegrationCommand({ ...ctx(write), data: { ...data, usuarios: [{ ...user, active: false }] } }).status, 403);
  assert.equal(prepareIntegrationCommand({ ...ctx(write), data: { ...data, usuarios: [{ ...user, role: 'visualizador' }] } }).status, 403);
});
test('capabilities intersect actor permissions', () => {
  const result = integrationCapabilities(grant, { ...user, role: 'visualizador' }, false);
  assert.deepEqual(result.readModules, []);
  assert.deepEqual(result.writes, []);
});

test('unsafe monetary precision is rejected instead of reporting rounded totals', () => {
  const result = previewBudget(ctx({ obraId: 'o1', budgetId: 'b1', changes: [{ id: 'i1', quantidade: 1e12, precoUnit: 1e12 }] }));
  assert.equal(result.status, 422);
});
test('reads fail closed if latest actor was revoked or re-scoped', () => {
  for (const actor of [{ ...user, active: false }, { ...user, obraId: 'o2' }, { ...user, role: 'visualizador' }]) {
    assert.equal(readIntegration({ ...ctx({ module: 'financeiro', obraId: 'o1' }), data: { ...data, usuarios: [actor] } }).status, 403);
  }
});
