import {calculateAttendanceDayCost} from '../src/domains/ponto/payroll.js';
import {describe,it,expect} from 'vitest';
import {planBiometricSync,validSyncRange} from './attendance-biometric-sync.js';
import {applyAttendanceCommand} from './attendance-command.js';
import {recordSignature} from '../src/domains/ponto-eletronico/conferencia.js';
const now='2026-10-30T21:00:00Z',date='2026-10-29';
const rh={id:'rh',nome:'RH',role:'rh'},eng={id:'eng',role:'engenheiro',obraId:'old'};
const input={startsOn:date,endsOn:date,obraId:'all'};
const data=()=>({obras:[{id:'o',name:'Obra com batidas'},{id:'old',name:'Lotação antiga'}],
 employees:['e','f'].map(id=>({id,name:id,obra:'old',startDate:'2020-01-01',active:true,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]})),
 attendance:{e:{[date]:{status:'F',obraId:'old',note:'Manual anterior'}}},payments:[{id:'real',amount:7160}],titulosFolha:[]});
const events=(employeeId='e')=>['10:00','15:00','16:00','20:00'].map((clock,i)=>({employeeId,eventId:`${employeeId}-${i}`,tipoRegistro:'ponto',obraId:'o',marcadoEm:`${date}T${clock}:00.000Z`,horaConfiavel:true,metodo:'facial',tipoEvento:['entrada','intervalo','retorno','saida'][i]}));
const command=(d,es)=>({action:'attendance-sync-punches',operationId:'20000000-0000-4000-8000-000000000001',...input,
 items:planBiometricSync(d,input,es,now).filter(i=>i.state==='ready').map(({employeeId,date,sourceSignature,scheduleSignature,expectedRecord})=>({employeeId,date,sourceSignature,scheduleSignature,expectedRecord}))});
describe('sincronização biométrica pelo RH',()=>{
 it('substitui falta e obra manuais por fatos, audita e não modifica pagamentos; repete sem duplicar',()=>{
  const d=data(),es=events(),c=command(d,es),r=applyAttendanceCommand(d,rh,c,now,es);
  expect(r.ok).toBe(true);expect(r.data.attendance.e[date]).toMatchObject({status:'P',obraId:'o',workedMinutes:540,pontoReview:{method:'biometric-sync',reviewedBy:'rh'}});
  expect(r.result.attendance[0].previousObraId).toBe('old');expect(r.audit.before.attendance[0].record.status).toBe('F');
  expect(r.data.payments).toBe(d.payments);expect(d.attendance.e[date].status).toBe('F');
  expect(applyAttendanceCommand(r.data,rh,c,now,es).idempotent).toBe(true);
  expect(planBiometricSync(r.data,input,es,now)[0].state).toBe('synced');
 });
 it('aproveita o status legado salvo como texto e preserva o original na auditoria',()=>{
  const d=data();d.attendance.e[date]='F';const es=events(),r=applyAttendanceCommand(d,rh,command(d,es),now,es);
  expect(r.ok).toBe(true);expect(r.data.attendance.e[date].status).toBe('P');expect(r.data.attendance.e[date]).not.toHaveProperty('0');
  expect(r.audit.before.attendance[0].record).toBe('F');
 });
 it('engenharia não sincroniza nem altera/apaga o registro protegido, inclusive com flags forjadas',()=>{
  const d=data(),es=events(),c=command(d,es),r=applyAttendanceCommand(d,rh,c,now,es);
  expect(applyAttendanceCommand(d,eng,c,now,es).status).toBe(403);
  for(const record of [{status:'F'}, {status:null}]){
   const write={action:'attendance-batch-upsert',operationId:'20000000-0000-4000-8000-000000000002',patches:[{employeeId:'e',date,selectedObraId:'o',reviewedByServer:true,record}]};
   expect(applyAttendanceCommand(r.data,eng,write,now).ok).toBe(false);
  }
 });
 it('RH mantém a conferência justificada depois de sincronizar, sem liberar a engenharia',()=>{
  const d=data(),es=events(),r=applyAttendanceCommand(d,rh,command(d,es),now,es),record=r.data.attendance.e[date];
  const reviewed=applyAttendanceCommand(r.data,rh,{action:'attendance-review-punches',operationId:'20000000-0000-4000-8000-000000000004',employeeId:'e',date,
   selectedObraId:'o',clocks:{entrada:'07:00',intervaloSaida:'12:00',intervaloRetorno:'13:00',saida:'17:00'},status:'P',reason:'Conferência justificada pelo RH',
   sourceSignature:record.pontoReview.sourceSignature,scheduleSignature:JSON.stringify(record.pontoReview.schedule),expectedRecord:recordSignature(record)},now,es);
  expect(reviewed.ok).toBe(true);expect(reviewed.data.attendance.e[date].pontoReview.revision).toBe(2);
  expect(reviewed.data.payments).toEqual(d.payments);
 });
 it('recalcula no servidor e rejeita fonte, escala ou grade alteradas sem gravar parcialmente',()=>{
  const d=data(),es=[...events(),...events('f')],c=command(d,es);
  c.items[1].expectedRecord='forjado';expect(applyAttendanceCommand(d,rh,c,now,es).ok).toBe(false);expect(d.attendance.e[date].status).toBe('F');
  for(const field of ['expectedRecord','sourceSignature','scheduleSignature']){const bad=command(d,events());bad.items[0][field]='falso';expect(applyAttendanceCommand(d,rh,bad,now,events()).ok).toBe(false);}
  expect(applyAttendanceCommand(d,rh,command(d,events()),now).ok).toBe(false);
 });
 it.each(['incomplete','manual','clock','mixedWorks','schedule','lock','archive','payroll'])('separa pendência %s em vez de inventar ou alterar período fechado',kind=>{
  const d=data();let es=events();
  if(kind==='incomplete')es=es.slice(0,3);
  if(kind==='manual')es[0].metodo='encarregado';
  if(kind==='clock')es[0].horaConfiavel=false;
  if(kind==='mixedWorks')es[0].obraId='old';
  if(kind==='schedule')d.employees[0].workSchedules=[];
  if(kind==='lock')d.attendanceLocks={[`${date}__old`]:{locked:true}};
  if(kind==='archive')d.quinzenasArquivadas={'2026-10-Q2':{}};
  if(kind==='payroll')d.titulosFolha=[{periodKey:'2026-10-Q2',status:'pago'}];
  const item=planBiometricSync(d,input,es,now)[0];expect(item.state).toBe('pending');expect(item.reasons.length).toBeGreaterThan(0);
 });
 it('suporta quatro batidas antigas e duas batidas sem criar marcações de intervalo',()=>{
  const es=events().map(e=>({...e,tipoEvento:null}));expect(planBiometricSync(data(),input,es,now)[0].state).toBe('ready');
  expect(planBiometricSync(data(),input,es.slice(0,2),now)[0].state).toBe('ready');
 });
 it('usa obra da captura, não a lotação fixa, e limita o recorte de consulta',()=>{
  expect(planBiometricSync(data(),{...input,obraId:'o'},events(),now)).toHaveLength(1);
  expect(planBiometricSync(data(),{...input,obraId:'old'},events(),now)).toHaveLength(0);
  expect(validSyncRange(input)).toBe(true);expect(validSyncRange({startsOn:'2026-02-31',endsOn:date})).toBe(false);
 });
 it('respeita o recorte de área e a quinzena que atravessa o mês',()=>{
  const d=data();d.employees[0].workArea='administrativo';
  expect(planBiometricSync(d,{...input,laborArea:'obras'},events(),now)).toHaveLength(0);
  expect(planBiometricSync(d,{...input,laborArea:'central'},events(),now)[0].state).toBe('ready');
  const nextDate='2026-11-03',es=events().map(e=>({...e,marcadoEm:e.marcadoEm.replace(date,nextDate)}));
  d.quinzenasArquivadas={'2026-10-Q2':{}};
  expect(planBiometricSync(d,{startsOn:nextDate,endsOn:nextDate},es,'2026-11-04T20:00:00Z')[0].reasons).toContain('Quinzena arquivada; restaure antes de sincronizar.');
 });
});

