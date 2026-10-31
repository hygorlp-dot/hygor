import { readMonitoring } from './marcell-monitoring.js';
import { DOMAIN_COMMAND_SPECS, prepareDomainCommand } from './marcell-domain-commands.js';
import { FIELD_COMMAND_SPECS, prepareFieldCommand } from './marcell-field-commands.js';
import { budgetSourceHash } from './marcell-budget-revision.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { projectDataForUser } from './data-projection.js';
import { calculateBudget } from '../src/domains/orcamentos/calculations.js';

export const INTEGRATION_ACTIONS = new Set(['integration-capabilities', 'integration-read', 'integration-budget-preview', 'integration-budget-revision', 'integration-report', 'integration-incident', 'integration-monitoring', 'integration-signature-prepare', 'integration-signature-track', 'integration-signatures', 'integration-command']);
const LOOKAHEAD_ROLES = ['admin', 'engenheiro', 'engenheiro_auditor', 'planejamento', 'mestre', 'qualidade', 'seguranca'];
const EXTRA_READ_ROLES={lookaheadWindows:LOOKAHEAD_ROLES,jobRiskAnalyses:['admin','engenheiro','seguranca'],workPermits:['admin','engenheiro','seguranca'],progressRecords:['admin','engenheiro','engenheiro_auditor','planejamento','mestre'],weeklyCommitments:['admin','engenheiro','engenheiro_auditor','planejamento','mestre']};
const COMMAND_SPECS = {...DOMAIN_COMMAND_SPECS,...FIELD_COMMAND_SPECS};
const MODULES = ['orcamento', 'planejamento', 'financeiro', 'compras', 'contratos', 'obras', 'rdo', 'qualidade', 'medicoes', 'estoque', 'suprimentos', 'equipamentos', 'licenciamento', 'equipe', 'terceiros', 'projetos', 'producao', 'seguranca'];
const fail = (status, code) => ({ ok: false, status, code });
const list = value => Array.isArray(value) ? value : [];
const scalar = value => typeof value === 'string' ? value.slice(0, 4000) : typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
const pick = (value, fields) => Object.fromEntries(fields.split(' ').flatMap(key => scalar(value?.[key]) === undefined ? [] : [[key, scalar(value[key])]]));
const COMMON = 'id obraId nome name descricao numero status version updatedAt atualizadoEm data';

// Configuration is an explicit deployment-time authorization, not supplied by callers.
// Store only SHA-256 digests of high-entropy bearer tokens; no token is minted here.
export function authenticateIntegration(headers, config, companyId, now = Date.now()) {
  let grants;
  try { grants = JSON.parse(config || 'null'); } catch { return fail(503, 'INTEGRATION_DISABLED'); }
  if (!Array.isArray(grants) || !grants.length) return fail(503, 'INTEGRATION_DISABLED');
  const match = /^Bearer ([A-Za-z0-9_-]{43,200})$/.exec(headers?.authorization || '');
  if (!match) return fail(401, 'INTEGRATION_UNAUTHORIZED');
  const digest = createHash('sha256').update(match[1]).digest();
  const matches = grants.filter(g => /^[a-f0-9]{64}$/.test(g?.tokenSha256 || '') && timingSafeEqual(digest, Buffer.from(g.tokenSha256, 'hex')));
  const g = matches.length === 1 ? matches[0] : null;
  if (!g || g.enabled !== true || g.companyId !== companyId || !g.userId || !g.id ||
      !Number.isFinite(Date.parse(g.expiresAt)) || Date.parse(g.expiresAt) <= now ||
      !Array.isArray(g.obraIds) || !g.obraIds.length || g.obraIds.some(id => typeof id !== 'string' || !id || id === '*') ||
      !Array.isArray(g.scopes) || g.scopes.some(s => ![...MODULES.map(m => `${m}:read`), 'orcamento:preview', ...MODULES.map(m => `${m}:write`), 'financeiro:manage', 'financeiro:settle', 'contratos:manage', 'contratos:prepare', 'contratos:signatures:read', 'contratos:signatures:write', 'monitoramento:read', 'monitoramento:write', 'relatorios:read'].includes(s))) return fail(401, 'INTEGRATION_UNAUTHORIZED');
  return { ok: true, grant: g };
}

