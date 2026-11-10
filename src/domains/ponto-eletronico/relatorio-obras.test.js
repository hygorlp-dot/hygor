import {describe,it,expect} from 'vitest';
import {construirRelatorioObras,tabelasRelatorioObras,apresentacaoJornada,linhaResumo} from './relatorio-obras.js';
import {htmlRelatorioPontoObras} from '../../reports/ponto-obras.js';
const data={employees:[{id:'f',name:'Pessoa sintética',role:'Pedreiro',workdayHours:8,cltPayroll:{profile:{registration:'001'}}}],obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}]};
const periodo={de:'2026-11-03',ate:'2026-11-03'};
const b=(hora,tipoEvento,obraCapturaId='a',dia=periodo.de)=>({id:`${dia}-${hora}-${tipoEvento}`,employeeId:'f',tipoEvento,obraCapturaId,marcadoEm:`${dia}T${hora.length===5?hora+':00':hora}-03:00`,horaConfiavel:true,metodo:'facial'});
const build=(marcacoes,extras={})=>construirRelatorioObras({data,periodo,consultadoEm:'2026-11-10T20:00:00Z',resposta:{marcacoes,apropriacoes:[],cobertura:{completa:true}},...extras});
describe('relatório compacto com classificação explícita',()=>{
 it('mantém Sem tipo cronológico, sem criar pares, horas ou débitos',()=>{
  const original=[b('16:00',null),b('07:00',null)],antes=JSON.stringify(original),r=build(original),d=r.banco[0];
  expect(d).toMatchObject({situacao:'Pendente de classificação',liquidoMinutos:null,saldoMinutos:null,pares:[]});
  expect(apresentacaoJornada(d).celulas.slice(2,6)).toEqual(['—','—','—','—']);
  expect(apresentacaoJornada(d).sublinha).toContain('07:00 · 16:00');expect(JSON.stringify(original)).toBe(antes);
 });
 it('desconta intervalo presumido uma vez, sem inventar saída ou retorno',()=>{
  const r=build([b('07:00','entrada'),b('16:00','saida')]),d=r.banco[0];
  expect(d).toMatchObject({liquidoMinutos:480,almocoMinutos:60,saldoMinutos:0,situacao:'Completo'});
  expect(apresentacaoJornada(d).celulas.slice(3,5)).toEqual(['—','—']);expect(apresentacaoJornada(d).celulas[6]).toContain('presumido');
 });
 it('apresenta classificação e pausa real sem novo desconto',()=>{
  const r=build([b('07:00','entrada'),b('12:00','intervalo'),b('13:00','retorno'),b('16:00','saida')]);
  expect(r.banco[0]).toMatchObject({liquidoMinutos:480,intervaloMinutos:60,almocoMinutos:0});
  expect(apresentacaoJornada(r.banco[0]).celulas.slice(2,6)).toEqual(['07:00','12:00','13:00','16:00']);
 });
 it('não apura entrada repetida nem dia incompleto como débito',()=>{
  for(const marks of [[b('07:00','entrada')],[b('07:00','entrada'),b('09:00','entrada'),b('16:00','saida')]]){
   expect(build(marks).banco[0]).toMatchObject({situacao:'Incompleto',saldoMinutos:null,liquidoMinutos:null});
  }
 });
 it('consolida duração superior a 24h e não inventa saldo anterior ou compensações',()=>{
  const marks=Array.from({length:4},(_,i)=>[b('07:00','entrada','a',`2026-11-0${i+3}`),b('16:00','saida','a',`2026-11-0${i+3}`)]).flat();
  const r=build(marks,{periodo:{de:'2026-11-03',ate:'2026-11-06'}}),g=r.grupos[0];
  expect(g.resumo.liquidoMinutos).toBe(1920);expect(linhaResumo(g)[2]).toBe('32h00');expect(linhaResumo(g).slice(6)).toEqual(['Não disponível','Não disponível','Não disponível']);
 });
 it('créditos e débitos ficam separados; saldo soma diferenças válidas',()=>{
  const r=build([b('07:00','entrada'),b('17:00','saida'),b('07:00','entrada','a','2026-11-04'),b('15:00','saida','a','2026-11-04')],{periodo:{de:'2026-11-03',ate:'2026-11-04'}});
  expect(r.grupos[0].resumo).toMatchObject({creditosMinutos:60,debitosMinutos:60,saldoMinutos:0});
 });
 it('mantém tolerância com segundos precisos e a auditoria conserva os originais',()=>{
  const c={...data,employees:[{...data.employees[0],workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-01-01'}]}]};
  const r=build([b('07:05:00','entrada'),b('16:55:00','saida')],{data:c});
  expect(r.banco[0].saldoMinutos).toBe(0);expect(r.auditoria[0].instante).toContain('07:05:00');
  const outro=build([b('07:05:01','entrada'),b('16:55:00','saida')],{data:c});expect(outro.banco[0].saldoMinutos).not.toBe(0);
 });
 it('jornada atravessando meia-noite aparece na data de entrada e com ambas as datas',()=>{
  const r=build([b('22:00','entrada'),b('06:00','saida','a','2026-11-04')]);
  expect(r.banco).toHaveLength(1);expect(r.banco[0].data).toBe('2026-11-03');
  const cells=apresentacaoJornada(r.banco[0]).celulas;expect(cells[2]).toContain('03/11/2026');expect(cells[5]).toContain('04/11/2026');
 });
 it('não conta saída de jornada iniciada antes do período como nova entrada',()=>{
  const r=build([b('22:00','entrada','a','2026-11-02'),b('06:00','saida')]);expect(r.banco).toHaveLength(0);
 });
 it('mais períodos no mesmo dia geram sublinha e uma única jornada prevista',()=>{
  const r=build([b('07:00','entrada'),b('11:00','saida'),b('13:00','entrada'),b('17:00','saida')]);
  expect(r.banco).toHaveLength(1);expect(r.grupos[0].resumo.jornadaMinutos).toBe(480);
  expect(apresentacaoJornada(r.banco[0]).sublinha).toContain('Períodos adicionais: 13:00 → 17:00');
 });
 it('entre obras não duplica jornada ou saldo e o filtro não rateia automaticamente',()=>{
  const marks=[b('07:00','entrada'),b('11:00','saida'),b('13:00','entrada','b'),b('17:00','saida','b')];
  const r=build(marks);expect(r.banco).toHaveLength(1);expect(r.grupos[0].resumo.jornadaMinutos).toBe(480);
  const filtrado=build(marks,{obraId:'b'});expect(filtrado.banco[0]).toMatchObject({liquidoMinutos:240,jornadaMinutos:null,saldoMinutos:null});
  expect(filtrado.pendencias.some(p=>p.observacao.includes('não foram rateados'))).toBe(true);
 });
 it('usa tratamento ativo do RH sem dar tipo fictício às batidas originais',()=>{
  const raw=[b('07:00',null),b('16:00',null)];
  const apropriacoes=[{id:'ajuste',employeeId:'f',data:periodo.de,inicio:raw[0].marcadoEm,fim:raw[1].marcadoEm,obraApropriadaId:'a',origem:'manual',status:'ativa',version:2}];
  const r=build(raw,{resposta:{marcacoes:raw,apropriacoes,cobertura:{completa:true}}});
  expect(r.banco[0]).toMatchObject({situacao:'Ajustado',liquidoMinutos:540});expect(r.auditoria[0].tipo).toBe('Sem tipo');
 });
 it('não confunde obra de captura com a obra apropriada pelo RH',()=>{
  const raw=[b('07:00',null),b('16:00',null)],apropriacoes=[{id:'ajuste',employeeId:'f',data:periodo.de,inicio:raw[0].marcadoEm,fim:raw[1].marcadoEm,obraApropriadaId:'b',origem:'manual',status:'ativa'}];
  const resposta={marcacoes:raw,apropriacoes,cobertura:{completa:true}};
  expect(build(raw,{obraId:'a',resposta}).banco).toHaveLength(0);
  expect(build(raw,{obraId:'b',resposta}).banco[0]).toMatchObject({liquidoMinutos:540,saldoMinutos:60});
 });
 it('sem jornada cadastrada conserva horas verificáveis e não inventa saldo',()=>{
  const r=build([b('07:00','entrada'),b('16:00','saida')],{data:{...data,employees:[{...data.employees[0],workdayHours:undefined}]}});
  expect(r.banco[0]).toMatchObject({liquidoMinutos:480,jornadaMinutos:null,saldoMinutos:null});
 });
 it('entrada e saída capturadas em obras distintas não justificam rateio das horas',()=>{
  const r=build([b('07:00','entrada'),b('12:00','saida','b')],{obraId:'a'});
  expect(r.banco[0]).toMatchObject({liquidoMinutos:null,saldoMinutos:null});
 });
 it('PDF compacto não tem marca d’água, tabela de metadados ou identificadores na saída padrão',()=>{
  const r=build([b('07:00','entrada'),b('16:00','saida')]);
  const html=htmlRelatorioPontoObras(r),doc=new DOMParser().parseFromString(html,'text/html');
  expect(doc.querySelector('.mrc-report-watermark')).toBeNull();expect(doc.querySelector('h1').textContent).toBe('Relatório de ponto e banco de horas');
  expect(doc.body.textContent).not.toContain(r.auditoria[0].id);expect(doc.querySelectorAll('footer')).toHaveLength(1);
  expect(htmlRelatorioPontoObras(r,{incluirAuditoria:true})).toContain(r.auditoria[0].id);
  expect(tabelasRelatorioObras(r).map(t=>t.nome)).toContain('Resumo');
 });
 it('escapa dados cadastrais e bloqueia exportação sem cobertura',()=>{
  const r=build([b('07:00','entrada'),b('16:00','saida')],{data:{...data,employees:[{...data.employees[0],name:'<img src=x onerror=alert(1)>'}]}});
  expect(htmlRelatorioPontoObras(r)).not.toContain('<img src=x');
  const incompleto=build([b('07:00','entrada')],{resposta:{marcacoes:[b('07:00','entrada')],apropriacoes:[],cobertura:{completa:false}}});
  expect(()=>htmlRelatorioPontoObras(incompleto)).toThrow('consulta completa');
 });
});
