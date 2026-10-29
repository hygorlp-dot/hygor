import { instanciaDaSolicitacao } from "./purchase-approval.js";
import { buildDreCashManagement } from "../conciliacao/cash-allocations.js";

const same=(a,b)=>a!=null&&b!=null&&String(a)!==""&&String(a)===String(b);
export function fichaDaCompra(data,{pedidoId,cotacaoId}){
  const order=(data.pedidos||[]).find(p=>same(p.id,pedidoId));
  const quote=(data.cotacoes||[]).find(c=>same(c.id,cotacaoId||order?.cotacaoId)&&(!order||same(c.obraId,order.obraId)));
  const project=order?.obraId||quote?.obraId;
  const orders=(data.pedidos||[]).filter(p=>same(p.obraId,project)&&(quote?same(p.cotacaoId,quote.id):same(p.id,pedidoId)));
  const request=(data.solicitacoesCompra||[]).find(s=>same(s.id,quote?.solicitacaoId||order?.solicitacaoId)&&same(s.obraId,project));
  const invoices=(data.notasFiscais||[]).filter(n=>same(n.obraId,project)&&orders.some(p=>same(p.id,n.pedidoId)));
  const invoicePayments=invoices.flatMap(n=>(n.pagamentos||[]).map(pg=>({...pg,origem:`NF ${n.numero}`})));
  const payments=[...orders.flatMap(p=>(p.pagamentos||[]).filter(pg=>!invoicePayments.some(ip=>same(ip.id,pg.id)||same(ip.transacaoId,pg.transacaoId))).map(pg=>({...pg,origem:`Pedido ${p.numero}`}))),...invoicePayments];
  const transactionIds=new Set([order?.transacaoId,...orders.map(p=>p.transacaoId),...payments.map(p=>p.transacaoId)].filter(Boolean).map(String));
  const cash=buildDreCashManagement(data);
  const eventIds=new Set(cash.entries.filter(e=>(e.sourceType==="pedido"&&orders.some(p=>same(p.id,e.sourceId)))||(e.sourceType==="pagamento_nota"&&invoices.some(n=>same(n.id,e.sourceId)))).map(e=>e.id));
  for(const link of cash.allocations)if(link.status==="active"&&eventIds.has(link.eventId))transactionIds.add(String(link.transactionId));
  const transactions=(data.transacoes||[]).filter(t=>transactionIds.has(String(t.id)));
  const documents=[];
  const add=(entity,origin)=>{for(const doc of entity?.documentos||[])documents.push({...doc,origem:origin});};
  const approval=instanciaDaSolicitacao(data,request);
  const decisions=(data.decisoesAprovacao||[]).filter(d=>same(d.instanciaId,approval?.id));
  add(request,"Solicitação");
  for(const decision of decisions)add({documentos:decision.anexos},`Aprovação · ${decision.aprovadorNome||"Responsável"}`);
  for(const proposal of quote?.propostas||[])add(proposal,`Cotação · ${(data.fornecedores||[]).find(f=>same(f.id,proposal.fornecedorId))?.nome||proposal.fornecedorId}`);
  for(const p of orders){add(p,`Pedido ${p.numero}`);for(const item of p.itens||[])for(const receipt of item.recebimentos||[])add(receipt,`Recebimento · ${p.numero}`);}
  for(const invoice of invoices)add(invoice,`NF ${invoice.numero}`);
  for(const payment of payments)add(payment,`Pagamento · ${payment.origem}`);
  return {quote,request,approval,decisions,orders,invoices,payments,transactions,documents};
}

export function urlDocumentoCompra(doc){
  try {const url=new URL(doc.url);return url.protocol==="https:"?url.href:"";}catch{return "";}
}