export function integrationActor(data, grant) {
  const user = list(data?.usuarios).find(u => u.id === grant.userId && u.active !== false);
  return user || null;
}

export function authorizeIntegrationWork(data, user, grant, obraId) {
  const currentActor = integrationActor(data, grant);
  if (!currentActor || currentActor.role !== user.role || currentActor.obraId !== user.obraId) return false;
  return typeof obraId === 'string' && grant.obraIds.includes(obraId) &&
    (!user.obraId || String(user.obraId) === obraId) && list(data.obras).some(w => String(w.id) === obraId);
}

export function integrationCapabilities(grant, user = {}, canWrite = false) {
  const sample = Object.fromEntries(Object.values(SPECS).flatMap(spec => Object.keys(spec).map(k => [k, []])));
  const visible = projectDataForUser(sample, user);
  const readable = MODULES.filter(m => Object.keys(SPECS[m]).some(k => (k in visible || EXTRA_READ_ROLES[k]?.includes(user.role)) && !(m==='contratos'&&k==='obras'&&!['admin','engenheiro','financeiro'].includes(user.role))) || (m === 'planejamento' && LOOKAHEAD_ROLES.includes(user.role)));
  return { version: '3', scopes: grant.scopes, obraIds: grant.obraIds,
    readModules: readable.filter(m => grant.scopes.includes(`${m}:read`)),
    writes: [...(canWrite && grant.scopes.includes('planejamento:write') ? ['add-planning-constraint'] : []), ...Object.entries(COMMAND_SPECS).filter(([,spec])=>spec.roles.includes(user.role)&&spec.scopes.every(scope=>grant.scopes.includes(scope))).map(([operation])=>operation), ...(grant.scopes.includes('orcamento:write')&&['admin','engenheiro','engenheiro_auditor'].includes(user.role)?['create-budget-revision']:[])],
    commandDetails: Object.fromEntries(Object.entries(COMMAND_SPECS).map(([name,spec])=>[name,{module:spec.module,scopes:spec.scopes,risk:spec.risk,effects:spec.effects||'Operação validada pelo domínio existente.'}])),
    monitoring: {read:['admin','engenheiro','engenheiro_auditor','financeiro','compras','planejamento','mestre','qualidade','seguranca'].includes(user.role)&&grant.scopes.includes('monitoramento:read'),intake:['admin','engenheiro','engenheiro_auditor','financeiro','compras','planejamento','mestre','qualidade','seguranca'].includes(user.role)&&grant.scopes.includes('monitoramento:write'),schedulerActive:false,deliveryActive:false},
    signatures: {prepare:['admin','compras','engenheiro','financeiro'].includes(user.role)&&grant.scopes.includes('contratos:prepare'),trackingRead:['admin','compras','engenheiro','financeiro'].includes(user.role)&&grant.scopes.includes('contratos:signatures:read'),trackingWrite:['admin','compras','engenheiro','financeiro'].includes(user.role)&&grant.scopes.includes('contratos:signatures:write'),manualUnverified:true,tokenAccess:false},
    previews: readable.includes('orcamento') && grant.scopes.includes('orcamento:preview') && grant.scopes.includes('orcamento:read') ? ['budget-item-revision'] : [],
    unavailable: ['bank-payments', 'purchase-approval', 'external-contract-signature', 'budget-approval', 'public-client-error-persistence', 'automatic-notifications', 'activated-scheduler', 'cryptographic-signature-verification', 'full-audit-feed'],
  };
}

