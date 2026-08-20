import { validDate } from "./date-validation.js";

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
  if(!advanceId||totalCents<=0||!Number.isInteger(count)||count<1||count>24||!validDate(firstDueDate)){
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

export const advanceInstallmentsForPeriod=(advance,startDate,endDate)=>{
  if(!active(advance)||!startDate||!endDate)return [];
  if(Array.isArray(advance?.installments)&&advance.installments.length){
    return advance.installments.filter(item=>
      active(item)&&validDate(item.dueDate)&&item.dueDate>=startDate&&item.dueDate<=endDate);
  }
  return validDate(advance?.date)&&advance.date>=startDate&&advance.date<=endDate
    ?[{id:`${advance.id}:legado`,number:1,dueDate:advance.date,amount:Number(advance.amount||0),status:"programada"}]
    :[];
};

export const advanceDeductionForPeriod=(advance,startDate,endDate)=>
  advanceInstallmentsForPeriod(advance,startDate,endDate)
    .reduce((sum,item)=>sum+Number(item.amount||0),0);

export const advanceCommandObraId=(data={},command={})=>{
  const employeeId=command.type===ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED
    ?command.payload?.advance?.empId
    :(data.advances||[]).find(item=>String(item.id)===String(command.payload?.advanceId))?.empId;
  return String((data.employees||[]).find(item=>String(item.id)===String(employeeId))?.obra||"");
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
    const amount=Number(raw.amount||0),installmentCount=Number(raw.installmentCount||1);
    const date=String(raw.date||""),firstDueDate=String(raw.firstDueDate||date);
    const frequency=["quinzenal","mensal"].includes(raw.frequency)?raw.frequency:"quinzenal";
    if(!(amount>0))return fail("Informe um valor positivo para o adiantamento.");
    if(!validDate(date)||!validDate(firstDueDate))return fail("Informe as datas do adiantamento e do primeiro desconto.");
    if(!Number.isInteger(installmentCount)||installmentCount<1||installmentCount>24){
      return fail("O parcelamento deve ter entre 1 e 24 parcelas.");
    }
    const installments=buildAdvanceInstallments({
      advanceId:id,amount,installmentCount,firstDueDate,frequency,
    });
    if(!installments.length)return fail("Não foi possível gerar as parcelas do adiantamento.");
    const record={
      ...raw,id,empId,date,firstDueDate,amount,installmentCount,frequency,installments,
      description:String(raw.description||"Adiantamento").trim()||"Adiantamento",
      status:"ativo",version:1,createdAt:now,createdById:String(command.actorId||""),
      createdBy:String(command.actorName||""),
    };
    return {ok:true,entityId:id,data:{...data,advances:[...advances,record]}};
  }
  const id=String(command.payload?.advanceId||"");
  const current=advances.find(item=>String(item.id)===id);
  if(!current)return fail("Adiantamento não encontrado.");
  if(versionOf(current)!==Number(command.expectedVersion||0))return fail("O adiantamento foi alterado por outra pessoa. Atualize a tela.");
  if(!active(current))return fail("O adiantamento já está cancelado.");
  const reason=String(command.payload?.reason||"").trim();
  if(!reason)return fail("Informe o motivo do cancelamento do adiantamento.");
  const cancelled={
    ...current,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,
    canceladoPorId:String(command.actorId||""),canceladoPor:String(command.actorName||""),
    version:versionOf(current)+1,
  };
  return {
    ok:true,entityId:id,
    data:{...data,advances:advances.map(item=>String(item.id)===id?cancelled:item)},
  };
};
