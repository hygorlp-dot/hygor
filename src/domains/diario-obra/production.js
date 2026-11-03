import {getAtt,isEmployeeEmployedOnDate} from '../ponto/attendance-engine.js';
import {resolveEmployeeAttendanceObraId} from '../ponto/permissions.js';
import {calculateTimekeeping} from '../ponto/timekeeping.js';
import {getActiveBudgetBaseline} from '../orcamentos/calculations.js';

export const productionNumber=value=>value==null||String(value).trim()===''?null:Number(value);
export const productionUnit=value=>String(value||'').trim().normalize('NFC').toLocaleUpperCase('pt-BR');
export const productionRole=value=>String(value||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR');
export const productionSignature=services=>JSON.stringify((services||[]).map(service=>({
  task:service.tarefaId||'',stage:service.etapaId||'',budget:service.budgetId||'',item:service.budgetItemId||'',unit:productionUnit(service.unidade),budgetQuantity:productionNumber(service.budgetQuantity),quantity:productionNumber(service.quantidadeDia),progress:productionNumber(service.progressoAte)||0,obs:service.obs||'',
  team:[...new Set(service.equipe||[])].sort(),thirdParties:[...new Set(service.tercIds||[])].sort(),hours:Object.fromEntries(Object.entries(service.horasPorPessoa||{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,value])=>[id,productionNumber(value)])),
})).sort((a,b)=>a.task.localeCompare(b.task)));
export function dailyWorkforce(data,obraId,date){
  return (data.employees||[]).flatMap(employee=>{
    const record=getAtt(data,employee.id,date);
    if(!isEmployeeEmployedOnDate(employee,date)||resolveEmployeeAttendanceObraId({data,employee,date,record})!==String(obraId))return [];
    if(!record&&employee.active===false)return [];
    const clocks=calculateTimekeeping(record||{}),pending=record?.confirmed===false||record?.pending===true||record?.pendingSync===true||['pending','pendente','aguardando','incomplete','conflict'].includes(record?.syncStatus||record?.reviewStatus),worked=!pending&&['P','M'].includes(record?.status);
    return [{employeeId:employee.id,name:employee.name||employee.nome||employee.id,role:productionRole(record?.role||employee.role),status:pending?'':record?.status||'',hours:worked&&clocks.valid&&!clocks.empty?clocks.workedMinutes/60:null,workdayHours:productionNumber(employee.workdayHours??data.config?.payrollWorkdayHours),record}];
  });
}
export function productionBudget(data,obraId){const budget=getActiveBudgetBaseline(data,obraId,'controle')?.budget;return budget?.obraId===obraId?budget:null;}
export function serviceBudgetItem(service,budget){return (budget?.itens||[]).find(item=>item.id===service.budgetItemId&&item.tipo!=='titulo');}
export function suggestedBudgetItem(task,budget){
  const candidates=(budget?.itens||[]).filter(item=>item.tipo!=='titulo'&&item.etapaId===task?.etapaId);
  return candidates.length===1?candidates[0]:null;
}
// A whole shift belongs to a service only when it is the person's sole service.
// Explicit splits are checked across the entire day, never repeated per activity.
export function serviceAttendance(data,report,service){
  const roster=dailyWorkforce(data,report.obraId,report.data),issues=[];
  const allocations=[...new Set(service.equipe||[])].map(id=>{
    const person=roster.find(row=>row.employeeId===id);
    const assignments=(report.servicos||[]).filter(row=>(row.equipe||[]).includes(id));
    const explicit=productionNumber(service.horasPorPessoa?.[id]);
    const hours=explicit??(assignments.length===1?person?.hours:null);
    if(!person?.role)issues.push(`Função no ponto ou cadastro pendente para ${person?.name||id}.`);
    if(!person||!['P','M'].includes(person.status)||person.hours===null)issues.push(`Ponto com horários completos pendente para ${person?.name||id}.`);
    if(assignments.length>1&&explicit===null)issues.push(`Divida as horas de ${person?.name||id} entre as atividades do dia.`);
    const used=assignments.reduce((total,row)=>total+(productionNumber(row.horasPorPessoa?.[id])||0),0);
    if(hours!==null&&(!Number.isFinite(hours)||hours<0||hours>24||person?.hours!=null&&used>person.hours+0.00001))issues.push(`Horas distribuídas excedem o ponto de ${person?.name||id}.`);
    return {employeeId:id,role:person?.role||'',pointSource:person?.record?`${id}@${report.data}:${JSON.stringify({status:person.status,role:person.role,entrada:person.record.entrada,intervaloSaida:person.record.intervaloSaida,intervaloRetorno:person.record.intervaloRetorno,saida:person.record.saida})}`:'',hours:person?.hours!=null&&hours!=null&&Number.isFinite(hours)&&hours>=0?hours:null};
  });
  if(!allocations.length)issues.push('Equipe própria não vinculada ao serviço.');
  if(service.tercIds?.length)issues.push('Serviço com terceiros: horas da equipe completa ainda não apropriadas.');
  return {allocations,issues:[...new Set(issues)],complete:!issues.length};
}
export function validateProduction(data,report,{onlyTaskId}={}){
  if(report.productionVersion!==1)return [];
  const errors=[],budget=productionBudget(data,report.obraId),seen=new Set();
  for(const service of report.servicos||[]){
    if(onlyTaskId&&service.tarefaId!==onlyTaskId)continue;
    if(seen.has(service.tarefaId))errors.push('Atividade repetida no diário.');seen.add(service.tarefaId);
    if(service.budgetItemId&&(report.servicos||[]).some(other=>other!==service&&other.budgetItemId===service.budgetItemId))errors.push('Registre cada item do orçamento uma única vez no diário do dia.');
    const item=serviceBudgetItem(service,budget),quantity=productionNumber(service.quantidadeDia);
    if(!item||service.budgetId!==budget?.id)errors.push('Vincule cada atividade ao item do orçamento de controle atual.');
    if(quantity===null||!Number.isFinite(quantity)||quantity<0)errors.push('Informe a quantidade executada no dia, inclusive zero quando não houve produção.');
    if(item&&(productionUnit(service.unidade)!==productionUnit(item.unidade)||Number(service.budgetQuantity)!==Number(item.quantidade)))errors.push('Quantidade de referência ou unidade do orçamento mudou; atualize o vínculo da atividade.');
    for(const [id,value] of Object.entries(service.horasPorPessoa||{})){
      const hours=productionNumber(value);
      if(!(service.equipe||[]).includes(id)||hours!==null&&(!Number.isFinite(hours)||hours<0||hours>24))errors.push('Distribuição de horas inválida.');
    }
    const attendance=serviceAttendance(data,report,service);
    errors.push(...attendance.issues.filter(issue=>issue.startsWith('Horas distribuídas')||issue.startsWith('Divida as horas')));
  }
  return [...new Set(errors)];
}

