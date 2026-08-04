export const RENTAL_STATE=Object.freeze({
  DRAFT:"draft",QUOTED:"quoted",RESERVED:"reserved",AWAITING_APPROVAL:"awaiting_approval",
  APPROVED:"approved",CONTRACTED:"contracted",SEPARATING:"separating",
  READY_FOR_DISPATCH:"ready_for_dispatch",IN_TRANSPORT:"in_transport",DELIVERED:"delivered",
  ACTIVE:"active",PICKUP_REQUESTED:"pickup_requested",RETURNED:"returned",
  UNDER_INSPECTION:"under_inspection",AWAITING_ADJUSTMENT:"awaiting_adjustment",
  CLOSED:"closed",CANCELLED:"cancelled",
});

export const RENTAL_STATES=Object.freeze(Object.values(RENTAL_STATE));

export const RENTAL_STATE_LABEL=Object.freeze({
  draft:"Rascunho",quoted:"Orçada",reserved:"Reservada",awaiting_approval:"Aguardando aprovação",
  approved:"Aprovada",contracted:"Contratada",separating:"Em separação",
  ready_for_dispatch:"Pronta para expedição",in_transport:"Em transporte",delivered:"Entregue",
  active:"Ativa",pickup_requested:"Retirada solicitada",returned:"Devolvida",
  under_inspection:"Em inspeção",awaiting_adjustment:"Aguardando ajuste",
  closed:"Encerrada",cancelled:"Cancelada",
});

export const rentalStateLabel=value=>RENTAL_STATE_LABEL[normalizeRentalState(value)]||"Rascunho";

const transitions=Object.freeze({
  draft:["quoted","cancelled"],quoted:["reserved","awaiting_approval","cancelled"],
  reserved:["awaiting_approval","approved","cancelled"],awaiting_approval:["approved","cancelled"],
  approved:["contracted","cancelled"],contracted:["separating","cancelled"],
  separating:["ready_for_dispatch","cancelled"],ready_for_dispatch:["in_transport","cancelled"],
  in_transport:["delivered"],delivered:["active"],active:["pickup_requested"],
  pickup_requested:["returned"],returned:["under_inspection"],
  under_inspection:["awaiting_adjustment","closed"],awaiting_adjustment:["closed"],
  closed:[],cancelled:[],
});

export const normalizeRentalState=value=>{
  const state=String(value||"").trim().toLowerCase();
  if(state==="ativa"||state==="em_andamento")return RENTAL_STATE.ACTIVE;
  if(state==="encerrada")return RENTAL_STATE.CLOSED;
  if(state==="cancelada")return RENTAL_STATE.CANCELLED;
  return RENTAL_STATES.includes(state)?state:RENTAL_STATE.DRAFT;
};

export const availableRentalTransitions=(value,{checkpoints=[]}={})=>{
  const state=normalizeRentalState(value),next=[...(transitions[state]||[])];
  if(state!==RENTAL_STATE.UNDER_INSPECTION)return next;
  const inspection=[...checkpoints].reverse().find(item=>item.type==="inspection"&&item.status!=="cancelled");
  return next.filter(item=>inspection?.needsAdjustment?item===RENTAL_STATE.AWAITING_ADJUSTMENT:item===RENTAL_STATE.CLOSED);
};

export const validateRentalTransition=(currentState,nextState,{reason="",hasBilling=false,checkpoints=[],rentalQuantity=1}={})=>{
  const rawTo=String(nextState||"").trim().toLowerCase();
  const from=normalizeRentalState(currentState),to=normalizeRentalState(rawTo);
  if(!RENTAL_STATES.includes(rawTo))return {ok:false,reason:"Estado de destino da locação inválido."};
  if(from===to)return {ok:false,reason:"A locação já está neste estado."};
  if(!(transitions[from]||[]).includes(to))return {ok:false,reason:`Transição de ${from} para ${to} não permitida.`};
  if(to===RENTAL_STATE.CANCELLED&&!String(reason||"").trim())return {ok:false,reason:"Informe a justificativa do cancelamento."};
  if(to===RENTAL_STATE.CANCELLED&&hasBilling)return {ok:false,reason:"Locação faturada exige processo de estorno antes do cancelamento."};
  const inspection=[...checkpoints].reverse().find(item=>item.type==="inspection"&&item.status!=="cancelled");
  if(from===RENTAL_STATE.UNDER_INSPECTION&&to===RENTAL_STATE.AWAITING_ADJUSTMENT&&!inspection?.needsAdjustment){
    return {ok:false,reason:"A inspeção não indicou necessidade de ajuste."};
  }
  if(from===RENTAL_STATE.UNDER_INSPECTION&&to===RENTAL_STATE.CLOSED&&inspection?.needsAdjustment){
    return {ok:false,reason:"Resolva os ajustes apontados pela inspeção antes de encerrar."};
  }
  const requiredCheckpoint={ready_for_dispatch:"separation",in_transport:"dispatch",delivered:"delivery",
    returned:"return",under_inspection:"inspection"}[to];
  if(requiredCheckpoint&&!checkpoints.some(item=>item.type===requiredCheckpoint&&item.status!=="cancelled")){
    return {ok:false,reason:`Registre o checklist de ${requiredCheckpoint} antes de avançar a locação.`};
  }
  const movementTypes=to===RENTAL_STATE.IN_TRANSPORT?["partial_dispatch","dispatch"]
    :to===RENTAL_STATE.DELIVERED?["partial_delivery","delivery"]:[];
  if(movementTypes.length){
    const moved=checkpoints.filter(item=>movementTypes.includes(item.type)&&item.status!=="cancelled")
      .reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)),0);
    if(moved<Math.max(1,Number(rentalQuantity||1)))return {ok:false,reason:"Ainda existem unidades pendentes de movimentação neste estágio."};
  }
  if(to===RENTAL_STATE.RETURNED){
    const returned=checkpoints.filter(item=>["partial_return","return"].includes(item.type)&&item.status!=="cancelled")
      .reduce((sum,item)=>sum+Math.max(0,Number(item.quantity||0)),0);
    if(returned<Math.max(1,Number(rentalQuantity||1)))return {ok:false,reason:"Ainda existem unidades pendentes de devolução."};
  }
  return {ok:true,from,to};
};

export const validateRentalClosure=rental=>{
  if(!rental?.lifecycleState)return {ok:true,legacy:true};
  const state=normalizeRentalState(rental.lifecycleState);
  if(![RENTAL_STATE.UNDER_INSPECTION,RENTAL_STATE.AWAITING_ADJUSTMENT].includes(state)){
    return {ok:false,reason:"A locação só pode ser encerrada após devolução e inspeção."};
  }
  const inspection=[...(rental.rentalCheckpoints||[])].reverse().find(item=>item.type==="inspection"&&item.status!=="cancelled");
  if(state===RENTAL_STATE.UNDER_INSPECTION&&inspection?.needsAdjustment)return {ok:false,reason:"Resolva os ajustes apontados pela inspeção antes de encerrar."};
  if(state===RENTAL_STATE.AWAITING_ADJUSTMENT&&!(rental.rentalCheckpoints||[]).some(item=>item.type==="adjustment"&&item.status!=="cancelled"))return {ok:false,reason:"Registre a conclusão do ajuste antes de encerrar."};
  return {ok:true,legacy:false};
};
