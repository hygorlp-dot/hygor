import { arcdApprovalEngine } from "../aprovacoes/arcd-engine.js";
import { active } from "./ledger.js";
import {
  cancelThirdPartyMeasurement,
  createThirdPartyMeasurement,
  createThirdPartyPayment,
  payThirdPartyMeasurement,
  reverseThirdPartyPayment,
} from "./third-party-payment-mutations.js";
import { isDateInClosedPeriod, linkThirdPartyInvoice } from "./workflows.js";
import { isActiveThirdPartyContract } from "../terceirizados/lifecycle.js";
import { calculateWithholdings } from "../terceirizados/withholdings.js";

export const THIRD_PARTY_COMMAND=Object.freeze({
  THIRD_PARTY_PAYMENT_RECORDED:"PAGAMENTO_TERCEIRO_REGISTRADO",
  THIRD_PARTY_PAYMENT_REVERSED:"PAGAMENTO_TERCEIRO_ESTORNADO",
  THIRD_PARTY_MEASUREMENT_RECORDED:"MEDICAO_TERCEIRO_REGISTRADA",
  THIRD_PARTY_MEASUREMENT_CANCELLED:"MEDICAO_TERCEIRO_CANCELADA",
  THIRD_PARTY_MEASUREMENT_PAID:"MEDICAO_TERCEIRO_PAGA",
  THIRD_PARTY_INVOICE_LINKED:"NOTA_MEDICAO_TERCEIRO_VINCULADA",
  THIRD_PARTY_CONTRACT_STAGES_SAVED:"ETAPAS_CONTRATO_TERCEIRO_SALVAS",
});

export const THIRD_PARTY_COMMAND_TYPES=new Set(Object.values(THIRD_PARTY_COMMAND));
export const THIRD_PARTY_PAYMENT_COMMAND_TYPES=new Set([
  THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_RECORDED,
  THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,
  THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,
  THIRD_PARTY_COMMAND.THIRD_PARTY_INVOICE_LINKED,
]);

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const contractById=(data,id)=>(data.terceirizados||[])
  .find(item=>String(item.id)===String(id));
const measurementById=(data,id)=>(data.medicoesTerc||[])
  .find(item=>String(item.id)===String(id));
const paymentById=(data,id)=>(data.pagsTerceiros||[])
  .find(item=>String(item.id)===String(id));
const invoiceById=(data,id)=>(data.notasFiscais||[])
  .find(item=>String(item.id)===String(id));
const sameVersion=(item,expected)=>
  expected!=null&&versionOf(item)===Number(expected);
const actorOf=command=>({
  id:String(command.actorId||""),
  nome:String(command.actorName||"").trim()||"Usuário autenticado",
});
const behaviorOf=data=>
  data.configAprovacao?.comportamentoSemPolitica||"auto_aprovar";
const activeMeasurements=(data,contractId)=>(data.medicoesTerc||[])
  .filter(item=>String(item.tercId)===String(contractId)&&active(item))
  .sort((a,b)=>`${a.data||a.dataMedicao||""}|${a.id}`
    .localeCompare(`${b.data||b.dataMedicao||""}|${b.id}`));
const latestPercentages=(data,contractId)=>{
  const result={};
  for(const measurement of activeMeasurements(data,contractId)){
    for(const item of measurement.itens||[])result[item.etapaId]=Number(item.pctAcum||0);
  }
  return result;
};
const projectExists=(data,id)=>(data.obras||[])
  .some(item=>String(item.id)===String(id));
// Mesma função usada no preview da tela (LegacyApp.jsx, calcRetencoes) —
// ver src/domains/terceirizados/withholdings.js. Evita que o valor
// mostrado antes de confirmar o pagamento divirja do valor gravado.
const paymentAmounts=(amount,contract)=>{
  const result=calculateWithholdings(amount,contract);
  if(result.error)return {error:result.error};
  return {issRetido:result.issRetido,inssRetido:result.inssRetido,liquido:result.liquido};
};

const startPaymentApproval=(data,{paymentId,value,obraId,hasMeasurement,actor,now})=>
  arcdApprovalEngine.iniciarInstancia(data,{
    entidadeTipo:"pagamentoTerceiro",entidadeId:paymentId,
    contexto:{
      valorTotal:value,obraId,possuiMedicao:hasMeasurement?"sim":"nao",
      solicitanteId:actor.id,
    },
    operador:actor,agora:now,comportamentoSemPolitica:behaviorOf(data),
  });

