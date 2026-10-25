import { validDate } from "./date-validation.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { active as activeFinancialRecord } from "../financeiro/ledger.js";
import { latestClosedPayrollDate } from "./attendance-pay-mode.js";
import {paidAdvanceDeductions, advancePaymentStatus, advanceClaimedInPayroll} from './advance-settlements.js';

export const ADVANCE_COMMAND = Object.freeze({
  PAYROLL_ADVANCE_CREATED:"ADIANTAMENTO_FOLHA_CRIADO",
  PAYROLL_ADVANCE_CANCELLED:"ADIANTAMENTO_FOLHA_CANCELADO",
});

export const ADVANCE_COMMAND_TYPES = new Set(Object.values(ADVANCE_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
export const isAdvanceActive=item=>!["cancelado","cancelada","estornado","estornada"].includes(
  String(item?.status||"").toLowerCase(),
);
const active=isAdvanceActive;
const isoDate=date=>date.toISOString().slice(0,10);
const parseDate=value=>{
  const [year,month,day]=String(value||"").split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day));
};
const addMonthsClamped=(value,months)=>{
  const source=parseDate(value);
  const targetMonth=source.getUTCMonth()+months;
  const lastDay=new Date(Date.UTC(source.getUTCFullYear(),targetMonth+1,0)).getUTCDate();
  return isoDate(new Date(Date.UTC(
    source.getUTCFullYear(),targetMonth,Math.min(source.getUTCDate(),lastDay),
  )));
};
const nextFortnightDate=value=>{
  const date=parseDate(value),day=date.getUTCDate();
  if(day<=5)return isoDate(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),20)));
  if(day<=20)return isoDate(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,5)));
  return isoDate(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,20)));
};

export const buildAdvanceInstallments=({
  advanceId,amount,installmentCount=1,firstDueDate,frequency="quinzenal",
}={})=>{
  const totalCents=Math.round(Number(amount||0)*100);
  const count=Number(installmentCount||1);
  if(!advanceId||!Number.isFinite(totalCents)||totalCents<=0||!Number.isInteger(count)||count<1||count>24||!validDate(firstDueDate)){
    return [];
  }
  const base=Math.floor(totalCents/count),remainder=totalCents-base*count;
  const rows=[];
  let dueDate=firstDueDate;
  for(let index=0;index<count;index+=1){
    const cents=base+(index===count-1?remainder:0);
    rows.push({
      id:`${advanceId}:parcela:${index+1}`,
      number:index+1,dueDate,amount:cents/100,status:"programada",
    });
    dueDate=frequency==="mensal"
      ?addMonthsClamped(dueDate,1)
      :nextFortnightDate(dueDate);
  }
  return rows;
};

const advanceInstallmentsForPeriod=(advance,startDate,endDate)=>{
  if(!active(advance)||!startDate||!endDate)return [];
  if(Array.isArray(advance?.installments)&&advance.installments.length){
    return advance.installments.filter(item=>
      active(item)&&validDate(item.dueDate)&&item.dueDate>=startDate&&item.dueDate<=endDate);
  }
  return validDate(advance?.date)&&advance.date>=startDate&&advance.date<=endDate
    ?[{id:`${advance.id}:legado`,number:1,dueDate:advance.date,amount:Number(advance.amount||0),status:"programada"}]
    :[];
};

export const advanceDeductionForPeriod=(advance,startDate,endDate,data)=> {
  const rows=advance?.paymentTitleId
    ?paidAdvanceDeductions(advance,data).filter(item=>item.date>=startDate&&item.date<=endDate)
    :advanceInstallmentsForPeriod(advance,startDate,endDate);
  return rows.reduce((sum,item)=>sum+Math.round(Number(item.amount||0)*100),0)/100;
};

// Both issue date and every active deduction date are protected. Cancelling
// an entire advance also cancels its past instalments, not just the future ones.
const advanceDates=advance=>[advance.date,...(advance.installments||[]).filter(active).map(i=>i.dueDate)].filter(validDate);
const advanceProtectionIssue=(data,advance)=>{
  const employee=(data.employees||[]).find(e=>String(e.id)===String(advance.empId));
  const titles=(data.titulosFolha||[]).filter(activeFinancialRecord);
  if(advanceClaimedInPayroll(data,advance))return 'O adiantamento já está compensado ou reservado em um título de folha ou demonstrativo. Registre um ajuste identificado, preservando o fechamento.';
  if((advance.installments||[]).some(i=>['compensada','compensado','descontada','descontado','liquidada','liquidado','quitada','quitado'].includes(String(i.status||'').toLowerCase())))return 'O adiantamento possui parcela já compensada; preserve o histórico e registre um ajuste identificado.';
  const dates=advanceDates(advance);
  if(dates.some(date=>isDateInClosedPeriod(data,date)))return 'A emissão ou parcela do adiantamento pertence a período financeiro fechado. Registre um ajuste identificado.';
  const protectedUntil=employee?latestClosedPayrollDate(data,employee):'';
  if(protectedUntil&&dates.some(date=>date<=protectedUntil))return 'O adiantamento participa de folha já fechada ou arquivada. Registre um ajuste identificado, sem reabrir descontos antigos.';
  // Old titles can contain only an aggregate deduction without source IDs or
  // dates. Do not assume that this advance was never included in that amount.
  if(titles.some(t=>String(t.employeeId)===String(advance.empId)&&Number(t.adiantamentos)>0
    &&!validDate(t.periodoFim)&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.competencia||'')))return 'Há desconto de adiantamento em folha legada sem origem identificada. Confira o vínculo antes de alterar o adiantamento.';
  return '';
};

