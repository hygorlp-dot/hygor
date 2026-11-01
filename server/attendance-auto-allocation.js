import {normalizeAttendanceRecord} from '../src/domains/ponto/records.js';
import {validDate} from '../src/domains/rh/date-validation.js';

const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const openObra=obra=>obra&&obra.active!==false&&['','active','ativa','em andamento'].includes(normalized(obra.status));

// Derivado exclusivamente do ponto validado no servidor. A captura bruta do
// aparelho, o filtro da tela e campos de lotação enviados pelo cliente não decidem.
export function applyAutomaticAttendanceAllocation(data,entries,{now,operationId,actorId,actorName}) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const touched=new Map();
  for(const entry of entries||[]){
    const id=String(entry.employeeId||'');
    if(!touched.has(id))touched.set(id,new Set());
    touched.get(id).add(entry.date);
  }
  const obras=new Map((data.obras||[]).map(o=>[String(o.id),o]));
  const transfers=[],events=[];
  const employees=(data.employees||[]).map(employee=>{
    const employeeId=String(employee.id),from=String(employee.obra||'');
    if(!touched.has(employeeId)||!from||!obras.has(from)||employee.active===false||employee.endDate||employee.status==='arquivado')return employee;
    if(!Number.isSafeInteger(Number(employee.version||0))||Number(employee.version||0)<0)return employee;
    const history=[...(employee.obraHistory||[]),...(data.changeLog||[]).filter(e=>e.type==='transfer'&&String(e.empId)===employeeId)];
    const cutoff=history.map(e=>e.date).filter(validDate).sort().at(-1)||'';
    const days=Object.entries(data.attendance?.[employeeId]||{})
      .filter(([date])=>validDate(date)&&date<=today&&(!employee.startDate||date>=employee.startDate))
      .map(([date,value])=>({date,record:normalizeAttendanceRecord(value)}))
      .filter(d=>['P','M'].includes(d.record?.status)).sort((a,b)=>b.date.localeCompare(a.date));
    const latest=days.slice(0,3);
    if(latest.length!==3||!touched.get(employeeId).has(latest[0].date)||latest.some(d=>d.date<=cutoff))return employee;
    const to=String(latest[0].record.obraId||'');
    if(!to||to===from||!openObra(obras.get(to))||latest.some(d=>String(d.record.obraId||'')!==to))return employee;
    const historyEntry={id:`allocation-${operationId}-${employeeId}`,date:today,fromObraId:from,toObraId:to,automatic:true,
      rule:'three-worked-days',evidenceDates:latest.map(d=>d.date).sort(),appliedAt:now};
    const updated={...employee,obra:to,version:Number(employee.version||0)+1,updatedAt:now,updatedById:String(actorId),
      updatedBy:'Sistema · lotação pelo ponto',obraHistory:[...(employee.obraHistory||[]),historyEntry]};
    transfers.push({employeeId,previousObraId:from,obraId:to,version:updated.version,updatedAt:now,
      updatedBy:updated.updatedBy,updatedById:updated.updatedById,historyEntry});
    events.push({id:historyEntry.id,type:'transfer',date:today,empId:employee.id,empName:employee.name,
      fromId:from,toId:to,from:obras.get(from).name,to:obras.get(to).name,automatic:true,
      evidenceDates:historyEntry.evidenceDates,operador:actorName||'Usuário autenticado',actorId:String(actorId),
      message:`Lotação atualizada automaticamente após três dias trabalhados em ${obras.get(to).name}.`});
    return updated;
  });
  return transfers.length?{data:{...data,employees,changeLog:[...(data.changeLog||[]),...events]},transfers}:{data,transfers};
}

export function enrichAttendanceWithAutomaticAllocation(applied,context) {
  if(!applied.ok||applied.idempotent||!applied.result?.attendance?.length)return applied;
  const allocation=applyAutomaticAttendanceAllocation(applied.data,applied.result.attendance,context);
  if(!allocation.transfers.length)return applied;
  const result={...applied.result,employeeAllocations:allocation.transfers};
  return {...applied,result,data:{...allocation.data,attendanceOperationReceipts:(allocation.data.attendanceOperationReceipts||[])
    .map(r=>r.operationId===context.operationId?{...r,result}:r)},
    audit:{...applied.audit,before:{...applied.audit?.before,employeeAllocations:allocation.transfers.map(t=>({employeeId:t.employeeId,obraId:t.previousObraId}))},
      after:{...applied.audit?.after,employeeAllocations:allocation.transfers}}};
}
