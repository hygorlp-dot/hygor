// Fila de compras agrupada (R7): por obra ou por fornecedor, com quantidade,
// valor em R$ e atrasos de cada grupo. Só projeção: nada é gravado.
//
// Fornecedor só é conhecido no pedido. Solicitações e cotações (que podem ter
// vários fornecedores em disputa) ficam no grupo "Sem fornecedor definido".
export const AGRUPAMENTOS_FILA = Object.freeze({ obra: "Obra", fornecedor: "Fornecedor" });
export const SEM_FORNECEDOR = "__sem_fornecedor";

const valorDaLinha = linha => Number(linha.total || 0);
export const linhaAtrasada = linha => linha.deadline?.tone === "danger";

export const resumoDaFila = linhas => ({
  quantidade: linhas.length,
  valor: linhas.reduce((soma, linha) => soma + valorDaLinha(linha), 0),
  atrasados: linhas.filter(linhaAtrasada).length,
  valorAtrasado: linhas.filter(linhaAtrasada).reduce((soma, linha) => soma + valorDaLinha(linha), 0),
});

// `nomeFornecedor(id)` devolve o nome do cadastro; a ordem é: mais atrasos,
// depois maior valor atrasado, maior valor e nome. "Sem fornecedor" vai por último.
export const agruparFilaCompras = (linhas, por, nomeFornecedor = id => id) => {
  if (!AGRUPAMENTOS_FILA[por]) return [];
  const grupos = new Map();
  for (const linha of linhas || []) {
    const chave = por === "obra" ? String(linha.obraId || linha.obra || "") : String(linha.supplierId || SEM_FORNECEDOR);
    if (!grupos.has(chave)) {
      const rotulo = por === "obra" ? linha.obra
        : chave === SEM_FORNECEDOR ? "Sem fornecedor definido" : nomeFornecedor(chave) || "Fornecedor não informado";
      grupos.set(chave, { chave, rotulo, linhas: [] });
    }
    grupos.get(chave).linhas.push(linha);
  }
  return [...grupos.values()]
    .map(grupo => ({ ...grupo, ...resumoDaFila(grupo.linhas) }))
    .sort((a, b) => Number(a.chave === SEM_FORNECEDOR) - Number(b.chave === SEM_FORNECEDOR)
      || b.atrasados - a.atrasados || b.valorAtrasado - a.valorAtrasado || b.valor - a.valor
      || String(a.rotulo).localeCompare(String(b.rotulo), "pt-BR"));
};

// Uma mensagem para cobrar de uma vez todas as entregas atrasadas do mesmo
// fornecedor. `pedidos`: [{numero, obra, previsao, diasAtraso, itens:[{descricao, falta, unidade}]}].
export const mensagemCobrancaFornecedor = ({ empresa, fornecedorNome, pedidos }) => {
  const saudacao = fornecedorNome ? `Ola, ${String(fornecedorNome).split(" ")[0]}! Tudo bem?` : "Ola! Tudo bem?";
  const blocos = (pedidos || []).map(pedido => {
    const itens = (pedido.itens || []).map(item => `  - ${item.descricao}: falta ${item.falta}${item.unidade ? ` ${item.unidade}` : ""}`).join("\n");
    const obra = pedido.obra ? ` (obra ${pedido.obra})` : "";
    return `Pedido ${pedido.numero}${obra}: entrega combinada para ${pedido.previsao}, ${pedido.diasAtraso} dia(s) de atraso.${itens ? `\n${itens}` : ""}`;
  }).join("\n\n");
  const ass = empresa ? `\n\nObrigado!\n${empresa}` : "\n\nObrigado!";
  return `${saudacao}\n\nEstou acompanhando ${pedidos.length === 1 ? "um pedido atrasado" : `${pedidos.length} pedidos atrasados`} com voces:\n\n${blocos}`
    + `\n\nPreciso desses materiais para nao parar as frentes de servico. Consegue me confirmar hoje as novas datas de entrega?${ass}`;
};
