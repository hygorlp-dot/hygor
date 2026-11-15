import {posicaoDoPedido} from '../compras/purchase-position.js';
import {toCents,selectCommitments} from './ledger.js';

// Distribuição proporcional ao valor dos itens: uma nota do pedido nem sempre
// identifica a etapa de cada parcela faturada. O critério fica visível na tela.
export function openPurchaseCommitments(data,obraId,budget,root,excludedOrders=new Set(),ledger){
 const result=new Map();
 const balances=ledger?new Map(selectCommitments(ledger,{obraId}).items.filter(p=>p.sourceType==='pedido').map(p=>[String(p.sourceId),p.balanceCents])):null;
 for(const order of (data.pedidos||[]).filter(p=>p.obraId===obraId)){
   if(excludedOrders.has(String(order.id)))continue;
   const position=posicaoDoPedido(order,data.notasFiscais||[]);
   const total=balances?(balances.get(String(order.id))||0):toCents(position.aFaturar);
   if(!position.viva||!total)continue;
   const weights=new Map();
   for(const item of order.itens||[]){
     const id=root(item.orcNivel1Id||budget?.itens?.find(i=>i.id===item.orcItemId)?.etapaId)||'unassigned';
     weights.set(id,(weights.get(id)||0)+Math.max(0,toCents(Number(item.qtd||0)*Number(item.precoUnit||0))));
   }
   const entries=[...weights],weight=entries.reduce((s,[,n])=>s+n,0);let allocated=0,cumulative=0;
   if(!weight){result.set('unassigned',(result.get('unassigned')||0)+total);continue;}
   entries.forEach(([id,n],i)=>{cumulative+=n;const end=i===entries.length-1?total:Math.round(total*cumulative/weight);result.set(id,(result.get(id)||0)+end-allocated);allocated=end;});
 }
 return result;
}

export function remainingChangeImpacts(work,root){
 const included=[],excluded=[];
 for(const item of work?.aditivosContrato||[]){
   const impact={id:item.id,description:item.descricao,status:item.status,stageId:root(item.etapaId)||'unassigned',amountCents:toCents(item.impactoCustoRestante||0)};
   (item.impactoNaPrevisao==='adicional'&&item.impactoCustoRestante!=null?included:excluded).push(impact);
 }
 return {included,excluded};
}
