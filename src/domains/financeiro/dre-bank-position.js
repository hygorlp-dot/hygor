import {accountCashPosition,accountMoneyCents} from './account-cash.js';
import {isFinancialDate} from './dates.js';
import {active} from './facts.js';

const sameAccount=(item,id)=>String(item.contaBancariaId||'')===id;
const isAporte=value=>['capital_socio','aporte_socio'].includes(value);
const previousDay=date=>new Date(Date.parse(`${date}T00:00:00Z`)-86400000).toISOString().slice(0,10);
const nextDay=date=>new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);

export function dreBankPeriod(year,month,today){
  const start=`${year}-${String(month+1).padStart(2,'0')}-01`;
  const monthEnd=new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);
  return {start,end:today<monthEnd?today:monthEnd};
}

function bankFigures(data,accountId,start,end){
  const summary=accountCashPosition(data,{accountId,opening:0,openingDate:start,referenceDate:end});
  const identities=new Set();
  const duplicate=summary.movements.some(({transaction})=>{
    const identity=transaction.fitid?`fitid:${transaction.fitid}`:transaction.chave;
    if(!identity)return false;
    if(identities.has(identity))return true;
    identities.add(identity);
    return false;
  });
  return {...summary,complete:summary.canCalculate&&!duplicate};
}

function shareholderContributions(movements,records){
  const byTransaction=new Map();
  for(const record of records){
    if(!active(record)||!record.transacaoId||(!isAporte(record.categoria)&&!isAporte(record.naturezaEntrada)))continue;
    const key=String(record.transacaoId);
    const list=byTransaction.get(key)||[];
    list.push(record);
    byTransaction.set(key,list);
  }
  let total=0;
  for(const {transaction,cents} of movements){
    if(cents<=0||transaction.vinculo?.tipo==='transferencia_interna')continue;
    const allocations=transaction.rateios||[];
    const linked=byTransaction.get(String(transaction.id))||[];
    const classified=allocations.length
      ? allocations.filter(row=>isAporte(row.categoria||row.category))
      : linked;
    if(!classified.length){
      if(!allocations.length&&isAporte(transaction.categoria))total+=cents;
      continue;
    }
    const amounts=classified.map(record=>accountMoneyCents(record.valor??record.value));
    const amount=amounts.reduce((sum,value)=>sum+value,0);
    if(amounts.some(value=>value===null||value<=0)||!Number.isSafeInteger(amount)||amount>cents)return null;
    total+=amount;
  }
  return Number.isSafeInteger(total)?total:null;
}

