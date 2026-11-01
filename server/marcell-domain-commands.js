import { saldoPagamentoPedido } from '../src/domains/compras/calculations.js';
import { saldoPagamentoNota } from '../src/domains/financeiro/payables.js';
// Strict integration inputs only. Persistence, actor attribution, domain validation,
// financial locks and audit stay in api/data's existing operational-command path.
const list = v => Array.isArray(v) ? v : [];
const failure = (status, code) => ({ ok: false, status, code });
const schema = (strings = '', numbers = '', children = {}) => ({ strings: strings.split(' ').filter(Boolean), numbers: numbers.split(' ').filter(Boolean), children });
const requestItem = schema('id materialId descricaoRef unidadeRef unidadeCompra orcItemId orcNivel1Id', 'quantidade precoRef fatorConversao');
const orderItem = schema('id materialId descricaoRef unidadeRef unidadeCompra previsao orcItemId orcNivel1Id', 'qtd precoUnit fatorConversao');
const supplyItem = schema('id materialId unidadeRef unidadeCompra', 'qtdContratada precoUnit fatorConversao');
const packageSchema = schema('id codigo descricao nome', '');
const retentions = schema('', 'iss inss irrf pis cofins csll outros');
const invoiceItem = schema('codigo descricao ncm unidade pedidoItemId', 'nItem qtd precoUnit valorTotal');

export const DOMAIN_COMMAND_SPECS = Object.freeze({
  'record-payable-settlement': { module: 'financeiro', scopes: ['financeiro:write', 'financeiro:settle'], type: 'PAGAMENTO_OBRIGACAO_REGISTRADO', roles: ['admin', 'financeiro', 'compras'], section: 'settlements', risk: 'financial-posting', effects: 'Registra baixa contábil de pagamento já realizado; não inicia PIX, transferência ou pagamento bancário. Origem fixada em empresa, sem transação bancária/caixa/conciliação; exige referência do pagamento já efetuado.', schema: schema('id targetType targetId data referencia observacao', 'valor') },
  'save-purchase-request': { module: 'compras', scopes: ['compras:write'], type: 'SOLICITACAO_COMPRA_SALVA', roles: ['admin', 'compras', 'engenheiro', 'engenheiro_auditor'], section: 'solicitacoesCompra', key: 'request', risk: 'workflow', effects: 'Solicitação enviada; aprovação criada/reiniciada pelo domínio; sem envio externo.', schema: schema('id numero necessidade prioridade observacao', '', { itens: [requestItem] }) },
  'save-purchase-order-draft': { module: 'compras', scopes: ['compras:write'], type: 'PEDIDO_COMPRA_SALVO', roles: ['admin', 'compras'], section: 'pedidos', key: 'order', risk: 'draft', effects: 'Rascunho; pode vincular solicitação a pedido; não envia ao fornecedor.', schema: schema('id numero fornecedorId data previsao solicitacaoId cotacaoId origemPagamento condicoesFaturamento enderecoEntrega contatoEntrega condicoesEntrega condicoesPagamento', '', { itens: [orderItem] }) },
  'create-project-expense': { module: 'financeiro', scopes: ['financeiro:write', 'financeiro:manage'], type: 'DESPESA_OBRA_CRIADA', roles: ['admin', 'financeiro'], section: 'outrasDesp', key: 'expense', risk: 'financial-posting', effects: 'Registra despesa ativa no financeiro; não executa pagamento ou transferência bancária.', schema: schema('id descricao competencia categoria', 'valor') },
  'save-invoice': { module: 'financeiro', scopes: ['financeiro:write', 'financeiro:manage'], type: 'NOTA_FISCAL_SALVA', roles: ['admin', 'financeiro'], section: 'notasFiscais', key: 'invoice', risk: 'financial-record', effects: 'Nota recebida, sem aprovação/pagamento; validação de três vias e período fechado pelo domínio.', schema: schema('id numero tipo chave emissao vencimento pedidoId fornecedorId', 'valorBruto', { retencoes: retentions, itensNota: [invoiceItem] }) },
  'save-contract-amendment': { module: 'contratos', scopes: ['contratos:write'], type: 'ADITIVO_CONTRATO_SALVO', roles: ['admin', 'engenheiro', 'financeiro'], section: 'amendments', key: 'amendment', risk: 'proposal', effects: 'Aditivo proposto, não aprovado; não muda contrato vigente.', schema: schema('id descricao justificativa orcamentoRevisaoId', 'valor prazoDias') },
  'save-supply-contract': { module: 'contratos', scopes: ['contratos:write', 'contratos:manage'], type: 'CONTRATO_FORNECIMENTO_SALVO', roles: ['admin', 'compras'], section: 'contratosFornecimento', key: 'contract', risk: 'contract-activation', effects: 'Contrato de fornecimento fica ativo no aplicativo; exige concessão manage explícita. Não assina/envia documento externo.', schema: schema('id numero fornecedorId vigenciaInicio vigenciaFim observacao', '', { itens: [supplyItem] }) },
  'create-lookahead': { module: 'planejamento', scopes: ['planejamento:write'], type: 'LOOKAHEAD_CRIADO', roles: ['admin', 'engenheiro', 'engenheiro_auditor', 'planejamento', 'mestre'], section: 'lookaheadWindows', key: 'lookahead', risk: 'draft', effects: 'Janela rascunho com pacotes não analisados, sem compromissos/liberações.', schema: schema('id semanaInicio semanaFim', 'horizonteSemanas', { pacotes: [packageSchema] }) },
});

