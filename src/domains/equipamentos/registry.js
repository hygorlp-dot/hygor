import { buildEquipmentUnavailability,isActiveUnavailability } from "./availability.js";

const list=(data,key)=>Array.isArray(data?.[key])?data[key]:[];
const text=value=>String(value??"").trim();
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const quantity=value=>Math.max(1,Math.trunc(number(value)||1));
const legacyId=(kind,id)=>`legacy-${kind}:${text(id)}`;
const sourceId=item=>text(item?.legacySourceId||item?.sourceEquipmentId);

const modelFromLegacy=equipment=>({
  id:legacyId("model",equipment.id),name:text(equipment.nome)||"Equipamento sem nome",
  category:text(equipment.categoria),manufacturer:text(equipment.fabricante),
  model:text(equipment.modelo),capacity:text(equipment.capacidade),
  specifications:equipment.especificacoes||{},image:equipment.imagem||equipment.imagemUrl||"",
  controlUnit:text(equipment.unidadeControle)||"un",defaultRates:{...(equipment.tarifas||{})},
  defaultCostRates:{...(equipment.tarifasCusto||{})},legacySourceId:text(equipment.id),
  migrationSource:"equipamentos",version:Number(equipment.version||0),
});

const lotFromLegacy=(equipment,modelId,reviewReason="")=>({
  id:legacyId("lot",equipment.id),modelId,quantity:quantity(equipment.quantidadeTotal),
  unit:text(equipment.unidadeControle)||"un",lotCode:text(equipment.codigo||equipment.patrimonio)||`LOTE-${text(equipment.id)}`,
  locationId:"",status:equipment.ativo===false?"inactive":"active",
  legacySourceId:text(equipment.id),migrationSource:"equipamentos",
  requiresReview:Boolean(reviewReason),reviewReason,version:Number(equipment.version||0),
});

const unitFromLegacy=(equipment,modelId)=>({
  id:legacyId("unit",equipment.id),modelId,assetTag:text(equipment.patrimonio),
  serialNumber:text(equipment.numeroSerie),plate:text(equipment.placa),chassis:text(equipment.chassi),
  year:number(equipment.ano)||null,manufacturer:text(equipment.fabricante),model:text(equipment.modelo),
  hourMeter:number(equipment.horimetro),status:text(equipment.status)||"disponivel",locationId:"",
  ownerId:text(equipment.proprietarioId),acquisitionValue:number(equipment.valorAquisicao),
  acquisitionDate:text(equipment.dataAquisicao),legacySourceId:text(equipment.id),
  migrationSource:"equipamentos",version:Number(equipment.version||0),
});

// Projeção aditiva e determinística: coleções novas têm precedência e os
// registros legados somente preenchem origens ainda não materializadas.
export const buildEquipmentRegistry=(data={})=>{
  const models=[...list(data,"equipmentModels")];
  const lots=[...list(data,"equipmentLots")];
  const units=[...list(data,"equipmentUnits")];
  const modelSources=new Set(models.map(sourceId).filter(Boolean));
  const lotSources=new Set(lots.map(sourceId).filter(Boolean));
  const unitSources=new Set(units.map(sourceId).filter(Boolean));
  const report={convertedToUnits:[],convertedToLots:[],ambiguous:[],manualReview:[]};

  for(const equipment of list(data,"equipamentos")){
    if(!equipment?.id)continue;
    const origin=text(equipment.id);
    let model=models.find(item=>sourceId(item)===origin);
    if(!model){
      model=modelFromLegacy(equipment);
      if(!modelSources.has(origin)){models.push(model);modelSources.add(origin);}
    }
    const total=quantity(equipment.quantidadeTotal);
    const patrimony=text(equipment.patrimonio);
    if(total===1&&patrimony){
      if(!unitSources.has(origin)){units.push(unitFromLegacy(equipment,model.id));unitSources.add(origin);}
      report.convertedToUnits.push(origin);
      continue;
    }
    const reason=total===1
      ?"Registro unitário sem patrimônio; confirmar se é lote ou ativo individual."
      :patrimony?"Registro com várias unidades e um único patrimônio; individualização pendente.":"";
    if(!lotSources.has(origin)){lots.push(lotFromLegacy(equipment,model.id,reason));lotSources.add(origin);}
    report.convertedToLots.push(origin);
    if(reason){report.ambiguous.push(origin);report.manualReview.push({equipmentId:origin,reason});}
  }
  return {models,lots,units,report};
};

const onDate=(event,asOf)=>isActiveUnavailability(event)
  &&event.startDate<=asOf&&(!event.endDate||event.endDate>=asOf);
const locationType=event=>event.type==="rental"||event.type==="reservation"?"work"
  :event.type==="maintenance"?"maintenance":event.type==="transport"?"transport":"blocked";
const allocationKey=(type,locationId)=>`${type}:${locationId}`;

export const deriveEquipmentLocations=(data={},asOf=new Date().toISOString().slice(0,10))=>{
  const registry=buildEquipmentRegistry(data);
  const events=buildEquipmentUnavailability(data).filter(event=>onDate(event,asOf));
  const allocations=[];
  const add=(entry)=>{
    const current=allocations.find(item=>item.key===entry.key);
    if(current)current.quantity+=entry.quantity;
    else allocations.push(entry);
  };
  for(const lot of registry.lots){
    const origin=sourceId(lot);
    const lotEvents=events.filter(event=>String(event.equipmentId)===origin&&!event.equipmentUnitId);
    let allocated=0;
    for(const event of lotEvents){
      const amount=Math.max(0,number(event.quantity));
      allocated+=amount;
      const type=locationType(event),locationId=text(event.workId)||type;
      add({key:`lot:${lot.id}:${allocationKey(type,locationId)}`,modelId:lot.modelId,lotId:lot.id,
        unitId:"",type,locationId,quantity:amount,eventIds:[event.id]});
    }
    const free=Math.max(0,number(lot.quantity)-allocated);
    if(free)add({key:`lot:${lot.id}:depot:depot`,modelId:lot.modelId,lotId:lot.id,unitId:"",
      type:"depot",locationId:"depot",quantity:free,eventIds:[]});
    if(allocated>number(lot.quantity))add({key:`lot:${lot.id}:exceeded:exceeded`,modelId:lot.modelId,
      lotId:lot.id,unitId:"",type:"exceeded",locationId:"exceeded",quantity:allocated-number(lot.quantity),eventIds:lotEvents.map(item=>item.id)});
  }
  for(const unit of registry.units){
    const origin=sourceId(unit);
    const candidates=events.filter(event=>String(event.equipmentUnitId)===String(unit.id)
      ||(!event.equipmentUnitId&&String(event.equipmentId)===origin));
    const event=candidates.sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)))[0];
    const type=event?locationType(event):"depot",locationId=event?(text(event.workId)||type):"depot";
    add({key:`unit:${unit.id}:${allocationKey(type,locationId)}`,modelId:unit.modelId,lotId:"",
      unitId:unit.id,type,locationId,quantity:1,eventIds:event?[event.id]:[]});
  }
  return {...registry,asOf,allocations};
};

// Materializa a migração sem remover a coleção `equipamentos`. Pode ser usada
// uma única vez por comando futuro ou repetidamente, pois é idempotente.
export const migrateLegacyEquipmentRegistry=data=>{
  const registry=buildEquipmentRegistry(data);
  return {...data,equipmentModels:registry.models,equipmentLots:registry.lots,equipmentUnits:registry.units,
    equipmentRegistryMigration:{version:1,report:registry.report}};
};
