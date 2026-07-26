import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { canOperateTechnicalMeasurement } from "../src/domains/medicoes/permissions.js";

export const operationalCommandObraId=(data={},command={})=>{
  const payload=command?.payload||{};
  if(command?.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED)return String(payload?.measurement?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED)return String((data?.medicoesObra||[]).find(item=>item.id===payload?.measurementId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED)return String(payload?.report?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED)return String((data?.rdos||[]).find(item=>item.id===payload?.reportId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED)return String(payload?.record?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED)return String((data?.progressRecords||[]).find(item=>item.id===payload?.recordId)?.obraId||"");
  if(command?.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED)return String((data?.pedidos||[]).find(item=>item.id===payload?.pedidoId)?.obraId||"");
  return "";
};

export const validateOperationalCommandScope=({user={},data={},command={}}={})=>{
  const obraId=operationalCommandObraId(data,command);
  if(!obraId)return {ok:false,error:"O comando operacional precisa estar vinculado a uma obra existente."};
  const isMeasurement=[OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED].includes(command.type);
  const allowed=isMeasurement
    ? canOperateTechnicalMeasurement(user,obraId)
    : user?.role==="admin"||!user?.obraId||String(user.obraId)===obraId;
  return allowed?{ok:true,obraId}:{ok:false,error:"Esta obra não está disponível no seu escopo operacional."};
};
