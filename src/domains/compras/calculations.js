// Regras puras do contexto de Compras. Sem React, DOM ou persistência.
import { calculateWorkCash } from "../financeiro/work-cash.js";
import { active } from "../financeiro/ledger.js";
import { pedidoPorContrato } from "./supply-contracts.js";
import { pedidoVivo, posicaoDasCompras, valorBrutoDoPedido } from "./purchase-position.js";
import { pedidosComItensAtrasados, pontualidadeEntregas, remessasDoItem } from "./delivery-schedule.js";

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

// Próximo número livre de pedido. Contar os pedidos (antes: length+1) repete
// número quando algum foi numerado à mão ou removido; o servidor recusa
// número repetido e a compra travava.
const proximoNumero = (registros, prefixo) => {
  const lista=registros||[];
  const padrao=new RegExp(`^${prefixo}-(\\d+)$`,"i");
  const maior=lista.reduce((max,registro)=>{
    const match=String(registro?.numero||"").trim().match(padrao);
    return match?Math.max(max,Number(match[1])):max;
  },0);
  return `${prefixo}-${String(Math.max(maior,lista.length)+1).padStart(4,"0")}`;
};
export const proximoNumeroPedido = pedidos => proximoNumero(pedidos,"PC");
export const proximoNumeroSolicitacao = solicitacoes => proximoNumero(solicitacoes,"SC");

export const totalPedido = pedido => valorBrutoDoPedido(pedido);
export const recebidoPedido = pedido => (pedido.itens||[])
  .reduce((s,i)=>s+Number(i.qtdRecebida||0)*Number(i.precoUnit||0),0);
export const pendentePedido = pedido => totalPedido(pedido)-recebidoPedido(pedido);
export const totalPagoPedido = pedido => {
  const pagamentos=(pedido.pagamentos||[]).filter(active).reduce((s,p)=>s+Number(p.valor||0),0);
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
  // O "último" é a compra mais recente pela data, não a primeira da lista: a tela
  // de Preços entrega a lista em ordem crescente. Em empate (ou sem data) vale a
  // primeira, como era com a lista em ordem decrescente.
  const maisRecente=historico.reduce((melhor,x)=>(String(x.data||"")>String(melhor.data||"")?x:melhor),historico[0]);
  const menor=Math.min(...precos),ultimo=maisRecente.preco;
  return {ultimo,menor,maior:Math.max(...precos),medio,compras:historico.length,
    variacao:menor?((ultimo-menor)/menor)*100:0};
};