const validateContract=(data,contractId)=>{
  const contract=contractById(data,contractId);
  if(!contract||!isActiveThirdPartyContract(contract))return {
    error:"Contrato de terceiro não encontrado ou inativo.",
  };
  if(!contract.obraId||!projectExists(data,contract.obraId))return {
    error:"O contrato precisa estar vinculado a uma obra existente.",
  };
  return {contract};
};

const recordPayment=(data,command,now)=>{
  const payload=command.payload||{},raw=payload.payment||{};
  const actor=actorOf(command);
  const validation=validateContract(data,raw.tercId);
  if(validation.error)return fail(validation.error);
  const contract=validation.contract;
  const id=String(raw.id||"");
  if(!id||paymentById(data,id))return fail("Pagamento de terceiro sem identificação única.");
  const amount=Number(raw.amount),date=String(raw.date||"");
  if(!(amount>0)||!Number.isFinite(amount))return fail("Informe um valor positivo para o pagamento.");
  if(!validDate(date))return fail("Informe uma data válida para o pagamento.");
  if(isDateInClosedPeriod(data,date))return fail("O período financeiro deste pagamento está fechado.");
  const pagador=String(raw.pagador||"");
  if(!["empresa","obra"].includes(pagador))return fail("Informe quem realizou o pagamento.");
  const amounts=paymentAmounts(amount,contract);
  if(amounts.error)return fail(amounts.error);
  const approval=startPaymentApproval(data,{
    paymentId:id,value:amount,obraId:contract.obraId,
    hasMeasurement:false,actor,now,
  });
  try{
    const next=createThirdPartyPayment({
      data:approval.data,actor,id,now,
      payment:{
        ...raw,id,tercId:contract.id,tercName:contract.name,
        specialty:contract.specialty,obraId:contract.obraId,amount,date,pagador,
        ...amounts,
        aprovacaoInstanciaId:approval.resumo.instanciaId,
      },
    });
    return {
      ok:true,data:next,entityId:id,
      summary:{approvalStatus:approval.resumo.status},
    };
  }catch(error){return fail(error.message);}
};

const reversePayment=(data,command,now)=>{
  const payload=command.payload||{},id=String(payload.paymentId||"");
  const actor=actorOf(command),payment=paymentById(data,id);
  if(!payment)return fail("Pagamento de terceiro não encontrado.");
  if(!sameVersion(payment,command.expectedVersion)){
    return fail("O pagamento foi alterado por outra pessoa. Atualize a tela.");
  }
  if(isDateInClosedPeriod(data,payment.date||payment.data)){
    return fail("O período financeiro deste pagamento está fechado.");
  }
  try{
    return {
      ok:true,data:reverseThirdPartyPayment({
        data,paymentId:id,reason:payload.reason,actor,now,
      }),entityId:id,
    };
  }catch(error){return fail(error.message);}
};

const validateMeasurement=(data,raw)=>{
  const validation=validateContract(data,raw.tercId);
  if(validation.error)return validation;
  const contract=validation.contract;
  const id=String(raw.id||"");
  if(!id||measurementById(data,id))return {error:"Medição de terceiro sem identificação única."};
  const date=String(raw.data||raw.dataMedicao||"");
  if(!validDate(date))return {error:"Informe uma data válida para a medição."};
  if(isDateInClosedPeriod(data,date))return {error:"O período financeiro desta medição está fechado."};
  const previousMeasurements=activeMeasurements(data,contract.id);
  const latest=previousMeasurements.at(-1);
  if(latest&&date<String(latest.data||latest.dataMedicao||"")){
    return {error:"A nova medição não pode anteceder a última medição ativa do contrato."};
  }
  if(!Array.isArray(raw.fotos)||!raw.fotos.length){
    return {error:"Anexe ao menos uma fotografia da execução antes de salvar a medição."};
  }
  const stages=new Map((contract.etapas||[]).map(item=>[String(item.id),item]));
  const previous=latestPercentages(data,contract.id);
  const ids=new Set(),items=[];
  let totalCents=0;
  for(const item of raw.itens||[]){
    const stageId=String(item.etapaId||""),stage=stages.get(stageId);
    if(!stage||ids.has(stageId))return {error:"A medição contém etapa inválida ou repetida."};
    ids.add(stageId);
    const prior=Number(previous[stageId]||0);
    const informedPrior=Number(item.pctAnterior||0);
    const accumulated=Number(item.pctAcum);
    if(Math.abs(prior-informedPrior)>0.0001){
      return {error:"O avanço anterior mudou. Atualize a medição antes de salvar."};
    }
    if(!Number.isFinite(accumulated)||accumulated<=prior||accumulated>100){
      return {error:"O percentual acumulado precisa avançar e permanecer entre 0% e 100%."};
    }
    const valueCents=Math.round(Math.round(Number(stage.valor||0)*100)*(accumulated-prior)/100);
    if(valueCents<=0)return {error:"A etapa medida precisa possuir valor contratual positivo."};
    totalCents+=valueCents;
    items.push({
      etapaId:stageId,pctAnterior:prior,pctAcum:accumulated,
      valor:valueCents/100,
    });
  }
  if(!items.length)return {error:"A medição precisa possuir ao menos uma etapa executada."};
  if(Math.abs(Math.round(Number(raw.total||0)*100)-totalCents)>1){
    return {error:"O total da medição não confere com o avanço das etapas."};
  }
  return {
    contract,date,items,total:totalCents/100,
    number:previousMeasurements.length+1,
  };
};

