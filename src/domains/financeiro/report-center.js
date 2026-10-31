import {selectDRE,selectCashFlow,selectAccountsPayable,selectAccountsReceivable} from './ledger.js';
import {financialEntry,positionEntries,overviewEntries} from './workspace.js';
import {COMPANY_EXPENSE_CATEGORIES} from '../dre/expense-taxonomy.js';
import {isFinancialDate as dateValid} from './dates.js';
import {financialSearchText as norm} from './search.js';

export const REPORT_TYPES={
 result:{label:'Resultado por competência',incoming:'Receitas reconhecidas',outgoing:'Custos incorridos',net:'Resultado',basis:'Competência do fato financeiro',formula:'Receitas reconhecidas − custos incorridos, líquidos de estornos. Não representa saldo de caixa.'},
 cash:{label:'Caixa realizado',incoming:'Entradas realizadas',outgoing:'Saídas realizadas',net:'Movimento líquido',basis:'Data efetiva do movimento',formula:'Entradas − saídas realizadas no financeiro. Não inclui saldo inicial, títulos em aberto, pagamentos diretos do cliente ao fornecedor ou movimentos bancários ainda sem fato financeiro vinculado.'},
 due:{label:'Títulos em aberto por vencimento',incoming:'A receber',outgoing:'A pagar',net:'Posição líquida dos títulos',basis:'Vencimento, com saldo acumulado na data de posição',formula:'Saldo a receber − saldo a pagar na data de posição. Não representa saldo bancário nem recebimento garantido.'},
};
export const GROUP_LABELS={work:'Obra',category:'Categoria',counterparty:'Cliente / fornecedor'};
const categoryNames=new Map(COMPANY_EXPENSE_CATEGORIES.map(item=>[item.id,item.label]));
export const reportCategoryLabel=value=>categoryNames.get(value)||({material:'Materiais',mao_obra:'Mão de obra',beneficio:'Benefícios',beneficios:'Benefícios',terceirizado:'Terceirizados',equipamento:'Equipamentos',receita:'Receitas',equipamentos:'Equipamentos',faturamento:'Faturamento',compras:'Compras',aporte:'Aportes'})[value]||value||'Sem categoria';
export function reportFilterError(filters) {
 if(!REPORT_TYPES[filters.kind]||!GROUP_LABELS[filters.group])return 'Selecione um relatório e um agrupamento válidos.';
 if(!dateValid(filters.start)||!dateValid(filters.end)||filters.start>filters.end)return 'Informe um intervalo válido, com início anterior ou igual ao fim.';
 const months=(Number(filters.end.slice(0,4))-Number(filters.start.slice(0,4)))*12+Number(filters.end.slice(5,7))-Number(filters.start.slice(5,7));
 if(months>=12)return 'Consulte até 12 meses por relatório.';
 if(filters.kind==='due'&&!dateValid(filters.asOf))return 'Informe a data de posição dos títulos.';
 if(filters.kind!=='cash'&&filters.account!=='all')return 'O filtro de conta vinculada se aplica somente ao caixa realizado.';
 if(filters.kind!=='due'&&filters.status!=='all')return 'O filtro de situação se aplica somente aos títulos em aberto.';
 return '';
}

// Reuse the same monthly adapter as the financial overview, including labor
// and equipment. Merge event identities rather than summing monthly snapshots.
export function createReportLedger(data,calcPeriod,filters) {
 if(reportFilterError(filters))return {ledger:{events:[],issues:[]},extra:[]};
 const months=[];
 if(filters.kind==='due')months.push(filters.asOf.slice(0,7));
 else for(let month=filters.start.slice(0,7);month<=filters.end.slice(0,7);){months.push(month);const y=Number(month.slice(0,4)),m=Number(month.slice(5,7));month=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;}
 const events=new Map(),issues=new Map(),extra=[];
 for(const month of months){
  const view=calcPeriod(data,Number(month.slice(0,4)),Number(month.slice(5,7))-1,filters.obraId);
  for(const event of view.selected.ledger.events)events.set(event.id,event);
  for(const issue of view.selected.ledger.issues||[])issues.set(JSON.stringify(issue),issue);
  if(filters.kind==='result')for(const item of overviewEntries(data,view.selected,filters.obraId,'result').filter(item=>item.id.startsWith('equipment:'))){
   const direction=item.id.endsWith('revenue')?'in':'out';
   extra.push({...item,id:`${item.id}:${month}`,category:'equipamentos',direction,amountCents:direction==='in'?item.amountCents:-item.amountCents});
  }
 }
 return {ledger:{events:[...events.values()],issues:[...issues.values()]},extra};
}

