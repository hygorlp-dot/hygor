// Recebimento de pedido (R6): a mesma regra para "Receber" (Compras) e
// "Chegou" (tela da obra). Monta o que vai ao comando PURCHASE_RECEIPT_RECORDED;
// quem decide de verdade continua sendo o servidor.
//
// Regra: ao menos uma quantidade maior que zero, sem valores negativos ou
// inválidos. Excesso gera aviso, mas o estoque reflete a entrega real.
// Receber não depende de pagamento (C1.2): o saldo só é informado.
import {
  conversionFactorOf, purchaseUnitOf, referenceQuantityOf, referenceUnitCostOf,
} from "./unit-conversion.js";
import {operationalWarning} from './workflow-advisories.js';

const EPS = 1e-6;
export const faltaDoItem = item => Math.max(0, Number(item?.qtd || 0) - Number(item?.qtdRecebida || 0));

// Quantidades sugeridas: tudo o que falta de cada item (o "chegou tudo").
export const quantidadesQueFaltam = pedido =>
  Object.fromEntries((pedido?.itens || []).map(item => [item.id, faltaDoItem(item)]));

// `recebidos`: {itemId: quantidade que chegou agora, na unidade de compra}.
// `opcoes`: {quando, novoId, descricao}.
export const montarRecebimento = (pedido, recebidos, { quando, novoId, descricao }) => {
  const linhas = (pedido?.itens || []).map(item => {
    const bruto = recebidos?.[item.id];
    const chegou = bruto === "" || bruto == null ? 0 : Number(bruto);
    return { item, chegou, falta: faltaDoItem(item) };
  });
  const invalida = linhas.find(linha => !Number.isFinite(linha.chegou) || linha.chegou < 0);
  if (invalida) return { ok: false, erro: "Quantidade recebida inválida.", itemId: invalida.item.id };
  const warnings=linhas.filter(linha=>linha.chegou>linha.falta+EPS).map(linha=>operationalWarning('RECEIPT_EXCEEDS_ORDER','recebimento','Compras / responsável pelo recebimento',`Quantidade recebida acima do saldo do item ${linha.item.id}.`,'Confira a diferença com o fornecedor e regularize o pedido ou a devolução. O estoque registra a quantidade realmente recebida.'));
  const chegaram = linhas.filter(linha => linha.chegou > 0);
  if (!chegaram.length) return { ok: false, erro: "Informe ao menos uma quantidade recebida." };

  const stockEntries = chegaram.map(({ item, chegou }) => ({
    id: novoId(), receiptId: novoId(), pedidoId: pedido.id, pedidoItemId: item.id,
    obraId: pedido.obraId, materialId: item.materialId, tipo: "entrada",
    // O pedido conta na embalagem comprada (ex.: SC); o estoque fica na
    // unidade do cadastro (ex.: KG).
    qtd: referenceQuantityOf(item, chegou), valorUnit: referenceUnitCostOf(item),
    qtdCompra: chegou, unidadeCompra: purchaseUnitOf(item), fatorConversao: conversionFactorOf(item),
    unidadeRef: item.unidadeRef || "", data: quando, descricao,
    transacaoId: "", servicoId: "", orcItemId: item.orcItemId || "", orcNivel1Id: item.orcNivel1Id || "", etapa: "",
  }));
  return {
    ok: true,
    warnings,
    receivedQuantities: Object.fromEntries(chegaram.map(({ item, chegou }) => [item.id, chegou])),
    stockEntries,
    completo: linhas.every(linha => linha.chegou >= linha.falta - EPS),
  };
};