export function productionHistory(data,obraId,asOf,budget=productionBudget(data,obraId)){
  const logs=(data.rdos||[]).filter(log=>log.obraId===obraId&&log.data<=asOf&&log.status!=='cancelado');
  const duplicates=new Set(logs.filter(log=>logs.some(other=>other!==log&&other.data===log.data)).map(log=>log.data));
  const accepted=logs.filter(log=>!duplicates.has(log.data)&&log.status==='concluido'&&log.revisaoEngenheiro?.aprovado).sort((a,b)=>a.data.localeCompare(b.data));
  const pending=logs.filter(log=>!accepted.includes(log)).map(log=>({id:log.id,date:log.data,reason:duplicates.has(log.data)?'Diários duplicados nesta data.':'Diário aguarda conclusão e revisão técnica.'}));
  const services=(budget?.itens||[]).filter(item=>item.tipo!=='titulo').map(item=>{
    const records=accepted.flatMap(log=>(log.servicos||[]).filter(service=>service.budgetItemId===item.id).map(service=>({log,service})));
    let cumulative=null;const samples=[],issues=[];
    for(const {log,service} of records){
      if(records.filter(record=>record.log.data===log.data).length>1){cumulative=null;issues.push(`${log.data}: item repetido no diário; revise a produção.`);continue;}
      if(service.budgetId!==budget.id||productionUnit(service.unidade)!==productionUnit(item.unidade)||Number(service.budgetQuantity)!==Number(item.quantidade)){cumulative=null;issues.push('Orçamento ou unidade de origem alterados; reconfira o levantamento no diário.');continue;}
      const progress=productionNumber(service.progressoAte);
      if(progress!==null&&progress>=0&&progress<=100)cumulative=Number(item.quantidade)*progress/100;
      const quantity=productionNumber(service.quantidadeDia),attendance=serviceAttendance(data,log,service);
      if(quantity===null||quantity<0||!Number.isFinite(quantity)){issues.push(`${log.data}: produção diária não registrada.`);continue;}
      if(!attendance.complete){issues.push(...attendance.issues.map(issue=>`${log.data}: ${issue}`));continue;}
      samples.push({reportId:log.id,date:log.data,quantity,allocations:attendance.allocations});
    }
    const functions=[...new Set(samples.flatMap(sample=>sample.allocations.filter(row=>row.hours>0).map(row=>row.role)).filter(Boolean))];
    const quantity=samples.reduce((total,sample)=>total+sample.quantity,0);
    return {item,records:records.map(({log})=>({id:log.id,date:log.data,version:log.version||0})),remaining:cumulative===null||!Number.isFinite(Number(item.quantidade))?null:Math.max(0,Number(item.quantidade)-cumulative),samples,quantity,functions,issues:[...new Set(issues)],rows:functions.map(role=>{
      const roleSamples=samples.filter(sample=>sample.allocations.some(row=>row.role===role&&row.hours>0));
      return {role,hours:roleSamples.reduce((total,sample)=>total+sample.allocations.filter(row=>row.role===role).reduce((sum,row)=>sum+row.hours,0),0),quantity:roleSamples.reduce((total,sample)=>total+sample.quantity,0)};
    })};
  });
  return {services,pending};
}