it.each([['2026-11-03','07:21','16:55',514,540],['2026-11-06','07:00','16:00',480,480],['2026-11-06','07:00','17:00',540,480],['2026-11-03','07:00','11:00',240,540],['2026-11-03','12:30','16:00',180,540]])('integra %s %s–%s com intervalo previsto e escala histórica', (day,start,end,minutes,expected)=>{
 const d=data();d.attendance={};
 const es=[start,end].map((clock,i)=>({...events()[i],eventId:`two-${i}`,tipoEvento:null,marcadoEm:new Date(`${day}T${clock}:00-03:00`).toISOString()}));
 const cmd={action:'attendance-sync-punches',automatic:true,operationId:'20000000-0000-4000-8000-000000000009',startsOn:day,endsOn:day};
 const result=applyAttendanceCommand(d,rh,cmd,'2026-11-07T21:00:00Z',es);
 expect(result.ok).toBe(true);
 const record=result.data.attendance.e[day];
 expect(record).toMatchObject({entrada:start,saida:end,intervaloSaida:'',intervaloRetorno:'',workedMinutes:minutes,archivedWorkdayHours:expected/60,pontoReview:{automatic:true,scheduledBreak:{source:'work-schedule'}}});
 expect(calculateAttendanceDayCost({employee:d.employees[0],record}).workedMinutes).toBe(minutes);
 expect(es).toHaveLength(2);expect(es.every(e=>e.tipoEvento===null)).toBe(true);
 expect(applyAttendanceCommand(result.data,rh,{...cmd,operationId:'20000000-0000-4000-8000-000000000010'},'2026-11-07T21:00:00Z',es).idempotent).toBe(true);
});
it('automático ignora pendências, não sobrescreve revisão RH nem reabre fechamentos',()=>{
 const d=data(),es=events(),cmd={action:'attendance-sync-punches',automatic:true,operationId:'20000000-0000-4000-8000-000000000011',...input};
 d.attendance.e[date].pontoReview={sourceSignature:'revisado',schedule:{},revision:2};
 expect(applyAttendanceCommand(d,rh,cmd,now,es)).toMatchObject({ok:true,idempotent:true,result:{attendance:[]}});
 expect(applyAttendanceCommand(d,eng,cmd,now,es).status).toBe(403);
 delete d.attendance.e[date].pontoReview;d.attendanceLocks={[`${date}__o`]:{locked:true}};
 expect(applyAttendanceCommand(d,rh,cmd,now,es).result.attendance).toEqual([]);
});
