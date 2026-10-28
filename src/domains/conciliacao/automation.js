import { validatePurchasePayment } from "../financeiro/purchase-payment-validation.js";
import { reconciliationHold, activeCashAllocations } from "./cash-allocations.js";
import { analisarMovimentoConciliacao, comandoConciliacaoAutomatica } from "./engine.js";
import { criarIndicesFinanceiros } from "./selectors.js";
import { criarRegistroIdentidades } from "./identity.js";

export const REGRA_AUTOMATICA = "pix-identidade-valor-referencia-v1";
const tipos = new Set(["nota", "pedido", "medicaoTerc", "tituloFolha", "medicao", "entradaContrato", "pagamentoNota", "pagamentoPedido"]);
const targetKey = c => `${c.tipo}:${c.entidadeId}:${c.pagamentoId || ""}`;
const bankIds = tr => ["fitid", "endToEndId", "txid"].filter(key => tr[key]).map(key => `${key}:${tr[key]}`);

// Compartilhado pela tela e pelo servidor. Pontuação/nome isolados não autorizam baixa.
export const classificarAutomacao = (tr, analysis, data) => {
  const c = analysis.melhorCandidata;
  const identity = analysis.identidadeProvavel || {};
  const identified = Boolean(identity.id && !identity.conflito);
  const result = motivo => ({ identificada: identified, automatica: false, motivo });
  if (reconciliationHold(tr)) return result(reconciliationHold(tr));
  if (activeCashAllocations(data).some(link => String(link.transactionId) === String(tr.id))) return result("Movimento com vínculos parciais; complete a revisão no gestor de caixa.");
  if (identity.conflito) return result("Mais de um cadastro corresponde aos dados do extrato.");
  if (!c || !tipos.has(c.tipo)) return result(identified ? "Pessoa identificada; falta um lançamento financeiro compatível." : "Não foi encontrada uma correspondência segura nos cadastros.");
  if (c.bloqueios?.length || c.alertas?.length) return result([...(c.bloqueios || []), ...(c.alertas || [])].join(" "));
  if ((data.rejeicoesConc || []).some(r => String(r.transacaoId) === String(tr.id) && r.candidatoTipo === c.tipo && String(r.candidatoId) === String(c.entidadeId))) return result("Esta sugestão já foi rejeitada; exige revisão.");
  if ((data.historicoConc || []).some(h => String(h.transacaoId) === String(tr.id) && /desfeit|desfeito|reabert/.test(h.acao))) return result("Movimento reaberto ou desfeito; exige revisão para não repetir a baixa.");
  if (!(c.podeVincular || c.podeRegistrarPagamento)) return result("O lançamento não está disponível para conciliação.");
  if (["nota", "pedido"].includes(c.tipo)) {
    const target = ((c.tipo === "nota" ? data.notasFiscais : data.pedidos) || []).find(item => String(item.id) === String(c.entidadeId));
    const validation = validatePurchasePayment(data, {type:c.tipo,target,value:Math.abs(Number(tr.valor)),actorRole:"financeiro"});
    if (validation.error) return result(validation.error);
  }
  const e = c.evidenciaAutomatica || {};
  if (!e.valorExato) return result("O valor difere do saldo do lançamento; revise pagamentos parciais ou taxas.");
  if (!e.referenciaExata && !(e.identidadeExata && e.dataProxima)) return result("Falta chave Pix/CPF/CNPJ exato com data compatível, ou referência bancária compartilhada.");
  if ((analysis.alternativas || []).some(other => (other.podeVincular || other.podeRegistrarPagamento) && !other.bloqueios?.length && (other.evidenciaAutomatica?.valorExato || other.score >= c.score - 15))) return result("Há mais de um lançamento compatível; escolha o destino.");
  const ids = bankIds(tr);
  if (!ids.length) return result("O extrato não contém identificador bancário para conferir duplicidades.");
  if ((data.transacoes || []).some(other => String(other.id) !== String(tr.id) && (!tr.contaBancariaId || !other.contaBancariaId || String(other.contaBancariaId) === String(tr.contaBancariaId)) && bankIds(other).some(id => ids.includes(id)))) return result("Identificador bancário repetido em outro movimento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tr.data || "") || !Number.isFinite(Date.parse(tr.data))) return result("Data bancária inválida.");
  return { identificada: true, automatica: true, motivo: "Identidade ou referência exata, valor integral e destino único.", alvo: targetKey(c) };
};

export const criarFilaAutomatica = (data, analyses) => {
  const indices = analyses ? null : criarIndicesFinanceiros(data);
  const registry = analyses ? null : criarRegistroIdentidades(data);
  const archived = new Set((data.extratos || []).filter(e => e.status === "arquivado").map(e => String(e.id)));
  const rows = (data.transacoes || []).filter(tr => tr.status === "pendente" && !archived.has(String(tr.extratoId || ""))).map(tr => {
    const analise = analyses?.get(tr.id) || analisarMovimentoConciliacao(tr, data, { indices, registry });
    return { tr, analise, ...classificarAutomacao(tr, analise, data) };
  });
  // Duas linhas disputando a mesma obrigação são ambas enviadas à revisão.
  const counts = new Map();
  rows.filter(r => r.automatica).forEach(r => counts.set(r.alvo, (counts.get(r.alvo) || 0) + 1));
  return rows.map(row => row.automatica && counts.get(row.alvo) > 1
    ? { ...row, automatica: false, motivo: "Mais de um movimento disputa o mesmo lançamento." } : row);
};

export const comandoAutomaticoSeguro = row => {
  if (!row?.automatica) return null;
  const command = comandoConciliacaoAutomatica(row.analise);
  return command ? { ...command, payload: { ...command.payload, observacao: `Automática · ${REGRA_AUTOMATICA} · ${row.analise.melhorCandidata.motivos.join("; ")}` } } : null;
};