const recordMeasurement=(data,command,now)=>{
  const raw=command.payload?.measurement||{},actor=actorOf(command);
  const validation=validateMeasurement(data,raw);
  if(validation.error)return fail(validation.error);
  try{
    const next=createThirdPartyMeasurement({
      data,actor,id:String(raw.id),now,
      measurement:{
        ...raw,tercId:validation.contract.id,
        obraId:validation.contract.obraId,data:validation.date,
        dataMedicao:validation.date,itens:validation.items,
        total:validation.total,numero:validation.number,
      },
    });
    return {ok:true,data:next,entityId:String(raw.id)};
  }catch(error){return fail(error.message);}
};

const cancelMeasurement=(data,command,now)=>{
  const payload=command.payload||{},id=String(payload.measurementId||"");
  const actor=actorOf(command),measurement=measurementById(data,id);
  if(!measurement)return fail("Medição de terceiro não encontrada.");
  if(!sameVersion(measurement,command.expectedVersion)){
    return fail("A medição foi alterada por outra pessoa. Atualize a tela.");
  }
  const latest=activeMeasurements(data,measurement.tercId).at(-1);
  if(!latest||String(latest.id)!==id)return fail("Só a última medição ativa do contrato pode ser cancelada.");
  if(isDateInClosedPeriod(data,measurement.data||measurement.dataMedicao)){
    return fail("O período financeiro desta medição está fechado.");
  }
  try{
    return {
      ok:true,data:cancelThirdPartyMeasurement({
        data,measurementId:id,reason:payload.reason,actor,now,
      }),entityId:id,
    };
  }catch(error){return fail(error.message);}
};

const payMeasurement=(data,command,now)=>{
  const payload=command.payload||{},measurementId=String(payload.measurementId||"");
  const paymentId=String(payload.payment?.id||""),actor=actorOf(command);
  const measurement=measurementById(data,measurementId);
  if(!measurement||!active(measurement))return fail("Medição de terceiro não encontrada ou cancelada.");
  if(!sameVersion(measurement,command.expectedVersion)){
    return fail("A medição foi alterada por outra pessoa. Atualize a tela.");
  }
  if(!paymentId||paymentById(data,paymentId))return fail("Pagamento de terceiro sem identificação única.");
  const contract=contractById(data,measurement.tercId);
  if(!contract)return fail("Contrato da medição não encontrado.");
  const date=String(payload.payment?.date||"");
  if(!validDate(date))return fail("Informe uma data válida para o pagamento.");
  if(isDateInClosedPeriod(data,date))return fail("O período financeiro deste pagamento está fechado.");
  const pagador=String(payload.payment?.pagador||"");
  if(!["empresa","obra"].includes(pagador))return fail("Informe quem realizou o pagamento.");
  const amounts=paymentAmounts(measurement.total,contract);
  if(amounts.error)return fail(amounts.error);
  const missingEvidence=!(measurement.fotos||[]).length;
  if(missingEvidence&&payload.riskAccepted!==true){
    return fail("Confirme explicitamente o pagamento sem evidência fotográfica.");
  }
  const approval=startPaymentApproval(data,{
    paymentId,value:Number(measurement.total||0),obraId:measurement.obraId,
    hasMeasurement:true,actor,now,
  });
  try{
    const next=payThirdPartyMeasurement({
      data:approval.data,measurementId,actor,id:paymentId,now,
      payment:{
        ...payload.payment,id:paymentId,tercName:contract.name,
        specialty:contract.specialty,date,pagador,
        ...amounts,
        semEvidenciaFotografica:missingEvidence,
        riscoSemFotoAceitoEm:missingEvidence?now:"",
        riscoSemFotoAceitoPor:missingEvidence?actor.nome:"",
        aprovacaoInstanciaId:approval.resumo.instanciaId,
      },
    });
    return {
      ok:true,data:next,entityId:paymentId,
      summary:{approvalStatus:approval.resumo.status},
    };
  }catch(error){return fail(error.message);}
};

