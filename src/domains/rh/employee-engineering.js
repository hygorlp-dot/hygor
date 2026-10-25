import {resolveHistoricalEmployeeObraId} from '../ponto/permissions.js';

export const EMPLOYEE_ENGINEERING_COMMAND=Object.freeze({
  EMPLOYEE_ENGINEERING_CREATED:'AVISO_ENGENHARIA_FUNCIONARIO_CRIADO',
  EMPLOYEE_ENGINEERING_STATUS_SET:'AVISO_ENGENHARIA_FUNCIONARIO_SITUACAO',
});
export const EMPLOYEE_ENGINEERING_TYPES=new Set(Object.values(EMPLOYEE_ENGINEERING_COMMAND));
export const ENGINEERING_STATUSES=Object.freeze({pending:'Pendente',acknowledged:'Ciente',resolved:'Resolvido',cancelled:'Cancelado'});
export const ENGINEERING_KINDS=Object.freeze({orientation:'Orientação',occurrence:'Ocorrência',request:'Solicitação'});
const roles=new Set(['admin','rh','engenheiro']);
const text=value=>typeof value==='string'?value.trim():'';
const fail=reason=>({ok:false,reason});
const byId=(data,id)=>(data.employeeEngineeringRecords||[]).find(row=>String(row.id)===String(id));
export const employeeEngineeringBusinessDate=(now=new Date().toISOString())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export const employeeEngineeringCurrentObra=(data,employee,date=employeeEngineeringBusinessDate())=>resolveHistoricalEmployeeObraId({employee,date,transferEvents:data?.changeLog,obras:data?.obras});

export function employeeEngineeringObraId(data,command){
  return command.type===EMPLOYEE_ENGINEERING_COMMAND.EMPLOYEE_ENGINEERING_CREATED
    ?String(command.payload?.record?.obraId||''):String(byId(data,command.payload?.recordId)?.obraId||'');
}
export function employeeEngineeringScope(user,data,command){
  if(!roles.has(user?.role))return {ok:false,error:'Seu perfil não pode registrar avisos de engenharia do funcionário.'};
  const obraId=employeeEngineeringObraId(data,command);
  if(!obraId||!(data.obras||[]).some(obra=>String(obra.id)===obraId))return {ok:false,error:'O aviso precisa estar vinculado a uma obra existente.'};
  if(user.role!=='admin'&&user.obraId&&String(user.obraId)!==obraId)return {ok:false,error:'Esta obra não está disponível no seu escopo operacional.'};
  return {ok:true,obraId,scope:'work'};
}
export function stampEmployeeEngineeringCommand(command,user,now){
  return EMPLOYEE_ENGINEERING_TYPES.has(command.type)?{...command,now,actorId:user.id,actorName:user.nome||user.email||'Usuário autenticado',actorRole:user.role,actorObraId:user.obraId||''}:command;
}
export function applyEmployeeEngineeringCommand(data,command,now){
  if(!EMPLOYEE_ENGINEERING_TYPES.has(command.type))return null;
  const scope=employeeEngineeringScope({id:command.actorId,role:command.actorRole,obraId:command.actorObraId},data,command);
  if(!scope.ok)return fail(scope.error);
  if(!command.actorId)return fail('Identifique o usuário autenticado para registrar o aviso.');
  const records=data.employeeEngineeringRecords||[];
  const actor={actorId:command.actorId,actorName:text(command.actorName)||'Usuário autenticado',actorRole:command.actorRole,at:now};
  if(command.type===EMPLOYEE_ENGINEERING_COMMAND.EMPLOYEE_ENGINEERING_CREATED){
    const raw=command.payload?.record||{},id=text(raw.id),employee=(data.employees||[]).find(row=>String(row.id)===String(raw.employeeId));
    if(!/^[a-zA-Z0-9_-]{8,150}$/.test(id))return fail('Identificação do aviso inválida.');
    if(byId(data,id))return fail('Este aviso já foi registrado. Atualize a ficha.');
    if(Number(command.expectedVersion||0)!==0)return fail('Versão inicial do aviso inválida.');
    if(!employee)return fail('Funcionário não encontrado.');
    if(employeeEngineeringCurrentObra(data,employee,employeeEngineeringBusinessDate(now))!==scope.obraId)return fail('A obra do aviso deve corresponder à lotação do funcionário na data do registro.');
    const title=text(raw.title),message=text(raw.message);
    if(title.length<3||title.length>120)return fail('Informe um título de 3 a 120 caracteres.');
    if(message.length<10||message.length>2000)return fail('Descreva o aviso de engenharia em 10 a 2000 caracteres.');
    if(!Object.hasOwn(ENGINEERING_KINDS,raw.kind))return fail('Selecione orientação, ocorrência ou solicitação.');
    const record={id,employeeId:employee.id,obraId:scope.obraId,title,message,kind:raw.kind,status:'pending',version:1,
      createdAt:now,createdBy:actor.actorId,createdByName:actor.actorName,createdByRole:actor.actorRole,
      updatedAt:now,history:[{...actor,status:'pending',note:'Aviso registrado'}]};
    return {ok:true,entityId:id,data:{...data,employeeEngineeringRecords:[...records,record]}};
  }
  const current=byId(data,command.payload?.recordId),status=command.payload?.status,note=text(command.payload?.note);
  if(!current)return fail('Aviso não encontrado.');
  if(Number(command.expectedVersion)!==Number(current.version))return fail('O aviso foi alterado por outra pessoa. Atualize a ficha.');
  const allowed={pending:['acknowledged','resolved','cancelled'],acknowledged:['resolved','cancelled'],resolved:[],cancelled:[]};
  if(!allowed[current.status]?.includes(status))return fail('Esta mudança de situação não está disponível. O histórico encerrado é preservado.');
  if(status==='cancelled'&&!['admin','rh'].includes(command.actorRole))return fail('Somente RH e administradores podem cancelar um aviso.');
  if(note.length<10||note.length>1000)return fail('Registre a providência ou justificativa em 10 a 1000 caracteres.');
  const record={...current,status,version:Number(current.version)+1,updatedAt:now,history:[...(current.history||[]),{...actor,status,note}]};
  return {ok:true,entityId:record.id,data:{...data,employeeEngineeringRecords:records.map(row=>row.id===record.id?record:row)}};
}
