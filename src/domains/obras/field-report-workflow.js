const FIELD_REPORT_CLIMATE_PERIODS=["manha","tarde","noite"];

const fieldReportCompletionChecks=report=>[
  {id:"contexto",label:"Obra e data",complete:Boolean(String(report?.obraId||"").trim()&&/^\d{4}-\d{2}-\d{2}$/.test(String(report?.data||"")))},
  {id:"relato",label:"Relato do dia",complete:Boolean(String(report?.descricao||report?.transcricaoVoz||"").trim())},
  {id:"clima",label:"Clima confirmado",complete:FIELD_REPORT_CLIMATE_PERIODS.every(period=>Boolean(String(report?.clima?.[period]||"").trim()))},
  {id:"execucao",label:"Serviço executado",complete:Boolean((report?.servicos||[]).some(service=>Number(service?.progressoAte||0)>0||String(service?.obs||"").trim()))},
  {id:"revisao",label:"Revisão técnica",complete:Boolean(report?.revisaoEngenheiro?.aprovado)},
];

export const fieldReportCompletion=report=>{
  const checks=fieldReportCompletionChecks(report),pending=checks.filter(check=>!check.complete);
  return {checks,pending,complete:pending.length===0};
};

export const fieldReportIsReadOnly=report=>["concluido","cancelado"].includes(String(report?.status||""));
