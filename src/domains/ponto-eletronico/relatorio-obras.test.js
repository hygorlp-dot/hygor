import { describe,it,expect } from 'vitest';
import { construirRelatorioObras,tabelasRelatorioObras } from './relatorio-obras.js';
import { htmlRelatorioPontoObras } from '../../reports/ponto-obras.js';
const data={employees:[{id:'f',name:'Pessoa sintética',workdayHours:8}],obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}]};
const periodo={de:'2026-11-03',ate:'2026-11-03'};
const b=(h,obra='a')=>({id:`${h}-${obra}`,employeeId:'f',obraCapturaId:obra,marcadoEm:`2026-11-03T${h}:00-03:00`,horaConfiavel:true,metodo:'facial'});
const build=(marcacoes,extras={})=>construirRelatorioObras({data,periodo,resposta:{marcacoes,apropriacoes:[],cobertura:{completa:true}},...extras});
describe('relatório por obra sem alterar fontes',()=>{
 it('desconta almoço uma vez e preserva batidas e fonte',()=>{
  const fonte=[b('07:00'),b('16:00')],antes=JSON.stringify(fonte),r=build(fonte);
  expect(r.banco[0]).toMatchObject({brutoMinutos:540,liquidoMinutos:480,almocoMinutos:60,saldoMinutos:0});
  expect(r.batidas).toHaveLength(2);expect(JSON.stringify(fonte)).toBe(antes);
 });
 it('não transforma dia incompleto em débito ou líquido zero',()=>{
  const r=build([b('07:00')]);expect(r.banco[0]).toMatchObject({liquidoMinutos:null,saldoMinutos:null,situacao:'A conferir'});
 });
 it('filtra a obra depois da jornada completa e não duplica saldo entre obras',()=>{
  const r=build([b('07:00'),b('11:00'),b('12:00','b'),b('16:00','b')],{obraId:'b'});
  expect(r.batidas).toHaveLength(2);expect(r.banco).toHaveLength(1);
  expect(r.banco[0]).toMatchObject({liquidoMinutos:240,jornadaMinutos:null,saldoMinutos:null,compartilhado:true});
 });
 it('não inventa rateio do almoço em transferência entre obras sem pausa registrada',()=>{
  const r=build([b('07:00'),b('12:00','b'),b('16:00','b')]);
  expect(r.banco.every(l=>l.saldoMinutos===null)).toBe(true);
 });
 it('exporta o mesmo recorte e escapa conteúdo de cadastro no PDF',()=>{
  const r=build([b('07:00'),b('16:00')],{data:{...data,employees:[{...data.employees[0],name:'<img src=x onerror=alert(1)>'}]}});
  const html=htmlRelatorioPontoObras(r);expect(html).toContain('&lt;img');expect(html).not.toContain('<img src=x');
  expect(tabelasRelatorioObras(r)[1].linhas).toHaveLength(2);expect(html).toContain('Não substitui'.toLowerCase());
 });
 it('recusa exportação quando a API não confirmou cobertura completa',()=>{
  const r=build([b('07:00')],{resposta:{marcacoes:[b('07:00')],apropriacoes:[],cobertura:{completa:false}}});
  expect(()=>htmlRelatorioPontoObras(r)).toThrow('consulta completa');expect(r.banco[0].saldoMinutos).toBeNull();
 });
});
