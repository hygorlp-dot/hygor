const FIELD_REPORT_CLIMATE_PERIODS=["manha","tarde"];

const dailyProductionComplete=report=>report?.productionVersion!==1||(report.servicos||[]).length>0&&(report.servicos||[]).every(service=>service.budgetId&&service.budgetItemId&&service.unidade&&service.quantidadeDia!==''&&service.quantidadeDia!=null&&Number.isFinite(Number(service.quantidadeDia))&&Number(service.quantidadeDia)>=0);
const fieldReportCompletionChecks=report=>[
  {id:"contexto",label:"Obra e data",complete:Boolean(String(report?.obraId||"").trim()&&/^\d{4}-\d{2}-\d{2}$/.test(String(report?.data||"")))},
  {id:"relato",label:"Relato do dia",complete:Boolean(String(report?.descricao||report?.transcricaoVoz||"").trim())},
  {id:"clima",label:"Clima confirmado",complete:FIELD_REPORT_CLIMATE_PERIODS.every(period=>Boolean(String(report?.clima?.[period]||"").trim()))},
  {id:"execucao",label:"Serviço executado",complete:dailyProductionComplete(report)&&Boolean((report?.servicos||[]).some(service=>Number(service?.progressoAte||0)>0||String(service?.obs||"").trim()))},
  {id:"revisao",label:"Revisão técnica",complete:Boolean(report?.revisaoEngenheiro?.aprovado)},
];

export const fieldReportCompletion=report=>{
  const checks=fieldReportCompletionChecks(report),pending=checks.filter(check=>!check.complete);
  return {checks,pending,complete:pending.length===0};
};

export const fieldReportIsReadOnly=report=>["concluido","cancelado"].includes(String(report?.status||""));

export const OPEN_FIELD_REPORT_DAY = 'open-field-report-day';

export function fieldReportDayTarget(intent, works, workId) {
  if (intent?.tabId !== 'rdo' || intent.action !== OPEN_FIELD_REPORT_DAY || !intent.linked) return null;
  const id = String(intent.scope?.obraId || '');
  const date = String(intent.record?.date || '');
  if (!id || (workId && String(workId) !== id) || !works.some(work => String(work.id) === id)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return { obraId:id, date, reportId:String(intent.record?.reportId || '') };
}

export function findFieldReportForDay(reports, obraId, date, reportId) {
  const sameDay = report => report.obraId === obraId && report.data === date;
  return (reportId && reports.find(report => report.id === reportId && sameDay(report))) || reports.find(sameDay);
}