function parse(raw, spec, depth = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 3) throw new Error('INVALID_RECORD');
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (spec.strings.includes(key)) {
      if (typeof value !== 'string' || value.length > 2000 || (key === 'id' && (!value || value.length > 128))) throw new Error('INVALID_RECORD');
      out[key] = value;
    } else if (spec.numbers.includes(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e9) throw new Error('INVALID_NUMBER');
      out[key] = value;
    } else if (Object.hasOwn(spec.children, key)) {
      const child = spec.children[key];
      if (Array.isArray(child)) {
        if (!Array.isArray(value) || value.length > 200) throw new Error('INVALID_RECORD');
        out[key] = value.map(item => parse(item, child[0], depth + 1));
        const ids = out[key].map(item => item.id).filter(Boolean);
        if (ids.length !== new Set(ids).size) throw new Error('DUPLICATE_ITEM_ID');
      } else out[key] = parse(value, child, depth + 1);
    } else throw new Error('UNSUPPORTED_FIELD');
  }
  return out;
}

function scopedReference(data, section, id, obraId) {
  if (!id) return true;
  return list(data[section]).some(row => String(row.id) === String(id) && String(row.obraId) === obraId);
}
function catalogReference(data, section, id, obraId) {
  if (!id) return true;
  return list(data[section]).some(row => String(row.id) === String(id) && (!row.obraId || String(row.obraId) === obraId));
}
function safeAmounts(record) {
  const values = ['valor', 'valorBruto'].filter(k => k in record).map(k => record[k]);
  for (const item of record.itens || []) values.push(Number(item.quantidade ?? item.qtd ?? item.qtdContratada ?? 0) * Number(item.precoUnit ?? item.precoRef ?? 0));
  return values.every(v => Number.isSafeInteger(Math.round(v * 100))) && Number.isSafeInteger(values.reduce((sum, v) => sum + Math.round(v * 100), 0));
}

function prepareSettlement(data, record, body, spec) {
  const obraId = body.obraId;
  if (!['pedido', 'nota'].includes(record.targetType) || !record.targetId) return failure(400, 'INVALID_SETTLEMENT_TARGET');
  const target = list(data[record.targetType === 'nota' ? 'notasFiscais' : 'pedidos']).find(r => String(r.id) === record.targetId);
  if (!target || String(target.obraId) !== obraId) return failure(403, 'TARGET_WORK_FORBIDDEN');
  if (list(target.rateios).some(r => String(r.obraId) !== obraId)) return failure(403, 'MULTI_WORK_SETTLEMENT_UNSUPPORTED');
  if (record.targetType === 'pedido' && list(data.notasFiscais).some(n => String(n.pedidoId) === String(target.id) && String(n.obraId) !== obraId)) return failure(403, 'REFERENCE_WORK_FORBIDDEN');
  if (record.targetType === 'nota' && target.pedidoId && !scopedReference(data, 'pedidos', target.pedidoId, obraId)) return failure(403, 'REFERENCE_WORK_FORBIDDEN');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.data || '') || !Number.isFinite(Date.parse(`${record.data}T12:00:00Z`)) || new Date(`${record.data}T12:00:00Z`).toISOString().slice(0, 10) !== record.data) return failure(400, 'INVALID_SETTLEMENT_DATE');
  if (!(record.valor > 0) || Math.abs(record.valor * 100 - Math.round(record.valor * 100)) > 0.000001 || !String(record.referencia || '').trim()) return failure(400, 'INVALID_SETTLEMENT');
  const balance = record.targetType === 'nota' ? saldoPagamentoNota(target) : saldoPagamentoPedido(target);
  const balanceCents = Math.round(balance * 100);
  if (!Number.isSafeInteger(balanceCents) || Math.abs(balance * 100 - balanceCents) > 0.000001 || Math.round(record.valor * 100) > balanceCents) return failure(409, 'SETTLEMENT_EXCEEDS_BALANCE');
  const { targetType, targetId, ...payment } = record;
  // This endpoint records an already executed company payment. It neither initiates
  // a transfer nor changes cash-book/bank reconciliation state as a side effect.
  return { ok: true, spec, command: { type: spec.type, expectedVersion: body.expectedVersion,
    payload: { targetType, targetId, payment: { ...payment, origem: 'empresa', transacaoId: '' } } } };

}

