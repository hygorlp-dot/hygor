import { isValidIsoDate } from "./date.js";
import { normalizeRentalState } from "./rental-lifecycle.js";

const allowed=new Set(["separating","ready_for_dispatch","in_transport","delivered","active","pickup_requested"]);
const text=value=>String(value||"").trim();

export const validateRentalReplacement=(rental={},input={},units=[])=>{
  const state=normalizeRentalState(rental.lifecycleState||rental.status);
  if(!allowed.has(state)||rental.fim)return {ok:false,reason:"Esta locação não permite substituição no estado atual."};
  const outgoingUnitId=text(input.outgoingUnitId),incomingUnitId=text(input.incomingUnitId),reason=text(input.reason),date=text(input.date);
  if(!isValidIsoDate(date))return {ok:false,reason:"Informe uma data válida para a substituição."};
  if(!reason)return {ok:false,reason:"Informe o motivo da substituição."};
  if(!outgoingUnitId||!(rental.equipmentUnitIds||[]).map(String).includes(outgoingUnitId))return {ok:false,reason:"Selecione uma unidade atual da locação."};
  if(!incomingUnitId||incomingUnitId===outgoingUnitId)return {ok:false,reason:"Selecione uma unidade substituta diferente."};
  const incoming=units.find(item=>String(item.id)===incomingUnitId);
  if(!incoming||incoming.status==="superseded")return {ok:false,reason:"A unidade substituta não existe ou está inativa."};
  return {ok:true,record:{outgoingUnitId,incomingUnitId,date,reason,notes:text(input.notes)}};
};
