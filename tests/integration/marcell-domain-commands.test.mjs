import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_COMMAND_SPECS, prepareDomainCommand } from '../../server/marcell-domain-commands.js';
import { applyOperationalCommand } from '../../src/domains/sync/operational-commands.js';

const user = { id: 'u1', role: 'admin', nome: 'Operador' };
const grant = { obraIds: ['o1'], scopes: ['compras:write', 'financeiro:write', 'financeiro:manage', 'contratos:write', 'contratos:manage', 'planejamento:write'] };
const base = () => ({ obras: [{ id: 'o1', contractValue: 50000 }, { id: 'o2' }], materiais: [{ id: 'm1', descricao: 'Aço', unidade: 'KG' }], fornecedores: [{ id: 'f1', nome: 'Fornecedor' }], orcamentos: [{ id: 'b1', obraId: 'o1', itens: [{ id: 'bi1' }] }, { id: 'b2', obraId: 'o2', itens: [{ id: 'bi2' }] }], pedidos: [{ id: 'p2', obraId: 'o2' }], solicitacoesCompra: [], cotacoes: [], instanciasAprovacao: [], usuarios: [user] });
const records = {
  'save-purchase-request': { id: 'r1', necessidade: '2026-11-01', prioridade: 'normal', itens: [{ id: 'ri1', materialId: 'm1', descricaoRef: 'Aço', unidadeRef: 'KG', unidadeCompra: 'KG', fatorConversao: 1, quantidade: 2, precoRef: 5 }] },
  'save-purchase-order-draft': { id: 'p1', fornecedorId: 'f1', data: '2026-10-31', itens: [{ id: 'pi1', materialId: 'm1', unidadeRef: 'KG', unidadeCompra: 'KG', fatorConversao: 1, qtd: 2, precoUnit: 5 }] },
  'create-project-expense': { id: 'e1', descricao: 'Taxa', competencia: '2026-10', categoria: 'outros', valor: 10 },
  'save-invoice': { id: 'n1', numero: '100', emissao: '2026-10-31', vencimento: '2026-11-05', valorBruto: 10, fornecedorId: 'f1', retencoes: { iss: 1 } },
  'save-contract-amendment': { id: 'a1', descricao: 'Revisão de escopo', justificativa: 'Solicitação', valor: 500, prazoDias: 3, orcamentoRevisaoId: 'b1' },
  'save-supply-contract': { id: 'c1', fornecedorId: 'f1', vigenciaInicio: '2026-10-31', vigenciaFim: '2026-12-31', itens: [{ id: 'ci1', materialId: 'm1', unidadeRef: 'KG', unidadeCompra: 'KG', fatorConversao: 1, qtdContratada: 10, precoUnit: 5 }] },
  'create-lookahead': { id: 'l1', semanaInicio: '2026-10-31', semanaFim: '2026-11-21', horizonteSemanas: 3, pacotes: [{ id: 'pk1', descricao: 'Estrutura' }] },
};
const body = (operation, overrides = {}) => ({ operation, obraId: 'o1', expectedVersion: 0, record: structuredClone(records[operation]), ...overrides });
const prepare = (operation, overrides = {}, extra = {}) => prepareDomainCommand({ data: base(), user, grant, body: body(operation, overrides), ...extra });
const execute = (data, prepared, key = 'integration_test_unique_key_001') => applyOperationalCommand(data, { ...prepared.command, idempotencyKey: key, actorId: user.id, actorRole: user.role, actorName: user.nome }, '2026-10-31T12:00:00.000Z');

for (const operation of Object.keys(records)) test(`${operation}: strict typed command accepted by real domain`, () => {
  const prepared = prepare(operation);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  const result = execute(base(), prepared);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.operationalCommandReceipts.length, 1);
  assert.equal(execute(result.data, prepared).idempotent, true);
});