const SPECS = {
  orcamento: { orcamentos: `${COMMON} versionId versionNumber versionStatus lockedAt bdi areaM2`, budgetBaselines: `${COMMON} budgetId budgetVersionId tipo ativo` },
  planejamento: { planos: `${COMMON} budgetId budgetVersionId inicio fim`, lookaheadWindows: `${COMMON} semanaInicio semanaFim horizonteSemanas` },
  financeiro: { notasFiscais: `${COMMON} numero valor valorTotal valorBruto valorLiquido emissao fornecedorId pedidoId vencimento`, payments: `${COMMON} valor vencimento dataPagamento tipo`, medicoes: `${COMMON} valor valorTotal vencimento`, outrasDesp: `${COMMON} valor vencimento categoria`, caixaObra: `${COMMON} valor tipo` },
  compras: { solicitacoesCompra: `${COMMON} dataNecessidade pedidoId`, pedidos: `${COMMON} solicitacaoId fornecedorId valorTotal total dataEntrega`, cotacoes: `${COMMON} solicitacaoId` },
  contratos: { contratosFornecimento: `${COMMON} fornecedorId vigenciaInicio vigenciaFim`, obras: `${COMMON} contractValue contratoValor dataInicio dataFim` },
  obras: { obras: `${COMMON} status fase inicio fim dataInicio dataFim` },
  rdo: { rdos: `${COMMON} descricao clima efetivo data versao` },
  qualidade: { qualidadeRegistros: `${COMMON} responsavelId normaProjeto pacoteId etapaId`, conferencias: `${COMMON} dataConferencia titulo` },
  medicoes: { medicoesObra: `${COMMON} valor total valorTotal periodoInicio periodoFim`, medicoesTecnicas: `${COMMON} valor total valorTotal`, medicoesTerc: `${COMMON} valor total valorTotal terceirizadoId` },
  estoque: { estoque: `${COMMON} materialId quantidade saldo unidade`, movEstoque: `${COMMON} materialId quantidade tipo unidade`, reservasEstoque: `${COMMON} materialId quantidade status` },
  suprimentos: { planosSuprimento: `${COMMON} inicio fim`, marcosSuprimento: `${COMMON} dataNecessidade materialId quantidade`, alertasSuprimento: `${COMMON} severidade tipo mensagem` },
  equipamentos: { equipamentos: `${COMMON} obraAtualId codigo tipo modelo`, locacoesEquip: `${COMMON} equipamentoId inicio fim dataInicio dataFim`, manutencoesEquip: `${COMMON} equipamentoId dataInicio dataFim tipo` },
  licenciamento: { licencas: `${COMMON} tipo numero validade vencimento` },
  equipe: { employees: 'id obra name nome funcao cargo active' },
  terceiros: { terceirizados: `${COMMON} especialidade active` },
  projetos: { engineeringProjects: `${COMMON} titulo codigo disciplina prazo` },
  producao: { progressRecords: `${COMMON} activityId quantidade quantity unidade date data`, weeklyCommitments: `${COMMON} activityId quantidade quantidadePrometida unidade weekStart weekEnd` },
  seguranca: { jobRiskAnalyses: `${COMMON} activityId validade inicio fim validFrom validUntil`, workPermits: `${COMMON} activityId validade inicio fim validFrom validUntil` },
};
const ITEMS = 'id descricao codigo unidade quantidade qtd precoUnit precoRef valor total etapaId tipo bdi materialId qtdContratada precoUnitario';
function projectRecord(record, fields, section, module) {
  const out = pick(record, fields);
  if (['orcamentos', 'pedidos', 'solicitacoesCompra', 'contratosFornecimento'].includes(section)) {
    out.itens = list(record.itens).slice(0, 1000).map(item => pick(item, ITEMS));
    out.itemsTruncated = list(record.itens).length > 1000;
  }
  if (['pedidos','notasFiscais'].includes(section)) {
    out.pagamentos=list(record.pagamentos).slice(0,500).map(payment=>pick(payment,'id data valor origem status registradoEm'));
    out.paymentsTruncated=list(record.pagamentos).length>500;
  }
  if (section === 'orcamentos') {
    out.sourceHash = budgetSourceHash(record);
    out.totals = pick(calculateBudget(record), 'engineVersion custoDiretoCentavos valorBDICentavos totalCentavos qtdItens');
    out.etapas = list(record.etapas).slice(0, 500).map(stage => pick(stage, 'id parentId nome descricao codigo'));
    out.stagesTruncated = list(record.etapas).length > 500;
  }
  if (section === 'planos') {
    out.tarefas = list(record.tarefas).slice(0, 1000).map(task => pick(task, 'id etapaId nome descricao inicio fim status progresso percentual durationDays'));
    out.tasksTruncated = list(record.tarefas).length > 1000;
  }
  if (section === 'obras' && module === 'contratos' && Array.isArray(record.aditivosContrato)) {
    out.aditivosContrato=record.aditivosContrato.slice(0,500).map(a=>pick(a,'id numero descricao justificativa valor prazoDias status version atualizadoEm orcamentoRevisaoId'));
    out.amendmentsTruncated=record.aditivosContrato.length>500;
  }
  if (section === 'jobRiskAnalyses') {
    out.risks=list(record.risks).filter(v=>typeof v==='string').slice(0,50).map(v=>v.slice(0,2000));
    out.controls=list(record.controls).filter(v=>typeof v==='string').slice(0,50).map(v=>v.slice(0,2000));
    out.safetyItemsTruncated=list(record.risks).length>50||list(record.controls).length>50;
  }
  if (section === 'lookaheadWindows') {
    out.pacotes = list(record.pacotes).slice(0, 500).map(p => pick(p, 'id obraId codigo descricao status inicio fim'));
    out.restricoes = list(record.restricoes).slice(0, 500).map(r => pick(r, 'id obraId pacoteId categoria descricao status dataIdentificacao dataNecessidade'));
    out.childrenTruncated = list(record.pacotes).length > 500 || list(record.restricoes).length > 500;
  }
  return out;
}

