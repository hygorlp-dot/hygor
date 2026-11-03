// @vitest-environment node
import {it,expect} from 'vitest';
import {inspectDay} from './conferencia.js';
import {proporApropriacoes} from './apropriacao.js';
import {proporGradeDoREP} from './ponte-grade.js';
import {construirBancoHoras} from './banco-horas.js';
import {planBiometricSync} from '../../../server/attendance-biometric-sync.js';
import {montarEquipeObras} from './equipe-obras.js';
const date='2026-11-03';
const employee={id:'e',name:'QA',obra:'o',workdayHours:9,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]};
const punches=(clocks,types=[])=>clocks.map((clock,i)=>({eventId:String(i),employeeId:'e',obraId:'o',obraCapturaId:'o',tipoRegistro:'ponto',tipoEvento:types[i]||null,marcadoEm:`${date}T${clock}:00-03:00`,horaConfiavel:true,metodo:'facial'}));
it('07:21 e 07:23 sem tipo continuam originais, sinalizadas e sem jornada proposta',()=>{
 const events=punches(['07:21','07:23']),before=JSON.stringify(events);
 const day=inspectDay(events,employee,date);expect(day.duplicidades).toHaveLength(1);expect(day.warnings.join(' ')).toContain('duplic');
 expect(proporApropriacoes(events).intervalos).toEqual([]);
 expect(proporGradeDoREP({marcacoes:events})[0]).toMatchObject({status:null,workedMinutes:0});
 const bank=construirBancoHoras({employees:[employee],marcacoes:events,de:date,ate:date,cobertura:{completa:true}});
 expect(bank.linhas[0].dias[0]).toMatchObject({situacao:'pendente',saldoMinutos:null,trabalhadosMinutos:0});
 expect(JSON.stringify(events)).toBe(before);
});
it('duas entradas tipadas não viram par entrada/saída, mesmo com horas entre elas',()=>{
 const events=punches(['07:21','10:23'],['entrada','entrada']);
 expect(inspectDay(events,employee,date).duplicidades).toHaveLength(1);expect(proporApropriacoes(events).intervalos).toEqual([]);
});
it('dia com quatro batidas antigas e possível repetição não é liberado para sincronização automática',()=>{
 const events=punches(['07:21','07:23','13:00','17:00']);
 const data={employees:[employee],obras:[{id:'o'}],attendance:{},config:{},payments:[{amount:7160}]},before=JSON.stringify(data);
 const item=planBiometricSync(data,{startsOn:date,endsOn:date},events,'2026-11-03T22:00:00Z')[0];
 expect(item.state).toBe('pending');expect(item.record).toBeNull();expect(item.reasons.join(' ')).toContain('duplic');
 expect(JSON.stringify(data)).toBe(before);
});
it('entrada e saída explicitamente diferentes, ainda que próximas, não são tratadas como repetição',()=>{
 const events=punches(['07:21','07:23'],['entrada','saida']);
 expect(inspectDay(events,employee,date).duplicidades).toEqual([]);expect(proporApropriacoes(events).intervalos).toHaveLength(1);
});
it('não mistura obras ou funcionários e respeita o limite de cinco minutos',()=>{
 for(const patch of [{obraCapturaId:'b',obraId:'b'},{employeeId:'outro'}]){
  const events=punches(['07:21','07:23']);Object.assign(events[1],patch);
  expect(inspectDay(events,employee,date).duplicidades).toEqual([]);
 }
 expect(inspectDay(punches(['07:21','07:26']),employee,date).duplicidades).toHaveLength(1);
 expect(inspectDay(punches(['07:21','07:27']),employee,date).duplicidades).toEqual([]);
});
it('uma saída posterior não apaga a suspeita; tratamento RH continua separado das batidas',()=>{
 const events=punches(['07:21','07:23','17:00']);
 expect(proporGradeDoREP({marcacoes:events})[0]).toMatchObject({workedMinutes:0,status:null});
 const r=proporGradeDoREP({marcacoes:events,apropriacoes:[{id:'a',employeeId:'e',data:date,status:'ativa',inicio:`${date}T07:21:00-03:00`,fim:`${date}T12:00:00-03:00`,obraApropriadaId:'o'}]});
 expect(r[0]).toMatchObject({origem:'apropriacao',workedMinutes:279});
});
it('painel da equipe sinaliza entradas repetidas sem esconder o primeiro evento',()=>{
 const events=punches(['07:21','07:23'],['entrada','entrada']);
 const row=montarEquipeObras({employees:[employee],obras:[{id:'o'}],marcacoes:events,agora:Date.parse(`${date}T10:00:00-03:00`)})[0];
 expect(row.situacao).toBe('conferir');expect(row.eventos).toHaveLength(2);expect(row.pendencias.join(' ')).toContain('duplic');
});
it('uma transferência para outra obra interrompe a comparação, inclusive no retorno à primeira',()=>{
 const events=punches(['07:21','07:22','07:23'],['entrada','entrada','entrada']);events[1].obraId='b';events[1].obraCapturaId='b';
 expect(inspectDay(events,employee,date).duplicidades).toEqual([]);
});
