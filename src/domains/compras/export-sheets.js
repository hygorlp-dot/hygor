// A0.3 (roadmap 7,6 → 9): planilhas de Compras para o Excel. Cada função recebe
// o que a tela já está mostrando (lista filtrada, escopo da obra) e devolve a
// aba pronta: valores em número e datas como data, nunca texto formatado.
// O arquivo é gerado por `baixarPlanilhaCompras` (lib/spreadsheet), sem servidor.
import {
  origemPagamentoLabel, recebidoPedido, saldoPagamentoPedido, STATUS_PEDIDO, statusPagamentoPedido,
  statusPedido, totalPagoPedido, totalPedido,
} from "./calculations.js";

export const FORMATO = Object.freeze({
  texto: null,
  data: "dd/mm/yyyy",
  moeda: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  numero: "#,##0.##",
  pct: "0.0%",
});

const PAGAMENTO = { pago: "Pago", parcial: "Pago em parte", pendente: "A pagar", cancelado: "Cancelado", sem_valor: "Sem valor" };
const INATIVAS = ["cancelada", "cancelado", "estornada", "estornado", "rejeitada", "rejeitado"];
const ETAPA_FILA = { solicitacoes: "Solicitação", cotacoes: "Cotação", aprovacoes: "Aprovação", pedidos: "Pedido", recebimentos: "Recebimento" };
const ALERTA = { estourou: "Estourou", atencao: "Atenção (90% ou mais)", ok: "Dentro do orçado" };

