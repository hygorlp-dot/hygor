import {itensDaCotacao,precoDaProposta} from "./quote-map.js";
import {quoteResponseOpen} from "./supplier-quote-response.js";
import {materialPriceHistory} from "./material-price-history.js";
import {custoFinalDaProposta} from "./final-cost.js";
import {quoteDispatchTracking} from "./quote-dispatch.js";

export const SUPPLIER_RESPONSE_LABELS={pendente:"Aguardando revisão",aguardando:"Aguardando retorno",nao_enviado:"Envio não registrado",retorno_manual:"Retorno por outro canal — conferir proposta",aceita:"Aceita por Compras",rejeitada:"Rejeitada por Compras",cadastrada:"Proposta cadastrada"};
export function supplierResponseQueue(quotes=[],now=new Date().toISOString()){
 return quotes.filter(quoteResponseOpen).flatMap(quote=>(quote.propostas||[]).map(proposal=>{
  const responses=(quote.respostasFornecedor||[]).filter(r=>r.proposalId===proposal.id&&r.fornecedorId===proposal.fornecedorId);
  const response=responses.find(r=>r.status==="pendente")||[...responses].sort((a,b)=>String(b.recebidaEm).localeCompare(String(a.recebidaEm)))[0];
  const hasOffer=itensDaCotacao(quote).some(i=>precoDaProposta(quote,proposal,i.id)>0);
  const tracking=quoteDispatchTracking(quote,proposal,now);
  const status=response?.status==="pendente"?"pendente":tracking.awaiting?"aguardando":tracking.manualReturn?"retorno_manual":response?.status||(hasOffer?"cadastrada":"nao_enviado");
  return {id:`${quote.id}:${proposal.id}`,quote,proposal,response,tracking,status,receivedAt:tracking.receivedAt||response?.recebidaEm||null};
 })).sort((a,b)=>({pendente:0,retorno_manual:1,aguardando:2,nao_enviado:3}[a.status]??4)-({pendente:0,retorno_manual:1,aguardando:2,nao_enviado:3}[b.status]??4)||Number(b.tracking.overdue)-Number(a.tracking.overdue)||String(a.tracking.current?.deadlineAt||a.receivedAt||"").localeCompare(String(b.tracking.current?.deadlineAt||b.receivedAt||"")));
}

const unit=v=>String(v||"").trim().toUpperCase().replace(/^UND?$/,"UN");
// Compara a mesma identidade, unidade e custo final, apenas com recebimentos
// documentados anteriores à cotação. Não usa a própria compra como referência.
export function quotePriceReferences(data,quote,workIds=[]){
 const ownOrders=new Set((data.pedidos||[]).filter(p=>p.cotacaoId===quote.id).map(p=>p.id));
 const history=materialPriceHistory(data,{workIds,basis:"received",price:"final",end:quote.data||""})
  .filter(r=>r.price!=null&&!ownOrders.has(r.orderId));
 return itensDaCotacao(quote).map(item=>{
  const material=(data.materiais||[]).find(m=>String(m.id)===String(item.materialId));
  const referenceUnit=unit(item.unidadeRef||material?.unidade),purchaseUnit=unit(item.unidadeCompra||referenceUnit);
  const factor=referenceUnit&&purchaseUnit===referenceUnit?1:Number(quote.itens?.length?item.fatorConversao:quote.fatorConversao);
  const conversion=Boolean(referenceUnit&&purchaseUnit&&Number.isFinite(factor)&&factor>0);
  const last=conversion?history.find(r=>String(r.materialId)===String(item.materialId)&&r.referenceUnit===referenceUnit):null;
  const offers=(quote.propostas||[]).filter(p=>!(quote.respostasFornecedor||[]).some(r=>r.proposalId===p.id&&r.status==="pendente")).map(p=>{
   const cost=custoFinalDaProposta(quote,p),value=cost.complete?cost.precosFinais[item.id]:null;
   return {proposalId:p.id,supplierId:p.fornecedorId,price:value>0&&conversion?value/factor:null,change:last&&value>0?100*(value/factor-last.price)/last.price:null};
  });
  return {item,description:material?.descricao||item.descricaoRef||"Material",referenceUnit,last,offers};
 });
}
