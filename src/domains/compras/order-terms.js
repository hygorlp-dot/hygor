// Condições documentadas no pedido, sem consultar cadastros atuais na leitura.
export const ORDER_TERM_FIELDS={condicoesFaturamento:"Dados e condições de faturamento",enderecoEntrega:"Endereço de entrega",contatoEntrega:"Contato para entrega",condicoesEntrega:"Condições de entrega",condicoesPagamento:"Condições de pagamento"};
export const ORDER_TERM_LIMITS={condicoesFaturamento:1500,enderecoEntrega:600,contatoEntrega:200,condicoesEntrega:1500,condicoesPagamento:1000};
const text=v=>typeof v==="string"&&v.trim()?v.trim():null;
export function normalizeOrderTerms(order){
 const fields={};
 for(const [key,label] of Object.entries(ORDER_TERM_FIELDS)){
  const value=order[key];
  if(value!=null&&(typeof value!=="string"||value.length>ORDER_TERM_LIMITS[key]))return {error:`${label}: informe um texto com até ${ORDER_TERM_LIMITS[key]} caracteres.`};
  fields[key]=text(value);
 }
 return {fields};
}
const values=order=>({...normalizeOrderTerms(order).fields,previsao:text(order.previsao),origemPagamento:text(order.origemPagamento),obraId:order.obraId||null,fornecedorId:order.fornecedorId||null,
 entregas:(order.itens||[]).map(i=>({itemId:i.id,materialId:i.materialId,descricao:text(i.descricaoRef),qtd:Number(i.qtd),unidade:text(i.unidadeCompra||i.unidadeRef),previsao:text(i.previsao),remessas:(i.remessas||[]).map(r=>({id:r.id||null,data:text(r.data),qtd:Number(r.qtd)}))})),
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function preserveOrderTerms(data,current,order,command,now,{proposal=null,reason=""}={}){
 const normalized=normalizeOrderTerms(order);if(normalized.error)return normalized;
 const clean={...order,...Object.fromEntries(Object.entries(normalized.fields).map(([k,v])=>[k,v||""]))};
 const previous=current?.historicoCondicoesPedido||[];
 // O histórico é produzido somente no servidor. Nunca aceitar uma substituição
 // enviada no formulário, nem recalcular o passado a partir dos cadastros.
 const changed=current&&!same(values(current),values(clean));
 if(current&&!changed){
  delete clean.historicoCondicoesPedido;
  if(current.historicoCondicoesPedido)clean.historicoCondicoesPedido=previous;
  return {order:clean};
 }
 if(previous.length>=100)return {error:"Limite de revisões das condições do pedido atingido."};
 const who={registradoEm:now,registradoPorId:String(command.actorId||""),registradoPor:String(command.actorName||"Operador")};
 const snapshot=(source,origin,version,old=null)=>{
  const supplier=(data.fornecedores||[]).find(f=>String(f.id)===String(source.fornecedorId)),work=(data.obras||[]).find(o=>String(o.id)===String(source.obraId));
  const historical=origin==="legado";
  return {versao:version,origem:origin,...who,motivo:historical?"Dados disponíveis antes do ajuste; não comprovam o acordo original.":reason||String(command.payload?.adjustmentReason||"").trim(),
   condicoes:values(source),
   fornecedor:old?.fornecedor?.id===source.fornecedorId?{...old.fornecedor}:{id:source.fornecedorId,nome:historical?null:text(supplier?.nome),documento:historical?null:text(supplier?.cnpj)},
   obra:old?.obra?.id===source.obraId?{...old.obra}:{id:source.obraId,nome:historical?null:text(work?.name)},
   proposta:proposal?{cotacaoId:source.cotacaoId,propostaId:proposal.id,prazoDias:proposal.prazoDias==null||proposal.prazoDias===""||!Number.isFinite(Number(proposal.prazoDias))?null:Number(proposal.prazoDias)}:old?.proposta?{...old.proposta}:null,
  };
 };
 const history=current&&!previous.length?[snapshot(current,"legado",1)]:[...previous];
 history.push(snapshot(clean,current?"ajuste":"criacao",Number(history.at(-1)?.versao||0)+1,history.at(-1)));
 return {order:{...clean,historicoCondicoesPedido:history}};
}
