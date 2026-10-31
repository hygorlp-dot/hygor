import {custoFinalDaProposta} from "./final-cost.js";
export const responseItems=q=>q.itens?.length?q.itens:[{id:"__item",materialId:q.materialId,qtd:q.qtd,unidadeCompra:q.unidadeCompra||q.unidadeRef,descricaoRef:q.descricaoRef}];
export const quoteResponseScope=q=>JSON.stringify([q.id,q.obraId,responseItems(q).map(i=>[i.id,i.materialId,i.descricaoRef||"",Number(i.qtd),i.unidadeCompra||i.unidadeRef||"",i.fatorConversao||1])]);
export const quoteResponseOpen=q=>Boolean(q&&!q.deletedAt&&q.ativo!==false&&q.status==="aberta"&&!q.pedidoId&&!Object.keys(q.decisoes||{}).length);
const fail=reason=>({ok:false,reason});
export function storeSupplierResponse(data,{quoteId,proposalId,responseId,scope,body={}},now=new Date().toISOString()){
 const quote=(data.cotacoes||[]).find(q=>String(q.id)===String(quoteId));
 if(!quoteResponseOpen(quote)||quoteResponseScope(quote)!==scope)return fail("A cotação foi alterada ou encerrada. Peça um novo link a Compras.");
 const proposal=(quote.propostas||[]).find(p=>String(p.id)===String(proposalId));
 if(!proposal)return fail("Fornecedor indisponível nesta cotação.");
 const responses=quote.respostasFornecedor||[];
 if(responses.some(r=>r.id===responseId))return {ok:true,idempotent:true,data};
 if(responses.some(r=>r.proposalId===proposalId&&r.status==="pendente"))return fail("Já existe resposta aguardando revisão de Compras.");
 if(responses.length>=100)return fail("Limite de respostas atingido. Contate Compras.");
 const name=String(body.nome||"").trim(),payment=String(body.condicoesPagamento||"").trim();
 if(name.length<3||name.length>120||!payment||payment.length>500)return fail("Informe seu nome e as condições de pagamento.");
 const prices={},items=responseItems(quote);
 if(!items.length||items.length>300)return fail("Itens da cotação indisponíveis.");
 for(const i of items){const value=body.precos?.[i.id];if(value==null||value===""||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e9)return fail("Informe o preço de cada item ou zero para item não fornecido.");prices[i.id]=Number(value);}
 const terms={};for(const k of ["frete","desconto","impostos","despesas"]){const v=body.custoFinal?.[k];if(v==null||v===""||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e9)return fail("Informe custos e desconto válidos, usando zero quando não houver cobrança.");terms[k]=Number(v);}
 if(body.prazoDias==null||body.prazoDias===""||!Number.isInteger(Number(body.prazoDias))||Number(body.prazoDias)<0||Number(body.prazoDias)>3650)return fail("Informe um prazo de entrega válido em dias.");
 const documents=Array.isArray(body.documentos)?body.documentos:[];if(documents.length>5)return fail("Anexe no máximo cinco links.");
 const docs=[];for(const [i,d] of documents.entries()){let url;try{url=new URL(d.url)}catch{return fail("Anexo inválido. Informe um link HTTPS.");}if(url.protocol!=="https:"||url.username||url.password||url.href.length>2000)return fail("Anexo inválido. Informe um link HTTPS sem credenciais.");docs.push({id:`${responseId}-${i}`,nome:String(d.nome||"Anexo do fornecedor").slice(0,120),url:url.href});}
 const offer={precos:prices,precoUnit:prices.__item,custoFinal:terms,prazoDias:Number(body.prazoDias),condicoesPagamento:payment,obs:String(body.obs||"").slice(0,1000),documentos:docs};
 if(!custoFinalDaProposta(quote,offer).complete)return fail("A proposta deve ter ao menos um item com preço e custo final positivo.");
 const response={itens:items.map(i=>({id:i.id,materialId:i.materialId,descricaoRef:i.descricaoRef||"",qtd:i.qtd,unidadeCompra:i.unidadeCompra||i.unidadeRef||""})),total:custoFinalDaProposta(quote,offer).total,id:responseId,proposalId,fornecedorId:proposal.fornecedorId,scope,status:"pendente",nome:name,recebidaEm:now,offer};
 const updated={...quote,respostasFornecedor:[...responses,response],version:Number(quote.version||0)+1,updatedAt:now};
 return {ok:true,data:{...data,cotacoes:data.cotacoes.map(q=>q.id===quote.id?updated:q)}};
}
export function reviewSupplierResponse(data,command,now){
 if(!command.actorId||!["admin","compras"].includes(command.actorRole))return fail("Somente Compras ou Administração revisam propostas.");
 const p=command.payload||{},q=(data.cotacoes||[]).find(q=>q.id===p.quoteId),r=q?.respostasFornecedor?.find(r=>r.id===p.responseId);
 if(!q||q.status!=="aberta"||!r||r.status!=="pendente")return fail("Resposta indisponível para revisão.");
 if(Number(q.version||0)!==Number(command.expectedVersion))return fail("A cotação mudou. Atualize antes de revisar.");
 if(!["aceita","rejeitada"].includes(p.decision)||String(p.reason||"").trim().length<3)return fail("Informe a decisão e o motivo da revisão.");
 const proposal=q.propostas.find(o=>o.id===r.proposalId&&o.fornecedorId===r.fornecedorId);
 if(p.decision==="aceita"&&(!proposal||!quoteResponseOpen(q)||r.scope!==quoteResponseScope(q)))return fail("Os itens ou o fornecedor mudaram. Solicite outra resposta.");
 const updated={...q,propostas:p.decision==="aceita"?q.propostas.map(o=>o.id===r.proposalId?{...o,...r.offer,documentos:[...(o.documentos||[]),...r.offer.documentos],respostaFornecedorId:r.id}:o):q.propostas,
 respostasFornecedor:q.respostasFornecedor.map(o=>o.id===r.id?{...o,status:p.decision,revisadaEm:now,revisadaPorId:command.actorId,revisadaPor:command.actorName,motivo:String(p.reason).trim().slice(0,500)}:o),version:Number(q.version||0)+1,updatedAt:now};
 return {ok:true,entityId:q.id,data:{...data,cotacoes:data.cotacoes.map(o=>o.id===q.id?updated:o)}};
}
