import { proporGradeDoREP } from '../src/domains/ponto-eletronico/ponte-grade.js';
import { sourceSignature, recordSignature, EVENT_TYPES } from '../src/domains/ponto-eletronico/conferencia.js';
import { scheduleOnDate } from '../src/domains/rh/work-schedule.js';
import { validDate } from '../src/domains/rh/date-validation.js';
import { pointCycleForDate } from '../src/domains/rh/rh-step-target.js';
import { activePayrollTitlesForPeriod, payrollPeriodKey } from '../src/domains/ponto/payroll-closing.js';
import { closedCompetenceForDate } from './closed-dre-mutation-guard.js';
import {matchesLaborArea} from '../src/domains/rh/labor-area.js';
import {createHash} from 'node:crypto';
import {normalizeAttendanceRecord} from '../src/domains/ponto/records.js';

export function validSyncRange(command) {
  return validDate(command.startsOn) && validDate(command.endsOn) && command.endsOn >= command.startsOn &&
    (Date.parse(command.endsOn)-Date.parse(command.startsOn))/86400000 <= 31;
}

// Somente fatos lidos pelo servidor. Nenhuma hora, situação ou identificação
// biométrica enviada pelo navegador participa da gravação.
export function planBiometricSync(data, command, events, now) {
  const grouped=new Map();
  for(const event of events){
    const date=new Date(event.marcadoEm).toLocaleDateString('en-CA',{timeZone:'America/Bahia'});
    if(date<command.startsOn||date>command.endsOn||event.tipoRegistro!=='ponto')continue;
    const key=`${event.employeeId}__${date}`;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(event);
  }
  const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Bahia'});
  const items=[];
  for(const [key,raw] of grouped){
    const [employeeId,date]=key.split('__');
    const batidas=[...raw].sort((a,b)=>a.marcadoEm.localeCompare(b.marcadoEm));
    const obras=[...new Set(batidas.map(e=>String(e.obraId||e.obraCapturaId||'')))];
    if(command.obraId&&command.obraId!=='all'&&!obras.includes(String(command.obraId)))continue;
    const employee=(data.employees||[]).find(e=>String(e.id)===employeeId);
    if(employee&&!matchesLaborArea(employee,command.laborArea||'all'))continue;
    const rawCurrent=data.attendance?.[employeeId]?.[date],current=normalizeAttendanceRecord(rawCurrent);
    const schedule=scheduleOnDate(employee,date);
    const reasons=[];
    if(!employee)reasons.push('Funcionário não encontrado no cadastro.');
    else if(employee.startDate>date||employee.endDate&&employee.endDate<date||employee.active===false&&!employee.endDate)reasons.push('Sem vínculo ativo nesta data.');
    if(date>today||batidas.some(e=>Date.parse(e.marcadoEm)>Date.parse(now)))reasons.push('Há batidas com data ou horário futuro; conferir no RH.');
    if(!schedule?.working)reasons.push('Escala vigente com expediente não definida; conferir no RH.');
    if(!batidas.every(e=>e.metodo==='facial'&&e.horaConfiavel&&!e.relogioAlterado))reasons.push('Identificação ou horário exige conferência do RH.');
    if(![2,4].includes(batidas.length)||batidas.some((e,i)=>i&&e.marcadoEm<=batidas[i-1].marcadoEm))reasons.push('Batidas incompletas, duplicadas ou sequência fora do padrão.');
    const typed=batidas.some(e=>e.tipoEvento);
    if(!typed&&batidas.length!==4)reasons.push('Batidas antigas sem tipo: o RH precisa conferir os horários.');
    const expected=batidas.length===2?['entrada','saida']:EVENT_TYPES;
    if(typed&&batidas.some((e,i)=>e.tipoEvento!==expected[i]))reasons.push('Sequência de entrada, intervalo e saída inconsistente.');
    if(obras.length!==1||!obras[0]||!(data.obras||[]).some(o=>String(o.id)===obras[0]))reasons.push('Obra ausente ou jornada em várias obras; conferir apropriação.');
    const obraId=obras[0]||'';
    if(data.attendanceLocks?.[`${date}__${obraId}`]?.locked||current?.obraId&&data.attendanceLocks?.[`${date}__${current.obraId}`]?.locked)reasons.push('Ponto fechado; solicite a reabertura antes de sincronizar.');
    const cycle=pointCycleForDate(date),q=payrollPeriodKey(cycle.year,cycle.month,cycle.q);
    if(data.quinzenasArquivadas?.[q])reasons.push('Quinzena arquivada; restaure antes de sincronizar.');
    if(activePayrollTitlesForPeriod(data,q).length)reasons.push('Folha fechada; o RH deve tratar a reabertura antes de alterar o ponto.');
    if(closedCompetenceForDate(data,date))reasons.push('Competência do DRE fechada; sincronização bloqueada.');
    const signature=sourceSignature(batidas);
    const unchanged=current?.pontoReview?.sourceSignature===signature;
    let record=null;
    if(!reasons.length){
      const proposed=proporGradeDoREP({marcacoes:batidas,jornadaHorasPorFuncionario:{[employeeId]:schedule.minutes/60}})[0];
      if(!proposed?.status||proposed.avisos.length)reasons.push('Jornada incompleta; conferir no Ponto eletrônico.');
      else record={...current,status:proposed.status,obraId,entrada:proposed.entrada,intervaloSaida:proposed.intervaloSaida,
        intervaloRetorno:proposed.intervaloRetorno,saida:proposed.saida,workedMinutes:proposed.workedMinutes,ot:proposed.ot,
        atrasoMin:Math.max(0,(Number(proposed.entrada.slice(0,2))*60+Number(proposed.entrada.slice(3)))-(Number(schedule.entrada.slice(0,2))*60+Number(schedule.entrada.slice(3)))),
        archivedWorkdayHours:schedule.minutes/60,archivedWorkStart:schedule.entrada,
        note:'Sincronizado pelo RH a partir das batidas biométricas.',
        pontoReview:{sourceSignature:signature,eventIds:batidas.map(e=>String(e.eventId||e.id)),schedule,method:'biometric-sync'}};
    }
    items.push({employeeId,date,obraId,name:employee?.name||employeeId,sourceSignature:signature,scheduleSignature:JSON.stringify(schedule),expectedRecord:createHash('sha256').update(recordSignature(rawCurrent)).digest('hex'),
      state:reasons.length?'pending':unchanged?'synced':'ready',reasons,record,previous:current||null});
  }
  return items.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
}

// A prévia não precisa devolver notas antigas nem toda a cadeia de revisões.
export const biometricSyncPreview=items=>items.map(({record,previous,...item})=>({...item,
  previous:previous?{status:previous.status,obraId:previous.obraId}:null,
  record:record?Object.fromEntries(['status','obraId','entrada','intervaloSaida','intervaloRetorno','saida','workedMinutes','ot'].map(key=>[key,record[key]])):null,
}));
