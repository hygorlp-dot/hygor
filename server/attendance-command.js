import { normalizeAttendanceRecord } from "../src/domains/ponto/records.js";
import {
  resolveEmployeeAttendanceObraId,
} from "../src/domains/ponto/permissions.js";

export const ATTENDANCE_COMMAND = Object.freeze({
  UPSERT:"attendance-upsert",
  BATCH_UPSERT:"attendance-batch-upsert",
  DAILY_CHECK:"attendance-daily-check",
  LOCK:"attendance-lock",
  UNLOCK_REQUEST:"attendance-unlock-request",
  UNLOCK_APPROVE:"attendance-unlock-approve",
  UNLOCK_REJECT:"attendance-unlock-reject",
});

const WRITE_ROLES=new Set(["admin","rh","engenheiro"]);
const UNLOCK_REQUEST_ROLES=new Set(["admin","rh","engenheiro"]);
const OPERATION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
const CLOCK=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const receipts=data=>Array.isArray(data?.attendanceOperationReceipts)?data.attendanceOperationReceipts:[];
const fail=(error,status=400)=>({ok:false,error,status});
const sameId=(left,right)=>String(left||"")===String(right||"");
const lockKey=(obraId,date)=>`${date}__${obraId}`;

const validDate=value=>{
  if(!ISO_DATE.test(String(value||"")))return false;
  const parsed=new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
const validOperationId=value=>OPERATION_ID.test(String(value||""));
const currentDateForNow=now=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"America/Bahia",year:"numeric",month:"2-digit",day:"2-digit",
}).format(new Date(now));
const employeeActiveOnDate=(employee,date)=>{
  if(!employee)return false;
  if(employee.startDate&&String(employee.startDate)>date)return false;
  if(employee.endDate&&String(employee.endDate)<date)return false;
  return employee.active!==false||!!employee.endDate;
};
const findEmployee=(data,id)=>(data?.employees||[]).find(employee=>sameId(employee?.id,id));
const findObra=(data,id)=>(data?.obras||[]).find(obra=>sameId(obra?.id,id));
const receiptFor=(data,operationId)=>receipts(data).find(item=>item.operationId===operationId);
const appendReceipt=(data,{operationId,action,result,user,now})=>({
  ...data,
  attendanceOperationReceipts:[...receipts(data),{
    operationId,action,result,actorId:String(user?.id||""),appliedAt:now,
  }].slice(-3000),
});

const ensureCommandBase=({data,user,command})=>{
  if(!Object.values(ATTENDANCE_COMMAND).includes(command?.action))return fail("Comando de ponto inválido.");
  if(!validOperationId(command.operationId))return fail("operationId de ponto inválido.");
  const previous=receiptFor(data,command.operationId);
  if(previous)return {ok:true,idempotent:true,result:previous.result,data};
  return {ok:true};
};
const ensureWriter=user=>WRITE_ROLES.has(String(user?.role||""))
  ? {ok:true}
  : fail("Seu perfil não pode registrar ou alterar ponto.",403);
const ensureScopedObra=(user,obraId)=>{
  if(user?.role==="engenheiro"&&user?.obraId&&!sameId(user.obraId,obraId)){
    return fail("Não é permitido alterar ponto de outra obra.",403);
  }
  return {ok:true};
};

const resolvedObraId=({data,employee,date,currentRecord,patch})=>resolveEmployeeAttendanceObraId({
  data,employee,date,
  selectedObraId:patch?.selectedObraId,
  record:(currentRecord?.obraId||currentRecord?.obra)?currentRecord:(patch?.record||currentRecord),
});

const approvedUnlock=({data,user,obraId,date,employeeId,now})=>(data?.unlockRequests||[]).some(request=>
  sameId(request.obraId,obraId)&&request.date===date&&request.status==="approved"&&
  (!request.employeeId||sameId(request.employeeId,employeeId))&&
  sameId(request.requestedById,user?.id)&&request.validUntil&&new Date(request.validUntil)>new Date(now)
);
const ensureUnlocked=({data,user,obraId,date,employeeId,now})=>{
  const lock=data?.attendanceLocks?.[lockKey(obraId,date)];
  if(!lock?.locked)return {ok:true};
  return approvedUnlock({data,user,obraId,date,employeeId,now})
    ? {ok:true}
    : fail("O ponto desta obra está finalizado. Solicite e obtenha uma liberação antes de alterar.",409);
};

