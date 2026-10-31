// Mapa de cotação (C1.3): uma cotação cobre vários itens e cada fornecedor
// informa preço por item. A decisão é por item e gera um pedido por
// fornecedor vencedor. Cotações antigas (um material, `precoUnit` na
// proposta) são lidas como um mapa de um item só, para a tela e o servidor
// usarem a mesma regra nos dois formatos.

import { custoFinalDaProposta } from "./final-cost.js";
export const ITEM_COTACAO_LEGADO="__item";
const EPS=0.000001;

export const cotacaoMultiItens=quote=>Array.isArray(quote?.itens)&&quote.itens.length>0;

export const itensDaCotacao=quote=>{
  if(cotacaoMultiItens(quote))return quote.itens;
  if(!quote?.materialId)return [];
  return [{
    id:ITEM_COTACAO_LEGADO,materialId:quote.materialId,qtd:Number(quote.qtd||0),
    unidadeRef:quote.unidadeRef||"",unidadeCompra:quote.unidadeCompra||"",
    fatorConversao:Number(quote.fatorConversao||1),precoRef:Number(quote.precoRef||0),
    orcItemId:quote.orcItemId||"",orcNivel1Id:quote.orcNivel1Id||"",
  }];
};

export const precoDaProposta=(quote,proposal,itemId)=>{
  const value=cotacaoMultiItens(quote)
    ?Number(proposal?.precos?.[itemId]||0)
    :Number(proposal?.precoUnit||0);
  return Number.isFinite(value)&&value>0?value:0;
};

// Decisões por item: {itemId:{propostaId,pedidoId,justificativa}}. A cotação
// antiga guarda só `escolhida`/`pedidoId`.
export const decisoesDaCotacao=quote=>{
  if(cotacaoMultiItens(quote))return quote.decisoes||{};
  if(quote?.status==="decidida"&&quote.pedidoId){
    return {[ITEM_COTACAO_LEGADO]:{propostaId:quote.escolhida||"",pedidoId:quote.pedidoId,
      justificativa:quote.justificativaEscolha||""}};
  }
  return {};
};

// Linhas do mapa: uma por item, com as ofertas ordenadas pelo menor preço
// (empate pelo menor prazo) e a melhor destacada.
export const mapaDaCotacao=quote=>{
  const propostas=(quote?.propostas||[]).filter(p=>!(quote.respostasFornecedor||[]).some(r=>r.proposalId===p.id&&r.status==="pendente"));
  const custos=new Map(propostas.map(p=>[p.id,custoFinalDaProposta(quote,p)]));
  const decisoes=decisoesDaCotacao(quote);
  const linhas=itensDaCotacao(quote).map(item=>{
    const qtd=Number(item.qtd||0);
    const ofertas=propostas
      .map(proposta=>({proposta,precoUnit:custos.get(proposta.id).precosFinais[item.id]??precoDaProposta(quote,proposta,item.id)}))
      .filter(oferta=>oferta.precoUnit>0)
      .map(oferta=>({...oferta,total:oferta.precoUnit*qtd}))
      .sort((a,b)=>a.precoUnit-b.precoUnit
        ||Number(a.proposta.prazoDias||999)-Number(b.proposta.prazoDias||999));
    const menorPreco=ofertas[0]?.precoUnit||0;
    return {
      item,qtd,ofertas,menorPreco,melhorPropostaId:ofertas[0]?.proposta.id||"",
      decisao:decisoes[item.id]||null,
    };
  });
  const totaisPorProposta=Object.fromEntries(propostas.map(proposta=>[proposta.id,
    custos.get(proposta.id).total??linhas.reduce((sum,linha)=>sum+precoDaProposta(quote,proposta,linha.item.id)*linha.qtd,0)]));
  return {linhas,totaisPorProposta};
};

export const itensPendentesDaCotacao=quote=>mapaDaCotacao(quote).linhas.filter(linha=>!linha.decisao);