export function readIntegration({ data, user, grant, body }) {
  const { obraId, module, offset = 0, limit = 50 } = body;
  if (!authorizeIntegrationWork(data, user, grant, obraId)) return fail(403, 'WORK_FORBIDDEN');
  if (!MODULES.includes(module) || !grant.scopes.includes(`${module}:read`)) return fail(403, 'SCOPE_FORBIDDEN');
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) return fail(400, 'INVALID_PAGE');
  // Preserve application-role permissions, then apply a strict positive schema.
  const visible = projectDataForUser(data, user);
  // Lookahead follows engineering roles but is absent in the legacy projection.
  const sections = {};
  for (const [key, fields] of Object.entries(SPECS[module])) {
    const source = module==='contratos'&&key==='obras'&&!['admin','engenheiro','financeiro'].includes(user.role)?undefined:EXTRA_READ_ROLES[key]?.includes(user.role) ? data[key] : visible[key];
    const workOf = r => key === 'obras' ? r?.id : key === 'employees' ? r?.obra : key === 'equipamentos' ? r?.obraAtualId : r?.obraId;
    const rows = list(source).filter(r => String(workOf(r)) === obraId);
    sections[key] = { availability: Array.isArray(source) ? 'available' : 'not-present-or-not-authorized', total: Array.isArray(source) ? rows.length : null, nextOffset: offset + limit < rows.length ? offset + limit : null,
      records: rows.slice(offset, offset + limit).map(r => projectRecord(r, fields, key, module)) };
  }
  return { ok: true, version: '3', obraId, module, sections,
    coverage: { source: 'current-merged-app-data', archivedCostsIncluded: false, companyWideRecordsIncluded: false, authoritativeLedger: false } };
}

