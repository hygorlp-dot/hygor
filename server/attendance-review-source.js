import { decodeAppData } from "./data-codec.js";
import { mergeAttendanceObjects, withAttendanceSyncedAt } from "./attendance-obra-routing.js";
import { intervaloDoDia } from "../src/domains/ponto-eletronico/painel.js";
import { validDate } from "../src/domains/rh/date-validation.js";
const KEY="arced_ponto_v1", PONTO_KEY=`${KEY}__ponto`, PONTO_OBRA_KEY_PREFIX=`${PONTO_KEY}__obra__`;

// Chamado depois do lock compartilhado de ponto. Releitura evita que duas
// conferências abertas no mesmo instante sobrescrevam o lançamento vencedor.
export async function readFreshAttendance(transaction, company, fallback) {
  const rows = await transaction`select key,value,updated_at from company_app_data
    where company_id=${company} and (key=${KEY} or key=${PONTO_KEY} or starts_with(key,${PONTO_OBRA_KEY_PREFIX}))
    order by updated_at asc`;
  const core = decodeAppData(rows.find(r=>r.key===KEY)?.value || {});
  const meta = decodeAppData(rows.find(r=>r.key===PONTO_KEY)?.value || {});
  const sources = [meta.attendance || core.attendance || {}];
  for(const row of rows.filter(r=>r.key.startsWith(PONTO_OBRA_KEY_PREFIX))){
    const value=decodeAppData(row.value);
    sources.push(withAttendanceSyncedAt(value.attendance,value.attendanceSyncedAt));
  }
  return {employees:core.employees || fallback.employees, obras:core.obras || fallback.obras,
    quinzenasArquivadas:core.quinzenasArquivadas || {}, attendance:mergeAttendanceObjects(...sources)};
}

export async function readReviewEvents(transaction, company, command) {
  if(!validDate(command.date) || !String(command.employeeId || ""))return [];
  const {de,ate}=intervaloDoDia(command.date);
  // Consulta todas as obras do funcionário, sem truncar a jornada à obra filtrada.
  const events=await transaction`select event_id as id,obra_id,marcado_em,hora_confiavel,relogio_alterado,metodo,payload
    from ponto_eventos where company_id=${company} and employee_id=${String(command.employeeId)}
    and tipo_registro='ponto' and marcado_em>=${de} and marcado_em<=${ate}`;
  const legacy=await transaction`select id,obra_id,marcado_em,hora_confiavel,relogio_alterado,metodo
    from ponto_marcacoes where company_id=${company} and employee_id=${String(command.employeeId)}
    and tipo_registro='ponto' and marcado_em>=${de} and marcado_em<=${ate}`;
  return [...events,...legacy].map(e=>({id:String(e.id),eventId:String(e.id),obraId:e.obra_id,
    marcadoEm:new Date(e.marcado_em).toISOString(),tipoRegistro:"ponto",
    tipoEvento:e.payload?.versaoJornada===1?e.payload.tipoEvento:null,
    horaConfiavel:e.hora_confiavel,relogioAlterado:e.relogio_alterado,metodo:e.metodo}));
}

export async function readSyncEvents(transaction, company, command) {
  const {de}=intervaloDoDia(command.startsOn),{ate}=intervaloDoDia(command.endsOn);
  const rows=await transaction`select event_id as id,employee_id,obra_id,marcado_em,hora_confiavel,relogio_alterado,metodo,payload
    from ponto_eventos where company_id=${company} and tipo_registro='ponto' and marcado_em>=${de} and marcado_em<=${ate}
    order by marcado_em limit 10001`;
  const legacy=await transaction`select id,employee_id,obra_id,marcado_em,hora_confiavel,relogio_alterado,metodo
    from ponto_marcacoes where company_id=${company} and tipo_registro='ponto' and marcado_em>=${de} and marcado_em<=${ate}
    order by marcado_em limit 10001`;
  if(rows.length>10000||legacy.length>10000)throw new Error('Há mais de 10.000 batidas no período. Reduza o intervalo.');
  const events=new Map();
  for(const e of [...rows,...legacy]){
    const id=String(e.id);if(events.has(id))continue;
    events.set(id,{id,eventId:id,employeeId:String(e.employee_id),obraId:String(e.obra_id||''),
      marcadoEm:new Date(e.marcado_em).toISOString(),tipoRegistro:'ponto',tipoEvento:e.payload?.versaoJornada===1?e.payload.tipoEvento:null,
      horaConfiavel:e.hora_confiavel,relogioAlterado:e.relogio_alterado,metodo:e.metodo});
  }
  if(events.size>10000)throw new Error('Há mais de 10.000 batidas no período. Reduza o intervalo.');
  return [...events.values()];
}