export const advanceCommandObraId=(data={},command={})=>{
  const current=command.type===ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED?null
    :(data.advances||[]).find(item=>String(item.id)===String(command.payload?.advanceId));
  if(current?.obraId!=null)return String(current.obraId);
  const employeeId=current?.empId||command.payload?.advance?.empId;
  return String((data.employees||[]).find(item=>String(item.id)===String(employeeId))?.obra||'');
};

export const applyAdvanceCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!ADVANCE_COMMAND_TYPES.has(command.type))return null;
  const advances=Array.isArray(data.advances)?data.advances:[];
  if(command.type===ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED){
    const raw=command.payload?.advance||{};
    const id=String(raw.id||"").trim(),empId=String(raw.empId||"").trim();
    if(!id||advances.some(item=>String(item.id)===id))return fail("O adiantamento já existe ou não possui identificação.");
    const employee=(data.employees||[]).find(item=>String(item.id)===empId&&item.active!==false);
    if(!employee)return fail("Selecione um funcionário ativo, de campo ou administrativo.");
    const amount=Math.round(Number(raw.amount||0)*100)/100,installmentCount=Number(raw.installmentCount||1);
    const date=String(raw.date||""),firstDueDate=String(raw.firstDueDate||date);
    const frequency=["quinzenal","mensal"].includes(raw.frequency)?raw.frequency:"quinzenal";
    if(!Number.isFinite(amount)||!(amount>0))return fail("Informe um valor positivo para o adiantamento.");
    if(!validDate(date)||!validDate(firstDueDate))return fail("Informe as datas do adiantamento e do primeiro desconto.");
    if(!Number.isInteger(installmentCount)||installmentCount<1||installmentCount>24){
      return fail("O parcelamento deve ter entre 1 e 24 parcelas.");
    }
    const installments=buildAdvanceInstallments({
      advanceId:id,amount,installmentCount,firstDueDate,frequency,
    });
    if(!installments.length)return fail("Não foi possível gerar as parcelas do adiantamento.");
    const protection=advanceProtectionIssue(data,{id,empId,date,installments});
    if(protection)return fail(protection);
    if(firstDueDate<date)return fail("A data do primeiro desconto deve ser igual ou posterior à solicitação.");
    const paymentTitleId=`advance:${empId}:${id}`;
    if((data.titulosFolha||[]).some(title=>String(title.id)===paymentTitleId))return fail("Já existe uma obrigação financeira para este adiantamento.");
    const record={
      ...raw,id,empId,date,firstDueDate,amount,installmentCount,frequency,installments,paymentTitleId,obraId:String(employee.obra||""),
      description:String(raw.description||"Adiantamento").trim()||"Adiantamento",
      status:"ativo",version:1,createdAt:now,createdById:String(command.actorId||""),
      createdBy:String(command.actorName||""),
    };
    const title={id:paymentTitleId,employeeId:empId,funcionarioNome:employee.name||employee.nome||empId,
      competencia:date.slice(0,7),periodoInicio:date,periodoFim:date,vencimento:date,
      bruto:amount,descontos:0,adiantamentos:0,liquido:amount,valorPago:0,saldo:amount,
      status:"em_aberto",liquidacoes:[],rateiosPorObra:[{obraId:record.obraId,valor:amount}],
      snapshotCalculo:{kind:"advance",advanceId:id,description:record.description,installments},
      criadoEm:now,criadoPorId:record.createdById,criadoPor:record.createdBy,version:1};
    return {ok:true,entityId:id,data:{...data,advances:[...advances,record],titulosFolha:[...(data.titulosFolha||[]),title]}};
  }
  const id=String(command.payload?.advanceId||"");
  const current=advances.find(item=>String(item.id)===id);
  if(!current)return fail("Adiantamento não encontrado.");
  if(versionOf(current)!==Number(command.expectedVersion||0))return fail("O adiantamento foi alterado por outra pessoa. Atualize a tela.");
  if(!active(current))return fail("O adiantamento já está cancelado.");
  const reason=String(command.payload?.reason||"").trim();
  if(!reason)return fail("Informe o motivo do cancelamento do adiantamento.");
  const protection=advanceProtectionIssue(data,current);
  if(protection)return fail(protection);
  if(advancePaymentStatus(current,data).paid>0)return fail("O adiantamento já possui pagamento. Reverta a liquidação identificada antes de cancelar a solicitação.");
  const cancelled={
    ...current,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,
    canceladoPorId:String(command.actorId||""),canceladoPor:String(command.actorName||""),
    version:versionOf(current)+1,
  };
  return {
    ok:true,entityId:id,
    data:{...data,advances:advances.map(item=>String(item.id)===id?cancelled:item),
      ...(current.paymentTitleId?{titulosFolha:(data.titulosFolha||[]).map(title=>String(title.id)===String(current.paymentTitleId)
        ?{...title,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,canceladoPorId:cancelled.canceladoPorId,version:versionOf(title)+1}:title)}:{})},
  };
};