// A simulation only: never changes a version, baseline, approval or stored budget.
export function previewBudget({ data, user, grant, body }) {
  if (!grant.scopes.includes('orcamento:preview') || !grant.scopes.includes('orcamento:read')) return fail(403, 'SCOPE_FORBIDDEN');
  if (!authorizeIntegrationWork(data, user, grant, body.obraId)) return fail(403, 'WORK_FORBIDDEN');
  const budget = list(projectDataForUser(data, user).orcamentos).find(b => b.id === body.budgetId && b.obraId === body.obraId);
  if (!budget) return fail(404, 'BUDGET_NOT_FOUND');
  if (!Array.isArray(body.changes) || !body.changes.length || body.changes.length > 100) return fail(400, 'INVALID_CHANGES');
  const changes = new Map();
  for (const c of body.changes) {
    if (!c || !list(budget.itens).some(i => i.id === c.id) || changes.has(c.id) ||
        Object.keys(c).some(k => !['id', 'quantidade', 'precoUnit', 'bdi'].includes(k)) || Object.keys(c).length < 2 ||
        Object.entries(c).some(([k, v]) => k !== 'id' && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12))) return fail(400, 'INVALID_CHANGES');
    changes.set(c.id, c);
  }
  const revised = { ...budget, itens: list(budget.itens).map(i => ({ ...i, ...changes.get(i.id) })) };
  const totals = b => pick(calculateBudget(b), 'custoDiretoCentavos valorBDICentavos totalCentavos');
  const before = totals(budget), proposed = totals(revised);
  if ([...Object.values(before), ...Object.values(proposed)].some(v => !Number.isSafeInteger(v))) return fail(422, 'UNSAFE_MONETARY_PRECISION');
  return { ok: true, persisted: false, approvalRequired: true, budgetId: budget.id,
    versionId: budget.versionId || null, before, proposed,
    note: 'Simulação de preços/quantidades; não substitui validação técnica, revisão formal ou aprovação.' };
}

export function prepareIntegrationCommand({ data, user, grant, body }) {
  const currentActor = integrationActor(data, grant);
  if (!currentActor || currentActor.role !== user.role || currentActor.obraId !== user.obraId) return fail(403, 'ACTOR_CHANGED');
  if (!authorizeIntegrationWork(data, user, grant, body.obraId)) return fail(403, 'WORK_FORBIDDEN');
  const definition=Object.hasOwn(COMMAND_SPECS,body.operation)?COMMAND_SPECS[body.operation]:null;
  if(body.operation!=='add-planning-constraint'&&!definition)return fail(403,'OPERATION_NOT_SUPPORTED');
  if(definition&&(!definition.roles.includes(user.role)||!definition.scopes.every(scope=>grant.scopes.includes(scope))))return fail(403,'SCOPE_FORBIDDEN');
  if(!definition&&!grant.scopes.includes('planejamento:write'))return fail(403,'SCOPE_FORBIDDEN');
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0||!/^[a-zA-Z0-9_-]{16,160}$/.test(body.idempotencyKey||''))return fail(400,'INVALID_COMMAND');
  const key=integrationCommandKey(grant,body);
  const saved=list(data.operationalCommandReceipts).find(r=>r.idempotencyKey===key&&r.integration?.grantId===grant.id&&r.integration?.obraId===body.obraId);
  if(saved)return saved.integration.requestHash===budgetSourceHash(body)?{ok:true,replay:true}:fail(409,'IDEMPOTENCY_MISMATCH');
  if(definition){
    const prepared=(DOMAIN_COMMAND_SPECS[body.operation]?prepareDomainCommand:prepareFieldCommand)({data,user,grant,body});
    return prepared.ok?{...prepared,command:{...prepared.command,idempotencyKey:key}}:prepared;
  }
  const current = list(data.lookaheadWindows).find(w => w.id === body.lookaheadId && w.obraId === body.obraId);
  if (!current) return fail(404, 'LOOKAHEAD_NOT_FOUND');
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || !/^[a-zA-Z0-9_-]{16,160}$/.test(body.idempotencyKey || '')) return fail(400, 'INVALID_COMMAND');
  const raw = body.constraint;
  const fields = 'id pacoteId categoria descricao dataIdentificacao dataNecessidade';
  if (!raw || Object.keys(raw).some(k => !fields.split(' ').includes(k)) || fields.split(' ').some(k => typeof raw[k] !== 'string' || !raw[k] || raw[k].length > (k === 'descricao' ? 2000 : 100))) return fail(400, 'INVALID_CONSTRAINT');
  const command = { type: 'RESTRICAO_LOOKAHEAD_ADICIONADA', expectedVersion: body.expectedVersion,
    idempotencyKey: key,
    payload: { lookaheadId: current.id, constraint: { ...pick(raw, fields), obraId: body.obraId, status: 'aberta' } } };
  const replay = list(data.operationalCommandReceipts).some(r => r.idempotencyKey === command.idempotencyKey && r.entityId === current.id && r.type === command.type);
  if (list(current.restricoes).some(r => r.id === raw.id) && !replay) return fail(409, 'CONSTRAINT_ALREADY_EXISTS');
  return { ok: true, command };
}

