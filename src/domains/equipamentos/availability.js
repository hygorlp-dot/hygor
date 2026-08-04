import { isoPeriodsOverlap } from "./date.js";

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const quantity=value=>Math.max(1,Math.trunc(number(value)||1));

export const EQUIPMENT_BLOCKING_STATUS=Object.freeze({
  inativo:"inativo",
  manutencao:"em manutenção",
  bloqueado:"bloqueado administrativamente",
  avariado:"avariado",
  aguardando_inspecao:"aguardando inspeção",
});

const activeRental=item=>item?.status!=="cancelada";
const activeMaintenance=item=>!["cancelada","concluida"].includes(String(item?.status||""));

export const rentalAvailability=({data={},equipment={},rental={},exceptRentalId=""}={})=>{
  const total=quantity(equipment.quantidadeTotal);
  const start=String(rental.inicio||""),end=String(rental.fim||"");
  const requested=quantity(rental.quantidade);
  const conflicts=[];
  const statusReason=equipment.ativo===false?EQUIPMENT_BLOCKING_STATUS.inativo
    :EQUIPMENT_BLOCKING_STATUS[String(equipment.status||"")]||"";
  let unavailable=statusReason?total:0;
  if(statusReason)conflicts.push({type:"status",reason:statusReason,quantity:total});

  let rented=0;
  for(const item of data.locacoesEquip||[]){
    if(String(item.id)===String(exceptRentalId)||String(item.equipamentoId)!==String(equipment.id)||!activeRental(item))continue;
    if(isoPeriodsOverlap(start,end,item.inicio,item.fim)){
      const used=quantity(item.quantidade);rented+=used;
      conflicts.push({type:"rental",reason:"locação sobreposta",quantity:used,id:item.id,workId:item.obraId||""});
    }
  }

  if(!statusReason)for(const item of data.manutencoesEquip||[]){
    if(String(item.equipamentoId)!==String(equipment.id)||!activeMaintenance(item))continue;
    const maintenanceStart=item.inicio||item.data;
    const maintenanceEnd=item.fim||item.dataConclusao||maintenanceStart;
    if(isoPeriodsOverlap(start,end,maintenanceStart,maintenanceEnd)){
      const blocked=quantity(item.quantidade||total);unavailable+=blocked;
      conflicts.push({type:"maintenance",reason:item.descricao||"manutenção programada",quantity:blocked,id:item.id});
    }
  }
  unavailable=Math.min(total,unavailable);
  const free=Math.max(0,total-rented-unavailable);
  return {total,rented,unavailable,free,requested,exceeded:requested>free,conflicts,start,end:end||"em aberto"};
};
