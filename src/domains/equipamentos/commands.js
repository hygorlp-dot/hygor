import { rentalAvailability } from "./availability.js";
import { diasLocacaoNoPeriodo, validateRentalDiscounts } from "./calculations.js";
import { isValidIsoDate } from "./date.js";

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
  EQUIPMENT_SAVED:"EQUIPAMENTO_SALVO",
  EQUIPMENT_DEACTIVATED:"EQUIPAMENTO_INATIVADO",
  EQUIPMENT_RENTAL_SAVED:"LOCACAO_EQUIPAMENTO_SALVA",
  EQUIPMENT_RENTAL_CLOSED:"LOCACAO_EQUIPAMENTO_ENCERRADA",
  EQUIPMENT_RENTAL_CANCELLED:"LOCACAO_EQUIPAMENTO_CANCELADA",
  EQUIPMENT_MAINTENANCE_SAVED:"MANUTENCAO_EQUIPAMENTO_SALVA",
  EQUIPMENT_TRANSFERRED:"EQUIPAMENTO_TRANSFERIDO",
});

export const EQUIPMENT_COMMAND_TYPES=new Set(Object.values(EQUIPMENT_COMMAND));

export const equipmentCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_SAVED)return String(payload.equipment?.obraAtualId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_DEACTIVATED)return String(list(data,"equipamentos").find(item=>item.id===payload.equipmentId)?.obraAtualId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_SAVED)return String(payload.rental?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CLOSED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_RENTAL_CANCELLED)return String(list(data,"locacoesEquip").find(item=>item.id===payload.rentalId)?.obraId||"");
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
    const quantidade=Math.max(1,Math.trunc(numeric(input.quantidade)||1));
    const candidate={...input,id,quantidade,inicio:String(input.inicio),fim:String(input.fim||"")};
    const availability=rentalAvailability({data,equipment,rental:candidate,exceptRentalId:current?.id});
    if(availability.exceeded){
      const reason=availability.conflicts.map(item=>item.reason).filter(Boolean).join(", ")||"capacidade insuficiente";
      return fail(`Equipamento indisponível (${reason}) no período ${availability.start} a ${availability.end}: ${availability.unavailable} indisponível(is), ${availability.rented} locada(s), ${availability.free} livre(s) e ${availability.requested} solicitada(s).`);
    }
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
      status:input.fim?"encerrada":"ativa",version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:now,createdById:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_RENTAL_UPDATED":"EQUIPMENT_RENTAL_CREATED");
    let next=current?replace(data,"locacoesEquip",id,record):{...data,locacoesEquip:[...list(data,"locacoesEquip"),record]};
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
    const endDate=String(payload.endDate||"");
    if(!isValidIsoDate(endDate)||endDate<String(current.inicio||""))return fail("Informe uma data de término válida.");
    const record={...current,fim:endDate,status:"encerrada",version:versionOf(current)+1,updatedAt:now,
      encerradoEm:now,encerradoPorId:command.actorId||""};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_CLOSED",{endDate});
    let next=replace(data,"locacoesEquip",id,record);
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
    const record={...current,status:"cancelada",version:versionOf(current)+1,updatedAt:now,
      canceladoEm:now,canceladoPorId:command.actorId||"",motivoCancelamento:reason};
    record.operationalHistory=audit(current,command,now,"EQUIPMENT_RENTAL_CANCELLED",{reason});
    let next=replace(data,"locacoesEquip",id,record);
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

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_MAINTENANCE_SAVED){
    const input=payload.maintenance||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipamentoId));
    if(!id||!equipment)return fail("Selecione um equipamento existente.");
    if(!isValidIsoDate(input.data)||numeric(input.custo)<=0)return fail("Informe data e custo positivo da manutenção.");
    const obraId=String(input.obraId||equipment.obraAtualId||"");
    if(!obraExists(data,obraId))return fail("A obra da manutenção não existe.");
    const current=list(data,"manutencoesEquip").find(item=>String(item.id)===id);
    const stale=versionError(current,command.expectedVersion,"A manutenção");
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A manutenção ainda não existe na versão esperada.");
    const record={
      ...(current||{}),...input,id,equipamentoId:equipment.id,obraId,custo:numeric(input.custo),
      version:versionOf(current)+1,updatedAt:now,
      ...(!current?{createdAt:now,createdById:command.actorId||""}:{}),
    };
    record.operationalHistory=audit(current,command,now,current?"EQUIPMENT_MAINTENANCE_UPDATED":"EQUIPMENT_MAINTENANCE_CREATED");
    const next=current?replace(data,"manutencoesEquip",id,record):{...data,manutencoesEquip:[...list(data,"manutencoesEquip"),record]};
    return {ok:true,data:next,entityId:id};
  }

  if(command.type===EQUIPMENT_COMMAND.EQUIPMENT_TRANSFERRED){
    const input=payload.transfer||{};
    const id=String(input.id||"");
    const equipment=list(data,"equipamentos").find(item=>String(item.id)===String(input.equipamentoId));
    if(!id||!equipment||equipment.ativo===false)return fail("Selecione um equipamento ativo.");
    if(!input.paraObraId||!obraExists(data,input.paraObraId))return fail("Selecione uma obra de destino existente.");
    if(String(equipment.obraAtualId||"")===String(input.paraObraId))return fail("O equipamento já está na obra de destino.");
    if(!isValidIsoDate(input.data))return fail("Informe uma data válida para a transferência.");
    if(command.expectedVersion!=null&&versionOf(equipment)!==Number(command.expectedVersion))return fail("O equipamento foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.");
    if(list(data,"transferenciasEquip").some(item=>String(item.id)===id))return fail("Esta transferência já foi registrada.");
    const transfer={...input,id,equipamentoId:equipment.id,deObraId:String(equipment.obraAtualId||""),
      paraObraId:String(input.paraObraId),version:1,createdAt:now,createdById:command.actorId||""};
    const updatedEquipment={...equipment,obraAtualId:transfer.paraObraId,status:"locado",
      version:versionOf(equipment)+1,updatedAt:now};
    updatedEquipment.operationalHistory=audit(equipment,command,now,"EQUIPMENT_TRANSFERRED",{
      transferId:id,deObraId:transfer.deObraId,paraObraId:transfer.paraObraId,
    });
    const next=replace({...data,transferenciasEquip:[...list(data,"transferenciasEquip"),transfer]},"equipamentos",equipment.id,updatedEquipment);
    return {ok:true,data:next,entityId:id};
  }

  return null;
};
