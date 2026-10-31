const unit=v=>String(v||"").trim().toUpperCase().replace(/^UND?$/, "UN");
const positive=v=>Number.isFinite(Number(v))&&Number(v)>0;
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"")&&Number.isFinite(Date.parse(v));
export function materialPriceHistory(data,{workIds=[],basis="received",materialId="",supplierId="",start="",end="",price="final",referenceUnit=""}={}){
 const works=new Set(workIds.map(String)),materials=new Map((data.materiais||[]).map(m=>[String(m.id),m]));
 const rows=[];
 for(const order of data.pedidos||[]){
  if(!works.has(String(order.obraId))||["cancelado","rascunho"].includes(order.status))continue;
  if(supplierId&&String(order.fornecedorId)!==String(supplierId))continue;
  for(const [itemIndex,item] of (order.itens||[]).entries()){
   if(!item.materialId||(materialId&&String(item.materialId)!==String(materialId)))continue;
   const material=materials.get(String(item.materialId));
   const ref=unit(item.unidadeRef||material?.unidade),purchase=unit(item.unidadeCompra||ref);
   const factor=ref&&purchase===ref?1:Number(item.fatorConversao);
   const conversion=Boolean(ref&&purchase&&positive(factor));
   const finalKnown=Boolean(order.custoFinal&&["frete","desconto","impostos","despesas"].every(k=>order.custoFinal[k]!=null&&order.custoFinal[k]!==""&&Number.isFinite(Number(order.custoFinal[k]))&&Number(order.custoFinal[k])>=0)&&positive(item.precoUnitCotado));
   const raw=Number(item.precoUnitCotado??(order.custoFinal?NaN:item.precoUnit)),final=finalKnown?Number(item.precoUnit):null;
   const receipts=(item.recebimentos||[]).filter(r=>!r.cancelado&&!['cancelado','cancelada','estornado','estornada'].includes(r.status));
   const events=basis==="orders"?[{data:order.data,qtd:item.qtd}]:(item.recebimentos||[]).length?receipts.map(r=>({data:r.data,qtd:r.qtd??r.quantidade})):positive(item.qtdRecebida)?[{data:item.dataRecebimento||order.data,qtd:item.qtdRecebida,estimated:!item.dataRecebimento}]:[];
   for(const [index,event] of events.entries()){
    if(!positive(event.qtd))continue;
    if((start||end)&&(!date(event.data)||(start&&event.data<start)||(end&&event.data>end)))continue;
    if(referenceUnit&&ref!==referenceUnit)continue;
    const value=price==="final"?final:raw;
    const issue=!conversion?"Conversão de unidade não informada":!positive(value)?(price==="final"?"Custo final não documentado":"Preço não informado"):!date(event.data)?"Data não informada":null;
    rows.push({id:`${order.id}:${item.id||itemIndex}:${index}`,orderId:order.id,orderNumber:order.numero||order.id,workId:order.obraId,supplierId:order.fornecedorId,materialId:item.materialId,description:material?.descricao||item.descricaoRef||"Material",referenceUnit:ref||"Não informada",purchaseUnit:purchase||"Não informada",quantity:Number(event.qtd),referenceQuantity:conversion?Number(event.qtd)*factor:null,date:event.data||"",estimatedDate:Boolean(event.estimated),rawPrice:conversion&&positive(raw)?raw/factor:null,finalPrice:conversion&&positive(final)?final/factor:null,price:!issue?value/factor:null,issue});
   }
  }
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));
}
export function priceHistorySummary(rows){
 const comparable=rows.filter(r=>r.price!=null),units=new Set(comparable.map(r=>r.referenceUnit));
 if(!comparable.length||units.size!==1)return null;
 const quantity=comparable.reduce((s,r)=>s+r.referenceQuantity,0),first=comparable.at(-1),last=comparable[0];
 return {count:comparable.length,quantity,last:last.price,min:Math.min(...comparable.map(r=>r.price)),max:Math.max(...comparable.map(r=>r.price)),weighted:comparable.reduce((s,r)=>s+r.price*r.referenceQuantity,0)/quantity,change:first.price?100*(last.price-first.price)/first.price:0,unit:last.referenceUnit};
}
