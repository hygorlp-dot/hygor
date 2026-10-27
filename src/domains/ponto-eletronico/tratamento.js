import {proporApropriacoes} from './apropriacao.js';
import {dataLocal,horaLocal} from './painel.js';
import {attendancePolicyForEmployee,PUNCH_MODE} from '../ponto/attendance-policy.js';

const active = item => item?.status !== 'cancelada' && item?.status !== 'cancelado';
const stamp = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
export const intervalKey = interval => `${stamp(interval.inicio)}|${stamp(interval.fim)}|${String(interval.obraApropriadaId||'')}`;

// Read-only triage, never a payroll computation or an absence inference.
export function receivedDayQueue({summary=[],appropriations=[],data={},day}){
  return summary.filter(row=>row.batidas.length>0).map(row=>{
    const intervals=appropriations.filter(a=>String(a.employeeId)===String(row.employeeId)&&a.data===day&&active(a));
    const point=data.attendance?.[row.employeeId]?.[day];
    const sourceIds=row.batidas.map(m=>String(m.eventId||m.id||'')).sort();
    const importedIds=(point?.mobileSource?.eventIds||[]).map(String).sort();
    const refs=intervals.map(a=>`${a.id}:${a.version}`).sort();
    const importedRefs=(point?.mobileSource?.appropriations||[]).map(a=>`${a.id}:${a.version}`).sort();
    const sameImportedSource=sourceIds.every(Boolean)&&sourceIds.length>0&&JSON.stringify(sourceIds)===JSON.stringify(importedIds)&&refs.length>0&&JSON.stringify(refs)===JSON.stringify(importedRefs);
    if(sameImportedSource)return {...row,intervals,reasons:['Horários conferidos e registrados no ponto. Fechamento e pagamento são etapas separadas.'],pointStatus:point.status,closed:!!data.attendanceLocks?.[`${day}__${point.obraId}`]?.locked,needsReview:false};
    const reasons=[];
    if(row.batidas.length%2)reasons.push('Batidas sem par; conferir jornada.');
    if(row.alertas)reasons.push('Identificação ou horário precisa de conferência.');
    if(row.batidas.some(m=>m.recebidoEm&&dataLocal(m.recebidoEm)>dataLocal(m.marcadoEm)))reasons.push('Há marcação recebida em outro dia.');
    if(!intervals.length)reasons.push('Obra de apropriação ainda não conferida.');
    if(!point?.status)reasons.push('Ainda não consta no ponto de pagamento.');
    else reasons.push('Há lançamento no ponto de pagamento; comparar antes de qualquer ajuste.');
    const closed=point&&!!data.attendanceLocks?.[`${day}__${point.obraId}`]?.locked;
    if(closed)reasons.push('Ponto de pagamento fechado; tratar diferença por revisão autorizada.');
    return {...row,intervals,reasons,pointStatus:point?.status||null,closed,needsReview:true};
  });
}

// The proposal endpoint loads ALL captures for employee/day. Calling it is
// mandatory before treatment: a work-filtered list can omit a transfer.
export function appropriationReview(proposal={},saved=[]){
  const activeSaved=saved.filter(active);
  const candidates=(proposal.intervalos||[]).map(interval=>{
    // Capture work can differ from reviewed allocation work. Recognition
    // follows the original pair; never offer the pair a second time just
    // because RH allocated it to another work.
    const matches=activeSaved.filter(a=>stamp(a.inicio)===stamp(interval.inicio)&&stamp(a.fim)===stamp(interval.fim));
    return {...interval,existing:matches[0]||null};
  });
  const pending=candidates.filter(i=>!i.existing);
  const warnings=[...(proposal.avisos||[]).map(()=> 'Há batida sem saída. Não foi criado intervalo para ela.')];
  if(!proposal.marcacoes?.length)warnings.push('Nenhuma marcação atual recebida para este funcionário no dia. Registros legados precisam de revisão própria.');
  if(activeSaved.some(a=>!candidates.some(i=>stamp(i.inicio)===stamp(a.inicio)&&stamp(i.fim)===stamp(a.fim))))warnings.push('Há intervalos já conferidos diferentes da proposta atual. Revise o histórico antes de substituir.');
  return {candidates,pending,warnings,activeSaved};
}

export function defaultReviewInterval(interval,employeeId,day){
  return {employeeId:String(employeeId),data:day,inicio:interval.inicio,fim:interval.fim,obraApropriadaId:String(interval.obraApropriadaId),origem:'proposta_capturas',motivo:'Conferência das marcações recebidas no aplicativo'};
}

