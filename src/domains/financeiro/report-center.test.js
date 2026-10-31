import {expect,it} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {buildFinancialReport,createReportLedger,reportFilterError,reportCategoryLabel} from './report-center.js';
import {financialReportSheets,reportCsv,reportPrintHtml,safeReportText} from './report-export.js';
const data={obras:[{id:'a',name:'Obra Alfa'},{id:'b',name:'Obra Beta'}],contasBancarias:[{id:'bank',nome:'Banco QA'}],transacoes:[{id:'tx',contaBancariaId:'bank',data:'2026-10-20',valor:50}],notasFiscais:[{id:'nf',obraId:'a',numero:'123',status:'aprovada',competencia:'2026-10',emissao:'2026-10-01',vencimento:'2026-10-31',categoria:'material',fornecedorNome:'Loja Alfa',valorBruto:100,valorLiquido:100,pagamentos:[{id:'company',valor:25,data:'2026-10-20'},{id:'direct',valor:10,data:'2026-10-21',origem:'cliente_direto'}]},{id:'undated',obraId:'a',status:'recebida',competencia:'2026-10',emissao:'2026-10-01',valorBruto:20}],medicoes:[{id:'ma',obraId:'a',descricao:'Medição Alfa',competencia:'2026-10',dataEmissao:'2026-11-01',dataVencimento:'2026-10-31',valorPrevisto:200,recebimentos:[{id:'receipt',valor:50,data:'2026-10-20',transacaoId:'tx'}]},{id:'mb',obraId:'b',descricao:'Medição Beta',competencia:'2026-10',dataEmissao:'2026-10-01',valorPrevisto:999}]};
const filters={kind:'result',group:'work',obraId:'a',start:'2026-10-01',end:'2026-10-31',asOf:'2026-11-05',direction:'all',category:'all',status:'all',account:'all',query:'',includeUndated:false};
const bundle={ledger:buildFinancialLedger(data),extra:[]};
it('apresenta as categorias do razão com nomes legíveis sem mudar os identificadores',()=>{
 expect(['faturamento','compras','aporte','beneficios'].map(reportCategoryLabel)).toEqual(['Faturamento','Compras','Aportes','Benefícios']);
});
it('relatório e exportação incluem vencimento impossível somente na conferência dos sem data',()=>{
 const d={medicoes:[{id:'bad',obraId:'a',dataEmissao:'2026-02-01',dataVencimento:'2026-02-30',valorPrevisto:100}]};
 const bundle={ledger:buildFinancialLedger(d),extra:[]},f={...filters,kind:'due',start:'2026-02-01',end:'2026-02-28',asOf:'2026-02-28'};
 expect(buildFinancialReport(d,bundle,f).entries).toHaveLength(0);
 const result=buildFinancialReport(d,bundle,{...f,includeUndated:true});
 expect(result.entries).toHaveLength(1);expect(result.entries[0]).toMatchObject({dueDate:'',metadata:{vencimentoInvalido:true}});
 expect(reportCsv(result)).toContain('100');
});
const report=(overrides={})=>buildFinancialReport(data,bundle,{...filters,...overrides},'2026-10-30T15:00:00Z');

