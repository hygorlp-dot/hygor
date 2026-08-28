// Memória de cálculo hidrossanitária - painel de referência dentro do
// Orçamento (mesma disciplina/pavimento do memorial estrutural, decisão
// tomada com o usuário: "Memória de Cálculo Navegável" organizada por
// disciplina). Diferente do estrutural, o hidrossanitário não é quebrado
// por pavimento no próprio projeto - o "Tabelas e Detalhes" (última folha)
// já entrega o quantitativo consolidado da obra inteira, então as tabelas
// aqui vivem direto em memoriaCalculo.hidrossanitario, sem chave de
// pavimento.
//
// Cada tabela é uma lista de linhas editáveis (igual ao padrão de aço por
// bitola do estrutural) - o usuário pode digitar à mão ou importar do PDF
// do projeto (hidrossanitario-pdf-extrator.js).

export function novaLinhaConexao(extra = {}) {
  return { codigo: "", descricao: "", quantidade: 0, ...extra };
}
export function novaLinhaCaixa(extra = {}) {
  return { descricao: "", tipoSistema: "", quantidade: 0, ...extra };
}
export function novaLinhaPeca(extra = {}) {
  return { descricao: "", abreviatura: "", tipoSistema: "", quantidade: 0, ...extra };
}
export function novaLinhaContagem(extra = {}) {
  return { descricao: "", quantidade: 0, ...extra };
}
export function novaLinhaTuboRigido(extra = {}) {
  return { descricao: "", abreviatura: "", sistema: "", diametroMm: 0, comprimentoM: 0, ...extra };
}
export function novaLinhaTuboFlexivel(extra = {}) {
  return { descricao: "", diametroMm: 0, comprimentoM: 0, ...extra };
}

export function novoHidrossanitario(extra = {}) {
  return {
    conexoesAguaFria: [], conexoesEsgoto: [],
    caixasRalosComplementos: [], pecasHidraulicasSanitarias: [],
    registrosAcessorios: [], calhasPluviais: [],
    tubosRigidos: [], tubosFlexiveis: [],
    ...extra,
  };
}

// Soma simples de quantidade - usado no resumo de cada tabela (mesmo papel
// de somaAcoPorBitola no estrutural).
export const somaQuantidade = lista => (lista || []).reduce((soma, item) => soma + Number(item?.quantidade || 0), 0);
export const somaComprimento = lista => (lista || []).reduce((soma, item) => soma + Number(item?.comprimentoM || 0), 0);
