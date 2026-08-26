// Extraído de OrcamentoView.jsx (26/08/2026): a etapa de importar um
// orçamento externo (planilha código+quantidade cruzada com a base
// SINAPI/ORSE carregada) tinha detecção de coluna por nome de cabeçalho e
// nunca pedia confirmação humana. Uma planilha real com "Nome" em vez de
// "Descrição" perdeu, em silêncio, o nome de toda etapa (Nível/Subnível) e
// de todo item sem código (Produto/Serviço) - a tela agora sempre confirma
// com o usuário onde está cada coluna antes de montar qualquer linha; esta
// detecção automática vira só o palpite inicial pré-preenchido no modal.
export const normalizarCabecalho = valor =>
  String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Varre as primeiras `limite` linhas em busca de uma que pareça cabeçalho
// (tem Código E alguma coluna de Quantidade). Retorna o palpite inicial das
// demais colunas - nunca a fonte da verdade, sempre revisável pelo usuário.
export function detectarColunasImportacao(rows, limite = 30) {
  for (let i = 0; i < Math.min(rows.length, limite); i++) {
    const col = {};
    (rows[i] || []).forEach((cel, j) => {
      const h = normalizarCabecalho(cel);
      if (!h) return;
      if (col.codigo === undefined && (h === "codigo" || h.startsWith("cod"))) col.codigo = j;
      if (col.tipo === undefined && h === "tipo") col.tipo = j;
      if (col.descricao === undefined && (h === "item" || h === "nome" || h.startsWith("descri"))) col.descricao = j;
      if (col.unidade === undefined && (h === "un." || h === "un" || h.startsWith("unid"))) col.unidade = j;
      if (col.qtd === undefined && (h.startsWith("qtd") || h.startsWith("quant"))) col.qtd = j;
      if (col.preco === undefined && (h.includes("preco unit") || h.includes("p. unit") || h.includes("custo unit") || h === "preco" || h === "valor unitario")) col.preco = j;
      if (col.total === undefined && (h.includes("custo total") || h.includes("valor total") || h.includes("preco total") || h === "total")) col.total = j;
      if (col.composicao === undefined && (h.startsWith("compos") || h.includes("memoria de preco"))) col.composicao = j;
      if (col.fonte === undefined && h === "fonte") col.fonte = j;
    });
    if (col.codigo !== undefined && col.qtd !== undefined) return { hIdx: i, col };
  }
  return { hIdx: -1, col: {} };
}

// Monta as linhas (etapa/titulo/item) a partir de um mapeamento de colunas
// JÁ CONFIRMADO pelo usuário - col.{codigo,descricao,qtd,preco} devem estar
// definidos (índices de coluna); tipo/unidade/fonte/composicao são opcionais.
// `basePorCodigo` é um Map código(maiúsculo) -> item da base de referência;
// `precoDoItem(item, orc)` resolve o preço desonerado/não desonerado.
export function montarLinhasImportacao({ rows, hIdx, col, basePorCodigo, precoDoItem, orc, parseNumero }) {
  const linhas = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const cod = String(r[col.codigo] ?? "").trim().toUpperCase();
    const tipo = normalizarCabecalho(col.tipo !== undefined ? r[col.tipo] : "");
    const desc = String(col.descricao !== undefined ? r[col.descricao] : "").trim();
    const qtd = col.qtd !== undefined ? parseNumero(r[col.qtd]) : 0;
    if (!cod && !desc) continue;
    if (normalizarCabecalho(desc).startsWith("total")) continue;

    const ehNivel = tipo === "nivel" || (!tipo && !cod && qtd <= 0 && !!desc);
    const ehSub = tipo === "subnivel";
    if (ehNivel || ehSub) {
      linhas.push({ kind: "etapa", nivel: ehSub ? 2 : 1, nome: desc || "Etapa", _i: i + 1 });
      continue;
    }
    if (tipo === "titulo") { linhas.push({ kind: "titulo", descricao: desc, _i: i + 1 }); continue; }

    const b = cod ? basePorCodigo.get(cod) : null;
    const preco = b ? precoDoItem(b, orc) : 0;
    linhas.push({
      kind: "item",
      codigo: cod,
      descricao: b ? b.descricao : (desc || "(código não localizado — sem descrição)"),
      unidade: b ? (b.unidade || "UN") : "UN",
      fonte: b ? (b.fonte || orc.fonte) : "NÃO LOCALIZADO",
      quantidade: qtd,
      precoUnit: preco,
      composicao: "",
      codigoNaoEncontrado: !cod || !b,
      achou: !!b,
      semQtd: !(qtd > 0),
      semPreco: !(preco > 0),
      _i: i + 1,
    });
  }
  return linhas;
}

export function resumoImportacao(linhas) {
  const itens = linhas.filter(l => l.kind === "item");
  return {
    etapas: linhas.filter(l => l.kind === "etapa").length,
    itens: itens.length,
    ok: itens.filter(i => i.achou && !i.semPreco && !i.semQtd).length,
    naoAchou: itens.filter(i => !i.achou).length,
    semPreco: itens.filter(i => i.semPreco).length,
    semQtd: itens.filter(i => i.semQtd).length,
    valor: itens.reduce((s, i) => s + i.quantidade * i.precoUnit, 0),
  };
}