test('draft/proposal/active outcomes are explicit, never fake draft', () => {
  const order = execute(base(), prepare('save-purchase-order-draft')).data.pedidos.find(p => p.id === 'p1');
  assert.equal(order.status, 'rascunho');
  const amendment = execute(base(), prepare('save-contract-amendment')).data.obras[0].aditivosContrato[0];
  assert.equal(amendment.status, 'proposto');
  assert.equal(execute(base(), prepare('save-supply-contract')).data.contratosFornecimento[0].status, 'ativo');
  assert.equal(execute(base(), prepare('create-project-expense')).data.outrasDesp[0].status, 'ativo');
  assert.equal(execute(base(), prepare('save-invoice')).data.notasFiscais[0].status, 'recebida');
});
test('consequential writes require additional manage scope', () => {
  for (const op of ['create-project-expense', 'save-invoice', 'save-supply-contract']) assert.equal(prepare(op, {}, { grant: { ...grant, scopes: grant.scopes.filter(s => !s.endsWith(':manage')) } }).status, 403);
});
test('unknown and prototype operations fail closed', () => {
  for (const operation of ['pay', '__proto__', 'constructor']) assert.equal(prepareDomainCommand({ body: { operation } }).status, 403);
});
test('role, work and required initial version enforced', () => {
  for (const op of Object.keys(records)) {
    assert.equal(prepare(op, {}, { user: { ...user, role: 'visualizador' } }).status, 403);
    assert.equal(prepare(op, { obraId: 'o2' }).status, 403);
    assert.equal(prepare(op, { expectedVersion: 2 }).status, 409);
    assert.equal(prepare(op, { expectedVersion: undefined }).status, 400);
  }
});
test('actor/status/approval/payment/document injection rejected in each record', () => {
  for (const op of Object.keys(records)) for (const field of ['status', 'createdById', 'aprovacaoInstanciaId', 'pagamentos', 'documentos', 'obraId']) {
    assert.equal(prepare(op, { record: { ...records[op], [field]: 'injected' } }).status, 400, `${op}/${field}`);
  }
});
test('nested injection, duplicate IDs and unbounded numbers rejected', () => {
  const r = records['save-purchase-request'];
  assert.equal(prepare('save-purchase-request', { record: { ...r, itens: [{ ...r.itens[0], aprovado: true }] } }).status, 400);
  assert.equal(prepare('save-purchase-request', { record: { ...r, itens: [r.itens[0], r.itens[0]] } }).status, 400);
  assert.equal(prepare('create-project-expense', { record: { ...records['create-project-expense'], valor: Infinity } }).status, 400);
  const order = records['save-purchase-order-draft'];
  assert.equal(prepare('save-purchase-order-draft', { record: { ...order, itens: [{ ...order.itens[0], qtd: 1e9, precoUnit: 1e9 }] } }).status, 400);
});
test('existing record cannot be moved from another obra', () => {
  const data = base(); data.notasFiscais = [{ id: 'n1', obraId: 'o2', status: 'recebida', version: 1 }];
  assert.equal(prepare('save-invoice', { expectedVersion: 1 }, { data }).status, 403);
});
test('cross-work related order and budget links fail closed', () => {
  assert.equal(prepare('save-invoice', { record: { ...records['save-invoice'], pedidoId: 'p2' } }).status, 403);
  assert.equal(prepare('save-contract-amendment', { record: { ...records['save-contract-amendment'], orcamentoRevisaoId: 'b2' } }).status, 403);
  const record = structuredClone(records['save-purchase-request']); record.itens[0].orcItemId = 'bi2';
  assert.equal(prepare('save-purchase-request', { record }).status, 403);
});
test('approved invoices/sent orders/decided amendments cannot use draft operations', () => {
  const data = base(); data.notasFiscais = [{ id: 'n1', obraId: 'o1', status: 'aprovada' }];
  data.pedidos.push({ id: 'p1', obraId: 'o1', status: 'enviado' });
  data.obras[0].aditivosContrato = [{ id: 'a1', status: 'aprovado' }];
  for (const op of ['save-invoice', 'save-purchase-order-draft', 'save-contract-amendment']) assert.equal(prepare(op, {}, { data }).status, 409);
});
test('multi-work invoice updates are not normalized into a single-work grant', () => {
  const data = base(); data.notasFiscais = [{ id: 'n1', obraId: 'o1', status: 'recebida', rateios: [{ obraId: 'o2', valor: 10 }] }];
  assert.equal(prepare('save-invoice', {}, { data }).status, 403);
});
test('real invoice domain rejects a closed accounting period', () => {
  const data = base(); data.fechamentosFinanceiros = [{ id: 'closed', dataInicio: '2026-10-01', dataFim: '2026-10-31', status: 'fechado' }];
  const prepared = prepare('save-invoice', {}, { data });
  const result = execute(data, prepared);
  assert.equal(prepared.ok, true);
  assert.equal(result.ok, false);
  assert.match(result.reason, /período financeiro.*fechado/i);
});

