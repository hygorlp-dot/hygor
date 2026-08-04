import {
  EQUIPMENT_UNAVAILABILITY_TYPE,
  buildEquipmentUnavailability,
  fleetAvailability,
  rentalAvailability,
} from "./availability.js";
import { diasLocacaoNoPeriodo, validateRentalDiscounts } from "./calculations.js";
import { isValidIsoDate } from "./date.js";
import { buildEquipmentRegistry,deriveEquipmentLocations,migrateLegacyEquipmentRegistry } from "./registry.js";
import { validateRentalClosure,validateRentalTransition } from "./rental-lifecycle.js";
import { validateRentalCheckpoint } from "./rental-checkpoints.js";
import { RENTAL_AMENDMENT_TYPE,validateRentalAmendment } from "./rental-amendments.js";
import { validateRentalReplacement } from "./rental-replacements.js";

const EQUIPMENT_STATUS=new Set(["disponivel","locado","manutencao","inativo","bloqueado","avariado","aguardando_inspecao"]);
const RATE_KEYS=["dia","semana","quinzena","mes"];
const versionOf=value=>Number(value?.version||0);
const fail=reason=>({ok:false,reason});
const list=(data,key)=>Array.isArray(data?.[key])?data[key]:[];
const replace=(data,key,id,value)=>({...data,[key]:list(data,key).map(item=>String(item.id)===String(id)?value:item)});
const numeric=value=>{
  const number=Number(value||0);
  return Number.isFinite(number)?number:0;
};
const quantity=value=>Math.max(1,Math.trunc(numeric(value)||1));
const rates=value=>Object.fromEntries(RATE_KEYS.map(key=>[key,Math.max(0,numeric(value?.[key]))]));
const versionError=(current,expected,label)=>{
  if(expected==null)return "";
  return versionOf(current)===Number(expected)?"":`${label} foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.`;
};
const audit=(current,command,now,type,details={})=>[...(current?.operationalHistory||[]),{
  id:`${type.toLowerCase()}_${command.idempotencyKey}`,type,at:now,
  actorId:command.actorId||"",actorName:command.actorName||"",...details,
}].slice(-200);
const obraExists=(data,id)=>!id||list(data,"obras").some(item=>String(item.id)===String(id));
const activeRental=rental=>rental?.status!=="cancelada"&&!rental?.fim;
const hasOpenRental=(data,equipmentId,exceptId="")=>list(data,"locacoesEquip")
  .some(item=>String(item.equipamentoId)===String(equipmentId)&&String(item.id)!==String(exceptId)&&activeRental(item));
const unavailabilityList=data=>list(data,"equipmentUnavailability");
const upsertUnavailability=(data,record)=>{
  const current=unavailabilityList(data).find(item=>String(item.id)===String(record.id));
  return current?replace(data,"equipmentUnavailability",record.id,{...current,...record})
    :{...data,equipmentUnavailability:[...unavailabilityList(data),record]};
};
const unavailabilityConflict=availability=>{
  const reasons=[...new Set(availability.conflicts.map(item=>item.reason).filter(Boolean))].join(", ")||"capacidade insuficiente";
  return `Equipamento indisponível (${reasons}) no período ${availability.start} a ${availability.end}: ${availability.locado} locada(s), ${availability.reservado} reservada(s), ${availability.manutencao} em manutenção, ${availability.bloqueado} bloqueada(s), ${availability.free} livre(s) e ${availability.requested} solicitada(s).`;
};

const normalizeEquipment=input=>({
  ...input,
  nome:String(input?.nome||"").trim(),
  categoria:String(input?.categoria||"").trim(),
  patrimonio:String(input?.patrimonio||"").trim(),
  tarifas:rates(input?.tarifas),
  tarifasCusto:rates(input?.tarifasCusto),
  quantidadeTotal:Math.max(1,Math.trunc(numeric(input?.quantidadeTotal)||1)),
  valorDiaria:Math.max(0,numeric(input?.tarifas?.dia??input?.valorDiaria)),
  custoDiaria:Math.max(0,numeric(input?.tarifasCusto?.dia??input?.custoDiaria)),
  valorAquisicao:Math.max(0,numeric(input?.valorAquisicao)),
  sinapiPreco:Math.max(0,numeric(input?.sinapiPreco)),
});

const hasRates=value=>RATE_KEYS.some(key=>numeric(value?.[key])>0);
const commercialSnapshot=(input,equipment,command,now)=>{
  const negotiatedRates=rates(input.tarifas);
  const negotiatedCostRates=rates(input.tarifasCusto);
  const source=hasRates(negotiatedRates)||hasRates(negotiatedCostRates)||input.tarifaNegociada===true
    ?"negociada":"cadastro_equipamento";
  const effectiveRates=source==="negociada"&&hasRates(negotiatedRates)?negotiatedRates:rates(equipment.tarifas);
  const effectiveCostRates=source==="negociada"&&hasRates(negotiatedCostRates)?negotiatedCostRates:rates(equipment.tarifasCusto);
  if(!hasRates(effectiveRates)&&numeric(input.valorDiaria)>0)effectiveRates.dia=numeric(input.valorDiaria);
  if(!hasRates(effectiveCostRates)&&numeric(input.custoDiaria)>0)effectiveCostRates.dia=numeric(input.custoDiaria);
  return {
    tarifas:effectiveRates,tarifasCusto:effectiveCostRates,
    descontoPct:numeric(input.descontoPct),descontoValor:numeric(input.descontoValor),
    regraTarifaria:String(input.regraTarifaria||"menor_combinacao"),
    negociadoEm:now,negociadoPorId:command.actorId||"",negociadoPor:command.actorName||"",
    origemTabela:source,versaoTabela:Number(equipment.rateVersion||equipment.version||0),
  };
};

