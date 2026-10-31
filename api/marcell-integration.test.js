import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { budgetSourceHash } from '../server/marcell-budget-revision.js';
import { decodeAppData } from '../server/data-codec.js';

const token = 'z'.repeat(43);
const grant = { id: 'integration-1', enabled: true, userId: 'u1', companyId: 'arcd', tokenSha256: createHash('sha256').update(token).digest('hex'), expiresAt: '2099-01-01', obraIds: ['o1'], scopes: ['compras:read', 'planejamento:write'] };
const fixture = () => ({ usuarios: [{ id: 'u1', role: 'admin', active: true }], obras: [{ id: 'o1' }], pedidos: [{ id: 'p1', obraId: 'o1', pix: 'secret' }], padding: 'x'.repeat(70000), lookaheadWindows: [{ id: 'l1', obraId: 'o1', version: 1, pacotes: [{ id: 'p1' }], restricoes: [] }] });
let handler, db, state, calls;
function setupDb() {
  return {
    auth: { getUser: vi.fn(() => { throw new Error('machine grant must not call user-token auth'); }) },
    from: vi.fn(table => {
      const filters = [];
      const builder = {};
      for (const name of ['select', 'eq', 'in', 'like', 'order']) builder[name] = (...args) => { filters.push([name, ...args]); calls.push([table, name, ...args]); return builder; };
      const result = () => ({ data: filters.some(f => f[0] === 'eq' && f[1] === 'key') ? { value: state, updated_at: '2026-10-31T00:00:00Z' } : [], error: null });
      builder.maybeSingle = async () => result();
      builder.then = resolve => resolve(result());
      for (const name of ['update', 'upsert', 'insert', 'delete']) builder[name] = () => { throw new Error(`unexpected ${name}`); };
      return builder;
    }),
    rpc: vi.fn(async (name, args) => {
      calls.push(['rpc', name, args]);
      if (name !== 'company_save_with_audit') throw new Error(`unexpected RPC ${name}`);
      state = decodeAppData(args.p_value);
      return { data: [{ applied: true, updated_at: '2026-10-31T01:00:00Z' }], error: null };
    }),
  };
}
const call = async (body, authorization = `Bearer ${token}`) => {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', headers: { authorization }, body }, res);
  return res;
};
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'TEST_NOT_A_CREDENTIAL');
  vi.stubEnv('COMPANY_ID', 'arcd');
  vi.stubEnv('POSTGRES_URL_NON_POOLING', '');
  vi.stubEnv('MARCELL_INTEGRATION_GRANTS', JSON.stringify([grant]));
  state = fixture(); calls = []; db = setupDb();
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => db }));
  ({ default: handler } = await import('./data.js'));
});
afterEach(() => vi.unstubAllEnvs());
describe('integration HTTP adapter with mocked persistence only', () => {
  it('rejects missing/invalid token before all DB access, ignoring supplied PIN', async () => {
    const result = await call({ action: 'integration-read', userId: 'u1', pin: '1234' }, 'Bearer invalid');
    expect(result.statusCode).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
  it('read returns safe projection and does NOT perform transparent compression writes', async () => {
    const result = await call({ action: 'integration-read', module: 'compras', obraId: 'o1' });
    expect(result.statusCode).toBe(200);
    expect(result.body.sections.pedidos.records).toEqual([{ id: 'p1', obraId: 'o1', itens: [], itemsTruncated: false, pagamentos: [], paymentsTruncated: false }]);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(calls.filter(c => c[1] === 'eq' && c[2] === 'company_id').every(c => c[3] === 'arcd')).toBe(true);
  });
  it('write uses audited RPC, stored actor, versioning and sanitized replay', async () => {
    const body = { action: 'integration-command', operation: 'add-planning-constraint', obraId: 'o1', lookaheadId: 'l1', expectedVersion: 1, idempotencyKey: 'http_write_key_0001', actorId: 'evil', constraint: { id: 'r1', pacoteId: 'p1', categoria: 'material', descricao: 'Falta aço', dataIdentificacao: '2026-10-31', dataNecessidade: '2026-11-01' } };
    const result = await call(body);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ ok: true, idempotent: false, updatedAt: '2026-10-31T01:00:00Z' });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    const [, args] = db.rpc.mock.calls[0];
    expect(args.p_actor_id).toBe('u1');
    expect(args.p_after.integrationGrantId).toBe('integration-1');
    expect(args.p_action).toBe('operational_restricao_lookahead_adicionada');
    expect(state.lookaheadWindows[0].restricoes).toHaveLength(1);
    const repeat = await call(body);
    expect(repeat.body.idempotent).toBe(true);
    expect(repeat.body.data).toBeUndefined();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects stale version without RPC', async () => {
    const result = await call({ action: 'integration-command', operation: 'add-planning-constraint', obraId: 'o1', lookaheadId: 'l1', expectedVersion: 0, idempotencyKey: 'http_write_key_0001', constraint: { id: 'r1', pacoteId: 'p1', categoria: 'material', descricao: 'Falta aço', dataIdentificacao: '2026-10-31', dataNecessidade: '2026-11-01' } });
    expect(result.statusCode).toBe(409);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

it('persisted budget revision uses audited path and preserves approved source/baseline', async () => {
  vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['orcamento:write']} ]));
  const source={id:'b',obraId:'o1',versionId:'v1',versionStatus:'aprovado',lockedAt:'2026-01-01',approvedById:'u1',itens:[{id:'i',quantidade:2,precoUnit:100}],etapas:[]};
  state.orcamentos=[source];state.budgetBaselines=[{id:'base',obraId:'o1',budgetId:'b',budgetVersionId:'v1',tipo:'controle',ativo:true}];
  const before=structuredClone(source),baseline=structuredClone(state.budgetBaselines);
  const body={action:'integration-budget-revision',obraId:'o1',budgetId:'b',newId:'b2',newVersionId:'v2',sourceHash:budgetSourceHash(source),changes:[{id:'i',quantidade:3}],idempotencyKey:'budget_http_request_01'};
  const result=await call(body);
  expect(result.statusCode).toBe(200);expect(result.body.budgetId).toBe('b2');
  expect(state.orcamentos[0]).toEqual(before);expect(state.budgetBaselines).toEqual(baseline);expect(state.orcamentos[1].status).toBe('rascunho');
  expect(db.rpc.mock.calls[0][1].p_action).toBe('integration_budget_revision');expect(db.rpc.mock.calls[0][1].p_after.integrationGrantId).toBe(grant.id);
  const repeat=await call(body);expect(repeat.body.idempotent).toBe(true);expect(db.rpc).toHaveBeenCalledTimes(1);
});
it('expanded RDO command is audited and exact replay survives completed status', async()=>{
  vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['rdo:write']} ]));
  const body={action:'integration-command',operation:'save-field-report-draft',obraId:'o1',expectedVersion:0,idempotencyKey:'rdo_http_request_0001',record:{id:'r1',data:'2026-10-31',descricao:'Frente de serviço preparada'}};
  const result=await call(body);expect(result.statusCode).toBe(200);expect(state.rdos[0].status).toBe('preparacao');
  state.rdos[0].status='concluido';const repeat=await call(body);expect(repeat.body.idempotent).toBe(true);expect(db.rpc).toHaveBeenCalledTimes(1);
  const changed=await call({...body,record:{...body.record,descricao:'Diferente'}});expect(changed.statusCode).toBe(409);expect(db.rpc).toHaveBeenCalledTimes(1);
});
it('finance write scope alone never grants consequential financial recording',async()=>{
  vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['financeiro:write']} ]));
  const result=await call({action:'integration-command',operation:'create-project-expense',obraId:'o1',expectedVersion:0,idempotencyKey:'expense_http_request_1',record:{id:'expense',descricao:'Serviço',competencia:'2026-10',valor:10}});
  expect(result.statusCode).toBe(403);expect(db.rpc).not.toHaveBeenCalled();
});