const linkInvoice=(data,command,now)=>{
  const payload=command.payload||{};
  const measurement=measurementById(data,payload.measurementId);
  const invoice=invoiceById(data,payload.invoiceId);
  if(!measurement||!invoice)return fail("Medição ou nota fiscal não encontrada.");
  if(!sameVersion(measurement,payload.expectedMeasurementVersion)
    ||!sameVersion(invoice,payload.expectedInvoiceVersion)){
    return fail("A medição ou a nota fiscal foi alterada por outra pessoa. Atualize a tela.");
  }
  if(measurement.notaFiscalId&&String(measurement.notaFiscalId)!==String(invoice.id)){
    return fail("A medição já está vinculada a outra nota fiscal.");
  }
  const linked=linkThirdPartyInvoice(data,{
    medicaoTercId:measurement.id,notaFiscalId:invoice.id,
  });
  if(!linked.ok)return fail(linked.error);
  const actor=actorOf(command);
  return {
    ok:true,entityId:measurement.id,
    data:{
      ...data,
      medicoesTerc:linked.medicoesTerc.map(item=>item.id!==measurement.id?item:{
        ...item,version:versionOf(item)+1,updatedAt:now,
        updatedById:actor.id,updatedBy:actor.nome,
      }),
      notasFiscais:linked.notasFiscais.map(item=>item.id!==invoice.id?item:{
        ...item,version:versionOf(item)+1,atualizadoEm:now,
        updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
      }),
    },
  };
};

const saveContractStages=(data,command,now)=>{
  const payload=command.payload||{};
  const contract=contractById(data,payload.contractId);
  if(!contract)return fail("Contrato de terceiro não encontrado.");
  if(!sameVersion(contract,command.expectedVersion)){
    return fail("O contrato foi alterado por outra pessoa. Atualize a tela.");
  }
  const raw=Array.isArray(payload.stages)?payload.stages:[];
  const ids=new Set();
  const stages=[];
  for(const [index,item] of raw.entries()){
    const id=String(item?.id||""),nome=String(item?.nome||"").trim();
    const valor=Number(item?.valor||0);
    if(!id||ids.has(id)||!nome||!Number.isFinite(valor)||valor<0){
      return fail("As etapas do contrato possuem dados inválidos ou repetidos.");
    }
    ids.add(id);
    stages.push({...item,id,nome,valor,ordem:index});
  }
  const measuredStageIds=new Set((data.medicoesTerc||[])
    .filter(item=>String(item.tercId)===String(contract.id)&&active(item))
    .flatMap(item=>(item.itens||[]).map(stage=>String(stage.etapaId||""))));
  if([...measuredStageIds].some(id=>!ids.has(id))){
    return fail("Uma etapa já medida não pode ser removida do contrato.");
  }
  const actor=actorOf(command);
  const updated={...contract,etapas:stages,version:versionOf(contract)+1,
    updatedAt:now,updatedById:actor.id,updatedBy:actor.nome};
  return {ok:true,entityId:contract.id,data:{...data,
    terceirizados:(data.terceirizados||[]).map(item=>item.id===contract.id?updated:item)}};
};

export const thirdPartyCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_RECORDED){
    return String(contractById(data,payload.payment?.tercId)?.obraId||"");
  }
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED){
    return String(paymentById(data,payload.paymentId)?.obraId||"");
  }
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED){
    return String(contractById(data,payload.measurement?.tercId)?.obraId||"");
  }
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED){
    return String(contractById(data,payload.contractId)?.obraId||"");
  }
  const measurement=measurementById(data,payload.measurementId);
  return String(measurement?.obraId||"");
};

export const applyThirdPartyCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!THIRD_PARTY_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para alterar terceiros.");
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_RECORDED)return recordPayment(data,command,now);
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_PAYMENT_REVERSED)return reversePayment(data,command,now);
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED)return recordMeasurement(data,command,now);
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED)return cancelMeasurement(data,command,now);
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_MEASUREMENT_PAID)return payMeasurement(data,command,now);
  if(command.type===THIRD_PARTY_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED)return saveContractStages(data,command,now);
  return linkInvoice(data,command,now);
};
