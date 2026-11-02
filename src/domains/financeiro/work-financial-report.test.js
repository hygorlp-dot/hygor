import {expect,it,vi} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {buildWorkFinancialReport,workFinancialCsv,workFinancialPrint,workFinancialSheets} from './work-financial-report.js';

const data={obras:[{id:'a',name:'Obra Alfa'},{id:'b',name:'Obra Beta'}],notasFiscais:[{id:'n',obraId:'a',numero:'NF-1',status:'aprovada',competencia:'2026-10',emissao:'2026-11-01',vencimento:'2026-10-31',categoria:'material',valorBruto:100,valorLiquido:100,pagamentos:[{id:'p',valor:30,data:'2026-10-15'},{id:'c',valor:10,data:'2026-10-16',origem:'cliente_direto'}]}],medicoes:[{id:'m',obraId:'a',competencia:'2026-10',dataEmissao:'2026-10-01',dataVencimento:'2026-10-31',valorPrevisto:200,recebimentos:[{id:'r',valor:50,data:'2026-10-15'}]},{id:'foreign',obraId:'b',competencia:'2026-10',valorPrevisto:999}],orcamentos:[]};
const calc=(d,year,month,obraId)=>({selected:{moData:{laborCost:120,benefitCost:10,chargesCost:20},ledger:buildFinancialLedger(d,{supplementalEvents:[{id:`labor-${obraId}-${month}`,effect:'cost',obraId,competence:`${year}-${String(month+1).padStart(2,'0')}`,date:`${year}-${String(month+1).padStart(2,'0')}-28`,amountCents:12000,category:'mao_obra',sourceType:'ponto'},{id:`benefit-${obraId}-${month}`,effect:'cost',obraId,competence:`${year}-${String(month+1).padStart(2,'0')}`,date:`${year}-${String(month+1).padStart(2,'0')}-28`,amountCents:1000,category:'beneficios',sourceType:'ponto'}]})}});
const options={obraId:'a',start:'2026-10',end:'2026-10'};
it('reconcilia custos e mão de obra com o razão sem somar encargos novamente nem duplicar pagamentos',()=>{
 const before=JSON.stringify(data),r=buildWorkFinancialReport(data,calc,options);
 expect(r.summary).toMatchObject({cost:23000,labor:13000,revenue:20000,result:-3000,cashIn:5000,cashOut:3000,clientPaid:1000,payable:0,receivable:15000});
 expect(r.costs.reduce((s,e)=>s+e.amountCents,0)).toBe(r.summary.cost);expect(r.costs.find(e=>e.sourceType==='ponto').record.calculation['Encargos identificáveis já incluídos (R$)']).toBe(20);expect(JSON.stringify(data)).toBe(before);
});
it('deduplica origens entre meses e preserva componentes mensais diferentes',()=>{
 const r=buildWorkFinancialReport(data,calc,{...options,end:'2026-11'});
 expect(r.costs.filter(e=>e.sourceId==='n')).toHaveLength(1);expect(r.summary.cost).toBe(36000);expect(r.monthly.map(m=>m.labor)).toEqual([13000,13000]);expect(r.costs.some(e=>e.obraId==='b')).toBe(false);
 expect(r.summary.payable).toBe(6000); // posição só reconhece o título emitido em novembro
});
it('preserva estorno negativo e não escolhe etapa em rateios ambíguos',()=>{
 const d=structuredClone(data);d.notasFiscais[0].rateios=[{id:'one',obraId:'a',valor:50,etapaId:'x'},{id:'two',obraId:'a',valor:50,etapaId:'y'}];
 const wrapped=(...args)=>{const result=calc(...args);result.selected.ledger.events.push({id:'reversal',effect:'cost_reversal',sourceType:'outra_despesa',sourceId:'old',obraId:'a',competence:'2026-10',amountCents:2000,category:'material'});return result;};
 const r=buildWorkFinancialReport(d,wrapped,options);expect(r.summary.cost).toBe(21000);expect(r.categories.find(g=>g.id==='material').amountCents).toBe(8000);expect(r.costs.find(e=>e.id==='reversal').amountCents).toBe(-2000);
 expect(r.cashOut[0].stageId).toBe('');
});
it('rejeita obra ausente e intervalo inválido antes de acessar o cálculo',()=>{
 const fn=vi.fn();expect(buildWorkFinancialReport(data,fn,{...options,obraId:'all'}).error).toContain('Selecione');expect(buildWorkFinancialReport(data,fn,{...options,start:'2026-13'}).error).toContain('competências');expect(buildWorkFinancialReport(data,fn,{...options,start:'2010-01'}).error).toContain('dez anos');expect(fn).not.toHaveBeenCalled();
});
it('exporta todas as bases com os mesmos totais e escapa HTML e fórmulas',()=>{
 const r=buildWorkFinancialReport(data,calc,options),sheets=workFinancialSheets(r);expect(sheets.Custos.length).toBe(r.costs.length+1);expect(sheets.Resumo).toContainEqual(['Custos',230]);expect(sheets.Recorte).toContainEqual(['Obra','Obra Alfa']);expect(workFinancialCsv(r)).not.toContain('Obra Beta');
 r.costs[0].description='<script>alert(1)</script>';expect(workFinancialPrint(r)).toContain('&lt;script&gt;');expect(workFinancialPrint(r)).not.toContain('<script>alert');r.costs[0].description='=1+1';expect(workFinancialCsv(r)).toContain("'=1+1");
});