// Sugestão inicial da tela: a melhor oferta de cada item ainda pendente.
export const sugestaoDeEscolhas=quote=>Object.fromEntries(itensPendentesDaCotacao(quote)
  .filter(linha=>linha.melhorPropostaId&&linha.ofertas.every(({proposta})=>!proposta.custoFinal||custoFinalDaProposta(quote,proposta).complete))
  .map(linha=>[linha.item.id,linha.melhorPropostaId]));

// Exige justificativa quando a escolha não é a mais barata ou quando o item
// tem menos de duas ofertas (sem concorrência).
export const escolhaPrecisaJustificativa=(linha,propostaId)=>{
  if(linha.ofertas.length<2)return true;
  const oferta=linha.ofertas.find(item=>String(item.proposta.id)===String(propostaId));
  return !oferta||oferta.precoUnit>linha.menorPreco+EPS;
};

// Valida as escolhas de itens pendentes e agrupa por fornecedor. Itens sem
// escolha ficam pendentes para uma decisão posterior.
export const avaliarEscolhasCotacao=(quote,escolhas={},justificativas={})=>{
  const pendentes=itensPendentesDaCotacao(quote);
  const pendentesPorId=new Map(pendentes.map(linha=>[String(linha.item.id),linha]));
  const escolhidos=Object.entries(escolhas||{}).filter(([,propostaId])=>propostaId);
  if(!escolhidos.length)return {erro:"Escolha a proposta de ao menos um item."};
  const grupos=new Map();
  let economia=0;
  const decisoes={};
  for(const [itemId,propostaId] of escolhidos){
    const linha=pendentesPorId.get(String(itemId));
    if(!linha)return {erro:"Um dos itens escolhidos não existe ou já virou pedido."};
    const oferta=linha.ofertas.find(item=>String(item.proposta.id)===String(propostaId));
    if(!oferta)return {erro:"A proposta escolhida não cotou este item."};
    if(oferta.proposta.custoFinal){
      const cost=custoFinalDaProposta(quote,oferta.proposta);
      if(!cost.complete)return {erro:"Complete frete, desconto, impostos adicionais e despesas da proposta antes de gerar pedidos. Informe zero quando não houver cobrança."};
      // Frete fixo não pode ser fracionado em vários pedidos sem nova oferta.
      if(Object.values(oferta.proposta.custoFinal).some(value=>Number(value)>0)&&itensDaCotacao(quote).some(item=>precoDaProposta(quote,oferta.proposta,item.id)>0&&escolhas[item.id]!==propostaId)){
        return {erro:"A proposta com custos adicionais deve ser comprada integralmente. Para dividir os itens, revise a cotação com os custos de cada fornecedor."};
      }
    }
    const justificativa=String(justificativas?.[itemId]||"").trim();
    if(escolhaPrecisaJustificativa(linha,propostaId)&&!justificativa){
      return {erro:linha.ofertas.length<2
        ?"Justifique a compra de item com uma única proposta."
        :"Justifique a escolha de uma proposta que não é a mais barata."};
    }
    const fornecedorId=String(oferta.proposta.fornecedorId);
    if(!grupos.has(fornecedorId)){
      grupos.set(fornecedorId,{fornecedorId,propostaId:oferta.proposta.id,
        prazoDias:Number(oferta.proposta.prazoDias||0),itens:[]});
    }
    grupos.get(fornecedorId).itens.push({linha,precoUnit:oferta.precoUnit});
    const maior=linha.ofertas[linha.ofertas.length-1].precoUnit;
    const economiaItem=Math.max(0,(maior-oferta.precoUnit)*linha.qtd);
    economia+=economiaItem;
    decisoes[linha.item.id]={propostaId:oferta.proposta.id,justificativa,economia:economiaItem};
  }
  const lista=[...grupos.values()].map(grupo=>({
    ...grupo,total:grupo.itens.reduce((sum,item)=>sum+item.precoUnit*item.linha.qtd,0),
  }));
  return {grupos:lista,economia,decisoes,
    total:lista.reduce((sum,grupo)=>sum+grupo.total,0),
    restantes:pendentes.length-escolhidos.length};
};
