// Comandos operacionais são a fronteira transitória entre o LegacyApp e uma
// persistência por agregado. Eles são puros para poderem ser exercitados sem
// navegador e, principalmente, não fazem "last write wins" para a mesma
// entidade. A migração do endpoint para comandos usa este mesmo contrato.
import {
  normalizeTechnicalMeasurement,
  rebuildTechnicalMeasurementProjection,
  technicalMeasurementAuditEvent,
  validateTechnicalMeasurement,
} from "../medicoes/index.js";
import { inactive } from "../financeiro/workflows.js";
import { cancelProgressRecord, completeWeeklyCommitment, createProgressRecord, createWeeklyCommitment, releaseWeeklyCommitment } from "../producao/mutations.js";
import { buildQualityProjection, canReleaseForMeasurement } from "../qualidade/calculations.js";
import { validateActivitySafety } from "../seguranca/calculations.js";
import { addConstraint, commitWorkPackage, createLookahead, releaseConstraint } from "../lookahead/commands.js";
import { applyEquipmentCommand, EQUIPMENT_COMMAND } from "../equipamentos/commands.js";
import { createManualReceipt, reverseManualReceipt } from "../dre/mutations.js";
import {
  applyClientMeasurementCommand,
  CLIENT_MEASUREMENT_COMMAND,
} from "../financeiro/measurement-commands.js";
import { activateCommercialContract } from "../comercial/contract-activation.js";
import { applyExpenseCommand, EXPENSE_COMMAND } from "../financeiro/expense-commands.js";
import { applyWorkCashCommand, WORK_CASH_COMMAND } from "../financeiro/work-cash-commands.js";
export const OPERATIONAL_COMMAND = Object.freeze({
  TECHNICAL_MEASUREMENT_CREATED:"MEDICAO_TECNICA_CRIADA",
  TECHNICAL_MEASUREMENT_CANCELLED:"MEDICAO_TECNICA_CANCELADA",
  FIELD_REPORT_CHANGED:"RDO_CAMPO_ALTERADO",
  FIELD_REPORT_CANCELLED:"RDO_CANCELADO",
  PURCHASE_RECEIPT_RECORDED:"PEDIDO_RECEBIMENTO_REGISTRADO",
  MANUAL_RECEIPT_CREATED:"RECEBIMENTO_MANUAL_CRIADO",
  MANUAL_RECEIPT_REVERSED:"RECEBIMENTO_MANUAL_ESTORNADO",
  ...CLIENT_MEASUREMENT_COMMAND,
  COMMERCIAL_CONTRACT_ACTIVATED:"CONTRATO_COMERCIAL_ATIVADO",
  ...EXPENSE_COMMAND,
  ...WORK_CASH_COMMAND,
  PROGRESS_RECORD_SAVED:"AVANCO_FISICO_REGISTRADO",
  PROGRESS_RECORD_CANCELLED:"AVANCO_FISICO_CANCELADO",
  WEEKLY_COMMITMENT_COMPLETED:"COMPROMISSO_SEMANAL_CONCLUIDO",
  WEEKLY_COMMITMENT_CREATED:"COMPROMISSO_SEMANAL_CRIADO",
  WEEKLY_COMMITMENT_RELEASED:"COMPROMISSO_SEMANAL_LIBERADO",
  QUALITY_PLAN_GENERATED:"PLANO_QUALIDADE_GERADO",
  QUALITY_ITEM_INSPECTED:"ITEM_QUALIDADE_INSPECIONADO",
  QUALITY_NONCONFORMITY_RESOLVED:"NAO_CONFORMIDADE_RESOLVIDA",
  QUALITY_RECORD_RELEASED:"FICHA_QUALIDADE_LIBERADA",
  QUALITY_RECORD_DETAILS_UPDATED:"FICHA_QUALIDADE_ATUALIZADA",
  SAFETY_RISK_ANALYSIS_SAVED:"APR_SALVA",
  SAFETY_WORK_PERMIT_SAVED:"PERMISSAO_TRABALHO_SALVA",
  LOOKAHEAD_CREATED:"LOOKAHEAD_CRIADO",
  LOOKAHEAD_CONSTRAINT_ADDED:"RESTRICAO_LOOKAHEAD_ADICIONADA",
  LOOKAHEAD_CONSTRAINT_RELEASED:"RESTRICAO_LOOKAHEAD_LIBERADA",
  LOOKAHEAD_PACKAGE_COMMITTED:"PACOTE_LOOKAHEAD_COMPROMETIDO",
  ...EQUIPMENT_COMMAND,
});

