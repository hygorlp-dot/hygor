import { NONCONFORMITY_STATUS } from "./constants.js";
const activeNonconformity=status=>!["encerrada","cancelada"].includes(String(status||""));
const sameService=(item,serviceId)=>!serviceId||!item.serviceId||String(item.serviceId)===String(serviceId);

const hasBlockingNonconformity=(records=[],obraId,serviceId)=>records.some(item=>
  String(item.obraId)===String(obraId)&&
  sameService(item,serviceId)&&
  item.impeditiva===true&&
  activeNonconformity(item.status)
);

// A tela histórica de FVS/FVM usa `qualidadeRegistros`, enquanto os novos
// comandos usam `inspections` e `nonconformities`. Esta projeção é a fronteira
// única entre os dois modelos durante a migração: uma reprovação registrada
// pela operação de campo não pode desaparecer do gate de medição.
export const buildQualityProjection=(data={})=>{
  const inspections=[...(data.inspections||[])];
  const nonconformities=[...(data.nonconformities||[])];

  for(const record of data.qualidadeRegistros||[]){
    if(["cancelada","cancelado"].includes(record.status))continue;
    const serviceId=record.itemOrcamentoId||record.etapaId||"";
    const hasRejectedItem=(record.itens||[]).some(item=>item.status==="nao_conforme");
    const nc=record.naoConformidade;
    const hasOpenNc=Boolean(nc&&activeNonconformity(nc.status));
    const resultado=record.status==="reprovada"||hasRejectedItem&&hasOpenNc
      ?"nao_conforme"
      :["aprovada","liberada_concessao"].includes(record.status)
        ?"conforme"
        :"aguardando_evidencia";

    inspections.push({
      id:`qualidade-registro:${record.id}`,
      sourceId:record.id,
      source:"qualidadeRegistros",
      obraId:record.obraId,
      serviceId,
      resultado,
    });
    if(nc){
      nonconformities.push({
        id:`qualidade-registro-nc:${record.id}`,
        sourceId:record.id,
        source:"qualidadeRegistros",
        obraId:record.obraId,
        serviceId,
        impeditiva:record.status!=="liberada_concessao",
        status:nc.status||"aberta",
      });
    }
  }
  return {inspections,nonconformities};
};

export const canReleaseForMeasurement=({inspections=[],nonconformities=[],obraId,serviceId,exceptionApproved=false}={})=>{if(exceptionApproved)return {ok:true,reason:"Exceção formal aprovada."};if(hasBlockingNonconformity(nonconformities,obraId,serviceId))return {ok:false,reason:"Existe não conformidade impeditiva aberta."};const relevant=inspections.filter(item=>String(item.obraId)===String(obraId)&&sameService(item,serviceId));if(relevant.some(item=>item.resultado==="nao_conforme"))return {ok:false,reason:"Inspeção não conforme impede a medição."};return {ok:true,reason:"Qualidade liberada."};};
export const nextNonconformityStatus=(current,next)=>{const order=NONCONFORMITY_STATUS;return order.indexOf(next)===order.indexOf(current)+1||next==="encerrada"&&current==="verificacao";};
