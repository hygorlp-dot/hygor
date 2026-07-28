// Regras puras do contexto de Compras. Sem React, DOM ou persistência.
import { calculateWorkCash } from "../financeiro/work-cash.js";

export const STATUS_PEDIDO = {
  rascunho:{l:"Rascunho",c:"#6B6459"},enviado:{l:"Enviado",c:"#0D47A1"},
  parcial:{l:"Parcial",c:"#BF360C"},recebido:{l:"Recebido",c:"#1E6B31"},
  cancelado:{l:"Cancelado",c:"#B71C1C"},
};

export const statusPedido = pedido => {
  if(["cancelado","rascunho"].includes(pedido.status))return pedido.status;
  const total=(pedido.itens||[]).reduce((s,i)=>s+Number(i.qtd||0),0);
  const recebido=(pedido.itens||[]).reduce((s,i)=>s+Number(i.qtdRecebida||0),0);
  return recebido<=0?"enviado":recebido>=total-1e-6?"recebido":"parcial";
};

export const totalPedido = pedido => (pedido.itens||[])
  .reduce((s,i)=>s+Number(i.qtd||0)*Number(i.precoUnit||0),0);
export const recebidoPedido = pedido => (pedido.itens||[])
  .reduce((s,i)=>s+Number(i.qtdRecebida||0)*Number(i.precoUnit||0),0);
export const pendentePedido = pedido => totalPedido(pedido)-recebidoPedido(pedido);
export const totalPagoPedido = pedido => {
  const pagamentos=(pedido.pagamentos||[]).filter(p=>p.status!=="estornado").reduce((s,p)=>s+Number(p.valor||0),0);
  return pagamentos>0?pagamentos:(pedido.transacaoId?totalPedido(pedido):0);
};
export const saldoPagamentoPedido = pedido => Math.max(0,totalPedido(pedido)-totalPagoPedido(pedido));
export const statusPagamentoPedido = pedido => {
  if(pedido.status==="cancelado")return "cancelado";
  const total=totalPedido(pedido),pago=totalPagoPedido(pedido);
  if(total<=0)return "sem_valor";
  return pago>=total-.01?"pago":pago>0?"parcial":"pendente";
};
export const pedidoLiberadoParaReceber = pedido => statusPagamentoPedido(pedido)==="pago";
export const origemPagamentoLabel = origem =>
  ({empresa:"Empresa",caixa_obra:"Caixa da obra",cliente_direto:"Cliente direto"}[origem]||"Empresa");

export const situacaoCaixaObra = (data,obraId) => {
  const caixa=calculateWorkCash(data,obraId);
  const saldo=caixa.saldo,aportes=caixa.totalAportes,despesas=caixa.totalDespesas;
  const limiteBaixo=Math.max(500,aportes*.10);
  return {saldo,aportes,despesas,limiteBaixo,baixo:saldo<=limiteBaixo};
};

const entradasRecebidas = (pedido,item) => {
  const eventos=Array.isArray(item.recebimentos)?item.recebimentos.filter(r=>Number(r.qtd)>0):[];
  const qtdEventos=eventos.reduce((s,r)=>s+Number(r.qtd||0),0);
  const entradas=eventos.map(r=>({data:r.data||pedido.data,fornecedorId:pedido.fornecedorId,
    preco:Number(r.precoUnit||item.precoUnit||0),qtd:Number(r.qtd||0),pedidoId:pedido.id,
    pedidoNumero:pedido.numero||"",obraId:pedido.obraId||""}));
  const legado=Math.max(0,Number(item.qtdRecebida||0)-qtdEventos);
  if(legado>1e-6)entradas.push({data:pedido.data,fornecedorId:pedido.fornecedorId,
    preco:Number(item.precoUnit||0),qtd:legado,pedidoId:pedido.id,pedidoNumero:pedido.numero||"",
    obraId:pedido.obraId||""});
  return entradas;
};

export const historicoPreco = (pedidos,materialId) => {
  const historico=[];
  (pedidos||[]).filter(p=>p.status!=="cancelado").forEach(p=>(p.itens||[])
    .filter(i=>i.materialId===materialId&&Number(i.qtdRecebida)>0)
    .forEach(i=>historico.push(...entradasRecebidas(p,i))));
  return historico.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
};