const finiteBetween=(value,min,max)=>{
  const number=Number(value||0);
  return Number.isFinite(number)&&number>=min&&number<=max?number:null;
};
const normalizeSubmittedRecord=({input,current,obraId})=>{
  if(!input||typeof input!=="object")return fail("Registro de ponto inválido.");
  const status=input.status==null||input.status===""?null:String(input.status);
  if(![null,"P","M","F"].includes(status))return fail("Status de ponto inválido.");
  const ot=finiteBetween(input.ot,0,24);
  const workedMinutes=finiteBetween(input.workedMinutes,0,1440);
  const atrasoMin=finiteBetween(input.atrasoMin,0,1440);
  if(ot==null||workedMinutes==null||atrasoMin==null)return fail("Horas ou minutos do ponto são inválidos.");
  for(const field of ["entrada","intervaloSaida","intervaloRetorno","saida"]){
    if(input[field]&&!CLOCK.test(String(input[field])))return fail("Horário do ponto inválido.");
  }
  const previous=normalizeAttendanceRecord(current)||{};
  const keepsWorkedTime=["P","M"].includes(status);
  const record={
    ...previous,
    status,
    ot:keepsWorkedTime?ot:0,
    note:String(input.note??previous.note??"").trim().slice(0,2000),
    entrada:keepsWorkedTime?String(input.entrada??previous.entrada??""):"",
    intervaloSaida:keepsWorkedTime?String(input.intervaloSaida??previous.intervaloSaida??""):"",
    intervaloRetorno:keepsWorkedTime?String(input.intervaloRetorno??previous.intervaloRetorno??""):"",
    saida:keepsWorkedTime?String(input.saida??previous.saida??""):"",
    workedMinutes:keepsWorkedTime?workedMinutes:0,
    atrasoMin:keepsWorkedTime?atrasoMin:0,
    obraId:String(obraId||""),
  };
  return {ok:true,record:status?record:null};
};

const validatePatch=({data,user,patch,now})=>{
  const writer=ensureWriter(user);
  if(!writer.ok)return writer;
  const employeeId=String(patch?.employeeId||"");
  const date=String(patch?.date||"");
  const employee=findEmployee(data,employeeId);
  if(!employee)return fail("Funcionário não encontrado.",404);
  if(!validDate(date))return fail("Data do ponto inválida.");
  if(!employeeActiveOnDate(employee,date))return fail("O funcionário não possui vínculo ativo nesta data.",409);
  const currentRecord=data?.attendance?.[employeeId]?.[date]||null;
  const obraId=resolvedObraId({data,employee,date,currentRecord,patch});
  if(!obraId&&user.role==="engenheiro")return fail("Selecione uma obra para registrar o ponto.",409);
  if(obraId&&!findObra(data,obraId))return fail("Obra do lançamento não encontrada.",404);
  const scope=ensureScopedObra(user,obraId);
  if(!scope.ok)return scope;
  const unlocked=ensureUnlocked({data,user,obraId,date,employeeId,now});
  if(!unlocked.ok)return unlocked;
  const normalized=normalizeSubmittedRecord({input:patch.record,current:currentRecord,obraId});
  if(!normalized.ok)return normalized;
  return {ok:true,employeeId,date,employee,obraId,currentRecord,record:normalized.record};
};

const applyValidatedPatch=(data,validated)=>{
  const attendance={...(data?.attendance||{})};
  const days={...(attendance[validated.employeeId]||{})};
  if(validated.record)days[validated.date]=validated.record;
  else delete days[validated.date];
  if(Object.keys(days).length)attendance[validated.employeeId]=days;
  else delete attendance[validated.employeeId];
  return {...data,attendance};
};
const attendanceResult=validated=>({
  employeeId:validated.employeeId,date:validated.date,obraId:validated.obraId,
  record:validated.record,
});