export function buildFinancialReport(data,bundle,filters,generatedAt=new Date().toISOString()) {
 const definition=REPORT_TYPES[filters.kind],error=reportFilterError(filters);
 if(error)return {error,entries:[],groups:[],summary:{incoming:0,outgoing:0,net:0}};
 const scoped=filters.obraId==='all'?{}:{obraId:filters.obraId};
 const transactions=new Map((data.transacoes||[]).map(item=>[item.id,item]));
 let entries;
 if(filters.kind==='due'){
  entries=[...positionEntries(data,selectAccountsReceivable(bundle.ledger,{...scoped,asOfDate:filters.asOf})).map(item=>({...item,direction:'in'})),...positionEntries(data,selectAccountsPayable(bundle.ledger,{...scoped,asOfDate:filters.asOf})).map(item=>({...item,direction:'out'}))];
 }else{
  const events=filters.kind==='result'?selectDRE(bundle.ledger,{...scoped,startDate:filters.start.slice(0,7),endDate:filters.end.slice(0,7)}).events:selectCashFlow(bundle.ledger,{...scoped,startDate:filters.start,endDate:filters.end}).events;
  entries=events.map(event=>({...financialEntry(data,event),direction:['revenue','revenue_reversal','cash_in'].includes(event.effect)?'in':'out',amountCents:event.amountCents*(event.effect.endsWith('_reversal')?-1:1),status:event.effect.endsWith('_reversal')?'Estorno':filters.kind==='result'?'Reconhecido':'Realizado'}));
  if(filters.kind==='result')entries.push(...bundle.extra.map(item=>({...item,status:'Calculado pelo módulo de equipamentos'})));
 }
 entries=entries.map(item=>{
  const accountId=transactions.get(item.transactionId||item.metadata?.movimentoBancario?.id)?.contaBancariaId||'';
  const overdue=filters.kind==='due'&&item.dueDate&&item.dueDate<filters.asOf;
  const party=item.counterparty||item.record?.fornecedorNome||item.record?.fornecedor||(data.fornecedores||[]).find(supplier=>supplier.id===item.record?.fornecedorId)?.nome||item.record?.cliente||'';
  return {...item,overdue,counterparty:typeof party==='string'?party:party?.nome||party?.name||'',category:item.category||item.record?.categoria||'',accountId,account:(data.contasBancarias||[]).find(account=>account.id===accountId)?.nome||'Sem conta vinculada',categoryLabel:reportCategoryLabel(item.category||item.record?.categoria),statusLabel:item.status==='parcial'&&overdue?'Parcial e vencido':({aberto:'Em aberto',parcial:'Parcial',vencido:'Vencido',liquidado:'Liquidado com resíduo'})[item.status]||item.status||'Não informada'};
 }).filter(item=>(filters.direction==='all'||item.direction===filters.direction)&&(filters.category==='all'||(item.category||'unclassified')===filters.category)&&(filters.status==='all'||(filters.status==='vencido'?item.overdue:item.status===filters.status))&&(filters.account==='all'||(filters.account==='unlinked'?!item.accountId:item.accountId===filters.account))&&norm([item.description,item.obra,item.counterparty,item.documentNumber].join(' ')).includes(norm(filters.query).trim()));
 const undated=filters.kind==='due'?entries.filter(item=>!item.dueDate).length:0;
 if(filters.kind==='due')entries=entries.filter(item=>item.dueDate?item.dueDate>=filters.start&&item.dueDate<=filters.end:filters.includeUndated);
 entries.sort((a,b)=>String(filters.kind==='result'?a.competence:filters.kind==='due'?a.dueDate:a.date).localeCompare(String(filters.kind==='result'?b.competence:filters.kind==='due'?b.dueDate:b.date))||String(a.id).localeCompare(String(b.id)));
 const summary={incoming:0,outgoing:0,net:0},grouped=new Map();
 for(const item of entries){
  const label=filters.group==='work'?item.obra:filters.group==='category'?item.categoryLabel:item.counterparty||'Contraparte não informada';
  const key=filters.group==='work'?item.obraId||'company':filters.group==='category'?item.category||'unclassified':label;
  const group=grouped.get(key)||{id:key,label,items:[],incoming:0,outgoing:0,net:0};
  const metric=item.direction==='in'?'incoming':'outgoing';summary[metric]+=item.amountCents;group[metric]+=item.amountCents;group.items.push(item);group.net=group.incoming-group.outgoing;grouped.set(key,group);
 }
 summary.net=summary.incoming-summary.outgoing;
 const labels={report:definition.label,basis:definition.basis,formula:definition.formula,work:filters.obraId==='all'?'Todas as obras e empresa':(data.obras||[]).find(work=>work.id===filters.obraId)?.name||filters.obraId,period:filters.kind==='result'?`${filters.start.slice(0,7)} a ${filters.end.slice(0,7)}`:`${filters.start} a ${filters.end}`,group:GROUP_LABELS[filters.group],direction:filters.direction==='all'?'Todos':filters.direction==='in'?definition.incoming:definition.outgoing,category:filters.category==='all'?'Todas':reportCategoryLabel(filters.category==='unclassified'?'':filters.category),account:filters.account==='all'?'Todas':filters.account==='unlinked'?'Sem conta vinculada':(data.contasBancarias||[]).find(account=>account.id===filters.account)?.nome||filters.account,status:({all:'Todas',aberto:'Em aberto',parcial:'Parcial',vencido:'Vencido'})[filters.status]||filters.status};
 return {error:'',definition,labels,filters:{...filters},generatedAt,entries,groups:[...grouped.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')),summary,undated,source:'Base atual do ERP e adaptador compartilhado com a visão financeira. Snapshots de competências fechadas são consultados no DRE mensal/anual.'};
}
