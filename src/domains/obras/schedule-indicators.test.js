import {describe,it,expect} from 'vitest';
import {scheduleIndicators} from './schedule-indicators.js';
import {data as demo} from '../../../scripts/fixtures/schedule-indicators-data.mjs';
import {executiveWorkReport,executiveReportSheets} from '../financeiro/executive-report.js';
import {executiveReportPrintHtml} from '../financeiro/executive-report-export.js';

const fixture=()=>structuredClone(demo);
const run=(data,asOf='2026-11-02')=>scheduleIndicators(data,{obraId:'a',asOf});
const log=(id,date,progress,extra={})=>({id,obraId:'a',data:date,status:'concluido',revisaoEngenheiro:{aprovado:true},servicos:[{tarefaId:'daily-task',progressoAte:progress}],...extra});
describe('indicadores de prazo integrados ao diário',()=>{
 it('separa atraso confirmado, falta de medição, conclusão tardia e próximas entregas',()=>{
  const report=run(fixture());
  expect(report).toMatchObject({total:5,measured:2,coverage:.4,overdue:1,unverified:1,completed:1,lateCompleted:1,upcoming:2,maxOpenDelay:4,finish:'2026-11-05',baselineFinish:'2026-11-03',finishDrift:2,spi:null});
  expect(report.rows.find(row=>row.id==='daily-task')).toMatchObject({progress:30,sourceId:'daily-report',lateDays:4});
  expect(report.rows.find(row=>row.id==='prazo-concluido')).toMatchObject({completedAt:'2026-10-24',lateDays:2});
 });
 it('não usa progresso editado no plano, diário futuro, rascunho, não revisado ou de outra obra',()=>{
  const data=fixture();data.rdos.push(log('future','2026-11-03',100),log('draft','2026-11-01',100,{status:'rascunho'}),log('other','2026-11-01',100,{obraId:'b'}));
  data.rdos.push(log('unreviewed','2026-11-02',100,{revisaoEngenheiro:{aprovado:false}}));
  expect(run(data).rows[0]).toMatchObject({progress:30,sourceId:'daily-report',overdue:true});
  expect(run(data).rows.find(row=>row.id==='prazo-sem-medicao').progress).toBeNull();
 });
 it('reaproveita nova revisão e recalcula sem gravar dados nem misturar atividades',()=>{
  const data=fixture();data.rdos.push(log('completed','2026-11-02',100));const before=JSON.stringify(data);
  expect(run(data)).toMatchObject({overdue:0,completed:2,lateCompleted:2});
  expect(run(data).rows[0]).toMatchObject({progress:100,completedAt:'2026-11-02',lateDays:4,sourceId:'completed'});
  expect(JSON.stringify(data)).toBe(before);
 });
 it('diários ou atividades duplicados e medição inválida anulam a evidência daquele corte',()=>{
  const data=fixture();data.rdos.push(log('duplicate','2026-10-30',100));
  expect(run(data).rows[0]).toMatchObject({progress:null,unverified:true,overdue:false});
  data.rdos=data.rdos.filter(row=>row.id!=='duplicate');data.rdos.at(0).servicos.push({...data.rdos[0].servicos[0]});
  expect(run(data).rows[0].progress).toBe(30);
  data.rdos.push(log('bad','2026-11-02',101));expect(run(data).rows[0].progress).toBeNull();
 });
 it('reabertura reseta o ciclo de conclusão e mantém o primeiro registro de 100% do ciclo',()=>{
  const data=fixture();data.rdos.push(log('done','2026-10-31',100),log('again','2026-11-01',80),log('done-again','2026-11-02',100));
  expect(run(data).rows[0].completedAt).toBe('2026-11-02');data.rdos.push(log('repeat','2026-11-03',100));
  expect(run(data,'2026-11-03').rows[0].completedAt).toBe('2026-11-02');
 });
 it('hoje não é vencido, janela inclui +7 e exclui +8; usa dias corridos em ano bissexto',()=>{
  const data=fixture();data.planos[0].tarefas=[{id:'daily-task',inicio:'2024-02-01',fim:'2024-02-28'},{id:'seven',inicio:'2024-02-01',fim:'2024-03-08'},{id:'eight',inicio:'2024-02-01',fim:'2024-03-09'},{id:'today',inicio:'2024-02-01',fim:'2024-03-01'}];
  data.rdos=[log('leap','2024-02-29',0)];const report=run(data,'2024-03-01');
  expect(report).toMatchObject({overdue:1,upcoming:2,maxOpenDelay:2});
  expect(report.rows.find(row=>row.id==='today').unverified).toBe(false);
 });
 it('base posterior, incompleta, duplicada ou datas inválidas não sustentam desvio integral',()=>{
  const data=fixture();data.planos[0].baselineData='2026-11-03';expect(run(data).finishDrift).toBeNull();
  data.planos[0].baselineData='2026-10-01';data.planos[0].baseline.pop();expect(run(data).finishDrift).toBeNull();
  data.planos[0].tarefas[0].fim='2026-02-30';expect(run(data).finish).toBe('');
  expect(run(data).rows[0].overdue).toBe(false);expect(run(data,'2026-02-30').error).toBeTruthy();
 });
 it('não conta títulos de etapas nem cancelados; não confunde plano ausente com zero atraso',()=>{
  const data=fixture();data.planos[0].tarefas.push({id:'heading',titulo:true},{id:'cancelled',status:'cancelado'});
  expect(run(data).total).toBe(5);data.planos=[];expect(run(data)).toMatchObject({available:false,coverage:null,finishDrift:null});
  data.planos=[demo.planos[0],demo.planos[0]];expect(run(data).reason).toContain('ambíguo');
 });
 it('não infere entrega dos marcos e não altera a base ao exportar tela, CSV e apresentação',()=>{
  const data=fixture();data.planos[0].marcos.push({id:'past',nome:'<script>entrega</script>',data:'2026-10-01'});
  const before=JSON.stringify(data),report=executiveWorkReport(data,{workIds:['a'],start:'2026-10-01',asOf:'2026-11-02'});
  expect(report.rows[0].schedule.milestones[1].state).toContain('validar entrega');
  const sheets=executiveReportSheets(report),html=executiveReportPrintHtml(report);
  expect(sheets.Prazos[1][6]).toBe(1);expect(sheets['Atividades prazo'].flat()).toContain('daily-report');
  expect(html).toContain('Anexo · prazo por atividade');expect(html).not.toContain('<script>entrega</script>');expect(html).toContain('&lt;script&gt;entrega');
  expect(JSON.stringify(data)).toBe(before);
 });
});