export const mapaGerencialCompras = (data, obraIds = [], hoje = "") => {
  const escopo = new Set(obraIds.filter(Boolean));
  const noEscopo = registro => !escopo.size || escopo.has(registro.obraId);
  const pedidos = (data.pedidos || []).filter(p => noEscopo(p) && p.status !== "cancelado");
  const solicitacoes = (data.solicitacoesCompra || []).filter(noEscopo);
  const cotacoes = (data.cotacoes || []).filter(noEscopo);
  // Comprometido e "a pagar" só contam pedido vivo (enviado); o rascunho ainda
  // não é compra. O que já foi pago continua contando, mesmo em rascunho.
  const { comprometido: totalComprometido, aFaturar: totalAFaturar } =
    posicaoDasCompras(pedidos.filter(pedidoVivo), data.notasFiscais);
  const totalPago = pedidos.reduce((s, p) => s + totalPagoPedido(p), 0);
  const totalRecebido = pedidos.reduce((s, p) => s + recebidoPedido(p), 0);
  const pedidosValidos = pedidos.filter(pedidoVivo);
  const totalPendente = pedidosValidos.reduce((s, p) => s + saldoPagamentoPedido(p), 0);
  // C2.2: atraso e previsão olham cada item (data própria ou remessas).
  const atrasadosIds = new Set(hoje ? pedidosComItensAtrasados({ ...data, pedidos: pedidosValidos }, hoje).map(x => x.pedido.id) : []);
  const atrasados = pedidosValidos.filter(p => atrasadosIds.has(p.id));
  const semPrevisao = pedidosValidos.filter(p => (p.itens || []).every(i => !remessasDoItem(i, p).length));
  // Pedido feito pelo contrato de fornecimento dispensa cotação (C2.4).
  const semCotacao = pedidosValidos.filter(p => !p.cotacaoId && !pedidoPorContrato(p));
  const pagamentos = pedidos.flatMap(p => p.pagamentos || []).filter(active);
  const semConciliacao = pagamentos.filter(pg => !pg.conciliado);
  const recebidosSemQuitar = pedidosValidos.filter(p =>
    statusPedido(p) === "recebido" && statusPagamentoPedido(p) !== "pago");
  const cotacoesCompetitivas = cotacoes.filter(c => (c.propostas || []).length >= 3);
  const propostas = cotacoes.reduce((s, c) => s + (c.propostas || []).length, 0);
  const economia = cotacoes.reduce((s, c) => s + Number(c.economia || 0), 0);
  const porFornecedor = new Map();
  pedidosValidos.forEach(p => {
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
  const origens = {
    empresa: pagamentos.filter(p => p.origem === "empresa" || p.origem === "banco").reduce((s, p) => s + Number(p.valor || 0), 0),
    caixa_obra: pagamentos.filter(p => p.origem === "caixa_obra").reduce((s, p) => s + Number(p.valor || 0), 0),
    cliente_direto: pagamentos.filter(p => p.origem === "cliente_direto").reduce((s, p) => s + Number(p.valor || 0), 0),
  };
  const fila = {
    solicitacoes: solicitacoes.filter(s => s.status === "enviada").length,
    cotacoes: cotacoes.filter(c => c.status === "aberta").length,
    pedidos: pedidosValidos.filter(p => !["recebido"].includes(statusPedido(p))).length,
    pagamentos: pedidosValidos.filter(p => statusPagamentoPedido(p) !== "pago").length,
    // Recebimento não depende de pagamento: compra a prazo é o caso normal.
    recebimentos: pedidosValidos.filter(p => statusPedido(p) !== "recebido").length,
  };
  const coberturaCotacao = pedidosValidos.length
    ? ((pedidosValidos.length - semCotacao.length) / pedidosValidos.length) * 100 : 0;
  const concorrencia = cotacoes.length ? propostas / cotacoes.length : 0;
  const pontualidade = pontualidadeEntregas(pedidosValidos, hoje);
  const completude = [
    pedidosValidos.length > 0,
    pedidosValidos.some(p => p.cotacaoId),
    pedidosValidos.some(p => (p.itens || []).some(i => remessasDoItem(i, p).length)),
    pedidosValidos.some(p => (p.pagamentos || []).length),
    pedidosValidos.some(p => (p.itens || []).some(i => (i.recebimentos || []).length)),
    (data.fornecedores || []).some(f => f.cnpj && (f.categorias || []).length),
  ].filter(Boolean).length / 6 * 100;
  // R5: cada exceção diz como abrir a lista já filtrada (`filtro`); `destino`
  // continua sendo a área, para quem só precisa do atalho.
  const alertas = [
    atrasados.length && { nivel: "critico", titulo: `${atrasados.length} entrega(s) atrasada(s)`, detalhe: "Risco de parada e replanejamento da obra.", destino: "pedidos",
      filtro: { area: "pedidos", pedidos: { atrasados: true } } },
    recebidosSemQuitar.length && { nivel: "critico", titulo: `${recebidosSemQuitar.length} recebimento(s) sem quitação`, detalhe: "Regularize o vínculo financeiro e a conciliação.", destino: "financeiro",
      filtro: { area: "pedidos", pedidos: { ids: recebidosSemQuitar.map(p => p.id) } } },
    totalPendente > 0 && { nivel: "alto", titulo: `${totalPendente.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} a pagar`, detalhe: "Compromissos assumidos ainda sem cobertura completa.", destino: "financeiro",
      filtro: { area: "financeiro", financeiro: "pendentes" } },
    semCotacao.length && { nivel: "alto", titulo: `${semCotacao.length} pedido(s) sem concorrência registrada`, detalhe: "Preço, prazo e decisão ficam sem evidência comparável.", destino: "cotacoes",
      filtro: { area: "pedidos", pedidos: { ids: semCotacao.map(p => p.id) } } },
    semPrevisao.length && { nivel: "medio", titulo: `${semPrevisao.length} pedido(s) sem previsão`, detalhe: "Sem data não há controle confiável de abastecimento.", destino: "pedidos",
      filtro: { area: "pedidos", pedidos: { ids: semPrevisao.map(p => p.id) } } },
    semConciliacao.length && { nivel: "medio", titulo: `${semConciliacao.length} pagamento(s) sem conciliação`, detalhe: "O caixa pode divergir do histórico de compras.", destino: "financeiro",
      filtro: { area: "financeiro", financeiro: "nao_conciliados" } },
    concentracaoTop3 > 75 && { nivel: "medio", titulo: `${concentracaoTop3.toFixed(0)}% concentrado nos 3 maiores fornecedores`, detalhe: "Avalie alternativas para itens críticos e risco de dependência.", destino: "forn" },
  ].filter(Boolean);
  return {
    pedidos, solicitacoes, cotacoes, fila, totalComprometido, totalAFaturar, totalPago,
    totalRecebido, totalPendente, economia, coberturaCotacao, concorrencia,
    pontualidade, completude, atrasados, semPrevisao, semCotacao,
    semConciliacao, recebidosSemQuitar, cotacoesCompetitivas, fornecedores,
    concentracaoTop3, origens, alertas,
  };
};