it('resultado segue competência mesmo com emissão posterior; caixa segue a data efetiva',()=>{
 expect(report().summary).toEqual({incoming:20000,outgoing:12000,net:8000});
 expect(report({kind:'cash'}).summary).toEqual({incoming:5000,outgoing:2500,net:2500});
 expect(report({kind:'cash',start:'2026-10-22'}).entries).toHaveLength(0);
});
it('obra, categoria, direção e busca filtram a mesma composição e seus grupos',()=>{
 const filtered=report({direction:'out',category:'material',query:'Loja Alfa',group:'counterparty'});
 expect(filtered.entries).toHaveLength(1);expect(filtered.summary.net).toBe(-10000);
 expect(filtered.groups[0].items).toEqual(filtered.entries);
 expect(report({obraId:'b'}).summary.incoming).toBe(99900);
});
it('conta de caixa depende de vínculo bancário; sem conta permanece identificável',()=>{
 expect(report({kind:'cash',account:'bank'}).summary.incoming).toBe(5000);
 expect(report({kind:'cash',account:'bank'}).summary.outgoing).toBe(0);
 expect(report({kind:'cash',account:'unlinked'}).summary.outgoing).toBe(2500);
 expect(report({account:'bank'}).error).toMatch(/somente ao caixa/);
});
it('posição usa pagamentos até a referência; vencidos incluem saldos parciais',()=>{
 const before=report({kind:'due',asOf:'2026-10-15',direction:'out'});
 expect(before.summary.outgoing).toBe(10000);
 const after=report({kind:'due',direction:'out',status:'vencido'});
 expect(after.summary.outgoing).toBe(6500);expect(after.entries[0].statusLabel).toBe('Parcial e vencido');
 expect(report({kind:'due',includeUndated:true,direction:'out'}).summary.outgoing).toBe(8500);
 expect(report({kind:'due',direction:'out'}).undated).toBe(1);
});
it('exporta resumo e todos os detalhes do mesmo recorte, com base e busca explícitas',()=>{
 const selected=report({query:'Loja Alfa',group:'category'}),sheets=financialReportSheets(selected);
 expect(sheets.Lançamentos).toHaveLength(selected.entries.length+1);
 expect(sheets.Resumo.at(-1)[3]).toBe(selected.summary.net/100);
 expect(sheets.Recorte).toContainEqual(['Busca','Loja Alfa']);
 expect(reportCsv(selected)).toContain('Base de cálculo');expect(reportPrintHtml(selected)).toContain('Loja Alfa');
 expect(reportCsv(selected)).not.toContain('Medição Beta');
});
it('evita fórmulas em planilhas e HTML executável nos textos dos relatórios',()=>{
 for(const value of ['=1+1',' +SUM(A1)','@command','\t=1','-cmd'])expect(safeReportText(value)).toMatch(/^'/);
 const selected=report();selected.entries[0]={...selected.entries[0],description:'<script>alert(1)</script>'};
 expect(reportPrintHtml(selected)).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
 expect(reportPrintHtml(selected)).not.toContain('<script>alert(1)</script>');
});
it('rejeita datas impossíveis e intervalos acima de 12 meses antes de calcular',()=>{
 expect(reportFilterError({...filters,start:'2026-02-31'})).toBeTruthy();
 expect(reportFilterError({...filters,start:'2025-10-01'})).toMatch(/12 meses/);
 expect(createReportLedger(data,()=>{throw new Error('não deveria calcular');},{...filters,start:''}).ledger.events).toEqual([]);
});
it('combina competências sem duplicar fatos comuns e mantém equipamentos por mês',()=>{
 const calc=(source,year,month)=>({selected:{ledger:bundle.ledger,per0:`${year}-${String(month+1).padStart(2,'0')}-01`,perF:`${year}-${String(month+1).padStart(2,'0')}-28`,equipReceita:10,equipCustoEmpresa:3}});
 const range={...filters,obraId:'all',end:'2026-11-30'};
 const combined=createReportLedger(data,calc,range);
 expect(combined.ledger.events).toHaveLength(bundle.ledger.events.length);
 expect(combined.extra).toHaveLength(4);
 expect(new Set(combined.extra.map(item=>item.id)).size).toBe(4);
 expect(buildFinancialReport(data,combined,range).summary.incoming).toBe(121900);
});
it('exporta grupos e lançamentos além de uma página de 50 registros',()=>{
 const events=Array.from({length:65},(_,index)=>({id:`line-${index}`,effect:'cost',amountCents:100,date:'2026-10-10',competence:'2026-10',obraId:'a',category:'software',sourceType:'expense',sourceId:`source-${index}`,description:`Descrição ${index}`,counterparty:`Fornecedor ${index}`}));
 const selected=buildFinancialReport(data,{ledger:{events},extra:[]},{...filters,group:'counterparty'});
 expect(selected.groups).toHaveLength(65);
 expect(financialReportSheets(selected).Lançamentos).toHaveLength(66);
 expect(financialReportSheets(selected).Resumo).toHaveLength(67);
 expect(selected.summary.outgoing).toBe(6500);
});
it('agrupa despesas da empresa pelo fornecedor do cadastro legado',()=>{
 const company={...data,despesasEmpresa:[{id:'corporate',competencia:'2026-10',descricao:'Sistema corporativo',categoria:'software',fornecedor:'Fornecedor corporativo',valor:30}]};
 const selected=buildFinancialReport(company,{ledger:buildFinancialLedger(company),extra:[]},{...filters,obraId:'all',group:'counterparty',query:'Fornecedor corporativo'});
 expect(selected.groups[0].label).toBe('Fornecedor corporativo');expect(selected.summary.outgoing).toBe(3000);
});