export function receivedClockPreview(proposal={},day,employee={}){
  const marks=[...(proposal.marcacoes||[])].sort((a,b)=>Date.parse(a.marcadoEm)-Date.parse(b.marcadoEm));
  const works=new Set(marks.map(m=>String(m.obraCapturaId||m.obraId||'')));
  const policy=attendancePolicyForEmployee(employee);
  if(marks.length!==policy.expectedPunchCount||works.size!==1||works.has('')||(proposal.avisos||[]).length){
    const expected=policy.expectedPunchCount===2
      ?'duas batidas (entrada e saída; intervalo pré-assinalado)'
      :'quatro batidas (entrada, saída para intervalo, retorno e saída)';
    return {ok:false,reason:`A política atual do RH exige ${expected}. Quantidade diferente ou mudança de obra exige análise dos intervalos.`,policy};
  }
  if(marks.some(m=>!Number.isFinite(Date.parse(m.marcadoEm))||dataLocal(m.marcadoEm)!==day))return {ok:false,reason:'Há horário fora do dia escolhido ou inválido.',policy};

  let workedMinutes=0,breakMinutes=0;
  if(policy.punchMode===PUNCH_MODE.ENTRY_EXIT){
    const gross=(Date.parse(marks[1].marcadoEm)-Date.parse(marks[0].marcadoEm))/60000;
    breakMinutes=policy.plannedBreakMinutes;
    workedMinutes=Math.round(gross-breakMinutes);
    if(gross<=0||workedMinutes<=0)return {ok:false,reason:'Entrada, saída ou intervalo pré-assinalado produzem uma jornada inválida.',policy};
  }else{
    for(let index=0;index<marks.length;index+=2){
      const duration=(Date.parse(marks[index+1].marcadoEm)-Date.parse(marks[index].marcadoEm))/60000;
      if(duration<=0)return {ok:false,reason:'Batidas com horários iguais ou fora de ordem.',policy};
      workedMinutes+=duration;
    }
    breakMinutes=Math.round((Date.parse(marks[2].marcadoEm)-Date.parse(marks[1].marcadoEm))/60000);
    if(breakMinutes<0)return {ok:false,reason:'O intervalo registrado está fora de ordem.',policy};
    workedMinutes=Math.round(workedMinutes);
  }
  return {
    ok:true,date:day,obraCapturaId:[...works][0],
    entrada:horaLocal(marks[0].marcadoEm),
    saida:horaLocal(marks.at(-1).marcadoEm),
    intervaloSaida:policy.punchMode===PUNCH_MODE.ENTRY_EXIT?policy.workBreakStart:horaLocal(marks[1].marcadoEm),
    intervaloRetorno:policy.punchMode===PUNCH_MODE.ENTRY_EXIT?policy.workBreakEnd:horaLocal(marks[2].marcadoEm),
    workedMinutes,breakMinutes,
    breakSource:policy.punchMode===PUNCH_MODE.ENTRY_EXIT?'preassigned':'punched',
    punchMode:policy.punchMode,
    policy,
    status:policy.punchMode===PUNCH_MODE.ENTRY_EXIT
      ?'Capturas completas; intervalo pré-assinalado conforme política do RH'
      :'Capturas completas; intervalo registrado nas batidas',
  };
}

// Eligibility is repeated against server-owned rows before writing. Times
// shown here are never accepted as client authority by the import command.
export function mobileAttendanceImportReview({proposal={},saved=[],day,point=null,locks={},employee={}}){
  const preview=receivedClockPreview(proposal,day,employee);
  if(!preview.ok)return preview;
  if(point!=null)return {ok:false,reason:'Já existe ponto neste dia. Compare os registros na Gestão do ponto; a importação não substitui lançamentos.'};
  const marks=proposal.marcacoes||[],ids=marks.map(m=>String(m.eventId||''));
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)return {ok:false,reason:'Marcações sem identificação única; atualize a conferência.'};
  if(marks.some(m=>m.horaConfiavel!==true||m.relogioAlterado===true))return {ok:false,reason:'Horário sem referência confiável ou relógio alterado; exige tratamento próprio.'};
  const intervals=saved.filter(active),pairs=[];
  const ordered=[...marks].sort((a,b)=>Date.parse(a.marcadoEm)-Date.parse(b.marcadoEm));
  for(let i=0;i<ordered.length;i+=2)pairs.push([stamp(ordered[i].marcadoEm),stamp(ordered[i+1].marcadoEm)]);
  if(intervals.length!==pairs.length||pairs.some(([start,end])=>intervals.filter(a=>stamp(a.inicio)===start&&stamp(a.fim)===end).length!==1))return {ok:false,reason:'Confira todos os intervalos e resolva diferenças antes de levar o dia ao ponto.'};
  const works=new Set(intervals.map(a=>String(a.obraApropriadaId||'')));
  if(works.size!==1||works.has(''))return {ok:false,reason:'Dia apropriado em mais de uma obra: mantenha os intervalos e solicite tratamento de rateio; não será criada presença duplicada.'};
  const obraId=[...works][0];
  if(locks[`${day}__${obraId}`]?.locked||locks[`${day}__${preview.obraCapturaId}`]?.locked)return {ok:false,reason:'Ponto fechado. Marcações tardias ficam para revisão autorizada, sem alterar o fechamento.'};
  if(intervals.some(a=>!a.id||!Number.isInteger(Number(a.version))||Number(a.version)<1))return {ok:false,reason:'Atualize os intervalos para obter as versões confirmadas pelo servidor.'};
  return {...preview,obraId,sourceEventIds:ids.sort(),appropriationVersions:intervals.map(a=>({id:String(a.id),version:Number(a.version)})).sort((a,b)=>a.id.localeCompare(b.id))};
}