export const EQUIPMENT_COMMAND=Object.freeze({
  EQUIPMENT_REGISTRY_MIGRATED:"CADASTRO_FISICO_EQUIPAMENTOS_MIGRADO",
  EQUIPMENT_REGISTRY_CLASSIFIED:"CADASTRO_FISICO_EQUIPAMENTO_CLASSIFICADO",
  EQUIPMENT_SAVED:"EQUIPAMENTO_SALVO",
  EQUIPMENT_DEACTIVATED:"EQUIPAMENTO_INATIVADO",
  EQUIPMENT_RENTAL_SAVED:"LOCACAO_EQUIPAMENTO_SALVA",
  EQUIPMENT_RENTAL_CLOSED:"LOCACAO_EQUIPAMENTO_ENCERRADA",
  EQUIPMENT_RENTAL_CANCELLED:"LOCACAO_EQUIPAMENTO_CANCELADA",
  EQUIPMENT_RENTAL_TRANSITIONED:"LOCACAO_EQUIPAMENTO_ESTADO_ALTERADO",
  EQUIPMENT_RENTAL_CHECKPOINT_RECORDED:"LOCACAO_EQUIPAMENTO_CHECKLIST_REGISTRADO",
  EQUIPMENT_RENTAL_AMENDED:"LOCACAO_EQUIPAMENTO_ADITIVADA",
  EQUIPMENT_RENTAL_UNIT_REPLACED:"LOCACAO_EQUIPAMENTO_UNIDADE_SUBSTITUIDA",
  EQUIPMENT_RESERVATION_SAVED:"RESERVA_EQUIPAMENTO_SALVA",
  EQUIPMENT_RESERVATION_CANCELLED:"RESERVA_EQUIPAMENTO_CANCELADA",
  EQUIPMENT_UNAVAILABILITY_SAVED:"INDISPONIBILIDADE_EQUIPAMENTO_SALVA",
  EQUIPMENT_UNAVAILABILITY_CANCELLED:"INDISPONIBILIDADE_EQUIPAMENTO_CANCELADA",
  EQUIPMENT_MAINTENANCE_SAVED:"MANUTENCAO_EQUIPAMENTO_SALVA",
  EQUIPMENT_TRANSFERRED:"EQUIPAMENTO_TRANSFERIDO",
});

export const EQUIPMENT_COMMAND_TYPES=new Set(Object.values(EQUIPMENT_COMMAND));

export const equipmentCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_REGISTRY_MIGRATED)return "";
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED)return "";
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_SAVED)return String(payload.equipment?.obraAtualId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_DEACTIVATED)return String(list(data,"equipamentos").find(item=>item.id===payload.equipmentId)?.obraAtualId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_SAVED)return String(payload.rental?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CLOSED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CANCELLED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_AMENDED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if([EQUIPMENT_COMMAND.EQUIPMENT_RESERVATION_SAVED,EQUIPMENT_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED].includes(command.type))return String(payload.unavailability?.workId||"");
  if([EQUIPMENT_COMMAND.EQUIPMENT_RESERVATION_CANCELLED,EQUIPMENT_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED].includes(command.type))return String(unavailabilityList(data).find(item=>item.id===payload.unavailabilityId)?.workId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_MAINTENANCE_SAVED){
    const input=payload.maintenance||{};
    const equipment=list(data,"equipamentos").find(item=>item.id===input.equipamentoId);
    return String(input.obraId||equipment?.obraAtualId||"");
  }
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_TRANSFERRED)return String(payload.transfer?.paraObraId||"");
  return "";
};

