const id=value=>value!=null&&String(value).trim()!=='';
const same=(a,b)=>id(a)&&id(b)&&String(a)===String(b);
const unit=value=>String(value||'').trim().toUpperCase().replace(/^UND?$/,'UN');
const active=value=>value&&!value.deletedAt&&value.ativo!==false&&!['cancelado','cancelada','estornado','estornada','rejeitado','rejeitada'].includes(value.status);
const positive=value=>Number.isFinite(Number(value))&&Number(value)>0;
function measure(item){
 const purchase=unit(item.unidadeCompra||item.unidadeRef),reference=unit(item.unidadeRef||item.unidadeCompra);
 const factor=purchase===reference?1:Number(item.fatorConversao);
 return {purchase,reference,factor,valid:Boolean(purchase&&reference&&positive(factor))};
}

// Coverage is physical, proven by request/item/material/work identities. Never cash or stock allocation.
export function planningRequestCoverage(request,orders,needDate){
 const linked=orders.filter(order=>active(order)&&id(order.id)&&order.status!=='rascunho'&&same(order.obraId,request.obraId)&&same(order.solicitacaoId,request.id));
 const orderCounts=new Map();for(const order of linked)orderCounts.set(String(order.id),(orderCounts.get(String(order.id))||0)+1);
 const requestItems=request.itens||[],counts=new Map();
 for(const item of requestItems)if(id(item.id))counts.set(String(item.id),(counts.get(String(item.id))||0)+1);
 const unmatched=[];
 for(const order of linked)for(const item of order.itens||[])if(!id(item.solicitacaoItemId)||!requestItems.some(r=>same(r.id,item.solicitacaoItemId)))unmatched.push({orderId:order.id,itemId:item.id});
 const rows=requestItems.map((item,index)=>{
  const measured=measure(item),quantity=Number(item.quantidade),reasons=[],commitments=[];
  const valid=id(item.id)&&counts.get(String(item.id))===1&&id(item.materialId)&&positive(quantity)&&measured.valid;
  if(!valid)reasons.push('Confira identidade, material, quantidade e unidade da solicitação.');
  for(const order of linked){
   const orderIds=new Map();for(const line of order.itens||[])if(id(line.id))orderIds.set(String(line.id),(orderIds.get(String(line.id))||0)+1);
   for(const line of order.itens||[]){
    if(!same(line.solicitacaoItemId,item.id))continue;
    const m=measure(line),duplicate=!id(line.id)||orderIds.get(String(line.id))!==1;
    if(!valid||orderCounts.get(String(order.id))!==1||duplicate||!same(line.materialId,item.materialId)||!positive(line.qtd)||!m.valid||m.reference!==measured.reference){reasons.push(`Pedido ${order.numero||order.id}: vínculo, quantidade ou conversão pendente.`);continue;}
    const equivalent=Number(line.qtd)*m.factor/measured.factor;
    if(!positive(equivalent)){reasons.push(`Pedido ${order.numero||order.id}: conversão não comprovada.`);continue;}
    commitments.push({orderId:order.id,numero:order.numero||order.id,quantity:equivalent,date:order.previsao||'',late:Boolean(needDate&&order.previsao&&order.previsao>needDate)});
   }
  }
  const committed=commitments.reduce((sum,line)=>sum+line.quantity,0),uncovered=valid?Math.max(0,quantity-committed):null;
  const uncertain=reasons.length>0||unmatched.length>0;
  const status=!valid||uncertain?'review':uncovered>1e-6?(committed>0?'partial':'uncovered'):'covered';
  return {id:item.id||`missing-${index}`,label:item.descricaoRef||item.descricao||'Material sem descrição',materialId:item.materialId,unit:measured.purchase,quantity:valid?quantity:null,committed,uncovered,status,reasons,commitments,excess:valid?Math.max(0,committed-quantity):0};
 });
 return {request,rows,unmatched,complete:rows.length>0&&rows.every(row=>row.status==='covered'),requiresReview:!rows.length||rows.some(row=>row.status==='review'),uncovered:rows.filter(row=>['partial','uncovered'].includes(row.status)).length};
}
