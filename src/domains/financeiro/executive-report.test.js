import {describe,it,expect} from 'vitest';
import {executiveWorkReport,executiveReportSheets,executiveReportCsvRows} from './executive-report.js';
import {executiveReportPrintHtml} from './executive-report-export.js';
import {costAtCompletion,forecastCsv} from './management-forecasts.js';
function fixture(){return {
 obras:[{id:'a',name:'Obra Alfa',contractStart:'2026-10-01'}],
 budgetBaselines:[{obraId:'a',tipo:'controle',ativo:true,budgetId:'b'}],orcamentos:[{id:'b',obraId:'a',etapas:[{id:'s',nome:'Estrutura'}],itens:[{id:'i',tipo:'servico',descricao:'Alvenaria',etapaId:'s',quantidade:100,precoUnit:10,unidade:'m²'}]}],
 pedidos:[{id:'p',obraId:'a',status:'enviado',data:'2026-10-01',itens:[{id:'x',orcNivel1Id:'s',qtd:8,precoUnit:100,qtdRecebida:3}]}],
 notasFiscais:[{id:'n',pedidoId:'p',obraId:'a',etapaId:'s',status:'aprovada',competencia:'2026-10',emissao:'2026-10-01',vencimento:'2026-11-02',valorBruto:400,descricao:'Concreto conferido',pagamentos:[{id:'paid',valor:200,data:'2026-10-05'},{id:'direct',valor:50,data:'2026-10-06',origem:'cliente_direto'}]}],
 medicoes:[{id:'m',obraId:'a',dataEmissao:'2026-10-01',competencia:'2026-10',dataVencimento:'2026-11-07',valorPrevisto:1000,recebimentos:[{id:'receipt',data:'2026-10-08',valor:300}]}],
 rdos:[{id:'r',obraId:'a',data:'2026-10-30',status:'concluido',revisaoEngenheiro:{aprovado:true},servicos:[{budgetId:'b',budgetItemId:'i',budgetQuantity:100,unidade:'m²',quantidadeDia:40,progressoAte:40,equipe:[]}]}],
 employees:[],attendance:{},terceirizados:[],medicoesTerc:[],payments:[],equipamentos:[],locacoesEquip:[]};}
