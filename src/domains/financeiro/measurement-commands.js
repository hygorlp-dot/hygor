import {
  aplicarRecebimentoMedicao,
  estornarRecebimentosMedicao,
  totalRecebidoMedicao,
} from "../conciliacao/calculations.js";
import {
  cancelClientMeasurement,
  saveClientMeasurement,
  saveGeneratedClientMeasurements,
} from "./measurement-mutations.js";
import { createBillingFromTechnicalMeasurement } from "./workflows.js";

export const CLIENT_MEASUREMENT_COMMAND=Object.freeze({
  CLIENT_MEASUREMENT_SAVED:"MEDICAO_FINANCEIRA_SALVA",
  CLIENT_MEASUREMENTS_GENERATED:"MEDICOES_FINANCEIRAS_GERADAS",
  CLIENT_MEASUREMENT_CANCELLED:"MEDICAO_FINANCEIRA_CANCELADA",
  CLIENT_MEASUREMENT_RECEIPTS_CHANGED:"RECEBIMENTOS_MEDICAO_ALTERADOS",
  CLIENT_MEASUREMENT_ADMIN_CLOSED:"ADMINISTRACAO_MEDICAO_FECHADA",
  CLIENT_MEASUREMENT_BILLED:"MEDICAO_TECNICA_FATURADA",
});

export const CLIENT_MEASUREMENT_COMMAND_TYPES=new Set(Object.values(CLIENT_MEASUREMENT_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const inactive=item=>["cancelado","cancelada","estornado","arquivado"].includes(String(item?.status||"").toLowerCase());
const actorFrom=command=>({id:command.actorId||"",nome:command.actorName||""});
const measurementById=(data,id)=>(data?.medicoes||[]).find(item=>item.id===id);
const versionError=(current,expected)=>{
  if(expected==null)return "";
  return versionOf(current)===Number(expected)
    ?""
    :"A medição foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.";
};
const projectExists=(data,obraId)=>(data?.obras||[]).some(item=>String(item.id)===String(obraId||""));

export const clientMeasurementCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED)return String(payload.measurement?.obraId||"");
  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENTS_GENERATED)return String(payload.obraId||"");
  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_BILLED){
    return String((data?.medicoesObra||[]).find(item=>item.id===payload.medicaoTecnicaId)?.obraId||"");
  }
  const id=String(payload.measurementId||payload.changes?.[0]?.measurementId||"");
  return String(measurementById(data,id)?.obraId||"");
};