export const historicoPrecoTodos = pedidos => {
  const porMaterial=new Map();
  (pedidos||[]).filter(p=>p.status!=="cancelado").forEach(p=>(p.itens||[]).forEach(i=>{
    if(!i.materialId||!(Number(i.qtdRecebida)>0))return;
    const lista=porMaterial.get(i.materialId)||[];
    lista.push(...entradasRecebidas(p,i));porMaterial.set(i.materialId,lista);
  }));
  porMaterial.forEach(lista=>lista.sort((a,b)=>(b.data||"").localeCompare(a.data||"")));
  return porMaterial;
};

export const analisePreco = historico => {
  if(!historico.length)return null;
  const precos=historico.map(x=>x.preco);
  const quantidade=historico.reduce((s,x)=>s+x.qtd,0);
  const medio=quantidade?historico.reduce((s,x)=>s+x.preco*x.qtd,0)/quantidade:0;
  const menor=Math.min(...precos),ultimo=historico[0].preco;
  return {ultimo,menor,maior:Math.max(...precos),medio,compras:historico.length,
    variacao:menor?((ultimo-menor)/menor)*100:0};
};

export const mapaGerencialCompras = (data, obraIds = [], hoje = "") => {
  const escopo = new Set(obraIds.filter(Boolean));
  const noEscopo = registro => !escopo.size || escopo.has(registro.obraId);
  const pedidos = (data.pedidos || []).filter(p => noEscopo(p) && p.status !== "cancelado");
  const solicitacoes = (data.solicitacoesCompra || []).filter(noEscopo);
  const cotacoes = (data.cotacoes || []).filter(noEscopo);
  const totalComprometido = pedidos.reduce((s, p) => s + totalPedido(p), 0);
  const totalPago = pedidos.reduce((s, p) => s + totalPagoPedido(p), 0);
  const totalRecebido = pedidos.reduce((s, p) => s + recebidoPedido(p), 0);
  const totalPendente = pedidos.reduce((s, p) => s + saldoPagamentoPedido(p), 0);
  const pedidosValidos = pedidos.filter(p => !["rascunho", "cancelado"].includes(p.status));
  const atrasados = pedidosValidos.filter(p =>
    p.previsao && hoje && p.previsao < hoje && statusPedido(p) !== "recebido");
  const semPrevisao = pedidosValidos.filter(p => !p.previsao);
  const semCotacao = pedidosValidos.filter(p => !p.cotacaoId);
  const semConciliacao = pedidos.flatMap(p => p.pagamentos || []).filter(pg => !pg.conciliado);
  const recebidosSemQuitar = pedidosValidos.filter(p =>
    statusPedido(p) === "recebido" && statusPagamentoPedido(p) !== "pago");
  const cotacoesCompetitivas = cotacoes.filter(c => (c.propostas || []).length >= 3);
  const propostas = cotacoes.reduce((s, c) => s + (c.propostas || []).length, 0);
  const economia = cotacoes.reduce((s, c) => s + Number(c.economia || 0), 0);
  const porFornecedor = new Map();
  pedidos.forEach(p => {
    if (!p.fornecedorId) return;
    porFornecedor.set(
      p.fornecedorId,
      (porFornecedor.get(p.fornecedorId) || 0) + totalPedido(p)
    );
  });
  const fornecedores = [...porFornecedor.entries()]
    .map(([id, valor]) => ({
      id,
      nome: (data.fornecedores || []).find(f => f.id === id)?.nome || "Fornecedor",
      valor,
      participacao: totalComprometido ? (valor / totalComprometido) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  const concentracaoTop3 = fornecedores.slice(0, 3)
    .reduce((s, f) => s + f.participacao, 0);
  const pagamentos = pedidos.flatMap(p => p.pagamentos || []);
  const origens = {
    empresa: pagamentos.filter(p => p.origem === "empresa").reduce((s, p) => s + Number(p.valor || 0), 0),
    caixa_obra: pagamentos.filter(p => p.origem === "caixa_obra").reduce((s, p) => s + Number(p.valor || 0), 0),
    cliente_direto: pagamentos.filter(p => p.origem === "cliente_direto").reduce((s, p) => s + Number(p.valor || 0), 0),
  };
  const fila = {
    solicitacoes: solicitacoes.filter(s => s.status === "enviada").length,
    cotacoes: cotacoes.filter(c => c.status === "aberta").length,
    pedidos: pedidosValidos.filter(p => !["recebido"].includes(statusPedido(p))).length,
    pagamentos: pedidosValidos.filter(p => statusPagamentoPedido(p) !== "pago").length,
    recebimentos: pedidosValidos.filter(p =>
      statusPagamentoPedido(p) === "pago" && statusPedido(p) !== "recebido").length,
  };
  const coberturaCotacao = pedidosValidos.length
    ? ((pedidosValidos.length - semCotacao.length) / pedidosValidos.length) * 100 : 0;
  const concorrencia = cotacoes.length ? propostas / cotacoes.length : 0;
  const entrega = pedidosValidos.filter(p => p.previsao);
  const entreguesNoPrazo = entrega.filter(p => {
    if (statusPedido(p) !== "recebido") return false;
    const datas = (p.itens || []).flatMap(i => i.recebimentos || [])
      .map(r => String(r.data || "").slice(0, 10)).filter(Boolean).sort();
    return datas.length && datas[datas.length - 1] <= p.previsao;
  }).length;
  const pontualidade = entrega.length ? (entreguesNoPrazo / entrega.length) * 100 : null;
  const completude = [
    pedidosValidos.length > 0,
    pedidosValidos.some(p => p.cotacaoId),
    pedidosValidos.some(p => p.previsao),
    pedidosValidos.some(p => (p.pagamentos || []).length),
    pedidosValidos.some(p => (p.itens || []).some(i => (i.recebimentos || []).length)),
    (data.fornecedores || []).some(f => f.cnpj && (f.categorias || []).length),
  ].filter(Boolean).length / 6 * 100;
  const alertas = [
    atrasados.length && { nivel: "critico", titulo: `${atrasados.length} entrega(s) atrasada(s)`, detalhe: "Risco de parada e replanejamento da obra.", destino: "pedidos" },
    recebidosSemQuitar.length && { nivel: "critico", titulo: `${recebidosSemQuitar.length} recebimento(s) sem quitação`, detalhe: "Regularize o vínculo financeiro e a conciliação.", destino: "financeiro" },
    totalPendente > 0 && { nivel: "alto", titulo: `${totalPendente.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} a pagar`, detalhe: "Compromissos assumidos ainda sem cobertura completa.", destino: "financeiro" },
    semCotacao.length && { nivel: "alto", titulo: `${semCotacao.length} pedido(s) sem concorrência registrada`, detalhe: "Preço, prazo e decisão ficam sem evidência comparável.", destino: "cotacoes" },
    semPrevisao.length && { nivel: "medio", titulo: `${semPrevisao.length} pedido(s) sem previsão`, detalhe: "Sem data não há controle confiável de abastecimento.", destino: "pedidos" },
    semConciliacao.length && { nivel: "medio", titulo: `${semConciliacao.length} pagamento(s) sem conciliação`, detalhe: "O caixa pode divergir do histórico de compras.", destino: "financeiro" },
    concentracaoTop3 > 75 && { nivel: "medio", titulo: `${concentracaoTop3.toFixed(0)}% concentrado nos 3 maiores fornecedores`, detalhe: "Avalie alternativas para itens críticos e risco de dependência.", destino: "forn" },
  ].filter(Boolean);
  return {
    pedidos, solicitacoes, cotacoes, fila, totalComprometido, totalPago,
    totalRecebido, totalPendente, economia, coberturaCotacao, concorrencia,
    pontualidade, completude, atrasados, semPrevisao, semCotacao,
    semConciliacao, recebidosSemQuitar, cotacoesCompetitivas, fornecedores,
    concentracaoTop3, origens, alertas,
  };
};