// "2026-10-28" vira a data do Excel daquele dia (meia-noite UTC, sem fuso).
export const dataExcel = valor => {
  const m = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const reais = valor => Math.round(Number(valor || 0) * 100) / 100;
const col = (titulo, tipo = "texto", largura = 14) => ({ titulo, tipo, largura, formato: FORMATO[tipo] });
const nomeDe = lista => {
  const mapa = new Map((lista || []).map(item => [String(item.id), item.name || item.nome || item.descricao || ""]));
  return id => mapa.get(String(id || "")) || "";
};

export function planilhaHistoricoMaterial(data,rows,{basis="received",price="final"}={}){
 const obra=nomeDe(data.obras),fornecedor=nomeDe(data.fornecedores);
 return {nome:"Histórico de preços",colunas:[col("Material","texto",36),col("Obra","texto",26),col("Fornecedor","texto",28),col("Compra","texto",14),col("Data","data",12),col("Base","texto",22),col("Preço comparado","texto",24),col("Unidade referência","texto",14),col("Quantidade referência","numero",18),col("Preço dos itens","numero",18),col("Custo final","numero",18),col("Conferência","texto",40)],
 linhas:rows.map(r=>[r.description,obra(r.workId),fornecedor(r.supplierId),r.orderNumber,dataExcel(r.date),basis==="received"?"Recebimentos efetivos":"Pedidos emitidos",price==="final"?"Custo final com adicionais":"Preço dos itens",r.referenceUnit,r.referenceQuantity,r.rawPrice,r.finalPrice,r.issue||"Comparável"])};
}

export function planilhaPedidos(data, pedidos) {
  const obra = nomeDe(data?.obras), fornecedor = nomeDe(data?.fornecedores);
  return {
    nome: "Pedidos",
    colunas: [col("Pedido", "texto", 12), col("Obra", "texto", 26), col("Fornecedor", "texto", 28), col("Data", "data", 12),
      col("Previsão", "data", 12), col("Situação", "texto", 12), col("Valor do pedido", "moeda", 16), col("Recebido", "moeda", 16),
      col("Pago", "moeda", 16), col("A pagar", "moeda", 16), col("Pagamento", "texto", 14), col("Quem paga", "texto", 14),
      col("Cotação", "texto", 10), col("Solicitação", "texto", 11)],
    linhas: (pedidos || []).map(p => [
      p.numero || p.id, obra(p.obraId), fornecedor(p.fornecedorId), dataExcel(p.data), dataExcel(p.previsao),
      STATUS_PEDIDO[statusPedido(p)]?.l || statusPedido(p), reais(totalPedido(p)), reais(recebidoPedido(p)),
      reais(totalPagoPedido(p)), reais(saldoPagamentoPedido(p)), PAGAMENTO[statusPagamentoPedido(p)] || "",
      origemPagamentoLabel(p.origemPagamento), p.cotacaoId ? "Sim" : "Não", p.solicitacaoId ? "Sim" : "Não",
    ]),
  };
}

// Uma linha por item: a planilha que o comprador usa para conferir quantidade e preço.
export function planilhaItensDosPedidos(data, pedidos) {
  const material = nomeDe(data?.materiais), fornecedor = nomeDe(data?.fornecedores);
  return {
    nome: "Itens dos pedidos",
    colunas: [col("Pedido", "texto", 12), col("Fornecedor", "texto", 28), col("Material", "texto", 36), col("Unidade", "texto", 9),
      col("Quantidade", "numero", 12), col("Recebida", "numero", 12), col("Falta", "numero", 12), col("Preço unitário", "moeda", 15),
      col("Valor do item", "moeda", 16)],
    linhas: (pedidos || []).flatMap(p => (p.itens || []).map(item => {
      const qtd = Number(item.qtd || 0), recebida = Number(item.qtdRecebida || 0);
      return [p.numero || p.id, fornecedor(p.fornecedorId), material(item.materialId) || item.descricaoRef || "",
        item.unidadeCompra || item.unidadeRef || "", qtd, recebida, Math.max(0, qtd - recebida),
        reais(item.precoUnit), reais(qtd * Number(item.precoUnit || 0))];
    })),
  };
}

// Notas dos pedidos exportados: a mesma seleção da tela, sem notas soltas de outras áreas.
export function planilhaNotas(data, pedidos) {
  const ids = new Set((pedidos || []).map(p => String(p.id)));
  const numeroPedido = new Map((pedidos || []).map(p => [String(p.id), p.numero || p.id]));
  const obra = nomeDe(data?.obras), fornecedor = nomeDe(data?.fornecedores);
  const notas = (data?.notasFiscais || []).filter(n => ids.has(String(n.pedidoId || "")))
    .sort((a, b) => String(a.emissao || "").localeCompare(String(b.emissao || "")));
  return {
    nome: "Notas fiscais",
    colunas: [col("Nota", "texto", 12), col("Pedido", "texto", 12), col("Obra", "texto", 26), col("Fornecedor", "texto", 28),
      col("Emissão", "data", 12), col("Vencimento", "data", 12), col("Valor bruto", "moeda", 16), col("Valor líquido", "moeda", 16),
      col("Situação", "texto", 12), col("Divergências", "texto", 48)],
    linhas: notas.map(n => [
      n.numero || "", numeroPedido.get(String(n.pedidoId)) || "", obra(n.obraId), fornecedor(n.fornecedorId),
      dataExcel(n.emissao), dataExcel(n.vencimento), reais(n.valorBruto), reais(n.valorLiquido ?? n.valorBruto),
      INATIVAS.includes(String(n.status || "").toLowerCase()) ? "Cancelada" : "Ativa",
      (n.divergencias || []).map(d => (typeof d === "string" ? d : d?.mensagem || d?.texto || "")).filter(Boolean).join(" | "),
    ]),
  };
}

// Orçado × comprometido de uma obra, por etapa (modelo de calcOrcadoComprado).
export function planilhaOrcadoComprado(modelo, nomeObra = "") {
  return {
    nome: "Orçado x comprometido",
    colunas: [col("Obra", "texto", 26), col("Etapa", "texto", 22), col("Item do orçamento", "texto", 40), col("Orçado", "moeda", 16),
      col("Comprometido", "moeda", 16), col("Recebido", "moeda", 16), col("Saldo", "moeda", 16), col("% do orçado", "pct", 12),
      col("Situação", "texto", 20)],
    linhas: (modelo?.linhas || []).map(l => [
      nomeObra, l.etapa || "", l.it?.descricao || l.it?.codigo || "", reais(l.orcado), reais(l.comprometido), reais(l.recebido),
      reais(l.saldo), Number(l.orcado) > 0 ? l.pct / 100 : null, ALERTA[l.alerta] || "",
    ]),
  };
}

// Comparativo de todas as obras (modelo de buildPurchasesByWork).
export function planilhaOrcadoPorObra(modelo) {
  return {
    nome: "Orçado x comprometido",
    colunas: [col("Obra", "texto", 30), col("Orçado", "moeda", 16), col("Comprometido", "moeda", 16), col("% do orçado", "pct", 12),
      col("A receber", "moeda", 16), col("A pagar", "moeda", 16), col("Entregas atrasadas", "numero", 12), col("Etapas estouradas", "numero", 12)],
    linhas: (modelo?.linhas || []).map(l => [
      l.obra, l.temControle ? reais(l.orcado) : null, reais(l.comprometido), l.pctOrcado != null ? l.pctOrcado / 100 : null,
      reais(l.aReceber), reais(l.aPagar), Number(l.atrasados || 0), Number(l.estouradas || 0),
    ]),
  };
}

// Fila de trabalho como está filtrada na tela (linhas de buildPurchaseWorkspace).
export function planilhaFila(linhas) {
  return {
    nome: "Fila de trabalho",
    colunas: [col("Etapa", "texto", 13), col("Registro", "texto", 12), col("Obra", "texto", 26), col("Material", "texto", 40),
      col("Situação", "texto", 34), col("Prazo", "data", 12), col("Prazo (situação)", "texto", 16), col("Contato / solicitante", "texto", 28),
      col("Valor", "moeda", 16), col("Próxima ação", "texto", 22)],
    linhas: (linhas || []).map(row => [
      ETAPA_FILA[row.stage] || row.stage, row.code, row.obra, row.title, row.detail, dataExcel(row.date), row.deadline?.label || "",
      row.responsible, row.total == null ? null : reais(row.total), row.action,
    ]),
  };
}

export const nomeArquivoCompras = (assunto, hoje) => `compras-${assunto}-${String(hoje || "").slice(0, 10)}.xlsx`;
