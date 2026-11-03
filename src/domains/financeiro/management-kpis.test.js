import {it,expect} from 'vitest';
import {managementKpis,managementKpiTotals} from './management-kpis.js';
const run=(patch={})=>managementKpis({receivable:[],payable:[],commitments:[],asOf:'2026-11-02',incurred:50000,earned:40000,budget:100000,finalCost:110000,...patch});
it('usa saldos residuais, exclui hoje e sem data da inadimplência e separa faixas',()=>{
 const result=run({receivable:[{amountCents:20000,dueDate:'2026-10-03'},{amountCents:10000,dueDate:'2026-10-02'},{amountCents:30000,dueDate:'2026-11-02'},{amountCents:40000,dueDate:'2026-11-10'},{amountCents:5000,dueDate:'2026-02-30'}]}).receivables;
 expect(result).toMatchObject({totalCents:105000,datedCents:100000,overdueCents:30000,ratio:.3,undatedCents:5000,undatedCount:1});expect(result.aging[0]).toMatchObject({amountCents:20000,count:1});expect(result.aging[1]).toMatchObject({amountCents:10000,count:1});
});
it('sem base datada não presume inadimplência percentual zero; saldo de um centavo permanece',()=>{
 expect(run().receivables.ratio).toBeNull();expect(run({receivable:[{amountCents:1,dueDate:'2026-11-01'}]}).receivables.ratio).toBe(1);
});
it('confere as fronteiras das faixas e conta o dia bissexto',()=>{
 const dates=['2026-03-02','2026-03-01','2026-01-31','2026-01-30','2026-01-01','2025-12-31'];
 expect(run({asOf:'2026-04-01',receivable:dates.map(dueDate=>({dueDate,amountCents:1}))}).receivables.titles.map(item=>item.bucket)).toEqual(['1 a 30 dias','31 a 60 dias','31 a 60 dias','61 a 90 dias','61 a 90 dias','Mais de 90 dias']);
 expect(run({asOf:'2024-03-01',receivable:[{dueDate:'2024-02-29',amountCents:1}]}).receivables.titles[0].overdueDays).toBe(1);
});
it('mantém compra a faturar e contas a pagar separados, sem somar ao custo',()=>{const model=run({commitments:[{amountCents:60000}],payable:[{amountCents:20000}]});expect(model.purchases).toMatchObject({openCents:60000,payableCents:20000});expect(model.variance).toMatchObject({actual:50000,cv:-10000,vac:-10000});});
it('CV exige valor agregado comparável, enquanto VAC pode existir com previsão válida',()=>{expect(run({earned:null,cpiReason:'Mês em andamento'}).variance).toMatchObject({cv:null,vac:-10000,reason:'Mês em andamento'});expect(run({earned:0,incurred:0}).variance.cv).toBe(0);});
it('não soma uma carteira parcialmente comparável como se fosse completa e pondera a razão',()=>{
 const first=run({receivable:[{amountCents:10000,dueDate:'2026-11-01'}]}),second=run({earned:null,receivable:[{amountCents:90000,dueDate:'2026-11-20'}]});
 expect(managementKpiTotals([{managementKpis:first},{managementKpis:second}])).toMatchObject({ratio:.1,cv:null,comparableWorks:1,workCount:2});
});
it('centavos inválidos ou totais inseguros ficam indisponíveis, preservando a origem',()=>{
 const source=[{amountCents:Number.MAX_SAFE_INTEGER,dueDate:'2026-11-01'},{amountCents:1,dueDate:'2026-11-01'}],before=JSON.stringify(source);expect(run({receivable:source}).receivables.overdueCents).toBeNull();expect(run({commitments:[{amountCents:-1}]}).purchases.openCents).toBeNull();expect(JSON.stringify(source)).toBe(before);
});