export const applyEquipmentCommand=(data={},command={},now=new Date().toISOString())=>{
  const payload=command.payload||{};

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_REGISTRY_MIGRATED){
    const currentVersion=Number(data?.equipmentRegistryMigration?.version||0);
    if(command.expectedVersion!=null&&currentVersion!==Number(command.expectedVersion))return fail("O cadastro físico foi migrado por outra pessoa. Atualize os dados antes de tentar novamente.");
    if(currentVersion>=1)return {ok:true,data,entityId:"equipment-registry-v1"};
    const migrated=migrateLegacyEquipmentRegistry(data);
    migrated.equipmentRegistryMigration={...migrated.equipmentRegistryMigration,migratedAt:now,
      migratedById:command.actorId||"",version:1,operationalHistory:[{
        id:`equipment_registry_migrated_${command.idempotencyKey}`,type:"EQUIPMENT_REGISTRY_MIGRATED",
        at:now,actorId:command.actorId||"",actorName:command.actorName||"",
        report:migrated.equipmentRegistryMigration.report,
      }]};
    return {ok:true,data:migrated,entityId:"equipment-registry-v1"};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED){
    if(Number(data?.equipmentRegistryMigration?.version||0)<1)return fail("Materialize o cadastro físico antes de revisar a classificação.");
    const equipmentId=String(payload.equipmentId||""),kind=String(payload.kind||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===equipmentId);
    if(!equipment)return fail("Equipamento legado não encontrado.");
    const registry=buildEquipmentRegistry(data);
    const model=registry.models.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===equipmentId);
    if(!model)return fail("Modelo físico não encontrado.");
    const revision=Number(data.equipmentRegistryRevision||0);
    if(command.expectedVersion!=null&&revision!==Number(command.expectedVersion))return fail("A classificação física foi alterada por outra pessoa. Atualize a tela.");
    let lots=list(data,"equipmentLots"),units=list(data,"equipmentUnits");
    if(kind==="lot"){
      const amount=Math.max(1,Math.trunc(numeric(payload.lot?.quantity)||Number(equipment.quantidadeTotal)||1));
      const current=lots.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===equipmentId&&item.status!=="superseded");
      const record={...(current||{}),...(payload.lot||{}),id:String(current?.id||payload.lot?.id||`legacy-lot:${equipmentId}`),modelId:model.id,
        quantity:amount,unit:String(payload.lot?.unit||current?.unit||"un"),lotCode:String(payload.lot?.lotCode||current?.lotCode||`LOTE-${equipmentId}`),
        legacySourceId:equipmentId,classificationReviewed:true,reviewedAt:now,reviewedById:command.actorId||"",status:"active",version:versionOf(current)+1};
      lots=current?lots.map(item=>item.id===current.id?record:item):[...lots,record];
      units=units.map(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===equipmentId?{...item,status:"superseded",supersededAt:now}:item);
    }else if(kind==="unit"){
      const requested=Array.isArray(payload.units)?payload.units:[];
      const expected=Math.max(1,Math.trunc(Number(equipment.quantidadeTotal)||1));
      const tags=requested.map(item=>String(item.assetTag||"").trim()).filter(Boolean);
      if(requested.length!==expected||tags.length!==expected||new Set(tags.map(tag=>tag.toUpperCase())).size!==expected)return fail(`Informe ${expected} patrimônio(s) único(s) para individualizar este equipamento.`);
      lots=lots.map(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===equipmentId?{...item,status:"superseded",supersededAt:now}:item);
      const otherUnits=units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")!==equipmentId);
      units=[...otherUnits,...requested.map((item,index)=>({...item,id:String(item.id||`unit:${equipmentId}:${index+1}`),modelId:model.id,
        assetTag:tags[index],legacySourceId:equipmentId,classificationReviewed:true,reviewedAt:now,reviewedById:command.actorId||"",
        status:String(item.status||"disponivel"),version:Number(item.version||0)+1}))];
    }else return fail("Escolha classificar como lote ou unidade física.");
    const history=[...(data.equipmentRegistryHistory||[]),{id:`equipment_registry_classified_${command.idempotencyKey}`,
      type:"EQUIPMENT_REGISTRY_CLASSIFIED",equipmentId,kind,at:now,actorId:command.actorId||"",actorName:command.actorName||""}].slice(-500);
    return {ok:true,data:{...data,equipmentLots:lots,equipmentUnits:units,equipmentRegistryRevision:revision+1,equipmentRegistryHistory:history},entityId:equipmentId};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_SAVED){
    const input=normalizeEquipment(payload.equipment||{});
    if(!input.id||!input.nome)return fail("Informe a identificação e o nome do equipamento.");
    if(!EQUIPMENT_STATUS.has(String(input.status||"disponivel")))return fail("Situação do equipamento inválida.");
    if(!obraExists(data,input.obraAtualId))return fail("A obra atual do equipamento não existe.");
    const duplicatePatrimony=input.patrimonio&&list(data,"equipamentos").some(item=>
      item.ativo!==false&&String(item.id)!==String(input.id)
      && String(item.patrimonio||"").trim().toUpperCase()===input.patrimonio.toUpperCase()
    );
    if(duplicatePatrimony)return fail("Já existe um equipamento ativo com este patrimônio.");
    const current=list(data,"equipamentos").find(item=>String(item.id)===String(input.id));
    const stale=versionError(current,command.expectedVersion,"O equipamento");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O equipamento ainda não existe na versão esperada.");
    const record={
      ...(current||{}),...input,id:String(input.id),ativo:current?.ativo!==false,
      status:String(input.status||current?.status||"disponivel"),
      version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:input.createdAt||now,createdById:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_UPDATED":"EQUIPMENT_CREATED");
    const next=current?replace(data,"equipamentos",record.id,record):{...data,equipamentos:[...list(data,"equipamentos"),record]};
    return {ok:true,data:next,entityId:record.id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_DEACTIVATED){
    const id=String(payload.equipmentId||"");
    const current=list(data,"equipamentos").find(item=>String(item.id)===id);
    if(!current)return fail("Equipamento não encontrado.");
    const stale=versionError(current,command.expectedVersion,"O equipamento");
    if(stale)return fail(stale);
    if(current.ativo===false)return fail("O equipamento já está inativo.");
    if(hasOpenRental(data,id))return fail("Encerre as locações em aberto antes de inativar o equipamento.");
    const reason=String(payload.reason||"Inativado no cadastro").trim();
    const record={...current,ativo:false,status:"inativo",version:versionOf(current)+1,updatedAt:now,
      inativadoEm:now,inativadoPorId:command.actorId||"",motivoInativacao:reason};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_DEACTIVATED",{reason});
    return {ok:true,data:replace(data,"equipamentos",id,record),entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_SAVED){
    const input=payload.rental||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipamentoId));
    if(!id||!equipment||equipment.ativo===false)return fail("Selecione um equipamento ativo.");
    if(!obraExists(data,input.obraId)||!input.obraId)return fail("Selecione uma obra existente.");
    if(!isValidIsoDate(input.inicio)||input.fim&&(!isValidIsoDate(input.fim)||String(input.fim)<String(input.inicio)))return fail("Informe um período válido para a locação.");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A locação ainda não existe na versão esperada.");
    const selectedUnitIds=[...new Set((Array.isArray(input.equipmentUnitIds)?input.equipmentUnitIds:[]).map(String).filter(Boolean))];
    const quantidade=Math.max(1,Math.trunc(numeric(input.quantidade)||1));
    const registry=buildEquipmentRegistry(data);
    const sourceUnits=registry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    const sourceLots=registry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    if(selectedUnitIds.some(unitId=>!sourceUnits.some(unit=>String(unit.id)===unitId)))return fail("Uma das unidades físicas selecionadas não pertence ao equipamento.");
    if(Number(data?.equipmentRegistryMigration?.version||0)>=1&&sourceUnits.length&&!current&&!selectedUnitIds.length)return fail("Selecione a unidade física que será locada.");
    if(selectedUnitIds.length&&selectedUnitIds.length!==quantidade)return fail("A quantidade da locação deve corresponder às unidades físicas selecionadas.");
    if(input.equipmentLotId&&!sourceLots.some(lot=>String(lot.id)===String(input.equipmentLotId)))return fail("O lote selecionado não pertence ao equipamento.");
    if(input.equipmentLotId&&quantidade>Number(sourceLots.find(lot=>String(lot.id)===String(input.equipmentLotId))?.quantity||0))return fail("A quantidade solicitada é superior à quantidade do lote.");
    const candidate={...input,id,quantidade,equipmentUnitIds:selectedUnitIds,
      equipmentUnitId:selectedUnitIds.length===1?selectedUnitIds[0]:"",equipmentLotId:String(input.equipmentLotId||""),
      inicio:String(input.inicio),fim:String(input.fim||"")};
    const availability=rentalAvailability({data,equipment,rental:candidate,exceptRentalId:current?.id});
    if(availability.exceeded){
      return fail(unavailabilityConflict(availability));
    }
    const occupiedUnits=new Set(availability.conflicts.flatMap(event=>[
      event.equipmentUnitId,...(event.equipmentUnitIds||[]),
    ]).filter(Boolean).map(String));
    const repeatedUnit=selectedUnitIds.find(unitId=>occupiedUnits.has(unitId));
    if(repeatedUnit)return fail("A unidade física selecionada já está indisponível no período informado.");
    const contractDays=candidate.fim?diasLocacaoNoPeriodo(candidate,candidate.inicio,candidate.fim):30;
    const discountCandidate=current?.commercialSnapshot?{
      ...candidate,
      descontoPct:current.commercialSnapshot.descontoPct,
      descontoValor:current.commercialSnapshot.descontoValor,
    }:candidate;
    const discountValidation=validateRentalDiscounts(discountCandidate,equipment,contractDays);
    if(!discountValidation.ok)return fail(discountValidation.reason);
    const snapshot=current?.commercialSnapshot||commercialSnapshot(candidate,equipment,command,now);
    const record={
      ...(current||{}),...candidate,
      tarifas:rates(input.tarifas),tarifasCusto:rates(input.tarifasCusto),
      valorDiaria:Math.max(0,numeric(input.valorDiaria)),custoDiaria:Math.max(0,numeric(input.custoDiaria)),
      descontoPct:snapshot.descontoPct,descontoValor:snapshot.descontoValor,
      commercialSnapshot:snapshot,
      lifecycleState:current?.lifecycleState||(input.fim?"closed":"active"),
      status:input.fim?"encerrada":"ativa",version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:now,createdById:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_RENTAL_UPDATED":"EQUIPMENT_RENTAL_CREATED");
    let next=current?replace(data,"locacoesEquip",id,record):{...data,locacoesEquip:[...list(data,"locacoesEquip"),record]};
    next=upsertUnavailability(next,{
      id:`unav-rental:${id}`,equipmentId:equipment.id,equipmentUnitId:selectedUnitIds.length===1?selectedUnitIds[0]:"",quantity,
      equipmentUnitIds:selectedUnitIds,equipmentLotId:record.equipmentLotId||"",
      type:EQUIPMENT_UNAVAILABILITY_TYPE.RENTAL,startDate:record.inicio,endDate:record.fim,
      reason:`Locação para ${list(data,"obras").find(item=>String(item.id)===String(record.obraId))?.name||"obra"}`,
      status:record.status,workId:record.obraId,maintenanceId:"",rentalId:id,
      createdAt:current?.commercialSnapshot?unavailabilityList(data).find(item=>item.rentalId===id)?.createdAt||now:now,
      createdBy:command.actorId||"",version:versionOf(unavailabilityList(data).find(item=>item.rentalId===id))+1,
    });
    const affectedEquipmentIds=new Set([current?.equipamentoId,equipment.id].filter(Boolean).map(String));
    for(const equipmentId of affectedEquipmentIds){
      const affected=list(next,"equipamentos").find(item=>String(item.id)===equipmentId);
      if(!affected)continue;
      const openRental=list(next,"locacoesEquip").find(item=>
        String(item.equipamentoId)===equipmentId&&activeRental(item));
      const updatedEquipment={...affected,status:openRental?"locado":"disponivel",
        obraAtualId:openRental?.obraId||"",version:versionOf(affected)+1,updatedAt:now};
      updatedEquipment.operationalHistory=audit(affected,command,now,
        openRental?"EQUIPMENT_ALLOCATED":"EQUIPMENT_RELEASED",
        {obraId:openRental?.obraId||"",rentalId:id});
      next=replace(next,"equipamentos",equipmentId,updatedEquipment);
    }
    return {ok:true,data:next,entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CLOSED){
    const id=String(payload.rentalId||"");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    if(current.fim)return fail("A locação já está encerrada.");
    const closure=validateRentalClosure(current);
    if(!closure.ok)return fail(closure.reason);
    const endDate=String(payload.endDate||"");
    if(!isValidIsoDate(endDate)||endDate<String(current.inicio||""))return fail("Informe uma data de término válida.");
    const record={...current,fim:endDate,status:"encerrada",lifecycleState:"closed",version:versionOf(current)+1,updatedAt:now,
      encerradoEm:now,encerradoPorId:command.actorId||""};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_CLOSED",{endDate});
    let next=replace(data,"locacoesEquip",id,record);
    const rentalEvent=unavailabilityList(next).find(item=>String(item.rentalId)===id);
    if(rentalEvent)next=upsertUnavailability(next,{...rentalEvent,endDate,status:"encerrada",version:versionOf(rentalEvent)+1,updatedAt:now});
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(current.equipamentoId));
    if(equipment&&!hasOpenRental(next,equipment.id,id)){
      const updatedEquipment={...equipment,status:"disponivel",obraAtualId:"",version:versionOf(equipment)+1,updatedAt:now};
      updatedEquipment.operationalHistory=audit(equipment,command,now,"EQUIPMENT_RELEASED",{rentalId:id});
      next=replace(next,"equipamentos",equipment.id,updatedEquipment);
    }
    return {ok:true,data:next,entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CANCELLED){
    const id=String(payload.rentalId||"");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    if(current.status==="cancelada")return fail("A locação já foi excluída.");
    const reason=String(payload.reason||"Excluída pelo cadastro de locações").trim();
    const record={...current,status:"cancelada",lifecycleState:"cancelled",version:versionOf(current)+1,updatedAt:now,
      canceladoEm:now,canceladoPorId:command.actorId||"",motivoCancelamento:reason};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_CANCELLED",{reason});
    let next=replace(data,"locacoesEquip",id,record);
    const rentalEvent=unavailabilityList(next).find(item=>String(item.rentalId)===id);
    if(rentalEvent)next=upsertUnavailability(next,{...rentalEvent,status:"cancelada",version:versionOf(rentalEvent)+1,updatedAt:now});
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(current.equipamentoId));
    if(equipment){
      const remaining=list(next,"locacoesEquip").find(item=>
        String(item.equipamentoId)===String(equipment.id)&&activeRental(item));
      const updatedEquipment={...equipment,status:remaining?"locado":"disponivel",
        obraAtualId:remaining?.obraId||"",version:versionOf(equipment)+1,updatedAt:now};
      updatedEquipment.operationalHistory=audit(equipment,command,now,"EQUIPMENT_RENTAL_REMOVED",{rentalId:id,reason});
      next=replace(next,"equipamentos",equipment.id,updatedEquipment);
    }
    return {ok:true,data:next,entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED){
    const id=String(payload.rentalId||"");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    const hasBilling=list(data,"rentalChargeItems").some(item=>String(item.rentalId)===id&&item.status!=="cancelled")
      ||list(data,"rentalInvoices").some(item=>String(item.rentalId)===id&&item.status!=="cancelled");
    const validation=validateRentalTransition(current.lifecycleState||current.status,payload.nextState,{reason:payload.reason,hasBilling,checkpoints:current.rentalCheckpoints||[],rentalQuantity:current.quantidade});
    if(!validation.ok)return fail(validation.reason);
    const event={id:`rental_transition_${command.idempotencyKey}`,type:"EQUIPMENT_RENTAL_TRANSITIONED",
      from:validation.from,to:validation.to,reason:String(payload.reason||"").trim(),at:now,
      actorId:command.actorId||"",actorName:command.actorName||""};
    const record={...current,lifecycleState:validation.to,version:versionOf(current)+1,updatedAt:now,
      lifecycleHistory:[...(current.lifecycleHistory||[]),event].slice(-500)};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_TRANSITIONED",{from:validation.from,to:validation.to,reason:event.reason});
    return {ok:true,data:replace(data,"locacoesEquip",id,record),entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED){
    const id=String(payload.rentalId||"");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    const existing=current.rentalCheckpoints||[];
    const validation=validateRentalCheckpoint(current,payload.checkpoint||{},existing);
    if(!validation.ok)return fail(validation.reason);
    const checkpoint={...validation.record,id:`rental_checkpoint_${command.idempotencyKey}`,rentalId:id,status:"recorded",
      createdAt:now,createdById:command.actorId||"",createdBy:command.actorName||""};
    const record={...current,rentalCheckpoints:[...existing,checkpoint].slice(-100),version:versionOf(current)+1,updatedAt:now};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_CHECKPOINT_RECORDED",{checkpointId:checkpoint.id,checkpointType:checkpoint.type});
    return {ok:true,data:replace(data,"locacoesEquip",id,record),entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_AMENDED){
    const id=String(payload.rentalId||"");
    const current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");
    if(stale)return fail(stale);
    const validation=validateRentalAmendment(current,payload.amendment||{});
    if(!validation.ok)return fail(validation.reason);
    const amendment={...validation.record,id:`rental_amendment_${command.idempotencyKey}`,rentalId:id,status:"active",
      commercialSnapshot:current.commercialSnapshot||null,createdAt:now,createdById:command.actorId||"",createdBy:command.actorName||""};
    const renewalPeriods=amendment.type===RENTAL_AMENDMENT_TYPE.RENEWAL
      ?[...(current.renewalPeriods||[]),{startDate:amendment.startDate,endDate:amendment.endDate,amendmentId:amendment.id}]
      :[...(current.renewalPeriods||[])];
    const record={...current,plannedEndDate:amendment.newEndDate,rentalAmendments:[...(current.rentalAmendments||[]),amendment].slice(-100),
      renewalPeriods,version:versionOf(current)+1,updatedAt:now};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_AMENDED",{amendmentId:amendment.id,amendmentType:amendment.type,newEndDate:amendment.newEndDate});
    return {ok:true,data:replace(data,"locacoesEquip",id,record),entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED){
    const id=String(payload.rentalId||""),current=list(data,"locacoesEquip").find(item=>String(item.id)===id);
    if(!current)return fail("Locação não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A locação");if(stale)return fail(stale);
    const registry=buildEquipmentRegistry(data),validation=validateRentalReplacement(current,payload.replacement||{},registry.units);
    if(!validation.ok)return fail(validation.reason);
    const incoming=registry.units.find(item=>String(item.id)===validation.record.incomingUnitId);
    const model=registry.models.find(item=>String(item.id)===String(incoming?.modelId));
    if(String(model?.legacySourceId||incoming?.legacySourceId||"")!==String(current.equipamentoId))return fail("A unidade substituta deve pertencer ao mesmo equipamento.");
    const conflicts=buildEquipmentUnavailability(data).filter(event=>event.rentalId!==id&&event.status!=="cancelada"&&event.status!=="inativa"
      &&(event.equipmentUnitIds||[]).map(String).includes(validation.record.incomingUnitId));
    if(conflicts.length)return fail("A unidade substituta está indisponível em outra alocação.");
    const replacement={...validation.record,id:`rental_replacement_${command.idempotencyKey}`,createdAt:now,createdById:command.actorId||"",createdBy:command.actorName||""};
    const unitIds=(current.equipmentUnitIds||[]).map(String).map(unitId=>unitId===replacement.outgoingUnitId?replacement.incomingUnitId:unitId);
    const record={...current,equipmentUnitIds:unitIds,equipmentUnitId:unitIds.length===1?unitIds[0]:"",rentalReplacements:[...(current.rentalReplacements||[]),replacement].slice(-100),version:versionOf(current)+1,updatedAt:now};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_UNIT_REPLACED",replacement);
    let next=replace(data,"locacoesEquip",id,record);const event=unavailabilityList(next).find(item=>String(item.rentalId)===id);
    if(event)next=upsertUnavailability(next,{...event,equipmentUnitIds:unitIds,equipmentUnitId:unitIds.length===1?unitIds[0]:"",version:versionOf(event)+1,updatedAt:now});
    return {ok:true,data:next,entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_MAINTENANCE_SAVED){
    const input=payload.maintenance||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipamentoId));
    if(!id||!equipment)return fail("Selecione um equipamento existente.");
    const startDate=String(input.inicio||input.data||"");
    const endDate=String(input.fim||input.dataConclusao||startDate);
    if(!isValidIsoDate(startDate)||!isValidIsoDate(endDate)||endDate<startDate||numeric(input.custo)<=0)return fail("Informe período válido e custo positivo da manutenção.");
    const obraId=String(input.obraId||equipment.obraAtualId||"");
    if(!obraExists(data,obraId))return fail("A obra da manutenção não existe.");
    const current=list(data,"manutencoesEquip").find(item=>String(item.id)===id);
    const stale=versionError(current,command.expectedVersion,"A manutenção");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A manutenção ainda não existe na versão esperada.");
    const selectedUnitIds=[...new Set((Array.isArray(input.equipmentUnitIds)?input.equipmentUnitIds:[]).map(String).filter(Boolean))];
    const registry=buildEquipmentRegistry(data);
    const sourceUnits=registry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    const sourceLots=registry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    const quantidade=Math.min(Math.max(1,Math.trunc(numeric(input.quantidade)||Number(equipment.quantidadeTotal)||1)),Math.max(1,Number(equipment.quantidadeTotal)||1));
    if(selectedUnitIds.some(unitId=>!sourceUnits.some(unit=>String(unit.id)===unitId)))return fail("Uma das unidades físicas selecionadas não pertence ao equipamento.");
    if(Number(data?.equipmentRegistryMigration?.version||0)>=1&&sourceUnits.length&&!current&&!selectedUnitIds.length)return fail("Selecione a unidade física que entrará em manutenção.");
    if(selectedUnitIds.length&&selectedUnitIds.length!==quantidade)return fail("A quantidade da manutenção deve corresponder às unidades físicas selecionadas.");
    if(input.equipmentLotId&&!sourceLots.some(lot=>String(lot.id)===String(input.equipmentLotId)))return fail("O lote selecionado não pertence ao equipamento.");
    const availability=fleetAvailability({data,equipment,startDate,endDate,requested:quantidade,except:{maintenanceId:current?.id},ignoreEquipmentStatus:true});
    if(availability.exceeded)return fail(unavailabilityConflict(availability));
    const occupiedUnits=new Set(availability.conflicts.flatMap(event=>[event.equipmentUnitId,...(event.equipmentUnitIds||[])]).filter(Boolean).map(String));
    if(selectedUnitIds.some(unitId=>occupiedUnits.has(unitId)))return fail("A unidade física selecionada já está indisponível no período da manutenção.");
    const record={
      ...(current||{}),...input,id,equipamentoId:equipment.id,obraId,custo:numeric(input.custo),quantidade,
      equipmentUnitIds:selectedUnitIds,equipmentUnitId:selectedUnitIds.length===1?selectedUnitIds[0]:"",
      equipmentLotId:String(input.equipmentLotId||""),
      inicio:startDate,fim:endDate,data:startDate,
      version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:now,createdById:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_MAINTENANCE_UPDATED":"EQUIPMENT_MAINTENANCE_CREATED");
    let next=current?replace(data,"manutencoesEquip",id,record):{...data,manutencoesEquip:[...list(data,"manutencoesEquip"),record]};
    next=upsertUnavailability(next,{
      id:`unav-maintenance:${id}`,equipmentId:equipment.id,equipmentUnitId:selectedUnitIds.length===1?selectedUnitIds[0]:"",quantity,
      equipmentUnitIds:selectedUnitIds,equipmentLotId:record.equipmentLotId||"",
      type:EQUIPMENT_UNAVAILABILITY_TYPE.MAINTENANCE,startDate,endDate,
      reason:record.descricao||"Manutenção",status:record.status||"programada",workId:obraId,
      maintenanceId:id,rentalId:"",createdAt:current?.createdAt||now,createdBy:command.actorId||"",
      version:versionOf(unavailabilityList(data).find(item=>item.maintenanceId===id))+1,
    });
    return {ok:true,data:next,entityId:id};
  }

  if([EQUIPMENT_COMMAND.EQUIPMENT_RESERVATION_SAVED,EQUIPMENT_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED].includes(command.type)){
    const input=payload.unavailability||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipmentId));
    const allowedTypes=new Set(Object.values(EQUIPMENT_UNAVAILABILITY_TYPE).filter(type=>!["rental","maintenance"].includes(type)));
    const type=command.type===EQUIPMENT_COMMAND.EQUIPMENT_RESERVATION_SAVED?"reservation":String(input.type||"");
    if(!id||!equipment||equipment.ativo===false)return fail("Selecione um equipamento ativo.");
    if(!allowedTypes.has(type))return fail("Tipo de indisponibilidade inválido.");
    const startDate=String(input.startDate||""),endDate=String(input.endDate||"");
    if(!isValidIsoDate(startDate)||!isValidIsoDate(endDate)||endDate<startDate)return fail("Informe um período válido para a indisponibilidade.");
    if(input.workId&&!obraExists(data,input.workId))return fail("A obra informada não existe.");
    const current=unavailabilityList(data).find(item=>String(item.id)===id);
    const stale=versionError(current,command.expectedVersion,"A indisponibilidade");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A indisponibilidade ainda não existe na versão esperada.");
    const quantidade=Math.min(quantity(input.quantity),Math.max(1,Number(equipment.quantidadeTotal)||1));
    const availability=fleetAvailability({data,equipment,startDate,endDate,requested:quantidade,except:{id:current?.id},ignoreEquipmentStatus:type!=="reservation"});
    if(availability.exceeded)return fail(unavailabilityConflict(availability));
    const record={...(current||{}),...input,id,equipmentId:equipment.id,equipmentUnitId:String(input.equipmentUnitId||""),
      quantity:quantidade,type,startDate,endDate,reason:String(input.reason||"").trim()||"Indisponibilidade programada",
      status:"ativa",workId:String(input.workId||""),maintenanceId:"",rentalId:"",
      version:versionOf(current)+1,updatedAt:now,...(!current?{createdAt:now,createdBy:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_UNAVAILABILITY_UPDATED":"EQUIPMENT_UNAVAILABILITY_CREATED");
    return {ok:true,data:upsertUnavailability(data,record),entityId:id};
  }

  if([EQUIPMENT_COMMAND.EQUIPMENT_RESERVATION_CANCELLED,EQUIPMENT_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED].includes(command.type)){
    const id=String(payload.unavailabilityId||"");
    const current=unavailabilityList(data).find(item=>String(item.id)===id);
    if(!current)return fail("Indisponibilidade não encontrada.");
    const stale=versionError(current,command.expectedVersion,"A indisponibilidade");
    if(stale)return fail(stale);
    if(["cancelada","cancelado","liberada","liberado","inativa","inativo"].includes(String(current.status||"")))return fail("A indisponibilidade já foi cancelada.");
    const reason=String(payload.reason||"Cancelada pelo operador").trim();
    const record={...current,status:"cancelada",version:versionOf(current)+1,updatedAt:now,cancelledAt:now,cancelledBy:command.actorId||"",cancellationReason:reason};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_UNAVAILABILITY_CANCELLED",{reason});
    return {ok:true,data:upsertUnavailability(data,record),entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_TRANSFERRED){
    const input=payload.transfer||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipamentoId));
    if(!id||!equipment||equipment.ativo===false)return fail("Selecione um equipamento ativo.");
    if(!input.paraObraId||!obraExists(data,input.paraObraId))return fail("Selecione uma obra de destino existente.");
    if(!isValidIsoDate(input.data))return fail("Informe uma data válida para a transferência.");
    if(command.expectedVersion!=null&&versionOf(equipment)!==Number(command.expectedVersion))return fail("O equipamento foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.");
    if(list(data,"transferenciasEquip").some(item=>String(item.id)===id))return fail("Esta transferência já foi registrada.");
    const registry=buildEquipmentRegistry(data);
    const sourceUnits=registry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    const sourceLots=registry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(equipment.id));
    const selectedUnitIds=[...new Set((Array.isArray(input.equipmentUnitIds)?input.equipmentUnitIds:[]).map(String).filter(Boolean))];
    const amount=Math.max(1,Math.trunc(numeric(input.quantidade)||selectedUnitIds.length||1));
    if(selectedUnitIds.some(unitId=>!sourceUnits.some(unit=>String(unit.id)===unitId)))return fail("Uma das unidades físicas selecionadas não pertence ao equipamento.");
    if(Number(data?.equipmentRegistryMigration?.version||0)>=1&&sourceUnits.length&&!selectedUnitIds.length)return fail("Selecione a unidade física que será transferida.");
    if(selectedUnitIds.length&&selectedUnitIds.length!==amount)return fail("A quantidade transferida deve corresponder às unidades físicas selecionadas.");
    if(input.equipmentLotId&&!sourceLots.some(lot=>String(lot.id)===String(input.equipmentLotId)))return fail("O lote selecionado não pertence ao equipamento.");
    const physical=Boolean(selectedUnitIds.length||input.equipmentLotId);
    const positions=deriveEquipmentLocations(data,input.data).allocations;
    const chosenAssets=selectedUnitIds.length?positions.filter(item=>selectedUnitIds.includes(String(item.unitId)))
      :positions.filter(item=>String(item.lotId)===String(input.equipmentLotId));
    const sourceLocation=String(input.deLocationId||chosenAssets.find(item=>item.quantity>=amount)?.locationId||equipment.obraAtualId||"depot");
    if(physical&&sourceLocation===String(input.paraObraId))return fail("O ativo físico selecionado já está na obra de destino.");
    if(selectedUnitIds.length&&chosenAssets.some(item=>String(item.locationId)!==sourceLocation))return fail("As unidades selecionadas precisam estar na mesma origem para serem transferidas juntas.");
    if(input.equipmentLotId&&chosenAssets.filter(item=>String(item.locationId)===sourceLocation).reduce((sum,item)=>sum+Number(item.quantity||0),0)<amount)return fail("A origem não possui quantidade suficiente do lote para esta transferência.");
    const transfer={...input,id,equipamentoId:equipment.id,deObraId:sourceLocation==="depot"?"":sourceLocation,
      deLocationId:sourceLocation,equipmentUnitIds:selectedUnitIds,equipmentUnitId:selectedUnitIds.length===1?selectedUnitIds[0]:"",
      equipmentLotId:String(input.equipmentLotId||""),quantidade:amount,physicalRegistryMovement:physical,
      paraObraId:String(input.paraObraId),version:1,createdAt:now,createdById:command.actorId||""};
    const updatedEquipment={...equipment,obraAtualId:transfer.paraObraId,status:"locado",
      version:versionOf(equipment)+1,updatedAt:now};
    updatedEquipment.operationalHistory=audit(equipment,command,now,"EQUIPMENT_TRANSFERRED",{
      transferId:id,deObraId:transfer.deObraId,paraObraId:transfer.paraObraId,
    });
    let next=replace({...data,transferenciasEquip:[...list(data,"transferenciasEquip"),transfer]},"equipamentos",equipment.id,updatedEquipment);
    next=upsertUnavailability(next,{
      id:`unav-transport:${id}`,equipmentId:equipment.id,equipmentUnitId:transfer.equipmentUnitId,quantity:amount,
      equipmentUnitIds:selectedUnitIds,equipmentLotId:transfer.equipmentLotId,
      type:EQUIPMENT_UNAVAILABILITY_TYPE.TRANSPORT,startDate:input.data,endDate:input.data,
      reason:`Transporte para ${list(data,"obras").find(item=>String(item.id)===String(input.paraObraId))?.name||"obra"}`,
      status:"concluida",workId:String(input.paraObraId),maintenanceId:"",rentalId:"",transferId:id,
      affectsCapacity:false,createdAt:now,createdBy:command.actorId||"",version:1,
    });
    return {ok:true,data:next,entityId:id};
  }

  return null;
};
