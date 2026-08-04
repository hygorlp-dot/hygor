import { isValidIsoDate } from "./date.js";
import { normalizeRentalState,RENTAL_STATE } from "./rental-lifecycle.js";

export const RENTAL_CHECKPOINT_TYPE=Object.freeze({
  SEPARATION:"separation",DISPATCH:"dispatch",DELIVERY:"delivery",RETURN:"return",INSPECTION:"inspection",
});

export const RENTAL_CHECKPOINT_TYPES=Object.freeze(Object.values(RENTAL_CHECKPOINT_TYPE));

const allowedState=Object.freeze({
  separation:RENTAL_STATE.SEPARATING,
  dispatch:RENTAL_STATE.READY_FOR_DISPATCH,
  delivery:RENTAL_STATE.IN_TRANSPORT,
  return:RENTAL_STATE.PICKUP_REQUESTED,
  inspection:RENTAL_STATE.RETURNED,
});

const text=value=>String(value||"").trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;

export const validateRentalCheckpoint=(rental={},input={},existing=[])=>{
  const type=text(input.type),state=normalizeRentalState(rental.lifecycleState||rental.status);
  if(!RENTAL_CHECKPOINT_TYPES.includes(type))return {ok:false,reason:"Tipo de checklist da locação inválido."};
  if(state!==allowedState[type])return {ok:false,reason:`O checklist de ${type} não pode ser registrado no estado ${state}.`};
  if(existing.some(item=>item.type===type&&item.status!=="cancelled"))return {ok:false,reason:"Este checklist já foi registrado para a locação."};
  if(type===RENTAL_CHECKPOINT_TYPE.DELIVERY&&!existing.some(item=>item.type===RENTAL_CHECKPOINT_TYPE.DISPATCH&&item.status!=="cancelled"))return {ok:false,reason:"Registre a expedição antes da entrega."};
  if(type===RENTAL_CHECKPOINT_TYPE.INSPECTION&&!existing.some(item=>item.type===RENTAL_CHECKPOINT_TYPE.RETURN&&item.status!=="cancelled"))return {ok:false,reason:"Registre a devolução antes da inspeção."};
  if(!isValidIsoDate(text(input.date)))return {ok:false,reason:"Informe uma data válida para o checklist."};
  const quantity=Math.max(0,Math.trunc(number(input.quantity)));
  if(!quantity||quantity>Math.max(1,number(rental.quantidade)))return {ok:false,reason:"A quantidade do checklist deve respeitar a quantidade contratada."};
  if(type===RENTAL_CHECKPOINT_TYPE.RETURN&&quantity!==Math.max(1,number(rental.quantidade)))return {ok:false,reason:"Este fluxo exige a devolução integral; use a devolução parcial quando disponível."};
  const rentalUnitIds=(rental.equipmentUnitIds||[]).map(String);
  const unitIds=[...new Set((input.equipmentUnitIds||[]).map(String).filter(Boolean))];
  if(unitIds.some(id=>!rentalUnitIds.includes(id)))return {ok:false,reason:"Uma unidade informada não pertence à locação."};
  if(rentalUnitIds.length&&unitIds.length!==quantity)return {ok:false,reason:"Informe exatamente as unidades físicas movimentadas."};
  if(type!==RENTAL_CHECKPOINT_TYPE.SEPARATION&&!text(input.responsible))return {ok:false,reason:"Informe o responsável pela movimentação."};
  if(type===RENTAL_CHECKPOINT_TYPE.DELIVERY&&(!text(input.receivedBy)||!text(input.address)))return {ok:false,reason:"Informe quem recebeu e o endereço da entrega."};
  if(number(input.hourMeter)<0)return {ok:false,reason:"O horímetro não pode ser negativo."};
  return {ok:true,record:{
    type,date:text(input.date),quantity,equipmentUnitIds:unitIds,
    accessories:Array.isArray(input.accessories)?input.accessories.map(text).filter(Boolean):[],
    hourMeter:Math.max(0,number(input.hourMeter)),fuel:text(input.fuel),condition:text(input.condition),
    photos:Array.isArray(input.photos)?input.photos.filter(Boolean):[],responsible:text(input.responsible),
    receivedBy:text(input.receivedBy),address:text(input.address),acceptance:text(input.acceptance),notes:text(input.notes),
    cleaning:text(input.cleaning),damages:Array.isArray(input.damages)?input.damages.map(text).filter(Boolean):[],
    missingItems:Array.isArray(input.missingItems)?input.missingItems.map(text).filter(Boolean):[],needsAdjustment:input.needsAdjustment===true,
  }};
};