export const applyClientMeasurementCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!CLIENT_MEASUREMENT_COMMAND_TYPES.has(command.type))return null;
  const actor=actorFrom(command);
  if(!actor.id)return fail("Sessão do usuário indisponível para alterar medições.");

  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED){
    const measurement=command.payload?.measurement||{};
    const id=String(measurement.id||"");
    const current=measurementById(data,id);
    if(!id)return fail("Medição sem identificação.");
    if(!projectExists(data,measurement.obraId))return fail("A obra da medição não existe.");
    const stale=versionError(current,command.expectedVersion);
    if(stale)return fail(stale);
    if(!current&&command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A nova medição precisa iniciar na versão zero.");
    try{
      return {
        ok:true,
        data:saveClientMeasurement({
          data,measurement,actor,id,receiptId:command.payload?.receiptId,now,
        }),
        entityId:id,
      };
    }catch(error){
      return fail(error?.message||"Medição inválida.");
    }
  }

  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENTS_GENERATED){
    const obraId=String(command.payload?.obraId||"");
    if(!projectExists(data,obraId))return fail("A obra das parcelas não existe.");
    try{
      return {
        ok:true,
        data:saveGeneratedClientMeasurements({
          data,obraId,measurements:command.payload?.measurements,
          overwrite:!!command.payload?.overwrite,actor,now,
        }),
        entityId:`medicoes:${obraId}`,
      };
    }catch(error){
      return fail(error?.message||"Não foi possível gerar as parcelas.");
    }
  }

  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_CANCELLED){
    const id=String(command.payload?.measurementId||"");
    const current=measurementById(data,id);
    if(!current)return fail("Medição não encontrada.");
    const stale=versionError(current,command.expectedVersion);
    if(stale)return fail(stale);
    try{
      return {
        ok:true,
        data:cancelClientMeasurement({
          data,measurementId:id,reason:command.payload?.reason,actor,now,
        }),
        entityId:id,
      };
    }catch(error){
      return fail(error?.message||"Não foi possível cancelar a medição.");
    }
  }

  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED){
    const changes=Array.isArray(command.payload?.changes)?command.payload.changes:[];
    if(!changes.length||changes.length>100)return fail("Informe entre 1 e 100 alterações de recebimento.");
    const ids=new Set();
    const receiptIds=new Set((data.medicoes||[])
      .flatMap(item=>(item.recebimentos||[]).map(receipt=>receipt.id))
      .filter(Boolean));
    let measurements=[...(data.medicoes||[])];
    try{
      for(const change of changes){
        const id=String(change?.measurementId||"");
        if(!id||ids.has(id))return fail("Há uma medição repetida no lote de recebimentos.");
        ids.add(id);
        const current=measurements.find(item=>item.id===id);
        if(!current)return fail("Medição não encontrada.");
        if(inactive(current))return fail("Uma medição cancelada não pode receber alterações.");
        const stale=versionError(current,change.expectedVersion);
        if(stale)return fail(stale);
        let updated;
        if(change.action==="receive"){
          const receiptId=String(change.receipt?.id||"");
          if(!receiptId)return fail("O recebimento precisa de uma identificação.");
          if(receiptIds.has(receiptId))return fail("Este recebimento já foi utilizado.");
          receiptIds.add(receiptId);
          const amount=Number(change.receipt?.valor);
          const balance=Number(current.valorPrevisto||0)-totalRecebidoMedicao(current);
          if(!(amount>0)||!Number.isFinite(amount))return fail("Informe um valor positivo para o recebimento.");
          if(amount>balance+0.01)return fail("O recebimento excede o saldo da medição.");
          if(!/^\d{4}-\d{2}-\d{2}$/.test(String(change.receipt?.data||"")))return fail("Informe uma data válida para o recebimento.");
          updated=aplicarRecebimentoMedicao(current,{
            ...change.receipt,actor,now,origem:change.receipt?.origem||"manual",
          });
        }else if(change.action==="reverse_all"){
          updated=estornarRecebimentosMedicao(current,{
            actor,reason:change.reason,now,
          });
        }else{
          return fail("Ação de recebimento inválida.");
        }
        updated={
          ...updated,version:versionOf(current)+1,updatedAt:now,
          updatedById:actor.id,updatedBy:actor.nome||"Usuário autenticado",
        };
        measurements=measurements.map(item=>item.id===id?updated:item);
      }
    }catch(error){
      return fail(error?.message||"Não foi possível alterar os recebimentos.");
    }
    return {
      ok:true,data:{...data,medicoes:measurements},
      entityId:`recebimentos:${[...ids].join(",")}`,
    };
  }

  if(command.type===CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_BILLED){
    const result=createBillingFromTechnicalMeasurement(data,{
      medicaoTecnicaId:command.payload?.medicaoTecnicaId,
      competencia:command.payload?.competencia,
      dataVencimento:command.payload?.dataVencimento,
      id:command.payload?.id,
    });
    if(!result.ok)return fail(result.error||"Não foi possível faturar a medição técnica.");
    const measurement={
      ...result.measurement,version:1,
      createdAt:now,createdById:actor.id,createdBy:actor.nome||"Usuário autenticado",
      updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||"Usuário autenticado",
    };
    return {
      ok:true,data:{...data,medicoes:[...(data.medicoes||[]),measurement]},
      entityId:measurement.id,
    };
  }

  const id=String(command.payload?.measurementId||"");
  const current=measurementById(data,id);
  if(!current)return fail("Medição não encontrada.");
  const stale=versionError(current,command.expectedVersion);
  if(stale)return fail(stale);
  if(inactive(current))return fail("Uma medição cancelada não pode ser alterada.");
  if(totalRecebidoMedicao(current)>0)return fail("Estorne os recebimentos antes de alterar a taxa administrativa.");
  const adminAmount=Number(command.payload?.adminAmount);
  if(!(adminAmount>0)||!Number.isFinite(adminAmount))return fail("Informe um valor positivo para a administração.");
  const updated={
    ...current,valorAdminPct:adminAmount,
    valorPrevisto:Number(current.valorMOFixo||0)+adminAmount,
    version:versionOf(current)+1,updatedAt:now,
    updatedById:actor.id,updatedBy:actor.nome||"Usuário autenticado",
  };
  return {
    ok:true,data:{...data,medicoes:(data.medicoes||[]).map(item=>item.id===id?updated:item)},
    entityId:id,
  };
};
