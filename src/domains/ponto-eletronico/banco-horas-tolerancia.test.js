// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {construirBancoHoras} from './banco-horas.js';
const date='2026-10-29';
const employee={id:'e',name:'Pessoa sintética',workdayHours:8,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]};
const punches=(hours,day=date)=>hours.map((h,i)=>({eventId:`${day}-${i}`,employeeId:'e',obraCapturaId:'o',tipoRegistro:'ponto',marcadoEm:`${day}T${h.length===5?h+':00':h}-03:00`,horaConfiavel:true,metodo:'facial'}));
const report=(hours,extras={})=>construirBancoHoras({employees:[employee],de:date,ate:date,marcacoes:punches(hours),cobertura:{completa:true},...extras});
const day=(hours,extras)=>report(hours,extras).linhas[0].dias[0];
describe('tolerância CLT na estimativa, sem alterar a fonte',()=>{
 it('abono de 5min na entrada e 5min na saída mantém horas observadas e zera apenas saldo',()=>{
  const marcacoes=punches(['07:05','16:55']),data={employees:[employee],marcacoes,payments:[{id:'real-preservado',amount:200}]},before=JSON.stringify(data);
  const r=report([],{employees:data.employees,marcacoes});
  expect(r.linhas[0]).toMatchObject({trabalhadosMinutos:530,previstosMinutos:540,saldoMinutos:0,creditosMinutos:0,debitosMinutos:0});
  expect(r.linhas[0].dias[0]).toMatchObject({saldoSemToleranciaMinutos:-10,ajusteToleranciaMinutos:10,tolerancia:{status:'aplicada',variacaoTotalMinutos:10}});
  expect(JSON.stringify(data)).toBe(before);expect(r.linhas[0].dias[0].batidas).toHaveLength(2);
 });
 it('desconsidera também os pequenos créditos dentro dos dois limites',()=>{
  expect(day(['06:55','17:05'])).toMatchObject({trabalhadosMinutos:550,saldoSemToleranciaMinutos:10,saldoMinutos:0,ajusteToleranciaMinutos:-10});
 });
 it.each([['07:06','17:00',-6],['07:00','17:06',6],['07:05:01','17:00',-5]])('não abona marcação acima de 5min: %s / %s',(a,b,balance)=>{
  expect(day([a,b])).toMatchObject({saldoMinutos:balance,ajusteToleranciaMinutos:0,tolerancia:{status:'excedida'}});
 });
 it('quatro marcações: verifica cada variação e soma absoluta no dia',()=>{
  expect(day(['07:03','11:58','13:02','16:57'])).toMatchObject({trabalhadosMinutos:530,saldoMinutos:0,tolerancia:{status:'aplicada',variacaoTotalMinutos:10}});
  expect(day(['07:03','11:57','13:03','16:57'])).toMatchObject({saldoMinutos:-12,tolerancia:{status:'excedida',variacaoTotalMinutos:12}});
  // Não usa apenas o saldo líquido (6min) para conceder abono: soma absoluta=12.
  expect(day(['07:03','12:03','13:03','16:57'])).toMatchObject({saldoMinutos:-6,tolerancia:{status:'excedida',variacaoTotalMinutos:12}});
 });
 it('não concede franquia parcial quando limites são ultrapassados',()=>{
  expect(day(['06:54','17:04'])).toMatchObject({saldoMinutos:10,ajusteToleranciaMinutos:0,tolerancia:{status:'excedida'}});
 });
 it('confere o limite diário em segundos antes de arredondar os minutos exibidos',()=>{
  expect(day(['07:02:30','11:57:30','13:02:30','16:57:30'])).toMatchObject({saldoMinutos:0,tolerancia:{status:'aplicada',variacaoTotalMinutos:10}});
  expect(day(['07:02:30','11:57:30','13:02:31','16:57:30'])).toMatchObject({saldoMinutos:-10,tolerancia:{status:'excedida'}});
 });
 it('limites valem por dia: crédito em outro dia não apaga débito nem amplia tolerância',()=>{
  const r=report([],{ate:'2026-10-30',marcacoes:[...punches(['07:06','17:00']),...punches(['07:00','16:06'],'2026-10-30')]});
  expect(r.linhas[0]).toMatchObject({saldoMinutos:0,creditosMinutos:6,debitosMinutos:6});
  expect(r.linhas[0].dias.map(d=>d.saldoMinutos)).toEqual([-6,6]);
 });
 it('não presume horários a partir da duração e respeita a vigência',()=>{
  expect(day(['07:05','15:55'],{employees:[{...employee,workSchedules:[]}]})).toMatchObject({saldoMinutos:-10,tolerancia:{status:'sem_escala'}});
  expect(day(['07:05','15:55'],{employees:[{...employee,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-30'}]}]})).toMatchObject({saldoMinutos:-10,tolerancia:{status:'sem_escala'}});
 });
 it('sexta tem saída às16; fim de semana não ganha abono',()=>{
  expect(report(['07:05','15:55'],{de:'2026-10-30',ate:'2026-10-30',marcacoes:punches(['07:05','15:55'],'2026-10-30')}).linhas[0].dias[0]).toMatchObject({previstosMinutos:480,saldoMinutos:0,tolerancia:{status:'aplicada'}});
  expect(report([],{de:'2026-10-31',ate:'2026-10-31',marcacoes:punches(['07:00','11:00'],'2026-10-31')}).linhas[0].dias[0]).toMatchObject({saldoMinutos:240,tolerancia:{status:'sem_escala'}});
 });
 it('preserva tratamento RH, dias incompletos, cobertura parcial e fonte não confiável',()=>{
  const apropriacoes=[{id:'a',employeeId:'e',data:date,inicio:`${date}T07:05:00-03:00`,fim:`${date}T12:00:00-03:00`,obraApropriadaId:'o',origem:'manual',status:'ativa'},
  {id:'b',employeeId:'e',data:date,inicio:`${date}T13:00:00-03:00`,fim:`${date}T16:55:00-03:00`,obraApropriadaId:'o',origem:'manual',status:'ativa'}];
  expect(day(['07:05','16:55'],{apropriacoes})).toMatchObject({saldoMinutos:-10,tolerancia:{status:'tratado_rh'}});
  expect(day(['07:05'])).toMatchObject({situacao:'pendente',saldoMinutos:null,ajusteToleranciaMinutos:0});
  expect(day(['07:05','16:55'],{cobertura:{completa:false}})).toMatchObject({situacao:'pendente',saldoMinutos:null});
  expect(day([],{marcacoes:punches(['07:05','16:55']).map(b=>({...b,horaConfiavel:false}))})).toMatchObject({saldoMinutos:-10,tolerancia:{status:'conferir_fonte'}});
 });
 it('não altera intervalos nem aplica tolerância a transferências com sequência ambígua',()=>{
  expect(day([],{marcacoes:punches(['07:05','12:00','16:55']).map((b,i)=>({...b,obraCapturaId:i?'outra':'o'}))})).toMatchObject({tolerancia:{status:'sequencia_especial'},ajusteToleranciaMinutos:0});
 });
 it('não transforma deslocamento integral de jornada em tolerância e não inventa débito sem batidas',()=>{
  expect(day(['08:00','18:00'])).toMatchObject({saldoMinutos:0,tolerancia:{status:'excedida'}});
  expect(day([])).toMatchObject({situacao:'sem_registro',saldoMinutos:null,ajusteToleranciaMinutos:0});
 });
});
