import {documentRegister} from './document-register.js';
import {dreAccountPosition} from './dre-bank-position.js';
import {isFinancialDate} from './dates.js';
import {active} from './facts.js';

const recognizedDocuments=new Set(['nota_fiscal','despesa_empresa','outra_despesa']);
const exceptionFingerprint=row=>JSON.stringify([row.id,row.record.version??null,row.entry.amountCents,row.entry.date,row.issues]);

export function monthlyClosingControls(data,{start,end},exception){
  if(!isFinancialDate(start)||!isFinancialDate(end)||start>end)return {ok:false,blockers:[],documents:[],exceptions:[],warnings:[]};
  const competence=start.slice(0,7);
  const documents=documentRegister(data,{competence}).filter(row=>row.issues.length);
  const blockers=[],exceptions=[],warnings=[];
  for(const row of documents){
    if(!recognizedDocuments.has(row.type)){warnings.push(row);continue;}
    if(row.record.id&&row.issues.length===1&&row.issues[0]==='missing'){
      exceptions.push({...row,fingerprint:exceptionFingerprint(row)});
    }else{
      blockers.push({code:'DOCUMENT_REVIEW',id:row.id,reason:'Confira a classificação, a duplicidade ou a situação do documento na Central.'});
    }
  }

  const bankRows=(data.transacoes||[]).filter(row=>active(row)&&!row.importReversal&&row.data>=start&&row.data<=end);
  const unassigned=bankRows.filter(row=>!row.contaBancariaId).length;
  const unreconciled=bankRows.filter(row=>['pendente','parcial',''].includes(String(row.status||''))).length;
  if(unassigned)blockers.push({code:'BANK_UNASSIGNED',count:unassigned,reason:'Vincule os movimentos sem conta pelo extrato de origem.'});
  if(unreconciled)blockers.push({code:'BANK_PENDING',count:unreconciled,reason:'Revise os movimentos pendentes ou parcialmente conciliados.'});

  const bankSource=data.dreBankSource||data;
  const bankData={...bankSource,transacoes:data.transacoes,caixaObra:data.caixaObra};
  const accountIds=new Set(bankRows.map(row=>String(row.contaBancariaId||'')).filter(Boolean));
  for(const id of accountIds){
    const account=(bankSource.contasBancarias||[]).find(row=>String(row.id)===id);
    const position=dreAccountPosition(bankData,id,{start,end},data.dreOfxEvidence);
    if(!account||!['checked','statement'].includes(position.state)||position.asOf!==end){
      blockers.push({code:'BANK_BALANCE_REQUIRED',id,account:account?.nome,reason:'Confira o saldo informado pelo banco no último dia da competência e a cobertura do período.'});
    }
  }

  const reason=typeof exception?.reason==='string'?exception.reason.trim():'';
  const fingerprints=exceptions.map(row=>row.fingerprint).sort();
  const supplied=Array.isArray(exception?.documents)?exception.documents:[];
  const accepted=Boolean(fingerprints.length&&reason.length>=15&&reason.length<=1000
    &&supplied.length===fingerprints.length&&supplied.every(item=>typeof item==='string')
    &&[...supplied].sort().every((item,index)=>item===fingerprints[index]));
  const approval=accepted?{reason,documentIds:exceptions.map(row=>row.id)}:null;
  return {ok:!blockers.length&&(!exceptions.length||accepted),blockers,documents,exceptions,warnings,approval};
}
