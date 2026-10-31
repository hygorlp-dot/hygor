import {active} from './ledger.js';
import {buildDreCashManagement} from '../conciliacao/cash-allocations.js';
import {podeAcessarAba} from '../administracao/abas-acesso.js';
export const hasInvoiceBankPayment=invoice=>(invoice.pagamentos||[]).filter(active).some(p=>!['cliente_direto','caixa_obra'].includes(p.origem));

export function invoiceBankContext(data,invoiceId,user){
 if(!['admin','financeiro'].includes(user?.role)||!podeAcessarAba(user,'fin')||!podeAcessarAba(user,'conc'))return null;
 const invoice=(data.notasFiscais||[]).find(n=>String(n.id)===String(invoiceId)&&active(n));
 if(!invoice||user.obraId&&String(user.obraId)!==String(invoice.obraId))return null;
 if(!hasInvoiceBankPayment(invoice))return null;
 const report=buildDreCashManagement(data);
 const entries=report.entries.filter(e=>e.sourceType==='pagamento_nota'&&String(e.sourceId)===String(invoice.id)&&e.metadata?.origem!=='caixa_obra');
 const eventIds=new Set(entries.map(e=>e.id));
 const ids=new Set([...entries.map(e=>e.transactionId),...report.allocations.filter(a=>a.status==='active'&&eventIds.has(a.eventId)).map(a=>a.transactionId)].filter(Boolean).map(String));
 const transactions=(data.transacoes||[]).filter(t=>active(t)&&ids.has(String(t.id)));
 const accounts=new Set(transactions.map(t=>t.contaBancariaId).filter(Boolean));
 return {invoiceId:invoice.id,obraId:invoice.obraId||'',label:`Documento ${invoice.numero||invoice.id}`,
  accountId:transactions.length?(accounts.size===1?[...accounts][0]:''):invoice.contaBancariaId||'',transactionIds:[...ids],hasPayments:entries.length>0};
}
