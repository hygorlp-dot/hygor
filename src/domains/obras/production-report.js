import {dailyWorkforce,productionNumber} from '../diario-obra/production.js';

const display=value=>value===null||!Number.isFinite(value)?'Não informado':value.toLocaleString('pt-BR',{maximumFractionDigits:4});
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Não informado';
// Shared factual reading for the closed diary and its printable report.
// Legacy diaries never acquire presumed hours from a later consultation.
export function dailyProductionReportLines(data,report,service){
  const quantity=productionNumber(service.quantidadeDia),unit=service.unidade||'';
  const lines=[`Produção do dia: ${display(quantity)}${quantity!==null&&unit?` ${unit}`:''}`,`Unidade registrada: ${unit||'Não informado'}`,`Item do orçamento: ${service.budgetItemId||'Não informado'} · orçamento: ${service.budgetId||'Não informado'}`,`Progresso acumulado: ${display(productionNumber(service.progressoAte))}%`];
  const roster=dailyWorkforce(data,report.obraId,report.data),team=[...new Set(service.equipe||[])];
  for(const id of team){
    const employee=(data.employees||[]).find(row=>row.id===id),person=roster.find(row=>row.employeeId===id);
    const explicit=productionNumber(service.horasPorPessoa?.[id]);
    const single=(report.servicos||[]).filter(row=>(row.equipe||[]).includes(id)).length===1;
    const duplicate=(data.rdos||[]).some(row=>row.id!==report.id&&row.obraId===report.obraId&&row.data===report.data&&row.status!=='cancelado');
    const fromPoint=report.productionVersion===1&&single&&!duplicate&&person?.hours!=null;
    const hours=explicit!==null?explicit:fromPoint?person.hours:null;
    const origin=explicit!==null?'apropriação registrada':fromPoint?`ponto consultado de ${day(report.data)} · atividade única`:'origem de horas não informada';
    lines.push(`Equipe: ${employee?.name||employee?.nome||id} · ${display(hours)}${hours!==null?' Hh':''} · ${origin}`);
  }
  for(const id of [...new Set(service.tercIds||[])]){
    const third=(data.terceirizados||[]).find(row=>row.id===id);
    lines.push(`Terceiro: ${third?.name||third?.nome||id} · horas: Não informado`);
  }
  if(!team.length&&!service.tercIds?.length)lines.push('Equipe executora: Não informado');
  return lines;
}
