import {intervaloDoDia} from '../src/domains/ponto-eletronico/painel.js';
import {proporApropriacoes} from '../src/domains/ponto-eletronico/apropriacao.js';

// Called inside the same transaction as canonical attendance persistence.
// Never accepts a source snapshot, timestamps or work IDs from the browser.
export async function loadMobileAttendanceSource(transaction,{company,employeeId,date}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!employeeId)return null;
  const parsed=new Date(`${date}T12:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
  const {de,ate}=intervaloDoDia(date);
  // Row locks protect edited versions; this brief SHARE lock also prevents
  // phantom offline arrivals/new appropriations during the approval commit.
  // Only this explicit import takes it, never ordinary monitoring reads.
  await transaction`set local lock_timeout = '2s'`;
  await transaction`lock table ponto_eventos, ponto_apropriacoes in share mode`;
  const events=await transaction`
    select event_id,marcado_em,obra_id,hora_confiavel,relogio_alterado
      from ponto_eventos
     where company_id=${company} and employee_id=${String(employeeId)}
       and tipo_registro='ponto' and marcado_em>=${de} and marcado_em<=${ate}
     order by marcado_em,event_id for share
  `;
  const rows=await transaction`
    select id,employee_id,data,inicio,fim,obra_apropriada_id,status,version
      from ponto_apropriacoes
     where company_id=${company} and employee_id=${String(employeeId)} and data=${date} and status='ativa'
     order by inicio,id for share
  `;
  const iso=value=>new Date(value).toISOString();
  const marcacoes=events.map(e=>({eventId:String(e.event_id),marcadoEm:iso(e.marcado_em),obraCapturaId:String(e.obra_id),horaConfiavel:e.hora_confiavel,relogioAlterado:e.relogio_alterado}));
  return {employeeId:String(employeeId),date,proposal:{marcacoes,...proporApropriacoes(marcacoes)},appropriations:rows.map(a=>({id:String(a.id),employeeId:String(a.employee_id),data:date,inicio:iso(a.inicio),fim:iso(a.fim),obraApropriadaId:String(a.obra_apropriada_id),status:a.status,version:Number(a.version)}))};
}
