import {it,expect} from 'vitest';
import {forecastCash} from './cash-forecast.js';
import {buildFinancialLedger} from './ledger.js';
const data={medicoes:[{id:'m',obraId:'a',dataEmissao:'2026-10-01',competencia:'2026-10',dataVencimento:'2026-10-31',valorPrevisto:100,recebimentos:[{id:'r',data:'2026-10-10',valor:20}]},{id:'other',obraId:'b',dataEmissao:'2026-10-01',competencia:'2026-10',dataVencimento:'2026-10-31',valorPrevisto:999}],notasFiscais:[{id:'n',obraId:'a',emissao:'2026-10-01',vencimento:'2026-10-30',status:'aprovada',valorBruto:50}]};
it('projeta saldo parcial por obra e identifica primeira insuficiência',()=>{const f=forecastCash(data,buildFinancialLedger(data),{today:'2026-10-30',obraId:'a',days:7,openingCents:1000});expect(f.rows[0].balance).toBe(-4000);expect(f.rows[1].incoming).toBe(8000);expect(f.lowest.date).toBe('2026-10-30');});
it('cenário atrasa recebimentos sem alterar fatos e não incorpora atrasados silenciosamente',()=>{const ledger=buildFinancialLedger(data),before=JSON.stringify(data);const f=forecastCash(data,ledger,{today:'2026-11-01',days:7});expect(f.overdue.length).toBe(3);expect(f.rows[0].incoming).toBe(0);const sim=forecastCash(data,ledger,{today:'2026-10-30',obraId:'a',days:7,receiptDelay:7});expect(sim.rows.every(r=>!r.incoming)).toBe(true);expect(JSON.stringify(data)).toBe(before);});
it('mantém vencimento impossível para conferência sem deslocar o título para outro dia',()=>{
 const d={medicoes:[{id:'bad',obraId:'a',dataEmissao:'2026-02-01',dataVencimento:'2026-02-30',valorPrevisto:100}]};
 const f=forecastCash(d,buildFinancialLedger(d),{today:'2026-02-28',days:7,receiptDelay:7,includeOverdue:true});
 expect(f.undated).toHaveLength(1);expect(f.undated[0].dueDate).toBe('');expect(f.undated[0].metadata).toMatchObject({vencimento:'2026-02-30',vencimentoInvalido:true});expect(f.rows.every(r=>r.incoming===0)).toBe(true);
});
it('não transforma saldo desconhecido em zero e aceita zero explicitamente',()=>{
 const ledger=buildFinancialLedger(data);
 const unknown=forecastCash(data,ledger,{today:'2026-10-30',obraId:'a',days:7});
 expect(unknown.rows[0].outgoing).toBe(5000);expect(unknown.rows.every(r=>r.balance===null)).toBe(true);expect(unknown.lowest).toBeNull();expect(unknown.firstNegative).toBeUndefined();
 const zero=forecastCash(data,ledger,{today:'2026-10-30',obraId:'a',days:7,openingCents:0});expect(zero.rows[0].balance).toBe(-5000);expect(zero.firstNegative.date).toBe('2026-10-30');
});
it('filtra contas previstas explícitas, separa os sem conta e não infere de liquidações',()=>{
 const d=structuredClone(data);d.medicoes[0].contaBancariaId='bank-a';d.notasFiscais[0].contaBancariaId='bank-b';
 d.medicoes[1].recebimentos=[{id:'old',data:'2026-10-01',valor:1,contaBancariaId:'bank-a'}];
 d.medicoes[1].accountId='chart-of-accounts-entry';
 const before=JSON.stringify(d),ledger=buildFinancialLedger(d);
 const a=forecastCash(d,ledger,{today:'2026-10-30',days:7,account:'bank-a'});
 expect(a.rows.reduce((s,r)=>s+r.incoming,0)).toBe(8000);expect(a.rows.every(r=>!r.outgoing)).toBe(true);expect(a.unassigned).toHaveLength(1);expect(a.excludedAccountCount).toBe(2);
 const none=forecastCash(d,ledger,{today:'2026-10-30',days:7,account:'unassigned'});
 expect(none.rows.reduce((s,r)=>s+r.incoming,0)).toBe(99800);expect(JSON.stringify(d)).toBe(before);
});