export function sanitizeIntegrationWriteResponse(payload, status = 200) {
  if (status >= 400) return { ok: false, code: status === 409 ? 'CONFLICT_OR_VALIDATION' : 'COMMAND_REJECTED', retryable: status === 503 };
  return { ok: true, idempotent: payload?.idempotent === true, updatedAt: payload?.updatedAt || null };
}

// On-demand observations, not a promise of a complete append-only audit/error feed.
export function integrationReport({data,user,grant,body}) {
  if(!grant.scopes.includes('relatorios:read')) return fail(403,'SCOPE_FORBIDDEN');
  if(!authorizeIntegrationWork(data,user,grant,body.obraId)) return fail(403,'WORK_FORBIDDEN');
  const day=body.date;
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(`${day}T12:00:00Z`))||new Date(`${day}T12:00:00Z`).toISOString().slice(0,10)!==day) return fail(400,'INVALID_DATE');
  const modules={},observations=[];
  for(const module of MODULES.filter(m=>grant.scopes.includes(`${m}:read`))){
    const result=readIntegration({data,user,grant,body:{module,obraId:body.obraId,limit:100}});
    if(!result.ok)continue;
    modules[module]=Object.fromEntries(Object.entries(result.sections).map(([key,value])=>[key,{total:value.total,availability:value.availability,truncated:value.nextOffset!==null}]));
    for(const [section,value] of Object.entries(result.sections))for(const record of value.records){
      const at=record.updatedAt||record.atualizadoEm||record.data||record.date;
      if(typeof at==='string'&&at.slice(0,10)===day)observations.push({module,section,id:record.id,status:record.status||null,at});
    }
  }
  const incidents=grant.scopes.includes('monitoramento:read')?readMonitoring({data,user,grant,body:{obraId:body.obraId,severity:'critical',limit:10}}):null;
  return {ok:true,criticalIncidents:incidents?.ok?{total:incidents.total,incidents:incidents.incidents,verification:'reported-unverified'}:{availability:'not-authorized'},obraId:body.obraId,date:day,generatedAt:new Date().toISOString(),modules,observations:observations.slice(0,200),observationsTruncated:observations.length>200,
    coverage:{kind:'current-record-observations',completeAuditTrail:false,persistentClientErrors:false,scheduled:false,missingDataIsNotZero:true}};
}

function integrationCommandKey(grant,body){
  const target=body.operation==='add-planning-constraint'?body.lookaheadId:body.operation;
  return `int_${createHash('sha256').update(`${grant.id}:${body.obraId}:${target}:${body.idempotencyKey}`).digest('hex')}`;
}
export function annotateIntegrationResult(result,integration,command){
  if(!integration||!result?.ok||result.idempotent)return result;
  return {...result,data:{...result.data,operationalCommandReceipts:list(result.data?.operationalCommandReceipts).map(r=>r.idempotencyKey===command.idempotencyKey?{...r,integration:{grantId:integration.grant.id,obraId:integration.body.obraId,operation:integration.body.operation,requestHash:budgetSourceHash(integration.body)}}:r)}};
}
