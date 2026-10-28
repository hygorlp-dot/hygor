// Vínculo com o orçamento ao longo da cadeia de compra (Onda 3.1 do roadmap).
//
// A solicitação diz para qual item/etapa do orçamento o material é
// (orcItemId/orcNivel1Id). O pedido herda esse vínculo; a nota fiscal liga
// cada item ao item do pedido (pedidoItemId) e o recebimento grava o vínculo
// no movimento de estoque. Quando o pedido chegava sem o vínculo (digitado à
// mão, ou vindo de cotação), o custo caía em "sem apropriação" mesmo com a
// solicitação dizendo a etapa. Aqui o pedido recupera o que a solicitação
// já sabia - nunca sobrescreve um vínculo escolhido no pedido.
const vazio = item => !String(item?.orcItemId || "").trim() && !String(item?.orcNivel1Id || "").trim();

export const herdarVinculoDaSolicitacao = (itens = [], solicitacao = null) => {
  const doPedido = Array.isArray(itens) ? itens : [];
  const daSolicitacao = Array.isArray(solicitacao?.itens) ? solicitacao.itens : [];
  if (!daSolicitacao.length) return doPedido;
  const porId = new Map(daSolicitacao.map(item => [String(item.id || ""), item]));
  const porMaterial = new Map();
  daSolicitacao.forEach(item => {
    const key = String(item.materialId || "");
    if (key) porMaterial.set(key, [...(porMaterial.get(key) || []), item]);
  });
  return doPedido.map(item => {
    // Item ligado explicitamente; senão, só por material quando houver UM
    // item daquele material na solicitação (dois itens iguais = ambíguo).
    const origem = porId.get(String(item.solicitacaoItemId || ""))
      || ((porMaterial.get(String(item.materialId || "")) || []).length === 1 ? porMaterial.get(String(item.materialId || ""))[0] : null);
    if (!origem) return item;
    const ligado = { ...item, solicitacaoItemId: String(item.solicitacaoItemId || origem.id || "") };
    if (!vazio(item) || vazio(origem)) return ligado;
    return { ...ligado, orcItemId: String(origem.orcItemId || ""), orcNivel1Id: String(origem.orcNivel1Id || ""), vinculoHerdadoDaSolicitacao: true };
  });
};
