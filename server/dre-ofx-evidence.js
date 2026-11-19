import {chaveTransacao,parseOFX} from '../src/domains/conciliacao/calculations.js';
import {validBankOriginal} from '../src/domains/conciliacao/import-reversal.js';
import {accountMoneyCents} from '../src/domains/financeiro/account-cash.js';
import {isFinancialDate} from '../src/domains/financeiro/dates.js';
import {active} from '../src/domains/financeiro/facts.js';
import {matchesStatementAccount} from '../src/domains/conciliacao/transaction-commands.js';

const field=(source,name)=>source.match(new RegExp(`<${name}>\\s*([^<\\r\\n]*)`,'i'))?.[1].trim()||'';
const ofxDate=value=>/^(\d{4})(\d{2})(\d{2})(?:\d|$)/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:'';
const block=(source,name)=>[...source.matchAll(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`,'gi'))];

function readStatement(statement,movements){
  const accountId=String(statement.contaBancariaId||'');
  if(!statement.id||!active(statement)||statement.importReversals?.length||!movements.length
    ||!/\.(?:ofx|qfx)$/i.test(statement.arquivo||'')||!validBankOriginal(statement.originalFile))return null;
  const source=Buffer.from(statement.originalFile.dataUrl.split(',')[1],'base64').toString('latin1');
  const responses=block(source,'STMTRS');
  if(responses.length!==1)return null;
  const response=responses[0][1], lists=block(response,'BANKTRANLIST'), balances=block(response,'LEDGERBAL');
  if(lists.length!==1||balances.length!==1||field(response,'CURDEF')!=='BRL'
    ||!field(response,'BANKID')||!field(response,'ACCTID')||field(response,'ACCTID')!==String(statement.conta||''))return null;
  const start=ofxDate(field(lists[0][1],'DTSTART')),end=ofxDate(field(lists[0][1],'DTEND'));
  const balance=field(balances[0][1],'BALAMT');
  const cents=/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(balance)?accountMoneyCents(balance.replace(',','.')):null;
  if(!isFinancialDate(start)||!isFinancialDate(end)||start>end||ofxDate(field(balances[0][1],'DTASOF'))!==end||cents===null)return null;
  const records=parseOFX(lists[0][1]).trans,keys=new Set();
  if(records.length!==movements.length||records.length!==block(lists[0][1],'STMTTRN').length)return null;
  if(movements.some(item=>!item.id)||new Set(movements.map(item=>String(item.id))).size!==movements.length)return null;
  const imported=new Map(movements.map(item=>[item.chave,item]));
  for(const record of records){
    const key=chaveTransacao(record),item=imported.get(key);
    if(keys.has(key)||!item||!active(item)||item.importReversal||String(item.contaBancariaId||'')!==accountId
      ||!isFinancialDate(record.data)||record.data<start||record.data>end||item.data!==record.data
      ||accountMoneyCents(record.valor)===null||accountMoneyCents(item.valor)!==accountMoneyCents(record.valor))return null;
    keys.add(key);
  }
  return {id:String(statement.id),start,end,balanceCents:cents,count:records.length,...(accountId?{accountId}:{})};
}

export function verifiedOfxEvidence(data){
  const byStatement=new Map();
  for(const item of data.transacoes||[]){
    if(!item.extratoId)continue;
    const movements=byStatement.get(item.extratoId)||[];
    movements.push(item);
    byStatement.set(item.extratoId,movements);
  }
  const accounts=new Map((data.contasBancarias||[]).map(account=>[String(account.id),account]));
  return (data.extratos||[]).map(statement=>{
    if(statement.contaBancariaId&&!matchesStatementAccount(statement,accounts.get(String(statement.contaBancariaId)),{allowInactive:true}))return null;
    return readStatement(statement,byStatement.get(statement.id)||[]);
  }).filter(Boolean);
}

export const unassignedOfxEvidence=data=>verifiedOfxEvidence(data).filter(item=>!item.accountId);
