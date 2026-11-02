import {active,toCents,notaReconhecivel} from './facts.js';
export function orderPaymentLinks(data,order,payment){
 return (data.notasFiscais||[]).filter(notaReconhecivel).flatMap(note=>(note.pagamentos||[]).filter(active).filter(p=>p.pedidoPagamentoId?note.pedidoId===order.id&&note.obraId===order.obraId&&p.pedidoPagamentoId===payment.id:p.id===payment.id||!!payment.transacaoId&&p.transacaoId===payment.transacaoId).map(p=>({id:p.id,notaId:note.id,valorCents:toCents(p.valor),modern:!!p.pedidoPagamentoId})));
}
export function availableOrderPayments(data,note){
 const order=(data.pedidos||[]).find(o=>o.id===note.pedidoId&&o.obraId===note.obraId&&active(o));
 if(!order)return [];
 return (order.pagamentos||[]).filter(active).map(payment=>({order,payment,availableCents:Math.max(0,toCents(payment.valor)-orderPaymentLinks(data,order,payment).reduce((sum,l)=>sum+l.valorCents,0))})).filter(p=>p.availableCents>0);
}