const receipts=data=>Array.isArray(data?.operationalCommandReceipts)?data.operationalCommandReceipts:[];
const versionOf=entity=>Number(entity?.version||0);
const fail=reason=>({ok:false,reason});
const appendReceipt=(data,command,entityId,now)=>({
  ...data,
  operationalCommandReceipts:[...receipts(data),{
    idempotencyKey:command.idempotencyKey,type:command.type,entityId,
    appliedAt:now,actorId:command.actorId||"",
  }].slice(-2000),
});
const commandIsValid=command=>command&&typeof command.type==="string"&&String(command.idempotencyKey||"").length>=8;
const duplicate=(data,key)=>receipts(data).some(item=>item.idempotencyKey===key);
const requiresVersion=(current,expected,label)=>{
  if(expected==null)return "";
  return versionOf(current)===Number(expected)?"":`${label} foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.`;
};
const appendTechnicalMeasurementAudit=(data,event)=>({
  ...data,
  technicalMeasurementAuditEvents:[...(data?.technicalMeasurementAuditEvents||[]),event].slice(-2000),
});
const validateMeasurementQuality=(data={},measurement={})=>{
  if(String(measurement.status||"")!=="aprovada")return "";
  const quality=buildQualityProjection(data);
  for(const item of measurement.itens||[]){
    const release=canReleaseForMeasurement({
      inspections:quality.inspections,nonconformities:quality.nonconformities,
      obraId:measurement.obraId,serviceId:item.tarefaId,
    });
    if(!release.ok)return `A tarefa ${item.tarefaId} não pode ser medida: ${release.reason}`;
  }
  return "";
};
const validateProgressSafety=(data={},record={})=>{
  const source=(data.scheduleActivities||[]).find(item=>String(item.id)===String(record.activityId))||{};
  const critical=Boolean(source.criticalActivity||source.atividadeCritica||record.criticalActivity);
  if(!critical)return "";
  const activity={...source,id:source.id||record.activityId,criticalActivity:true};
  const workerIds=new Set(record.workerIds||[]);
  if(!workerIds.size)return "Atividade crítica exige equipe identificada.";
  const workers=(data.employees||[]).filter(item=>workerIds.has(item.id));
  const result=validateActivitySafety({
    activity,workers,
    aprs:(data.jobRiskAnalyses||[]).filter(item=>!item.obraId||String(item.obraId)===String(record.obraId)),
    permits:(data.workPermits||[]).filter(item=>!item.obraId||String(item.obraId)===String(record.obraId)),
    asOf:record.data,
  });
  return result.ok?"":result.reason;
};
const qualityRecords=data=>Array.isArray(data?.qualidadeRegistros)?data.qualidadeRegistros:[];
const replaceQualityRecord=(data,id,record)=>({...data,qualidadeRegistros:qualityRecords(data).map(item=>item.id===id?record:item)});
const qualityKey=record=>`${record.tipo||""}|${record.etapaId||record.materialId||record.itemOrcamentoId||""}`;
const openNonconformity=record=>record?.naoConformidade&&!['encerrada','cancelada'].includes(record.naoConformidade.status);
const qualityRecordVersionError=(record,command)=>requiresVersion(record,command.expectedVersion,"A ficha de qualidade");
const safetyRecords=(data,key)=>Array.isArray(data?.[key])?data[key]:[];
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const replaceSafetyRecord=(data,key,id,record)=>({...data,[key]:safetyRecords(data,key).map(item=>item.id===id?record:item)});
const safetyCommandError=(record,command,label)=>requiresVersion(record,command.expectedVersion,label);
const lookaheads=data=>Array.isArray(data?.lookaheadWindows)?data.lookaheadWindows:[];
const replaceLookahead=(data,id,record)=>({...data,lookaheadWindows:lookaheads(data).map(item=>item.id===id?record:item)});

