import { isValidIsoDate,isoPeriodsOverlap } from "./date.js";
import { normalizeRentalState,rentalStateLabel } from "./rental-lifecycle.js";

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const quantity=value=>Math.max(1,Math.trunc(number(value)||1));
const active=item=>!["cancelada","cancelado","liberada","liberado","inativa","inativo"].includes(String(item?.status||"ativa"));
export const isActiveUnavailability=active;

export const EQUIPMENT_UNAVAILABILITY_TYPE=Object.freeze({
  RENTAL:"rental",
  RESERVATION:"reservation",
  MAINTENANCE:"maintenance",
  INSPECTION:"inspection",
  TRANSPORT:"transport",
  DAMAGE:"damage",
  ADMINISTRATIVE_BLOCK:"administrative_block",
  QUARANTINE:"quarantine",
});

export const EQUIPMENT_UNAVAILABILITY_LABEL=Object.freeze({
  rental:"Locação",reservation:"Reserva",maintenance:"Manutenção",
  inspection:"Inspeção",transport:"Transporte",damage:"Avaria",
  administrative_block:"Bloqueio administrativo",quarantine:"Quarentena",
});

export const EQUIPMENT_BLOCKING_STATUS=Object.freeze({
  inativo:"inativo",
  manutencao:"em manutenção",
  bloqueado:"bloqueado administrativamente",
  avariado:"avariado",
  aguardando_inspecao:"aguardando inspeção",
});

const typeCategory=type=>type==="rental"?"locado"
  :type==="reservation"?"reservado"
  :type==="maintenance"?"manutencao"
  :"bloqueado";

const normalizedEvent=(item,defaults={})=>{
  const type=String(item?.type||defaults.type||"");
  const startDate=String(item?.startDate||item?.start_date||defaults.startDate||"");
  const endDate=String(item?.endDate||item?.end_date||defaults.endDate||"");
  return {
    ...item,
    id:String(item?.id||defaults.id||""),
    equipmentId:String(item?.equipmentId||item?.equipment_id||defaults.equipmentId||""),
    equipmentUnitId:String(item?.equipmentUnitId||item?.equipment_unit_id||defaults.equipmentUnitId||""),
    equipmentUnitIds:Array.isArray(item?.equipmentUnitIds)?item.equipmentUnitIds.map(String)
      :Array.isArray(defaults.equipmentUnitIds)?defaults.equipmentUnitIds.map(String):[],
    equipmentLotId:String(item?.equipmentLotId||defaults.equipmentLotId||""),
    quantity:item?.affectsCapacity===false||defaults.affectsCapacity===false?0:quantity(item?.quantity??defaults.quantity),
    type,startDate,endDate,
    reason:String(item?.reason||defaults.reason||EQUIPMENT_UNAVAILABILITY_LABEL[type]||"Indisponibilidade"),
    status:String(item?.status||defaults.status||"ativa"),
    workId:String(item?.workId||item?.work_id||defaults.workId||""),
    maintenanceId:String(item?.maintenanceId||item?.maintenance_id||defaults.maintenanceId||""),
    rentalId:String(item?.rentalId||item?.rental_id||defaults.rentalId||""),
    affectsCapacity:item?.affectsCapacity!==false&&defaults.affectsCapacity!==false,
    version:Number(item?.version||defaults.version||0),
  };
};

export const rentalLifecycleAvailability=rental=>{
  if(!rental?.lifecycleState)return {type:EQUIPMENT_UNAVAILABILITY_TYPE.RENTAL,
    status:rental?.status||"ativa",affectsCapacity:true,reason:"Locação"};
  const state=normalizeRentalState(rental.lifecycleState);
  if(["draft","quoted","awaiting_approval","approved","cancelled"].includes(state))return {
    type:EQUIPMENT_UNAVAILABILITY_TYPE.RESERVATION,status:"inativa",affectsCapacity:false,
    reason:`Locação · ${rentalStateLabel(state)}`,
  };
  const type=["reserved","contracted","separating","ready_for_dispatch"].includes(state)
    ?EQUIPMENT_UNAVAILABILITY_TYPE.RESERVATION
    :state==="in_transport"?EQUIPMENT_UNAVAILABILITY_TYPE.TRANSPORT
    :["returned","under_inspection"].includes(state)?EQUIPMENT_UNAVAILABILITY_TYPE.INSPECTION
    :state==="awaiting_adjustment"?EQUIPMENT_UNAVAILABILITY_TYPE.DAMAGE
    :EQUIPMENT_UNAVAILABILITY_TYPE.RENTAL;
  return {type,status:rental.status||"ativa",affectsCapacity:true,reason:`Locação · ${rentalStateLabel(state)}`};
};

