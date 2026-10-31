import {active} from './ledger.js';
import {isFinancialDate} from './dates.js';

export function bankFreshness(data,accountId,referenceDate){
 const movements=(data.transacoes||[]).filter(t=>active(t)&&String(t.contaBancariaId||'')===String(accountId)&&accountId);
 const statementIds=new Set(movements.map(t=>String(t.extratoId||'')));
 const statements=(data.extratos||[]).filter(s=>String(s.contaBancariaId||'')===String(accountId)&&accountId||(!s.contaBancariaId&&statementIds.has(String(s.id))));
 const latestMovement=movements.map(t=>t.data).filter(isFinancialDate).sort().at(-1)||null;
 const imports=statements.map(s=>s.importadoEm).filter(value=>typeof value==='string'&&isFinancialDate(value.slice(0,10))&&(/^\d{4}-\d{2}-\d{2}$/.test(value)||(/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value)))));
 const latestImport=imports.sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null;
 return {latestMovement,latestImport,movementCount:movements.length,statementCount:statements.length,
  referenceAfterLatest:isFinancialDate(referenceDate)&&Boolean(latestMovement)&&referenceDate>latestMovement};
}