export const applyOperationalCommand=(data,command)=>{
  if(!commandIsValid(command))return fail("Comando operacional sem chave idempotente válida.");
  if(duplicate(data,command.idempotencyKey))return {ok:true,idempotent:true,data};
  const now=command.now||new Date().toISOString();
  const equipmentResult=applyEquipmentCommand(data,command,now);
  if(equipmentResult){
    if(!equipmentResult.ok)return equipmentResult;
    return {ok:true,data:appendReceipt(equipmentResult.data,command,equipmentResult.entityId,now)};
  }
  const financialMeasurementResult=applyClientMeasurementCommand(data,command,now);
  if(financialMeasurementResult){
    if(!financialMeasurementResult.ok)return financialMeasurementResult;
    return {
      ok:true,
      data:appendReceipt(
        financialMeasurementResult.data,command,
        financialMeasurementResult.entityId,now,
      ),
    };
  }
  const expenseResult=applyExpenseCommand(data,command,now);
  if(expenseResult){
    if(!expenseResult.ok)return expenseResult;
    return {
      ok:true,copied:expenseResult.copied,
      data:appendReceipt(expenseResult.data,command,expenseResult.entityId,now),
    };
  }
  const workCashResult=applyWorkCashCommand(data,command,now);
  if(workCashResult){
    if(!workCashResult.ok)return workCashResult;
    return {
      ok:true,
      data:appendReceipt(workCashResult.data,command,workCashResult.entityId,now),
    };
  }
  if(command.type===OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED){
    const result=activateCommercialContract({
      data,contractId:command.payload?.contractId,obraId:command.payload?.obraId,
      ids:command.payload?.ids,actor:{id:command.actorId,nome:command.actorName},now,
    });
    if(!result.ok)return fail(result.error);
    return {ok:true,data:appendReceipt(result.data,command,result.entityId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED){
    const records=Array.isArray(command.payload?.records)?command.payload.records:[];
    if(!records.length||records.length>500)return fail("O plano de qualidade precisa conter entre 1 e 500 fichas.");
    const obraId=String(records[0]?.obraId||"");
    if(!obraId||records.some(record=>String(record?.obraId||"")!==obraId))return fail("Todas as fichas do plano precisam pertencer à mesma obra.");
    const ids=new Set(qualityRecords(data).map(record=>record.id));
    const keys=new Set(qualityRecords(data).filter(record=>String(record.obraId)===obraId).map(qualityKey));
    const created=[];
    for(const raw of records){
      if(!raw?.id||!['fvs','fvm'].includes(raw.tipo)||!String(raw.titulo||"").trim())return fail("Ficha de qualidade inválida.");
      const key=qualityKey(raw);
      if(ids.has(raw.id)||keys.has(key))continue;
      ids.add(raw.id);keys.add(key);
      created.push({...raw,status:'planejada',version:1,criadoEm:raw.criadoEm||now,atualizadoEm:now,criadoPorId:command.actorId||'',criadoPor:command.actorName||''});
    }
    const next={...data,qualidadeRegistros:[...qualityRecords(data),...created]};
    return {ok:true,data:appendReceipt(next,command,`qualidade:${obraId}`,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED){
    const recordId=String(command.payload?.recordId||"");
    const itemId=String(command.payload?.itemId||"");
    const result=String(command.payload?.result||"");
    if(!['conforme','nao_conforme','nao_aplicavel'].includes(result))return fail("Resultado de inspeção inválido.");
    const current=qualityRecords(data).find(record=>record.id===recordId);
    if(!current)return fail("Ficha de qualidade não encontrada.");
    const versionError=qualityRecordVersionError(current,command);
    if(versionError)return fail(versionError);
    if(current.status==='aprovada')return fail("Uma ficha liberada não pode receber nova inspeção. Abra uma nova reinspeção.");
    if(!(current.itens||[]).some(item=>item.id===itemId))return fail("Critério de inspeção não encontrado.");
    const items=(current.itens||[]).map(item=>item.id===itemId?{
      ...item,status:result,responsavelId:command.actorId||'',responsavel:command.actorName||'',verificadoEm:now,
      historicoInspecoes:[...(item.historicoInspecoes||[]),{id:`ins_${command.idempotencyKey}`,resultado:result,inspecionadoEm:now,inspecionadoPorId:command.actorId||'',inspecionadoPor:command.actorName||'',tipo:'inspecao'}].slice(-100),
    }:item);
    const nonconformity=result==='nao_conforme'?(openNonconformity(current)?current.naoConformidade:{descricao:'Item(ns) não conforme(s) identificado(s) na inspeção.',disposicao:'Segregar, conter ou suspender a liberação até decisão.',acao:'',responsavelId:current.responsavelId||'',responsavel:current.responsavel||'',prazo:'',status:'aberta',verificacaoEficacia:'',encerradoEm:'',criadaEm:now,criadaPorId:command.actorId||''}):current.naoConformidade;
    const updated={...current,itens:items,status:result==='nao_conforme'?'reprovada':current.status,naoConformidade:nonconformity,version:versionOf(current)+1,atualizadoEm:now};
    return {ok:true,data:appendReceipt(replaceQualityRecord(data,recordId,updated),command,recordId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED){
    const recordId=String(command.payload?.recordId||"");
    const current=qualityRecords(data).find(record=>record.id===recordId);
    if(!current)return fail("Ficha de qualidade não encontrada.");
    const versionError=qualityRecordVersionError(current,command);
    if(versionError)return fail(versionError);
    if(!openNonconformity(current))return fail("Não há não conformidade aberta nesta ficha.");
    const action=String(command.payload?.correctiveAction||"").trim();
    const effectiveness=String(command.payload?.effectiveness||"").trim();
    if(!action||!effectiveness)return fail("Registre a ação corretiva e a verificação de eficácia antes da reinspeção.");
    const affected=(current.itens||[]).filter(item=>item.status==='nao_conforme');
    const reinspection={id:`reins_${command.idempotencyKey}`,tipo:'reinspecao',reinspecionadaEm:now,reinspecionadaPorId:command.actorId||'',reinspecionadaPor:command.actorName||'',acaoCorretiva:action,verificacaoEficacia:effectiveness,itens:affected.map(item=>({itemId:item.id,resultadoAnterior:item.status}))};
    const updated={...current,status:'em_inspecao',itens:(current.itens||[]).map(item=>item.status==='nao_conforme'?{
      ...item,status:'conforme',responsavelId:command.actorId||'',responsavel:command.actorName||'',verificadoEm:now,
      historicoInspecoes:[...(item.historicoInspecoes||[]),{id:`ins_${command.idempotencyKey}_${item.id}`,resultado:'conforme',inspecionadoEm:now,inspecionadoPorId:command.actorId||'',inspecionadoPor:command.actorName||'',tipo:'reinspecao',resultadoAnterior:'nao_conforme'}].slice(-100),
    }:item),historicoReinspecoes:[...(current.historicoReinspecoes||[]),reinspection].slice(-100),naoConformidade:{...current.naoConformidade,acao:action,verificacaoEficacia:effectiveness,status:'encerrada',encerradoEm:now,encerradoPorId:command.actorId||''},version:versionOf(current)+1,atualizadoEm:now};
    return {ok:true,data:appendReceipt(replaceQualityRecord(data,recordId,updated),command,recordId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED){
    const recordId=String(command.payload?.recordId||"");
    const current=qualityRecords(data).find(record=>record.id===recordId);
    if(!current)return fail("Ficha de qualidade não encontrada.");
    const versionError=qualityRecordVersionError(current,command);
    if(versionError)return fail(versionError);
    if((current.itens||[]).some(item=>item.status==='pendente'))return fail("Conclua todos os critérios antes de liberar a ficha.");
    if((current.itens||[]).some(item=>item.status==='nao_conforme')||openNonconformity(current))return fail("Encerre a não conformidade e verifique a eficácia antes de liberar a ficha.");
    const updated={...current,status:'aprovada',inspetorId:command.actorId||'',inspetor:command.actorName||'',concluidoEm:now,version:versionOf(current)+1,atualizadoEm:now};
    return {ok:true,data:appendReceipt(replaceQualityRecord(data,recordId,updated),command,recordId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.QUALITY_RECORD_DETAILS_UPDATED){
    const recordId=String(command.payload?.recordId||"");
    const current=qualityRecords(data).find(record=>record.id===recordId);
    if(!current)return fail("Ficha de qualidade não encontrada.");
    const versionError=qualityRecordVersionError(current,command);
    if(versionError)return fail(versionError);
    const patch=command.payload?.patch||{};
    const allowed={};
    if(Object.hasOwn(patch,'responsavelId')){
      const user=(data.usuarios||[]).find(item=>item.id===patch.responsavelId&&item.active!==false);
      if(!user)return fail("Responsável da ficha inválido.");
      allowed.responsavelId=user.id;allowed.responsavel=user.nome||'';
    }
    if(Object.hasOwn(patch,'normaProjeto'))allowed.normaProjeto=String(patch.normaProjeto||'').trim().slice(0,2000);
    if(!Object.keys(allowed).length)return fail("Nenhuma atualização válida foi informada para a ficha.");
    const updated={...current,...allowed,version:versionOf(current)+1,atualizadoEm:now};
    return {ok:true,data:appendReceipt(replaceQualityRecord(data,recordId,updated),command,recordId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED){
    const input=command.payload?.analysis||{};
    const id=String(input.id||"");
    const obraId=String(input.obraId||"");
    const activityId=String(input.activityId||"");
    const status=String(input.status||"rascunho");
    if(!id||!obraId||!activityId)return fail("APR exige identificação, obra e atividade.");
    if(!["rascunho","aprovada"].includes(status))return fail("Status da APR inválido.");
    const current=safetyRecords(data,"jobRiskAnalyses").find(item=>item.id===id);
    if(current){
      const versionError=safetyCommandError(current,command,"A APR");
      if(versionError)return fail(versionError);
      if(current.status==="aprovada")return fail("APR aprovada é imutável. Crie uma revisão para alterar riscos ou controles.");
      if(String(current.obraId)!==obraId||String(current.activityId)!==activityId)return fail("A APR não pode ser movida para outra obra ou atividade.");
    }else if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A APR ainda não existe na versão esperada.");
    const risks=Array.isArray(input.risks)?input.risks.filter(Boolean):[];
    const controls=Array.isArray(input.controls)?input.controls.filter(Boolean):[];
    if(status==="aprovada"&&(!risks.length||!controls.length))return fail("APR aprovada exige ao menos um risco e uma medida de controle.");
    const record={...(current||{}),...input,id,obraId,activityId,status,risks,controls,version:versionOf(current)+1,atualizadoEm:now,...(!current?{criadoEm:now,criadoPorId:command.actorId||"",criadoPor:command.actorName||""}:{})};
    const next=current?replaceSafetyRecord(data,"jobRiskAnalyses",id,record):{...data,jobRiskAnalyses:[...safetyRecords(data,"jobRiskAnalyses"),record]};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED){
    const input=command.payload?.permit||{};
    const id=String(input.id||"");
    const obraId=String(input.obraId||"");
    const activityId=String(input.activityId||"");
    const status=String(input.status||"rascunho");
    if(!id||!obraId||!activityId)return fail("Permissão de trabalho exige identificação, obra e atividade.");
    if(!["rascunho","liberada","suspensa","encerrada"].includes(status))return fail("Status da permissão de trabalho inválido.");
    if(!validDate(input.validFrom)||!validDate(input.validUntil)||String(input.validUntil)<String(input.validFrom))return fail("Informe a vigência válida da permissão de trabalho.");
    const current=safetyRecords(data,"workPermits").find(item=>item.id===id);
    if(current){
      const versionError=safetyCommandError(current,command,"A permissão de trabalho");
      if(versionError)return fail(versionError);
      if(["encerrada"].includes(current.status))return fail("Permissão encerrada é imutável. Crie uma nova permissão.");
      if(String(current.obraId)!==obraId||String(current.activityId)!==activityId)return fail("A permissão não pode ser movida para outra obra ou atividade.");
    }else if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("A permissão de trabalho ainda não existe na versão esperada.");
    if(status==="liberada"&&!safetyRecords(data,"jobRiskAnalyses").some(item=>String(item.obraId)===obraId&&String(item.activityId)===activityId&&item.status==="aprovada"))return fail("Libere a permissão somente após a APR aprovada para esta atividade.");
    const record={...(current||{}),...input,id,obraId,activityId,status,version:versionOf(current)+1,atualizadoEm:now,...(!current?{criadoEm:now,criadoPorId:command.actorId||"",criadoPor:command.actorName||""}:{})};
    const next=current?replaceSafetyRecord(data,"workPermits",id,record):{...data,workPermits:[...safetyRecords(data,"workPermits"),record]};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.LOOKAHEAD_CREATED){
    const input=command.payload?.lookahead||{};
    if(!input.id)return fail("Lookahead sem identificação.");
    if(lookaheads(data).some(item=>item.id===input.id))return fail("Já existe um Lookahead com esta identificação.");
    if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O Lookahead ainda não existe na versão esperada.");
    const result=createLookahead(input,{actor:{id:command.actorId,nome:command.actorName},now});
    if(!result.ok)return fail(result.error);
    const created={...result.lookahead,version:1,atualizadoEm:now};
    return {ok:true,data:appendReceipt({...data,lookaheadWindows:[...lookaheads(data),created]},command,created.id,now)};
  }

  if([OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED].includes(command.type)){
    const lookaheadId=String(command.payload?.lookaheadId||"");
    const current=lookaheads(data).find(item=>item.id===lookaheadId);
    if(!current)return fail("Lookahead não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O Lookahead");
    if(versionError)return fail(versionError);
    let result;
    if(command.type===OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED)result=addConstraint(current,command.payload?.constraint,{actor:{id:command.actorId,nome:command.actorName},now});
    if(command.type===OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED)result=releaseConstraint(current,command.payload?.constraintId,{evidenceIds:command.payload?.evidenceIds,actor:{id:command.actorId,nome:command.actorName},now});
    if(command.type===OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED)result=commitWorkPackage(current,command.payload?.packageId,{exceptionReason:command.payload?.exceptionReason,now});
    if(!result?.ok)return fail(result?.error||"Não foi possível atualizar o Lookahead.");
    const updated={...result.lookahead,version:versionOf(current)+1,atualizadoEm:now};
    return {ok:true,data:appendReceipt(replaceLookahead(data,lookaheadId,updated),command,lookaheadId,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED){
    const measurement=command.payload?.measurement;
    if(!measurement?.id)return fail("Medição técnica sem identificação.");
    if((data?.medicoesObra||[]).some(item=>item.id===measurement.id))return fail("Já existe uma medição técnica com esta identificação.");
    const nextNumber=Math.max(0,...(data?.medicoesObra||[]).filter(item=>item.obraId===measurement.obraId).map(item=>Number(item.numero||0)))+1;
    const created={...normalizeTechnicalMeasurement({...measurement,numero:nextNumber},{now,nextNumber}),version:1};
    const validation=validateTechnicalMeasurement(created,{requireApprovedItems:true});
    if(!validation.ok)return fail(validation.errors.join(" "));
    const qualityError=validateMeasurementQuality(data,created);
    if(qualityError)return fail(qualityError);
    let next={...data,medicoesObra:[...(data?.medicoesObra||[]),created]};
    next=rebuildTechnicalMeasurementProjection(next,created.obraId,now);
    next=appendTechnicalMeasurementAudit(next,technicalMeasurementAuditEvent({
      type:"MEDICAO_TECNICA_APROVADA",measurement:created,
      actor:{id:command.actorId,nome:command.actorName},occurredAt:now,
    }));
    return {ok:true,data:appendReceipt(next,command,created.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED){
    const id=String(command.payload?.measurementId||"");
    const current=(data?.medicoesObra||[]).find(item=>item.id===id);
    if(!current)return fail("Medição técnica não encontrada.");
    const versionError=requiresVersion(current,command.expectedVersion,"A medição técnica");
    if(versionError)return fail(versionError);
    if(["cancelada","cancelado"].includes(current.status))return fail("A medição técnica já está cancelada.");
    const reason=String(command.payload?.reason||"").trim();
    if(!reason)return fail("Informe o motivo do cancelamento da medição técnica.");
    if((data?.medicoes||[]).some(item=>item.medicaoTecnicaId===id&&!inactive(item))){
      return fail("Cancele primeiro o faturamento vinculado à medição técnica.");
    }
    const cancelled={...current,status:"cancelada",motivoCancelamento:reason,canceladaEm:now,canceladaPorId:command.actorId||"",canceladaPor:command.actorName||"",updatedAt:now,version:versionOf(current)+1};
    let next={...data,medicoesObra:(data.medicoesObra||[]).map(item=>item.id===id?cancelled:item)};
    next=rebuildTechnicalMeasurementProjection(next,current.obraId,now);
    next=appendTechnicalMeasurementAudit(next,technicalMeasurementAuditEvent({
      type:"MEDICAO_TECNICA_CANCELADA",measurement:cancelled,
      actor:{id:command.actorId,nome:command.actorName},occurredAt:now,reason,
    }));
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED){
    const report=command.payload?.report;
    if(!report?.id)return fail("Diário de obra sem identificação.");
    const current=(data?.rdos||[]).find(item=>item.id===report.id);
    const effective=current?{...current,...report}:report;
    if(!String(effective.obraId||"").trim()||!/^\d{4}-\d{2}-\d{2}$/.test(String(effective.data||"")))return fail("Diário de obra exige obra e data válida.");
    if(current){
      const versionError=requiresVersion(current,command.expectedVersion,"O diário de obra");
      if(versionError)return fail(versionError);
      const updated={...current,...report,id:current.id,createdAt:current.createdAt||current.criadoEm||now,criadoEm:current.criadoEm||current.createdAt||now,updatedAt:now,atualizadoEm:now,version:versionOf(current)+1};
      const next={...data,rdos:(data.rdos||[]).map(item=>item.id===current.id?updated:item)};
      return {ok:true,data:appendReceipt(next,command,current.id,now)};
    }
    if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O diário de obra ainda não existe na versão esperada.");
    const created={...report,version:1,createdAt:report.createdAt||report.criadoEm||now,criadoEm:report.criadoEm||report.createdAt||now,updatedAt:now,atualizadoEm:now};
    const next={...data,rdos:[...(data?.rdos||[]),created]};
    return {ok:true,data:appendReceipt(next,command,created.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED){
    const id=String(command.payload?.reportId||"");
    const current=(data?.rdos||[]).find(item=>item.id===id);
    if(!current)return fail("Diário de obra não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O diário de obra");
    if(versionError)return fail(versionError);
    if(current.status==="cancelado")return fail("O diário de obra já está cancelado.");
    const reason=String(command.payload?.reason||"").trim();
    if(!reason)return fail("Cancelamento do diário de obra exige motivo.");
    const cancelled={...current,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,canceladoPorId:command.actorId||"",canceladoPor:command.actorName||"",updatedAt:now,atualizadoEm:now,version:versionOf(current)+1,operationalHistory:[...(current.operationalHistory||[]),{type:"cancelled",at:now,byId:command.actorId||"",by:command.actorName||"",reason}]};
    const next={...data,rdos:(data.rdos||[]).map(item=>item.id===id?cancelled:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED){
    const record=command.payload?.record;
    if(!record?.id)return fail("Avanço físico sem identificação.");
    const current=(data?.progressRecords||[]).find(item=>item.id===record.id);
    if(current)return fail("Avanço físico já existe. Para corrigir, estorne e registre um novo avanço.");
    if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O avanço físico ainda não existe na versão esperada.");
    const commitment=(data?.weeklyCommitments||[]).find(item=>item.id===record.commitmentId);
    if(commitment?.status==="bloqueado")return fail("O compromisso semanal está bloqueado. Resolva a restrição antes de registrar avanço.");
    const created=createProgressRecord(record,{actor:{id:command.actorId,nome:command.actorName},now});
    if(!created.ok)return fail(created.error);
    const safetyError=validateProgressSafety(data,created.record);
    if(safetyError)return fail(`Avanço físico bloqueado por segurança: ${safetyError}`);
    const next={...data,progressRecords:[...(data?.progressRecords||[]),created.record]};
    return {ok:true,data:appendReceipt(next,command,created.record.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED){
    const id=String(command.payload?.recordId||"");
    const current=(data?.progressRecords||[]).find(item=>item.id===id);
    if(!current)return fail("Avanço físico não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O avanço físico");
    if(versionError)return fail(versionError);
    const cancelled=cancelProgressRecord(current,{reason:command.payload?.reason,actor:{id:command.actorId,nome:command.actorName},now});
    if(!cancelled.ok)return fail(cancelled.error);
    const next={...data,progressRecords:(data?.progressRecords||[]).map(item=>item.id===id?cancelled.record:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED){
    const id=String(command.payload?.commitmentId||"");
    const current=(data?.weeklyCommitments||[]).find(item=>item.id===id);
    if(!current)return fail("Compromisso semanal não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O compromisso semanal");
    if(versionError)return fail(versionError);
    if(current.status==="bloqueado")return fail("Resolva a restrição antes de concluir o compromisso semanal.");
    if(["concluido","cancelado"].includes(current.status))return fail("Este compromisso semanal não pode mais ser concluído.");
    const result=completeWeeklyCommitment(current,data?.progressRecords||[],{actor:{id:command.actorId,nome:command.actorName},now,reason:command.payload?.reason});
    if(!result.ok)return fail(result.error);
    const commitment={...result.commitment,version:versionOf(current)+1,completedAt:now,completedById:command.actorId||""};
    const next={...data,weeklyCommitments:(data?.weeklyCommitments||[]).map(item=>item.id===id?commitment:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED){
    const input=command.payload?.commitment;
    if(!input?.id)return fail("Compromisso semanal sem identificação.");
    if((data?.weeklyCommitments||[]).some(item=>item.id===input.id))return fail("Já existe um compromisso semanal com esta identificação.");
    const created=createWeeklyCommitment(input,{actor:{id:command.actorId,nome:command.actorName},now});
    if(!created.ok)return fail(created.error);
    const next={...data,weeklyCommitments:[...(data?.weeklyCommitments||[]),created.commitment]};
    return {ok:true,data:appendReceipt(next,command,created.commitment.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED){
    const id=String(command.payload?.commitmentId||"");
    const current=(data?.weeklyCommitments||[]).find(item=>item.id===id);
    if(!current)return fail("Compromisso semanal não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O compromisso semanal");
    if(versionError)return fail(versionError);
    const released=releaseWeeklyCommitment(current,{reason:command.payload?.reason,actor:{id:command.actorId,nome:command.actorName},now});
    if(!released.ok)return fail(released.error);
    const next={...data,weeklyCommitments:(data?.weeklyCommitments||[]).map(item=>item.id===id?released.commitment:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED){
    const receipt=command.payload?.receipt||{};
    const id=String(receipt.id||"");
    if(!id)return fail("Recebimento manual sem identificação.");
    if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O novo recebimento precisa iniciar na versão zero.");
    if((data?.payments||[]).some(item=>item.id===id))return fail("Já existe um recebimento com esta identificação.");
    if(!(data?.obras||[]).some(item=>String(item.id)===String(receipt.obraId||"")))return fail("A obra do recebimento não existe.");
    try{
      const next=createManualReceipt({
        data,receipt,actor:{id:command.actorId,nome:command.actorName},id,now,
      });
      return {ok:true,data:appendReceipt(next,command,id,now)};
    }catch(error){
      return fail(error?.message||"Recebimento manual inválido.");
    }
  }

  if(command.type===OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED){
    const id=String(command.payload?.receiptId||"");
    const current=(data?.payments||[]).find(item=>item.id===id);
    if(!current)return fail("Recebimento não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O recebimento");
    if(versionError)return fail(versionError);
    try{
      const next=reverseManualReceipt({
        data,receiptId:id,reason:command.payload?.reason,
        actor:{id:command.actorId,nome:command.actorName},now,
      });
      return {ok:true,data:appendReceipt(next,command,id,now)};
    }catch(error){
      return fail(error?.message||"Não foi possível estornar o recebimento.");
    }
  }

  if(command.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED){
    const pedidoId=String(command.payload?.pedidoId||"");
    const current=(data?.pedidos||[]).find(item=>item.id===pedidoId);
    if(!current)return fail("Pedido não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O pedido");
    if(versionError)return fail(versionError);
    const quantities=command.payload?.receivedQuantities;
    const entries=Array.isArray(command.payload?.stockEntries)?command.payload.stockEntries:[];
    if(!quantities||!entries.length)return fail("Recebimento de pedido incompleto.");
    const ids=new Set((data?.movEstoque||[]).map(item=>item.id));
    if(entries.some(item=>!item?.id||ids.has(item.id)))return fail("Há uma entrada de estoque duplicada neste recebimento.");
    const byItem=new Map((current.itens||[]).map(item=>[item.id,item]));
    const requested=Object.entries(quantities).filter(([,value])=>Number(value)>0);
    if(!requested.length)return fail("Informe ao menos uma quantidade recebida.");
    for(const [itemId,value] of requested){
      const item=byItem.get(itemId),quantity=Number(value);
      if(!item||!Number.isFinite(quantity)||quantity<=0)return fail("Item de recebimento inválido.");
      if(quantity>Number(item.qtd||0)-Number(item.qtdRecebida||0)+1e-6)return fail("Recebimento excede o saldo do pedido.");
    }
    if(entries.length!==requested.length||entries.some(entry=>{
      const item=byItem.get(entry?.pedidoItemId||"");
      return !item||entry.pedidoId!==current.id||entry.obraId!==current.obraId||entry.materialId!==item.materialId||Math.abs(Number(entry.qtd||0)-Number(quantities[item.id]||0))>=1e-6;
    }))return fail("Entradas de estoque não correspondem ao recebimento informado.");
    const updated={...current,itens:(current.itens||[]).map(item=>{
      const quantity=Number(quantities[item.id]||0);
      return quantity>0?{...item,qtdRecebida:Number(item.qtdRecebida||0)+quantity,recebimentos:[...(item.recebimentos||[]),{id:entries.find(entry=>entry.pedidoItemId===item.id)?.receiptId||`${command.idempotencyKey}:${item.id}`,data:entries.find(entry=>entry.pedidoItemId===item.id)?.data||now.slice(0,10),qtd:quantity,precoUnit:Number(item.precoUnit||0),responsavelId:command.actorId||"",responsavel:command.actorName||"",registradoEm:now}]}:item;
    }),id:current.id,version:versionOf(current)+1,updatedAt:now};
    const receivedMaterialIds=new Set(requested.map(([itemId])=>byItem.get(itemId).materialId));
    const materials=(data?.materiais||[]).map(material=>{
      if(!receivedMaterialIds.has(material.id))return material;
      const item=(current.itens||[]).find(entry=>entry.materialId===material.id&&Number(quantities[entry.id]||0)>0);
      return {...material,precoMedio:Number(item?.precoUnit||material.precoMedio||0)};
    });
    const next={...data,pedidos:(data.pedidos||[]).map(item=>item.id===pedidoId?updated:item),movEstoque:[...(data?.movEstoque||[]),...entries],materiais:materials};
    return {ok:true,data:appendReceipt(next,command,pedidoId,now)};
  }

  return fail("Tipo de comando operacional não suportado.");
};