const run=(data,options={})=>executiveWorkReport(data,{workIds:['a'],start:'2026-10-01',asOf:'2026-10-31',generatedAt:'2026-11-02T15:00:00Z',...options});
describe('Dossiê executivo para a diretoria',()=>{
 // Decisão de 03/11: o avanço oficial (o da DRE e do painel) aparece ao lado do
 // avanço pelo diário, sem substituir o diário no valor agregado e no CPI.
 it('mostra o avanço oficial da medição ao lado do avanço pelo diário, sem mudar o CPI',()=>{
  const base=run(fixture()).rows[0];expect(base.officialPhysical).toBeNull();
  const data=fixture();data.medicoesObra=[{id:'mt',obraId:'a',status:'aprovada',avancoFisico:25}];
  const row=run(data).rows[0];
  expect(row.officialPhysical).toBe(0.25);expect(row.physical).toBe(base.physical);expect(row.cpi).toBe(base.cpi);expect(row.earned).toBe(base.earned);
  const sheets=executiveReportSheets(run(data));expect(sheets.Carteira[0]).toContain('Avanço oficial da medição');expect(sheets.Carteira[1]).toContain(0.25);
  expect(executiveReportPrintHtml(run(data))).toContain('Avanço oficial da medição');
 });
 it('concilia custo, categoria, etapa e anexo sem somar pedido e pagamentos novamente',()=>{const report=run(fixture()),row=report.rows[0];expect(row.incurred).toBe(40000);expect(row.entries.reduce((sum,entry)=>sum+entry.amountCents,0)).toBe(40000);expect(row.categories.reduce((sum,item)=>sum+item.amountCents,0)).toBe(40000);expect(row.cost.report.totals.incurred).toBe(40000);expect(row.finalCost).toBe(100000);expect(row.cost.report.totals.remaining).toBe(60000);expect(row.reconciled).toBe(true);expect(row.periodPaid).toBe(20000);expect(row.periodClientPaid).toBe(5000);expect(row.payable[0].amountCents).toBe(15000);expect(row.receivable[0].amountCents).toBe(70000);expect(row.revenue).toBe(100000);expect(row.result).toBe(60000);expect(row.margin).toBe(.6);});
 it('preserva competências inteiras e usa datas exatas para caixa, sem misturar os cortes',()=>{const report=run(fixture(),{start:'2026-10-10',asOf:'2026-10-15'}),row=report.rows[0];expect(row.periodCost).toBe(40000);expect(row.periodPaid).toBe(0);expect(row.periodClientPaid).toBe(0);expect(row.paid).toBe(20000);expect(row.cpi).toBeNull();expect(row.cpiReason).toContain('cortes diferentes');expect(report.trend[0].cost).toBe(row.periodCost);expect(report.trend[0].paid).toBe(row.periodPaid);});
 it('CPI exige mês encerrado e mesmo orçamento, custo e avanço integral',()=>{const report=run(fixture());expect(report.rows[0].physical).toBe(.4);expect(report.rows[0].earned).toBe(40000);expect(report.rows[0].cpi).toBe(1);const data=fixture();data.orcamentos[0].itens.push({id:'unmeasured',tipo:'servico',quantidade:10,precoUnit:100,etapaId:'s'});expect(run(data).rows[0].cpi).toBeNull();expect(run(data).rows[0].physical).toBeNull();});
 it('total da carteira permanece indisponível se uma obra não tem base; subtotal tem cobertura explícita',()=>{const data=fixture();data.obras.push({id:'b',name:'Obra Beta'});const report=run(data,{workIds:['a','b']});expect(report.totals).toMatchObject({workCount:2,completeWorks:1,knownFinalCost:100000,finalCost:null,deviation:null,budget:null});expect(report.rows[1].finalCost).toBeNull();expect(report.rows[1].margin).toBeNull();expect(report.rows[1].performance.coverage.ratio).toBeNull();});
 it('revisão antiga, órfã ou valores inválidos não sustentam previsão ao término',()=>{const data=fixture();data.obras[0].costPlanning={stages:{s:{remainingCents:100,contingencyCents:0,budgetId:'b',asOf:'2026-10-31',fingerprint:'old',basis:{}}}};expect(run(data).rows[0].finalCost).toBeNull();expect(costAtCompletion(data,{workIds:['a'],asOf:'2026-10-31'})[0].status).toBe('Reconferir estimativa');delete data.obras[0].costPlanning;data.orcamentos[0].itens[0].precoUnit=-1;expect(run(data).rows[0].finalCost).toBeNull();data.orcamentos[0].itens[0].precoUnit=Number.MAX_VALUE;expect(run(data).rows[0].finalCost).toBeNull();});
 it('caixa futuro utiliza saldo residual, mantém abertura ausente e separa vencidos e sem data',()=>{const data=fixture();const report=run(data);expect(report.cash.incoming).toBe(70000);expect(report.cash.outgoing).toBe(15000);expect(report.cash.fundingNeed).toBeNull();expect(run(data,{openingCents:0}).cash.fundingNeed).toBe(15000);data.notasFiscais[0].vencimento='2026-10-20';data.medicoes[0].dataVencimento='';const separate=run(data).cash;expect(separate.overdue).toHaveLength(1);expect(separate.undated).toHaveLength(1);expect(separate.incoming).toBe(0);expect(separate.outgoing).toBe(0);});
 it('exportação contém toda a memória do recorte, protege HTML/planilha e não altera dados',()=>{const data=fixture();data.obras[0].name='<script>ataque()</script>';data.notasFiscais[0].fornecedor='=SUM(1,2)';const before=JSON.stringify(data),report=run(data),sheets=executiveReportSheets(report),csv=forecastCsv(executiveReportCsvRows(report)),html=executiveReportPrintHtml(report);expect(sheets.Gastos).toHaveLength(2);expect(csv).toContain("'=SUM");expect(csv).toContain('nota_fiscal');expect(csv).toContain('Caixa');expect(html).not.toContain('<script>ataque()');expect(html).toContain('&lt;script&gt;ataque()&lt;/script&gt;');expect(html).toContain('Anexo · todos os gastos');expect(JSON.stringify(data)).toBe(before);});
 it('limita recorte e obras disponíveis e mantém margem sem receita indisponível',()=>{expect(run(fixture(),{start:'2025-01-01'}).error).toBeTruthy();expect(run(fixture(),{asOf:'2026-02-30'}).error).toBeTruthy();expect(run(fixture(),{workIds:['missing']}).error).toBeTruthy();const data=fixture();data.medicoes=[];expect(run(data).rows[0].margin).toBeNull();expect(run(data).totals.margin).toBeNull();});
 it('não revela despesas da empresa no recorte de uma obra e conserva esse valor separado da carteira',()=>{const data=fixture();data.despesasEmpresa=[{id:'corp',data:'2026-10-01',competencia:'2026-10',valor:75,descricao:'Administrativo'}];expect(run(data).companyCost).toBeNull();const portfolio=run(data,{includeCompany:true});expect(portfolio.companyCost).toBe(7500);expect(portfolio.totals.incurred).toBe(40000);expect(portfolio.rows[0].entries).toHaveLength(1);});
 it('gasto sem etapa, orçamento vazio ou início inválido exigem correção antes da previsão',()=>{const data=fixture();delete data.notasFiscais[0].etapaId;delete data.notasFiscais[0].pedidoId;expect(run(data).rows[0].finalCost).toBeNull();expect(run(data).rows[0].warnings.join(' ')).toContain('sobrepor');const empty=fixture();empty.orcamentos[0].itens=[];expect(run(empty).rows[0].finalCost).toBeNull();const bad=fixture();bad.obras[0].contractStart='2026-13-01';expect(run(bad).rows[0].finalCost).toBeNull();});
});

it('KPIs usam saldo parcial na referência, sem recebimento futuro e sem misturar outra obra',()=>{
 const data=fixture();data.medicoes[0].dataVencimento='2026-10-01';data.medicoes[0].recebimentos.push({id:'future',data:'2026-11-02',valor:500});data.medicoes.push({...data.medicoes[0],id:'outside',obraId:'b'});
 const model=run(data).rows[0].managementKpis;expect(model.receivables).toMatchObject({overdueCents:70000,datedCents:70000,ratio:1});expect(model.receivables.titles).toHaveLength(1);
});
it('commitimento cai com nota reconhecida, sem diminuir novamente por pagamento ou entrega física',()=>{
 const data=fixture();data.pedidos.push({id:'future-order',obraId:'a',status:'enviado',data:'2026-11-10',itens:[{id:'future-item',qtd:20,precoUnit:100}]});
 const model=run(data).rows[0].managementKpis;expect(model.purchases.openCents).toBe(40000);expect(model.purchases.payableCents).toBe(15000);expect(model.purchases.items).toHaveLength(1);
});
it('CV mostra custo acima do agregado com sinal negativo, distingue VAC e bloqueia corte intermediário',()=>{
 const data=fixture();data.notasFiscais[0].valorBruto=450;
 expect(run(data).rows[0].managementKpis.variance).toMatchObject({earned:40000,actual:45000,cv:-5000,vac:0});
 expect(run(data,{asOf:'2026-10-30'}).rows[0].managementKpis.variance.cv).toBeNull();
});