export function prepareDomainCommand({ data = {}, user = {}, grant = {}, body = {} } = {}) {
  const spec = Object.hasOwn(DOMAIN_COMMAND_SPECS, body.operation) ? DOMAIN_COMMAND_SPECS[body.operation] : null;
  if (!spec) return failure(403, 'OPERATION_NOT_SUPPORTED');
  if (!spec.scopes.every(s => list(grant.scopes).includes(s)) || !spec.roles.includes(user.role)) return failure(403, 'SCOPE_FORBIDDEN');
  const obraId = body.obraId;
  if (typeof obraId !== 'string' || !list(grant.obraIds).includes(obraId) || (user.obraId && String(user.obraId) !== obraId) || !list(data.obras).some(w => String(w.id) === obraId)) return failure(403, 'WORK_FORBIDDEN');
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) return failure(400, 'INVALID_VERSION');
  let record;
  try { record = parse(body.record, spec.schema); } catch (e) { return failure(400, e.message); }
  if (!record.id || !safeAmounts(record)) return failure(400, 'INVALID_RECORD');
  if (body.operation === 'record-payable-settlement') return prepareSettlement(data, record, body, spec);
  const obra = list(data.obras).find(w => String(w.id) === obraId);
  const source = spec.section === 'amendments' ? list(obra.aditivosContrato) : list(data[spec.section]);
  const current = source.find(r => String(r.id) === record.id);
  if (current && spec.section !== 'amendments' && String(current.obraId) !== obraId) return failure(403, 'TARGET_WORK_FORBIDDEN');
  if (!current && body.expectedVersion !== 0) return failure(409, 'INITIAL_VERSION_REQUIRED');
  if (body.operation === 'save-purchase-order-draft' && current && current.status !== 'rascunho') return failure(409, 'DRAFT_ONLY');
  if (body.operation === 'save-invoice' && current && !['recebida', 'em_analise', 'pendente'].includes(current.status)) return failure(409, 'UNAPPROVED_INVOICE_ONLY');
  if (body.operation === 'save-contract-amendment' && current && current.status !== 'proposto') return failure(409, 'PROPOSAL_ONLY');
  if (current && spec.section === 'notasFiscais' && list(current.rateios).some(r => String(r.obraId) !== obraId)) return failure(403, 'MULTI_WORK_INVOICE_UNSUPPORTED');
  for (const [field, section] of [['solicitacaoId', 'solicitacoesCompra'], ['cotacaoId', 'cotacoes'], ['pedidoId', 'pedidos'], ['orcamentoRevisaoId', 'orcamentos']]) {
    if (!scopedReference(data, section, record[field], obraId)) return failure(403, 'REFERENCE_WORK_FORBIDDEN');
  }
  if (!catalogReference(data, 'fornecedores', record.fornecedorId, obraId)) return failure(403, 'SUPPLIER_UNAVAILABLE');
  const budgetItems = list(data.orcamentos).filter(b => String(b.obraId) === obraId).flatMap(b => list(b.itens));
  for (const item of record.itens || []) {
    if (!catalogReference(data, 'materiais', item.materialId, obraId)) return failure(403, 'MATERIAL_UNAVAILABLE');
    if (item.orcItemId && !budgetItems.some(i => String(i.id) === item.orcItemId)) return failure(403, 'BUDGET_ITEM_UNAVAILABLE');
  }
  if (record.itensNota?.some(item => item.pedidoItemId && !list(list(data.pedidos).find(p => p.id === record.pedidoId)?.itens).some(i => i.id === item.pedidoItemId))) return failure(403, 'ORDER_ITEM_UNAVAILABLE');
  let payload;
  if (body.operation === 'save-contract-amendment') payload = { obraId, amendment: record };
  else {
    record.obraId = obraId;
    if (body.operation === 'save-purchase-order-draft') record.status = 'rascunho';
    if (body.operation === 'create-lookahead') {
      record.status = 'rascunho';
      record.pacotes = list(record.pacotes).map(p => ({ ...p, obraId, status: 'nao_analisado', comprometido: false }));
      record.restricoes = []; record.compromissos = [];
    }
    payload = { [spec.key]: record };
  }
  if (body.operation === 'save-purchase-order-draft') {
    if (body.adjustmentReason != null && (typeof body.adjustmentReason !== 'string' || body.adjustmentReason.length > 2000)) return failure(400, 'INVALID_REASON');
    payload.adjustmentReason = body.adjustmentReason || '';
  }
  return { ok: true, command: { type: spec.type, expectedVersion: body.expectedVersion, payload }, spec };
}
