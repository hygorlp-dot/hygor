import { isValidIsoDate } from "./date.js";
import { normalizeRentalState,RENTAL_STATE } from "./rental-lifecycle.js";

export const RENTAL_CHECKPOINT_TYPE=Object.freeze({
  SEPARATION:"separation",PARTIAL_DISPATCH:"partial_dispatch",DISPATCH:"dispatch",
  PARTIAL_DELIVERY:"partial_delivery",DELIVERY:"delivery",PARTIAL_RETURN:"partial_return",RETURN:"return",INSPECTION:"inspection",ADJUSTMENT:"adjustment",
});

const RENTAL_CHECKPOINT_TYPES=Object.freeze(Object.values(RENTAL_CHECKPOINT_TYPE));

const allowedState=Object.freeze({
  separation:RENTAL_STATE.SEPARATING,
  partial_dispatch:RENTAL_STATE.READY_FOR_DISPATCH,
  dispatch:RENTAL_STATE.READY_FOR_DISPATCH,
  partial_delivery:RENTAL_STATE.IN_TRANSPORT,
  delivery:RENTAL_STATE.IN_TRANSPORT,
  partial_return:RENTAL_STATE.PICKUP_REQUESTED,
  return:RENTAL_STATE.PICKUP_REQUESTED,
  inspection:RENTAL_STATE.RETURNED,
  adjustment:RENTAL_STATE.AWAITING_ADJUSTMENT,
});

const text=value=>String(value||"").trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;

export const rentalReturnBalance=(rental={},checkpoints=[])=>{
  const returns=checkpoints.filter(item=>[RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN,RENTAL_CHECKPOINT_TYPE.RETURN].includes(item.type)&&item.status!=="cancelled");
  const returnedQuantity=returns.reduce((sum,item)=>sum+Math.max(0,Math.trunc(number(item.quantity))),0);
  const returnedUnitIds=[...new Set(returns.flatMap(item=>item.equipmentUnitIds||[]).map(String))];
  const contractedQuantity=Math.max(1,Math.trunc(number(rental.quantidade)||1));
  return {contractedQuantity,returnedQuantity,returnedUnitIds,remainingQuantity:Math.max(0,contractedQuantity-returnedQuantity),complete:returnedQuantity>=contractedQuantity};
};

const movementBalance=(rental,checkpoints,types)=>{
  const movements=checkpoints.filter(item=>types.includes(item.type)&&item.status!=="cancelled");
  const movedQuantity=movements.reduce((sum,item)=>sum+Math.max(0,Math.trunc(number(item.quantity))),0);
  const movedUnitIds=[...new Set(movements.flatMap(item=>item.equipmentUnitIds||[]).map(String))];
  const contractedQuantity=Math.max(1,Math.trunc(number(rental.quantidade)||1));
  return {contractedQuantity,movedQuantity,movedUnitIds,remainingQuantity:Math.max(0,contractedQuantity-movedQuantity),complete:movedQuantity>=contractedQuantity};
};

export const rentalDispatchBalance=(rental={},checkpoints=[])=>movementBalance(rental,checkpoints,[RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.DISPATCH]);
export const rentalDeliveryBalance=(rental={},checkpoints=[])=>movementBalance(rental,checkpoints,[RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.DELIVERY]);

export const validateRentalCheckpoint=(rental={},input={},existing=[])=>{
  const type=text(input.type),state=normalizeRentalState(rental.lifecycleState||rental.status);
  if(!RENTAL_CHECKPOINT_TYPES.includes(type))return {ok:false,reason:"Tipo de checklist da locação inválido."};
  if(state!==allowedState[type])return {ok:false,reason:`O checklist de ${type} não pode ser registrado no estado ${state}.`};
  const partialTypes=[RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN];
  if(!partialTypes.includes(type)&&existing.some(item=>item.type===type&&item.status!=="cancelled"))return {ok:false,reason:"Este checklist já foi registrado para a locação."};
  if(type===RENTAL_CHECKPOINT_TYPE.DELIVERY&&!existing.some(item=>item.type===RENTAL_CHECKPOINT_TYPE.DISPATCH&&item.status!=="cancelled"))return {ok:false,reason:"Registre a expedição antes da entrega."};
  if(type===RENTAL_CHECKPOINT_TYPE.INSPECTION&&!existing.some(item=>item.type===RENTAL_CHECKPOINT_TYPE.RETURN&&item.status!=="cancelled"))return {ok:false,reason:"Registre a devolução antes da inspeção."};
  if(!isValidIsoDate(text(input.date)))return {ok:false,reason:"Informe uma data válida para o checklist."};
  const quantity=Math.max(0,Math.trunc(number(input.quantity)));
  const balance=[RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.DISPATCH].includes(type)?rentalDispatchBalance(rental,existing)
    :[RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.DELIVERY].includes(type)?rentalDeliveryBalance(rental,existing)
    :rentalReturnBalance(rental,existing);
  const incrementalTypes=[RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.DISPATCH,RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.DELIVERY,RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN,RENTAL_CHECKPOINT_TYPE.RETURN];
  const limit=incrementalTypes.includes(type)?balance.remainingQuantity:Math.max(1,number(rental.quantidade));
  if(!quantity||quantity>limit)return {ok:false,reason:"A quantidade do checklist deve respeitar o saldo da locação."};
  if(partialTypes.includes(type)&&quantity>=balance.remainingQuantity)return {ok:false,reason:"Use o checklist integral para movimentar todo o saldo remanescente."};
  if([RENTAL_CHECKPOINT_TYPE.DISPATCH,RENTAL_CHECKPOINT_TYPE.DELIVERY,RENTAL_CHECKPOINT_TYPE.RETURN].includes(type)&&quantity!==balance.remainingQuantity)return {ok:false,reason:"O checklist integral deve corresponder a todo o saldo remanescente."};
  const rentalUnitIds=(rental.equipmentUnitIds||[]).map(String);
  const unitIds=[...new Set((input.equipmentUnitIds||[]).map(String).filter(Boolean))];
  if(unitIds.some(id=>!rentalUnitIds.includes(id)))return {ok:false,reason:"Uma unidade informada não pertence à locação."};
  const movedUnitIds=balance.returnedUnitIds||balance.movedUnitIds||[];
  if([RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN,RENTAL_CHECKPOINT_TYPE.RETURN].includes(type)&&unitIds.some(id=>movedUnitIds.includes(id)))return {ok:false,reason:"Uma unidade física selecionada já foi devolvida."};
  if([RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.DISPATCH,RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.DELIVERY].includes(type)&&unitIds.some(id=>movedUnitIds.includes(id)))return {ok:false,reason:"Uma unidade física selecionada já foi movimentada neste estágio."};
  if(rentalUnitIds.length&&unitIds.length!==quantity)return {ok:false,reason:"Informe exatamente as unidades físicas movimentadas."};
  if(type!==RENTAL_CHECKPOINT_TYPE.SEPARATION&&!text(input.responsible))return {ok:false,reason:"Informe o responsável pela movimentação."};
  if(type===RENTAL_CHECKPOINT_TYPE.ADJUSTMENT&&!text(input.notes))return {ok:false,reason:"Descreva o ajuste executado."};
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
