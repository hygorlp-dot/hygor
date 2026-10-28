import {createMonthlyClosingSnapshot} from "../src/domains/financeiro/workflows.js";

const iso=value=>String(value||"").slice(0,10);

export const monthlyClosingPeriodFromCommand=command=>{
  const payload=command?.payload||{};
  const startsOn=iso(payload.startsOn);
  const endsOn=iso(payload.endsOn);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)){
    return{ok:false,error:"Informe início e fim válidos para a competência."};
  }
  const competencia=startsOn.slice(0,7);
  if(startsOn!==`${competencia}-01`){
    return{ok:false,error:"O fechamento contábil deve começar no primeiro dia da competência."};
  }
  const [year,month]=competencia.split("-").map(Number);
  const expectedEnd=new Date(year,month,0).toISOString().slice(0,10);
  if(endsOn!==expectedEnd){
    return{ok:false,error:"O fechamento contábil deve terminar no último dia da competência."};
  }
  return{ok:true,competencia,startsOn,endsOn};
};

export const prepareMonthlyFinancialClosing=({
  data={},
  command={},
  actor={},
  supplementalEvents=[],
  now=new Date().toISOString(),
}={})=>{
  if(command?.type!=="CLOSE_ACCOUNTING_PERIOD")return null;
  const period=monthlyClosingPeriodFromCommand(command);
  if(!period.ok)return period;

  const existing=(data?.fechamentosFinanceiros||[])
    .find(item=>String(item?.competencia||"")===period.competencia&&item?.status==="fechado");
  if(existing){
    if(String(existing.idempotencyKey||"")===String(command.idempotencyKey||"")){
      return{ok:true,idempotent:true,period,closing:existing,data};
    }
    return{ok:false,error:"A competência já possui fechamento auditável registrado.",period};
  }

  const prepared=createMonthlyClosingSnapshot(data,{
    competencia:period.competencia,
    actor,
    closedAt:now,
    supplementalEvents,
  });
  if(!prepared.ok)return{...prepared,period};

  const closing={
    ...prepared.closing,
    idempotencyKey:String(command.idempotencyKey||""),
    canonicalCommand:"CLOSE_ACCOUNTING_PERIOD",
  };
  return{
    ok:true,
    idempotent:false,
    period,
    closing,
    data:{
      ...data,
      fechamentosFinanceiros:[...(data?.fechamentosFinanceiros||[]),closing],
    },
  };
};