export const buildEquipmentUnavailability=(data={})=>{
  const rentals=new Map((data.locacoesEquip||[]).map(item=>[String(item.id||""),item]));
  const explicit=(data.equipmentUnavailability||[]).map(item=>{
    const rental=rentals.get(String(item.rentalId||item.rental_id||""));
    return normalizedEvent(rental?{...item,...rentalLifecycleAvailability(rental)}:item);
  });
  const rentalLinks=new Set(explicit.map(item=>item.rentalId).filter(Boolean));
  const maintenanceLinks=new Set(explicit.map(item=>item.maintenanceId).filter(Boolean));
  const transportLinks=new Set(explicit.map(item=>item.transferId).filter(Boolean));
  const derived=[];

  for(const item of data.locacoesEquip||[]){
    if(rentalLinks.has(String(item.id||"")))continue;
    const lifecycle=rentalLifecycleAvailability(item);
    derived.push(normalizedEvent({}, {
      id:`legacy-rental:${item.id}`,equipmentId:item.equipamentoId,quantity:item.quantidade,
      equipmentUnitId:item.equipmentUnitId,equipmentUnitIds:item.equipmentUnitIds,equipmentLotId:item.equipmentLotId,
      ...lifecycle,startDate:item.inicio,endDate:item.fim,
      workId:item.obraId,rentalId:item.id,version:item.version,
    }));
  }
  for(const item of data.manutencoesEquip||[]){
    if(maintenanceLinks.has(String(item.id||"")))continue;
    const equipment=(data.equipamentos||[]).find(candidate=>String(candidate.id)===String(item.equipamentoId));
    derived.push(normalizedEvent({}, {
      id:`legacy-maintenance:${item.id}`,equipmentId:item.equipamentoId,quantity:item.quantidade||equipment?.quantidadeTotal,
      equipmentUnitId:item.equipmentUnitId,equipmentUnitIds:item.equipmentUnitIds,equipmentLotId:item.equipmentLotId,
      type:"maintenance",startDate:item.inicio||item.data,
      endDate:item.fim||item.dataConclusao||item.inicio||item.data,
      reason:item.descricao||"Manutenção",status:item.status,workId:item.obraId,
      maintenanceId:item.id,version:item.version,
    }));
  }
  for(const item of data.transferenciasEquip||[]){
    if(transportLinks.has(String(item.id||"")))continue;
    derived.push(normalizedEvent({...item,transferId:item.id}, {
      id:`legacy-transport:${item.id}`,equipmentId:item.equipamentoId,quantity:item.quantidade,
      type:"transport",startDate:item.data,endDate:item.data,reason:"Transporte entre obras",
      status:"concluida",workId:item.paraObraId,affectsCapacity:false,version:item.version,
    }));
  }
  return [...explicit,...derived].filter(item=>item.id&&item.equipmentId&&isValidIsoDate(item.startDate));
};

const nextIso=iso=>{
  const date=new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
};

const ignored=(event,except={})=>
  String(event.id)===String(except.id||"")
  ||except.rentalId&&String(event.rentalId)===String(except.rentalId)
  ||except.maintenanceId&&String(event.maintenanceId)===String(except.maintenanceId);

export const fleetAvailability=({data={},equipment={},startDate,endDate="",requested=0,except={},ignoreEquipmentStatus=false}={})=>{
  const total=quantity(equipment.quantidadeTotal);
  const start=String(startDate||""),end=String(endDate||"");
  const periodEnd=end||"9999-12-31";
  const events=buildEquipmentUnavailability(data)
    .filter(event=>String(event.equipmentId)===String(equipment.id)&&active(event)&&!ignored(event,except)
      &&isoPeriodsOverlap(start,end,event.startDate,event.endDate));
  const statusReason=equipment.ativo===false?EQUIPMENT_BLOCKING_STATUS.inativo
    :EQUIPMENT_BLOCKING_STATUS[String(equipment.status||"")]||"";
  if(statusReason&&!ignoreEquipmentStatus)events.push(normalizedEvent({}, {
    id:`equipment-status:${equipment.id}`,equipmentId:equipment.id,quantity:total,
    type:equipment.status==="manutencao"?"maintenance":equipment.status==="avariado"?"damage"
      :equipment.status==="aguardando_inspecao"?"inspection":"administrative_block",
    startDate:start,endDate:end,reason:statusReason,status:"ativa",
  }));

  const checkpoints=new Set([start]);
  events.forEach(event=>{
    if(event.startDate>=start&&event.startDate<=periodEnd)checkpoints.add(event.startDate);
    if(event.endDate){
      const after=nextIso(event.endDate);
      if(after>=start&&after<=periodEnd)checkpoints.add(after);
    }
  });
  let bottleneck={locado:0,reservado:0,manutencao:0,bloqueado:0,livre:total,date:start};
  [...checkpoints].sort().forEach(date=>{
    const values={locado:0,reservado:0,manutencao:0,bloqueado:0};
    events.filter(event=>event.startDate<=date&&(!event.endDate||event.endDate>=date))
      .forEach(event=>{values[typeCategory(event.type)]+=event.quantity;});
    const free=Math.max(0,total-values.locado-values.reservado-values.manutencao-values.bloqueado);
    if(free<bottleneck.livre)bottleneck={...values,livre:free,date};
  });
  const inactive=equipment.ativo===false?total:0;
  const request=quantity(requested);
  return {
    total,inativo:inactive,...bottleneck,requested:request,
    unavailable:bottleneck.manutencao+bottleneck.bloqueado,
    rented:bottleneck.locado,
    free:bottleneck.livre,
    exceeded:number(requested)>0&&request>bottleneck.livre,
    conflicts:events,
    start,end:end||"em aberto",
  };
};

export const rentalAvailability=({data={},equipment={},rental={},exceptRentalId=""}={})=>
  fleetAvailability({
    data,equipment,startDate:rental.inicio,endDate:rental.fim,requested:rental.quantidade,
    except:{rentalId:exceptRentalId},
  });

export const availabilityOnDate=(data,equipment,iso)=>
  fleetAvailability({data,equipment,startDate:iso,endDate:iso,requested:0});
