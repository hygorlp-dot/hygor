// @vitest-environment node
import {it,expect} from 'vitest';
import {construirBancoHoras} from './banco-horas.js';
const day='2026-10-29';
const employee={id:'e',name:'Equipe QA',workdayHours:8};
const punches=(hours,date=day)=>hours.map((h,i)=>({eventId:`${date}-${i}`,employeeId:'e',obraId:'o',tipoRegistro:'ponto',marcadoEm:`${date}T${h}:00-03:00`,horaConfiavel:true,metodo:'facial'}));
const report=(hours,extras={})=>construirBancoHoras({employees:[employee],de:day,ate:day,marcacoes:punches(hours),cobertura:{completa:true},...extras});
it('desconta uma hora estimada de almoço sem criar batidas ou alterar a fonte',()=>{
 const marcacoes=punches(['07:00','17:00']),before=JSON.stringify(marcacoes);
 const r=report([],{marcacoes});
 expect(r.linhas[0].dias[0]).toMatchObject({trabalhadosBrutosMinutos:600,trabalhadosMinutos:540,intervaloPadraoMinutos:60,intervaloMinutos:60,saldoMinutos:60});
 expect(JSON.stringify(marcacoes)).toBe(before);expect(r.linhas[0].dias[0].batidas).toHaveLength(2);
});
it('não desconta novamente uma hora já registrada, nem completa artificialmente um intervalo real de 30min',()=>{
 expect(report(['07:00','12:00','13:00','17:00']).linhas[0].dias[0]).toMatchObject({trabalhadosMinutos:540,intervaloPadraoMinutos:0,intervaloMinutos:60});
 expect(report(['07:00','12:00','12:30','17:00']).linhas[0].dias[0]).toMatchObject({trabalhadosMinutos:570,intervaloPadraoMinutos:0,intervaloMinutos:30});
});
it('não deduz almoço padrão de turno curto nem de intervalos já tratados pelo RH',()=>{
 expect(report(['07:00','11:00']).linhas[0].dias[0]).toMatchObject({trabalhadosMinutos:240,intervaloPadraoMinutos:0});
 const r=report([],{apropriacoes:[{id:'a',employeeId:'e',data:day,inicio:`${day}T07:00:00-03:00`,fim:`${day}T15:00:00-03:00`,obraApropriadaId:'o',status:'ativa',origem:'manual'}]});
 expect(r.linhas[0].dias[0]).toMatchObject({trabalhadosMinutos:480,intervaloPadraoMinutos:0,origem:'apropriacao'});
});
it('preserva pausa registrada mesmo abaixo de um minuto, sem substituir por almoço padrão',()=>{
 const source=punches(['07:00','12:00','12:00','17:00']);source[2].marcadoEm=`${day}T12:00:20-03:00`;
 expect(report([],{marcacoes:source}).linhas[0].dias[0]).toMatchObject({temIntervaloRegistrado:true,intervaloPadraoMinutos:0});
});
it('18h45 entre duas entradas e saídas viram 16h45 líquidos, respeitando quinta 9h e sexta 8h da escala vigente',()=>{
 const e={...employee,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-29'}]};
 const r=report([],{employees:[e],ate:'2026-10-30',marcacoes:[...punches(['07:00','16:22']),...punches(['07:00','16:23'],'2026-10-30')]});
 expect(r.linhas[0]).toMatchObject({trabalhadosMinutos:1005,previstosMinutos:1020,saldoMinutos:-15,jornadasMinutos:[540,480],fonteJornada:'escala'});
 expect(r.linhas[0].dias.map(d=>d.jornadaMinutos)).toEqual([540,480]);
});
it('mantém a jornada antiga antes da vigência e não lança débito nos dias sem registro',()=>{
 const e={...employee,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-29'}]};
 const r=report([],{employees:[e],de:'2026-10-28',ate:'2026-10-31',marcacoes:punches(['07:00','16:00'],'2026-10-28')});
 expect(r.linhas[0]).toMatchObject({trabalhadosMinutos:480,previstosMinutos:480,saldoMinutos:0,diasSemRegistro:3});
 expect(r.linhas[0].dias.map(d=>d.jornadaMinutos)).toEqual([480,540,480,0]);
});
