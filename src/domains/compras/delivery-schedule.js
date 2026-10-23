// Entrega programada por item (C2.2). Cada item do pedido pode ter a própria
// data prevista (`previsao`) ou remessas programadas (`remessas`, ex.: aço em
// 3 entregas). Sem nada no item, vale a previsão do pedido. Atraso e
// pontualidade passam a olhar o item e a remessa, não o pedido inteiro.

const DATA=/^\d{4}-\d{2}-\d{2}$/;
const EPS=1e-6;
const dia=valor=>String(valor||"").slice(0,10);
const diasEntre=(de,ate)=>Math.round((Date.parse(`${ate}T00:00:00Z`)-Date.parse(`${de}T00:00:00Z`))/86400000);
const pedidoAtivo=pedido=>!["rascunho","cancelado"].includes(String(pedido?.status||""));

// Remessas do item em ordem de data, com a quantidade acumulada.
export const remessasDoItem=(item,pedido={})=>{
  const programadas=(Array.isArray(item?.remessas)?item.remessas:[])
    .filter(remessa=>DATA.test(dia(remessa?.data))&&Number(remessa?.qtd)>0)
    .map(remessa=>({id:String(remessa.id||""),data:dia(remessa.data),qtd:Number(remessa.qtd)}));
  const dataGeral=dia(item?.previsao||pedido?.previsao);
  const programado=programadas.reduce((sum,remessa)=>sum+remessa.qtd,0);
  const restante=Number(item?.qtd||0)-programado;
  // O que não foi programado em remessa segue a previsão do item ou do pedido.
  const lista=restante>EPS&&DATA.test(dataGeral)
    ?[...programadas,{id:"",data:dataGeral,qtd:restante}]:programadas;
  let acumulado=0;
  return lista.sort((a,b)=>a.data.localeCompare(b.data)).map(remessa=>{
    acumulado+=remessa.qtd;
    return {...remessa,acumulado};
  });
};

export const dataPrevistaDoItem=(item,pedido={})=>{
  const remessas=remessasDoItem(item,pedido);
  return remessas.length?remessas[remessas.length-1].data:"";
};

// Data em que o recebido acumulado do item alcançou `quantidade`.
const dataQueAlcancou=(item,quantidade)=>{
  let acumulado=0;
  const recebimentos=(item?.recebimentos||[])
    .filter(rec=>DATA.test(dia(rec?.data))&&Number(rec?.qtd)>0)
    .map(rec=>({data:dia(rec.data),qtd:Number(rec.qtd)}))
    .sort((a,b)=>a.data.localeCompare(b.data));
  for(const rec of recebimentos){
    acumulado+=rec.qtd;
    if(acumulado+EPS>=quantidade)return rec.data;
  }
  return "";
};

// Situação do item hoje: quanto já devia ter chegado e não chegou.
export const atrasoDoItem=(item,pedido,hoje)=>{
  const remessas=remessasDoItem(item,pedido);
  const recebido=Number(item?.qtdRecebida||0);
  const vencidas=remessas.filter(remessa=>remessa.data<hoje);
  const devido=vencidas.length?Math.min(Number(item?.qtd||0),vencidas[vencidas.length-1].acumulado):0;
  const atrasada=Math.max(0,devido-recebido);
  const primeiraNaoAtendida=remessas.find(remessa=>remessa.acumulado>recebido+EPS);
  return {
    atrasada:atrasada>EPS?atrasada:0,
    diasAtraso:atrasada>EPS&&primeiraNaoAtendida?diasEntre(primeiraNaoAtendida.data,hoje):0,
    proximaData:primeiraNaoAtendida?.data||"",
    falta:Math.max(0,Number(item?.qtd||0)-recebido),
  };
};

// Pedidos com algum item atrasado. Mesmo formato usado pela cobrança:
// {pedido, diasAtraso, itensPendentes:[{itemId,descricao,unidade,falta,dataPrevista,diasAtraso}]}.
export const pedidosComItensAtrasados=(data,hoje)=>{
  const materiais=new Map((data?.materiais||[]).map(material=>[material.id,material]));
  return (data?.pedidos||[])
    .filter(pedido=>["enviado","parcial"].includes(pedido.status))
    .map(pedido=>{
      const itensPendentes=(pedido.itens||[]).map(item=>{
        const atraso=atrasoDoItem(item,pedido,hoje);
        if(!atraso.atrasada)return null;
        const material=materiais.get(item.materialId);
        return {itemId:item.id,descricao:material?.descricao||item.descricaoRef||"Material",
          unidade:material?.unidade||item.unidadeRef||"",falta:atraso.atrasada,
          dataPrevista:atraso.proximaData,diasAtraso:atraso.diasAtraso};
      }).filter(Boolean);
      return {pedido,itensPendentes,diasAtraso:Math.max(0,...itensPendentes.map(item=>item.diasAtraso))};
    })
    .filter(entry=>entry.itensPendentes.length>0)
    .sort((a,b)=>b.diasAtraso-a.diasAtraso);
};

// Cada remessa vencida ou já atendida é uma entrega avaliada: no prazo se o
// recebido acumulado alcançou a remessa até a data dela. `atraso` em dias.
export const entregasAvaliadas=(pedidos,hoje)=>(pedidos||[])
  .filter(pedidoAtivo)
  .flatMap(pedido=>(pedido.itens||[]).flatMap(item=>remessasDoItem(item,pedido).flatMap(remessa=>{
    const alcancou=dataQueAlcancou(item,Math.min(remessa.acumulado,Number(item.qtd||0)));
    if(!alcancou&&!(hoje&&remessa.data<hoje))return [];
    const atraso=alcancou?diasEntre(remessa.data,alcancou):diasEntre(remessa.data,hoje);
    return [{pedidoId:pedido.id,itemId:item.id,fornecedorId:pedido.fornecedorId,data:remessa.data,
      noPrazo:!!alcancou&&atraso<=0,atraso:Math.max(0,atraso),pendente:!alcancou}];
  })));

export const pontualidadeEntregas=(pedidos,hoje)=>{
  const avaliadas=entregasAvaliadas(pedidos,hoje);
  return avaliadas.length?(avaliadas.filter(entrega=>entrega.noPrazo).length/avaliadas.length)*100:null;
};

// Validação das datas do item, usada pelo servidor ao salvar o pedido.
export const validarProgramacaoItem=item=>{
  if(item?.previsao&&!DATA.test(String(item.previsao)))return "A data prevista do item é inválida.";
  const remessas=item?.remessas;
  if(remessas==null)return "";
  if(!Array.isArray(remessas)||remessas.length>50)return "As remessas do item são inválidas.";
  let soma=0;
  for(const remessa of remessas){
    if(!DATA.test(String(remessa?.data||""))||!(Number(remessa?.qtd)>0))return "Cada remessa precisa de data e quantidade.";
    soma+=Number(remessa.qtd);
  }
  if(soma>Number(item.qtd||0)+EPS)return "A soma das remessas passa da quantidade do item.";
  return "";
};
