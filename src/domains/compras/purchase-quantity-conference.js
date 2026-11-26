import {active} from '../financeiro/ledger.js';
import {conversionFactorOf} from './unit-conversion.js';

const id=value=>String(value??'');
const quantity=value=>value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
const unit=value=>String(value||'').trim().toUpperCase().replace(/^UND$/,'UN');
const EPS=1e-6;

export function purchaseQuantityConference(order,invoices){
 const items=order?.itens||[];
 const notes=invoices.filter(note=>active(note)&&id(note.pedidoId)===id(order?.id)&&id(note.obraId)===id(order?.obraId));
 const byId=new Map(items.filter(item=>id(item.id)).map(item=>[id(item.id),item]));
 const byItem=new Map();
 const issues=[];
 for(const note of notes){
  const label=`NF ${note.numero||note.id}`;
  if(!note.itensNota?.length)issues.push(`${label} sem itens detalhados.`);
  for(const line of note.itensNota||[]){
   const item=byId.get(id(line.pedidoItemId));
   const origin=`${label} · ${line.descricao||line.nItem||'Item fiscal'}`;
   if(!item){issues.push(`${origin} sem vínculo confirmado com um item do pedido.`);continue;}
   const purchaseUnit=unit(item.unidadeCompra||item.unidadeRef);
   const fiscalUnit=unit(line.unidade);
   const factor=fiscalUnit&&purchaseUnit&&fiscalUnit===purchaseUnit?1:
    fiscalUnit&&purchaseUnit&&fiscalUnit===unit(item.unidadeRef)?conversionFactorOf(item):0;
   const billed=quantity(line.qtd);
   if(!factor||billed===null){
    issues.push(`${origin} com unidade ou quantidade a conferir.`);
    continue;
   }
   const previous=byItem.get(item)||{billed:0,notes:new Set(),name:line.descricao};
   previous.billed+=billed/factor;
   previous.notes.add(label);
   byItem.set(item,previous);
   const fiscalPrice=quantity(line.precoUnit);
   const purchasePrice=quantity(item.precoUnit);
   if(fiscalPrice!==null&&purchasePrice!==null&&Math.abs(fiscalPrice*factor-purchasePrice)>0.01){
    issues.push(`${origin} com preço unitário diferente do pedido.`);
   }
  }
 }
 const rows=items.map(item=>{
  const ordered=quantity(item.qtd),received=quantity(item.qtdRecebida??0);
  const billing=byItem.get(item);
  const billed=billing?.billed??(notes.length?null:0);
  const label=item.descricaoRef||item.descricao||billing?.name||item.materialId||item.id||'Item do pedido';
  if(ordered!==null&&received!==null&&received>ordered+EPS)issues.push(`${label} com recebimento acima do pedido.`);
  if(billed!==null&&received!==null&&billed>received+EPS)issues.push(`${label} com quantidade faturada acima da recebida em ${[...(billing?.notes||[])].join(', ')}.`);
  return {item,ordered,received,billed,open:ordered===null||received===null?null:Math.max(ordered-received,0),unit:unit(item.unidadeCompra||item.unidadeRef)};
 });
 return {rows,issues};
}
