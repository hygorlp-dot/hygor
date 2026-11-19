import {active,toCents} from './ledger.js';
import {documentIssueLabels} from './document-register.js';
import {documentEvidenceInfo} from './document-evidence.js';
import {analyzePurchaseThreeWayMatch} from './workflows.js';
import {extrairContraparteDescricaoPix} from '../conciliacao/calculations.js';

export const documentConferenceLabels={
 ...documentIssueLabels,
 bankEvidence:'Despesa bancária sem evidência',
 rateio:'Rateio divergente',
 purchase:'Pedido ou recebimento a conferir',
};

const same=(a,b)=>Boolean(a&&b)&&String(a)===String(b);
const resolvable=documents=>documents.some(document=>document&&documentEvidenceInfo(document).resolvable);
const expenseTypes=new Set(['despesa_empresa','outra_despesa']);

export function documentConferenceRows(data,rows){
 const purchases=new Map((data.pedidos||[]).filter(active).map(order=>[String(order.id),order]));
 const bank=new Map((data.transacoes||[]).filter(item=>active(item)&&!item.importReversal).map(item=>[String(item.id),item]));
 const exceptions=new Map();
 for(const closing of data.fechamentosFinanceiros||[]){
  if(closing.status==='fechado')for(const id of closing.documentException?.documentIds||[]){
   exceptions.set(JSON.stringify([closing.competencia,id]),closing.documentException);
  }
 }
 const purchaseMatches=new Map();
 return rows.map(row=>{
  const record=row.record;
  const issues=[...row.issues];
  const transaction=expenseTypes.has(row.type)?bank.get(String(record.transacaoId||'')):null;
  const expense=expenseTypes.has(row.type);
  const exception=expense?exceptions.get(JSON.stringify([row.period,row.id])):undefined;
  if(expense&&(record.transacaoId||record.origem==='banco')&&issues.includes('missing')&&!exception){
   issues.push('bankEvidence');
  }
  if(row.type!=='nota_fiscal'){
   const pixName=expense&&!row.entry.counterparty?.trim()&&(record.transacaoId||record.origem==='banco')
    ?extrairContraparteDescricaoPix(transaction?.descricao||row.entry.description.replace(/^\[Extrato\]\s*/i,''),{aceitarNomeAlfanumerico:true})
    :'';
   return {...row,issues,transaction,exception,pixName};
  }
  const originals=[...(record.documentos||[]),...(row.entry.documents||[])];
  if(!resolvable(originals)&&!issues.includes('missing'))issues.push('missing');
  const gross=toCents(record.valorBruto??record.valorTotal??record.valor);
  const allocations=record.rateios||[];
  const allocationTotal=allocations.reduce((sum,item)=>sum+toCents(item.valor),0);
  const allocationMismatch=allocations.length>0&&(Math.abs(gross-allocationTotal)>1||
   allocations.some(item=>!item.obraId||item.valor==null||item.valor===''||!Number.isFinite(Number(item.valor))||Number(item.valor)<0));
  if(allocationMismatch)issues.push('rateio');
  const order=purchases.get(String(record.pedidoId||''));
  if(order&&!purchaseMatches.has(order.id))purchaseMatches.set(order.id,analyzePurchaseThreeWayMatch(data,order.id));
  const match=order?purchaseMatches.get(order.id):null;
  if(record.pedidoId&&(!order||match.issues.length))issues.push('purchase');
  return {...row,issues,originals,order,match,gross,allocationTotal,allocationMismatch};
 });
}

export function bankExpenseContext(row,user){
 const transaction=row.transaction;
 if(!transaction||!expenseTypes.has(row.type)||!['admin','financeiro'].includes(user?.role)||
   (user.obraId&&!same(user.obraId,row.entry.obraId)))return null;
 return {obraId:row.entry.obraId||'',transactionIds:[transaction.id],accountId:transaction.contaBancariaId||'',
  label:row.entry.description};
}
