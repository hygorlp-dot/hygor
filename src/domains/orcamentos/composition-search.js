const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const correspondeBuscaComposicao = (item, busca) => {
  const texto = normalize(`${item.codigo || ""} ${item.descricao || ""}`);
  return normalize(busca).split(/\s+/).filter(Boolean).every(termo => texto.includes(termo));
};
export const custoComponentes = itens => itens.reduce((total, item) => total + Number(item.coeficiente || 0) * Number(item.precoUnit || 0), 0);

export const composicaoComoReferencia = comp => ({
  ...comp, fonte: "PRÓPRIA", tipoItem: "COMPOSICAO", externa: true,
  precoUnit: custoComponentes(comp.itens || []),
  composicao: JSON.stringify(comp.itens || []),
});