export function dreBankPosition(data,accountId,{start,end}){
  const unavailable={opening:null,ending:null,asOf:null,state:'missing'};
  if(!isFinancialDate(start)||!isFinancialDate(end)||start>end)return {...unavailable,state:'future'};

  const archived=new Set((data.extratos||[]).filter(statement=>['arquivado','archived'].includes(statement.status)).map(statement=>String(statement.id)));
  // Arquivar tira da fila de trabalho. Só a reversão invalida o movimento bancário.
  const bankData={transacoes:(data.transacoes||[]).filter(transaction=>!transaction.importReversal)};
  const figures=bankFigures(bankData,accountId,start,end);
  const result={...unavailable,incoming:figures.complete?figures.incoming:null,outgoing:figures.complete?figures.outgoing:null,
    contributions:figures.complete?shareholderContributions(figures.movements,data.caixaObra||[]):null,
    movements:figures.movements.length,pending:figures.pending.filter(({transaction})=>!archived.has(String(transaction.extratoId))).length,
    archived:figures.movements.filter(({transaction})=>archived.has(String(transaction.extratoId))).length};
  if(!figures.complete)return {...result,state:'invalid'};

  // Só fechamentos com saldo informado pelo banco podem servir de referência.
  const closing=(data.fechamentosBancarios||[]).filter(item=>sameAccount(item,accountId)&&item.status==='fechado'
    &&isFinancialDate(item.dataInicio)&&isFinancialDate(item.dataFim)&&item.dataInicio<=item.dataFim);
  const anchors=closing.filter(item=>Number.isSafeInteger(item.saldoBancoCentavos));
  const endAnchors=anchors.filter(item=>item.dataFim===end);
  const balanceAtEnd=new Set(endAnchors.map(item=>item.saldoBancoCentavos));
  if(balanceAtEnd.size>1||endAnchors.some(item=>item.saldoCalculadoCentavos!==item.saldoBancoCentavos))return {...result,state:'divergent'};
  const samePeriod=endAnchors.filter(item=>item.dataInicio===start);
  if(samePeriod.length){
    const openingValues=new Set(samePeriod.map(item=>item.saldoInicialCentavos));
    const [opening]=openingValues, [ending]=balanceAtEnd;
    const adjacent=anchors.filter(item=>item.dataFim===previousDay(start));
    if(openingValues.size!==1||!Number.isSafeInteger(opening)||opening+figures.balanceCents!==ending
      ||adjacent.some(item=>item.saldoBancoCentavos!==opening||item.saldoCalculadoCentavos!==opening)
      ||samePeriod.some(item=>item.creditosCentavos!==figures.incoming||item.debitosCentavos!==figures.outgoing))return {...result,state:'divergent'};
    return {...result,opening,ending,asOf:end,state:'checked'};
  }

  const openingDate=anchors.filter(item=>item.dataFim<start).map(item=>item.dataFim).sort().at(-1);
  if(!openingDate)return result;
  const openingAnchors=anchors.filter(item=>item.dataFim===openingDate);
  const openingBalances=new Set(openingAnchors.map(item=>item.saldoBancoCentavos));
  if(openingBalances.size!==1||openingAnchors.some(item=>item.saldoCalculadoCentavos!==item.saldoBancoCentavos))return {...result,state:'divergent'};
  const [base]=openingBalances;
  const beforePeriod=openingDate===previousDay(start)?0:bankFigures(bankData,accountId,nextDay(openingDate),previousDay(start));
  const fullWindow=bankFigures(bankData,accountId,nextDay(openingDate),end);
  if(!fullWindow.complete||beforePeriod!==0&&!beforePeriod.complete)return {...result,state:'invalid'};
  const opening=base+(beforePeriod===0?0:beforePeriod.balanceCents),ending=base+fullWindow.balanceCents;
  if(!Number.isSafeInteger(opening)||!Number.isSafeInteger(ending))return {...result,state:'invalid'};
  if(balanceAtEnd.size&&!balanceAtEnd.has(ending))return {...result,state:'divergent'};
  return {...result,opening,ending,asOf:balanceAtEnd.size?end:openingDate,
    state:balanceAtEnd.size&&openingDate===previousDay(start)?'checked':'estimated'};
}

export function dreOfxPosition(data,evidence,{start,end}){
  const reference=end<evidence.end?end:evidence.end;
  const statementRows=(data.transacoes||[]).filter(item=>String(item.extratoId)===evidence.id&&String(item.contaBancariaId||'')===String(evidence.accountId||'')&&!item.importReversal);
  const transacoes=statementRows.map(item=>({...item,contaBancariaId:'unassigned'}));
  const result=dreBankPosition({...data,transacoes,fechamentosBancarios:[]},'unassigned',{start,end:reference});
  if(statementRows.length!==evidence.count)return {...result,state:'invalid'};
  if(result.state!=='missing')return result;
  const after=reference===evidence.end?null:bankFigures({transacoes},'unassigned',nextDay(reference),evidence.end);
  const ending=evidence.balanceCents-(after?.balanceCents??0);
  const opening=ending-result.incoming+result.outgoing;
  if((after&&!after.complete)||!Number.isSafeInteger(ending)||!Number.isSafeInteger(opening))return {...result,state:'invalid'};
  return {...result,opening,ending,reference,asOf:evidence.end,state:after?'statement-calculated':'statement'};
}

export function dreAccountPosition(data,accountId,period,evidence=[]){
  const position=dreBankPosition(data,accountId,period);
  if(!['missing','estimated','checked'].includes(position.state))return position;
  const candidates=evidence.filter(row=>row.accountId===accountId&&row.start<=period.start&&row.end>=period.start)
    .sort((a,b)=>b.end.localeCompare(a.end));
  for(const row of candidates){
    const reference=period.end<row.end?period.end:row.end;
    const overlap=(data.transacoes||[]).some(t=>sameAccount(t,accountId)&&active(t)&&!t.importReversal
      &&t.data>=period.start&&t.data<=row.end&&String(t.extratoId)!==row.id);
    if(overlap)continue;
    if(row.end<period.end&&(data.transacoes||[]).some(t=>sameAccount(t,accountId)&&active(t)&&!t.importReversal&&t.data>row.end&&t.data<=period.end))continue;
    const proof=dreOfxPosition(data,row,{...period,end:reference});
    if(proof.ending==null)continue;
    if(position.state==='checked')return reference===period.end&&proof.ending!==position.ending
      ?{...position,state:'divergent',opening:null,ending:null}:position;
    return proof;
  }
  return position;
}