const settlementData = () => ({ ...base(), notasFiscais: [{ id: 'approved-note', obraId: 'o1', status: 'aprovada', version: 2, valorBruto: 100, valorLiquido: 100, pagamentos: [] }] });
const settlementBody = changes => ({ operation: 'record-payable-settlement', obraId: 'o1', expectedVersion: 2, record: { id: 'settlement-1', targetType: 'nota', targetId: 'approved-note', data: '2026-10-31', referencia: 'Comprovante verificado pelo financeiro 001', valor: 100, ...changes } });
const settlement = (changes = {}, extra = {}) => prepareDomainCommand({ data: settlementData(), user, grant: { ...grant, scopes: [...grant.scopes, 'financeiro:settle'] }, body: settlementBody(changes), ...extra });
test('settlement uses real accounting reducer without bank execution and preserves idempotency', () => {
  const prepared = settlement(); assert.equal(prepared.ok, true);
  const result = execute(settlementData(), prepared);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.notasFiscais[0].status, 'paga');
  assert.equal(result.data.notasFiscais[0].pagamentos[0].valor, 100);
  assert.equal(execute(result.data, prepared).idempotent, true);
});
test('settlement requires explicit settle scope independent of finance manage', () => {
  assert.equal(settlement({}, { grant }).status, 403);
  assert.equal(settlement({}, { user: { ...user, role: 'engenheiro' } }).status, 403);
});
test('settlement rejects cross-work targets, linked orders and invoice allocations', () => {
  for (const patch of [{ obraId: 'o2' }, { pedidoId: 'p2' }, { rateios: [{ obraId: 'o2', valor: 100 }] }]) {
    const data = settlementData(); Object.assign(data.notasFiscais[0], patch);
    assert.equal(settlement({}, { data }).status, 403);
  }
});
test('settlement preserves real domain approved-state, balance, closed-period and version guards', () => {
  for (const patch of [{ status: 'recebida' }, { version: 3 }]) {
    const data = settlementData(); Object.assign(data.notasFiscais[0], patch);
    const result = execute(data, settlement({}, { data })); assert.equal(result.ok, false);
  }
  const data = settlementData(); data.fechamentosFinanceiros = [{ id: 'closed', dataInicio: '2026-10-01', dataFim: '2026-10-31', status: 'fechado' }];
  assert.equal(execute(data, settlement({}, { data })).ok, false);
});
test('settlement rejects injected status, workspace, advance, arbitrary attachment and actor', () => {
  for (const field of ['status', 'workspace', 'adiantamento', 'comprovantes', 'actorId', 'obraId']) assert.equal(settlement({ [field]: 'injected' }).status, 400);
  for (const patch of [{ data: '2026-02-31' }, { valor: 1.001 }, { valor: -1 }, { referencia: '' }, { origem: 'pix' }, { transacaoId: 't1' }]) assert.equal(settlement(patch).status, 400);
});
test('settlement rejects bank/cash/reconciliation parameters and enforces exact-cent balance', () => {
  for (const patch of [{ origem: 'empresa' }, { transacaoId: 'tx' }, { workCashMovementId: 'cash1' }, { origem: 'caixa_obra' }]) assert.equal(settlement(patch).status, 400);
  assert.equal(settlement({ valor: 100.01 }).status, 409);
  const data = settlementData(); data.notasFiscais[0].valorLiquido = 50;
  assert.equal(settlement({}, { data }).status, 409);
  const prepared = settlement();
  assert.equal(prepared.command.payload.payment.origem, 'empresa');
  assert.equal(prepared.command.payload.payment.transacaoId, '');
  const result = execute(settlementData(), prepared);
  assert.equal(result.data.caixaObra, undefined);
  assert.equal(result.data.transacoes, undefined);
});
test('purchase settlement cannot override receiving/invoice conference as advance', () => {
  const data = settlementData(); data.pedidos.push({ id: 'p1', obraId: 'o1', status: 'enviado', version: 1, itens: [{ id: 'pi1', qtd: 1, precoUnit: 100 }], pagamentos: [] });
  const request = { ...settlementBody({ targetType: 'pedido', targetId: 'p1' }), expectedVersion: 1 };
  const prepared = settlement({}, { data, body: request }); assert.equal(prepared.ok, true);
  const result = execute(data, prepared); assert.equal(result.ok, false); assert.match(result.reason, /conferido|adiantamento/i);
});
test('conferred purchase-order settlement succeeds without bank or cash effects', () => {
  const data = settlementData(); data.pedidos.push({ id: 'p1', obraId: 'o1', status: 'enviado', version: 1, itens: [{ id: 'pi1', qtd: 1, qtdRecebida: 1, precoUnit: 100 }], pagamentos: [] });
  data.notasFiscais[0].pedidoId = 'p1';
  const request = { ...settlementBody({ targetType: 'pedido', targetId: 'p1' }), expectedVersion: 1 };
  const prepared = settlement({}, { data, body: request }); assert.equal(prepared.ok, true);
  const result = execute(data, prepared); assert.equal(result.ok, true, JSON.stringify(result));
  const order = result.data.pedidos.find(p => p.id === 'p1');
  assert.equal(order.pagamentos[0].valor, 100); assert.equal(order.version, 2);
  assert.equal(result.data.caixaObra, undefined); assert.equal(result.data.transacoes, undefined);
  data.notasFiscais[0].obraId = 'o2';
  assert.equal(settlement({}, { data, body: request }).status, 403);
});