it('consequential finance command requires transactional connection even with explicit manage grant',async()=>{
  vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['financeiro:write','financeiro:manage']} ]));
  const result=await call({action:'integration-command',operation:'create-project-expense',obraId:'o1',expectedVersion:0,idempotencyKey:'expense_http_request_1',record:{id:'expense',descricao:'Serviço',competencia:'2026-10',valor:10}});
  expect(result.statusCode).toBe(503);expect(result.body.code).toBe('INTEGRATION_TRANSACTION_REQUIRED');expect(db.rpc).not.toHaveBeenCalled();
});

it('incident ingestion is persisted atomically with audit, dedup, no free text and readiness inactive',async()=>{
 vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['monitoramento:write','monitoramento:read']} ]));
 const body={action:'integration-incident',obraId:'o1',eventId:'critical_event_0001',code:'DATA_SAVE_FAILED',module:'financeiro'};
 const first=await call(body);expect(first.statusCode).toBe(200);expect(db.rpc.mock.calls[0][1].p_action).toBe('integration_incident_recorded');
 expect(state.integrationIncidents).toHaveLength(1);expect(state.integrationMonitoringCounters[0].count).toBe(1);
 expect((await call(body)).body.idempotent).toBe(true);expect(db.rpc).toHaveBeenCalledTimes(1);
 expect((await call({...body,eventId:'critical_event_0002',message:'Bearer SECRET'})).statusCode).toBe(400);
 const feed=await call({action:'integration-monitoring',obraId:'o1',severity:'critical'});expect(feed.body.incidents[0].verification).toBe('reported-unverified');expect(feed.body.readiness.schedulerActive).toBe(false);expect(feed.body.readiness.deliveryActive).toBe(false);
});
it('incident per-grant quota is enforced in persisted state',async()=>{
 vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['monitoramento:write']} ]));
 for(let n=0;n<20;n++)expect((await call({action:'integration-incident',obraId:'o1',eventId:`critical_event_${String(n).padStart(5,'0')}`,code:'DATA_SAVE_FAILED',module:'financeiro'})).statusCode).toBe(200);
 expect((await call({action:'integration-incident',obraId:'o1',eventId:'critical_event_over',code:'DATA_SAVE_FAILED',module:'financeiro'})).statusCode).toBe(429);expect(db.rpc).toHaveBeenCalledTimes(20);
});
it('signature preparation and manual tracking never assert cryptographic signature',async()=>{
 vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['contratos:prepare','contratos:signatures:read','contratos:signatures:write']} ]));
 state.obras[0].aditivosContrato=[{id:'a1',descricao:'Escopo para revisão',valor:100,prazoDias:1,status:'proposto',version:1}];
 const prepare={action:'integration-signature-prepare',packetId:'packet1',obraId:'o1',sourceType:'contract-amendment',sourceId:'a1',expectedVersion:1,idempotencyKey:'prepare_signature_0001'};
 expect((await call(prepare)).statusCode).toBe(200);expect(db.rpc.mock.calls[0][1].p_action).toBe('integration_signature_prepared');
 const read=await call({action:'integration-signatures',obraId:'o1',packetId:'packet1'});expect(read.statusCode).toBe(200);
 const packet=state.integrationSignaturePackets[0];expect(packet.status).toBe('prepared-awaiting-user-signature');
 const track={action:'integration-signature-track',packetId:'packet1',obraId:'o1',expectedVersion:1,documentHash:packet.contentHash,reportedStatus:'reported-signed',evidence:{sha256:'a'.repeat(64),fileName:'aditivo-assinado.pdf',mimeType:'application/pdf'},idempotencyKey:'track_signature_0001'};
 expect((await call(track)).statusCode).toBe(200);expect(state.integrationSignaturePackets[0].signatureVerified).toBe(false);expect(state.integrationSignaturePackets[0].status).toBe('reported-signed');
 expect((await call(track)).body.idempotent).toBe(true);expect((await call({...track,idempotencyKey:'token_signature_0001',tokenPin:'123456'})).statusCode).toBe(400);
 expect(db.rpc).toHaveBeenCalledTimes(2);
});
it('accounting settlement is separately scoped and requires locked persistence, never bank fallback',async()=>{
 state.notasFiscais=[{id:'nf',obraId:'o1',status:'aprovada',version:1,valorBruto:100,valorLiquido:100,pagamentos:[]}];
 const body={action:'integration-command',operation:'record-payable-settlement',obraId:'o1',expectedVersion:1,idempotencyKey:'settlement_http_0001',record:{id:'settlement',targetType:'nota',targetId:'nf',data:'2026-10-31',valor:50,referencia:'Pagamento já realizado'}};
 vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['financeiro:write']} ]));expect((await call(body)).statusCode).toBe(403);
 vi.stubEnv('MARCELL_INTEGRATION_GRANTS',JSON.stringify([{...grant,scopes:['financeiro:write','financeiro:settle']} ]));expect((await call(body)).statusCode).toBe(503);expect(db.rpc).not.toHaveBeenCalled();
});

it.each(['admin','engenheiro'])('legacy full-save by %s preserves omitted server-owned integration state and rejects explicit replacement',async role=>{
 delete state.padding;state.usuarios=[{id:'u1',role,active:true,authUserId:'auth-user'}];
 state.integrationIncidents=[{id:'incident1',obraId:'o1'}];state.integrationMonitoringCounters=[{subject:'quota',bucket:1,count:1}];state.integrationSignaturePackets=[{id:'packet1',obraId:'o1'}];
 db.auth.getUser.mockResolvedValue({data:{user:{id:'auth-user'}},error:null});
 const {integrationIncidents,integrationMonitoringCounters,integrationSignaturePackets,...payload}=structuredClone(state);
 const result=await call({action:'save',accessToken:'test-user-session',payload});expect(result.statusCode).toBe(200);
 expect(state.integrationIncidents).toEqual(integrationIncidents);expect(state.integrationMonitoringCounters).toEqual(integrationMonitoringCounters);expect(state.integrationSignaturePackets).toEqual(integrationSignaturePackets);
 const rejected=await call({action:'save',accessToken:'test-user-session',payload:{...payload,integrationSignaturePackets:[]}});expect(rejected.statusCode).toBe(409);
});