const applyUpsert=({data,user,command,now})=>{
  const validated=validatePatch({data,user,patch:command,now});
  if(!validated.ok)return validated;
  let next=applyValidatedPatch(data,validated);
  if(command.confirmDailyCheck&&validated.date===currentDateForNow(now))next={...next,dailyCheckDate:validated.date};
  const result={attendance:[attendanceResult(validated)],dailyCheckDate:next.dailyCheckDate||""};
  next=appendReceipt(next,{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:next,result,audit:{
    action:"attendance_upsert",before:{attendance:attendanceResult({...validated,record:validated.currentRecord})},
    after:{attendance:attendanceResult(validated),operationId:command.operationId},
  }};
};

const applyBatch=({data,user,command,now})=>{
  const patches=Array.isArray(command.patches)?command.patches:[];
  if(!patches.length||patches.length>500)return fail("O lote deve conter entre 1 e 500 registros.");
  let candidate=data;
  const validated=[];
  for(const patch of patches){
    const item=validatePatch({data:candidate,user,patch,now});
    if(!item.ok)return item;
    validated.push(item);
    candidate=applyValidatedPatch(candidate,item);
  }
  if(command.confirmDailyCheck&&validated.some(item=>item.date===currentDateForNow(now))){
    candidate={...candidate,dailyCheckDate:currentDateForNow(now)};
  }
  const result={attendance:validated.map(attendanceResult),dailyCheckDate:candidate.dailyCheckDate||""};
  candidate=appendReceipt(candidate,{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:candidate,result,audit:{
    action:"attendance_batch_upsert",
    before:{attendance:validated.map(item=>attendanceResult({...item,record:item.currentRecord}))},
    after:{attendance:result.attendance,operationId:command.operationId},
  }};
};

const applyDailyCheck=({data,user,command,now})=>{
  const writer=ensureWriter(user);
  if(!writer.ok)return writer;
  const date=String(command.date||"");
  if(!validDate(date)||date!==currentDateForNow(now))return fail("A verificação diária deve registrar a data de hoje.");
  const result={dailyCheckDate:date};
  const next=appendReceipt({...data,dailyCheckDate:date},{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:next,result,audit:{
    action:"attendance_daily_check",before:{dailyCheckDate:data?.dailyCheckDate||""},
    after:{dailyCheckDate:date,operationId:command.operationId},
  }};
};

const applyLock=({data,user,command,now})=>{
  const writer=ensureWriter(user);
  if(!writer.ok)return writer;
  const obraId=String(command.obraId||"");
  const date=String(command.date||"");
  if(!obraId||!findObra(data,obraId))return fail("Obra não encontrada.",404);
  if(!validDate(date))return fail("Data do ponto inválida.");
  const scope=ensureScopedObra(user,obraId);
  if(!scope.ok)return scope;
  const key=lockKey(obraId,date);
  const current=data?.attendanceLocks?.[key]||null;
  if(current?.locked){
    const result={lock:current};
    const next=appendReceipt(data,{operationId:command.operationId,action:command.action,result,user,now});
    return {ok:true,data:next,result,audit:{action:"attendance_lock_idempotent",before:{lock:current},after:{lock:current,operationId:command.operationId}}};
  }
  const obra=findObra(data,obraId);
  const lock={id:key,obraId,obraName:String(obra?.name||""),date,locked:true,lockedAt:now,lockedById:String(user.id||""),lockedBy:String(user.nome||"")};
  const result={lock};
  const next=appendReceipt({...data,attendanceLocks:{...(data?.attendanceLocks||{}),[key]:lock}},{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:next,result,audit:{action:"attendance_lock",before:{lock:current},after:{lock,operationId:command.operationId}}};
};

const applyUnlockRequest=({data,user,command,now})=>{
  if(!UNLOCK_REQUEST_ROLES.has(String(user?.role||"")))return fail("Seu perfil não pode solicitar liberação do ponto.",403);
  const obraId=String(command.obraId||"");
  const date=String(command.date||"");
  const employeeId=String(command.employeeId||"");
  const reason=String(command.reason||"").trim();
  if(!obraId||!findObra(data,obraId))return fail("Obra não encontrada.",404);
  if(!validDate(date))return fail("Data do ponto inválida.");
  if(employeeId&&!findEmployee(data,employeeId))return fail("Funcionário não encontrado.",404);
  if(reason.length<5)return fail("Informe um motivo com ao menos 5 caracteres.");
  const scope=ensureScopedObra(user,obraId);
  if(!scope.ok)return scope;
  if(!data?.attendanceLocks?.[lockKey(obraId,date)]?.locked)return fail("O ponto informado não está bloqueado.",409);
  const requestId=String(command.requestId||command.operationId);
  const obra=findObra(data,obraId),employee=employeeId?findEmployee(data,employeeId):null;
  const request={
    id:requestId,obraId,obraName:String(obra?.name||""),date,employeeId,
    employeeName:String(employee?.name||""),reason,status:"pending",
    requestedAt:now,requestedById:String(user.id||""),requestedBy:String(user.nome||""),
  };
  const result={unlockRequest:request};
  const next=appendReceipt({...data,unlockRequests:[...(data?.unlockRequests||[]),request]},{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:next,result,audit:{action:"attendance_unlock_request",before:{},after:{unlockRequest:request,operationId:command.operationId}}};
};

const mayDecideUnlock=(data,user,request)=>{
  if(String(user?.role||"")==="admin")return true;
  const allowed=new Set([
    ...(Array.isArray(request?.approverIds)?request.approverIds:[]),
    ...(Array.isArray(data?.config?.attendanceUnlockApproverIds)?data.config.attendanceUnlockApproverIds:[]),
  ].map(String));
  return allowed.has(String(user?.id||""));
};
const applyUnlockDecision=({data,user,command,now,approved})=>{
  const requestId=String(command.requestId||"");
  const current=(data?.unlockRequests||[]).find(item=>sameId(item?.id,requestId));
  if(!current)return fail("Solicitação de liberação não encontrada.",404);
  if(!mayDecideUnlock(data,user,current))return fail("Seu perfil não pode decidir esta solicitação.",403);
  if(sameId(current.requestedById,user?.id))return fail("O solicitante não pode aprovar ou recusar a própria solicitação.",403);
  if(current.status!=="pending")return fail("Esta solicitação já foi decidida.",409);
  const requestedMinutes=Number(command.validMinutes??30);
  const minutes=Number.isFinite(requestedMinutes)
    ?Math.max(5,Math.min(120,requestedMinutes))
    :30;
  const decided=approved?{
    ...current,status:"approved",approvedAt:now,approvedById:String(user.id||""),
    approvedBy:String(user.nome||""),validUntil:new Date(new Date(now).getTime()+minutes*60000).toISOString(),
  }:{
    ...current,status:"rejected",rejectedAt:now,rejectedById:String(user.id||""),
    rejectedBy:String(user.nome||""),
  };
  const result={unlockRequest:decided};
  const requests=(data?.unlockRequests||[]).map(item=>sameId(item?.id,requestId)?decided:item);
  const next=appendReceipt({...data,unlockRequests:requests},{operationId:command.operationId,action:command.action,result,user,now});
  return {ok:true,data:next,result,audit:{
    action:approved?"attendance_unlock_approve":"attendance_unlock_reject",
    before:{unlockRequest:current},after:{unlockRequest:decided,operationId:command.operationId},
  }};
};

export const applyAttendanceCommand=(data={},user={},command={},now=new Date().toISOString())=>{
  const base=ensureCommandBase({data,user,command});
  if(!base.ok||base.idempotent)return base;
  if(command.action===ATTENDANCE_COMMAND.UPSERT)return applyUpsert({data,user,command,now});
  if(command.action===ATTENDANCE_COMMAND.BATCH_UPSERT)return applyBatch({data,user,command,now});
  if(command.action===ATTENDANCE_COMMAND.DAILY_CHECK)return applyDailyCheck({data,user,command,now});
  if(command.action===ATTENDANCE_COMMAND.LOCK)return applyLock({data,user,command,now});
  if(command.action===ATTENDANCE_COMMAND.UNLOCK_REQUEST)return applyUnlockRequest({data,user,command,now});
  if(command.action===ATTENDANCE_COMMAND.UNLOCK_APPROVE)return applyUnlockDecision({data,user,command,now,approved:true});
  if(command.action===ATTENDANCE_COMMAND.UNLOCK_REJECT)return applyUnlockDecision({data,user,command,now,approved:false});
  return fail("Comando de ponto não suportado.");
};
