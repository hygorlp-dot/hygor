import { isValidIsoDate } from "./date.js";
import { normalizeRentalState } from "./rental-lifecycle.js";

export const RENTAL_AMENDMENT_TYPE=Object.freeze({EXTENSION:"extension",RENEWAL:"renewal"});
const RENTAL_AMENDMENT_TYPES=Object.freeze(Object.values(RENTAL_AMENDMENT_TYPE));

const allowedStates=new Set(["contracted","delivered","active","pickup_requested"]);
const text=value=>String(value||"").trim();

export const validateRentalAmendment=(rental={},input={})=>{
  const type=text(input.type),state=normalizeRentalState(rental.lifecycleState||rental.status);
  if(!RENTAL_AMENDMENT_TYPES.includes(type))return {ok:false,reason:"Tipo de aditivo da locação inválido."};
  if(!allowedStates.has(state)||rental.fim)return {ok:false,reason:"Esta locação não permite alteração de prazo no estado atual."};
  const currentEnd=text(rental.plannedEndDate||rental.dataPrevistaFim||rental.inicio);
  if(type===RENTAL_AMENDMENT_TYPE.EXTENSION){
    const newEndDate=text(input.newEndDate);
    if(!isValidIsoDate(newEndDate)||newEndDate<=currentEnd)return {ok:false,reason:"A nova previsão deve ser posterior ao término planejado atual."};
    return {ok:true,record:{type,newEndDate,reason:text(input.reason)}};
  }
  const startDate=text(input.startDate),endDate=text(input.endDate);
  if(!isValidIsoDate(startDate)||!isValidIsoDate(endDate)||endDate<startDate)return {ok:false,reason:"Informe um período válido para a renovação."};
  if(startDate<=currentEnd)return {ok:false,reason:"A renovação deve começar após o término planejado atual."};
  const periods=rental.renewalPeriods||[];
  if(periods.some(item=>startDate<=item.endDate&&endDate>=item.startDate))return {ok:false,reason:"O período da renovação conflita com outro aditivo."};
  return {ok:true,record:{type,startDate,endDate,newEndDate:endDate,reason:text(input.reason)}};
};
