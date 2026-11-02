import {calcObraLaborCost} from './legacy-calculations.js';

const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]||0),0);
const laborCategory=category=>category==='mao_obra'?'laborCents':['beneficio','beneficios'].includes(category)?'benefitCents':'';
export function laborCostsByRole(data,obraId,entries){
 const relevant=entries.filter(entry=>laborCategory(entry.category)),groups=new Map();
 const add=(role,source,key,amount,origin)=>{
  const id=JSON.stringify([role,source]),row=groups.get(id)||{role,source,laborCents:0,benefitCents:0,origins:new Set()};
  row[key]+=amount;if(origin)row.origins.add(origin);groups.set(id,row);
 };
 for(const month of [...new Set(relevant.filter(entry=>entry.sourceType==='ponto').map(entry=>entry.competence))].sort()){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))continue;
  const count=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  const days=Array.from({length:count},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
  const detail=calcObraLaborCost(data,obraId,days,{includeRoles:true});
  const roles=[...(detail.roleCosts||[])].sort((a,b)=>a.role.localeCompare(b.role,'pt-BR'));
  for(const key of ['laborCents','benefitCents']){
   const sources=relevant.filter(entry=>entry.sourceType==='ponto'&&entry.competence===month&&laborCategory(entry.category)===key),target=sum(sources,'amountCents');
   if(!sources.length)continue;
   let cumulative=0,allocated=0;
   for(const role of roles){
    const amount=role[key==='laborCents'?'laborCost':'benefitCost'];
    if(!Number.isFinite(amount))continue;
    cumulative+=amount;const end=Math.round(cumulative*100),cents=end-allocated;allocated=end;
    if(cents)add(role.role,role.source,key,cents,sources.map(source=>source.id).join(', '));
   }
   if(target!==allocated)add('Sem função na origem','Diferença para conferir no razão',key,target-allocated,sources.map(source=>source.id).join(', '));
  }
 }
 for(const entry of relevant.filter(entry=>entry.sourceType!=='ponto'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.competence||'')))add('Sem função na origem','Lançamento sem discriminação por função',laborCategory(entry.category),entry.amountCents,entry.id);
 const rows=[...groups.values()].map(row=>({...row,totalCents:row.laborCents+row.benefitCents,origins:[...row.origins].join(', ')}));
 const totalCents=sum(rows,'totalCents'),expected=sum(relevant,'amountCents');
 return {rows,totalCents,expected,reconciled:totalCents===expected,unclassifiedCents:sum(rows.filter(row=>!['Ponto / cadastro'].includes(row.source)),'totalCents')};
}

function thirdPartyIdentity(data,entry){
 let record=entry.record||{};
 if(entry.settlesSourceType==='medicao_terceiro')record=(data.medicoesTerc||[]).find(item=>item.id===entry.settlesSourceId)||record;
 if(['nota_fiscal','pagamento_nota'].includes(entry.sourceType))record=(data.medicoesTerc||[]).find(item=>record.medicaoTercId&&item.id===record.medicaoTercId||record.id&&item.notaFiscalId===record.id)||record;
 const contract=(data.terceirizados||[]).find(item=>item.id===record.tercId);
 return {id:contract?.id||record.tercId||record.fornecedorId||`${entry.sourceType}:${entry.sourceId}`,name:contract?.name||contract?.razaoSocial||contract?.nome||entry.counterparty||'Prestador não identificado',specialty:contract?.specialty||contract?.especialidade||'Especialidade não informada',contractId:contract?.id||record.tercId||'',linked:Boolean(contract||record.tercId||entry.sourceType==='medicao_terceiro'||entry.settlesSourceType==='medicao_terceiro'),record};
}
export function thirdPartyCosts(data,obraId,entries,payments,payable){
 const groups=new Map();
 const ensure=identity=>{if(!groups.has(identity.id))groups.set(identity.id,{...identity,incurred:0,paid:0,clientPaid:0,payable:0,origins:new Set(),hasCost:false});return groups.get(identity.id);};
 for(const contract of (data.terceirizados||[]).filter(item=>item.obraId===obraId))ensure({id:contract.id,contractId:contract.id,name:contract.name||contract.razaoSocial||contract.nome||'Prestador não identificado',specialty:contract.specialty||contract.especialidade||'Especialidade não informada'});
 for(const entry of entries.filter(entry=>entry.category==='terceirizado')){const row=ensure(thirdPartyIdentity(data,entry));row.incurred+=entry.amountCents;row.hasCost=true;row.origins.add(entry.id);}
 for(const [rows,metric] of [[payments,'paid'],[payable,'payable']])for(const entry of rows){
  const identity=thirdPartyIdentity(data,entry);
  if(entry.category!=='terceirizado'&&!identity.linked)continue;
  const row=ensure(identity);row[metric==='paid'&&entry.direct?'clientPaid':metric]+=entry.amountCents;row.origins.add(entry.id);
 }
 return [...groups.values()].map(row=>({...row,origins:[...row.origins].join(', ')})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}

const shiftMonth=(month,offset)=>{const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+offset);return date.toISOString().slice(0,7);};
const months=(start,end)=>{const result=[];for(let value=start;value<=end;value=shiftMonth(value,1))result.push(value);return result;};
export function workforceCostEvolution(data,obraId,entries,{start,end}){
 const currentMonths=months(start.slice(0,7),end.slice(0,7)),previousEnd=shiftMonth(currentMonths[0],-1),previousStart=shiftMonth(currentMonths[0],-currentMonths.length);
 const previousMonths=months(previousStart,previousEnd),allMonths=[...previousMonths,...currentMonths];
 const roleMonths=[],thirdMonths=[];
 for(const month of allMonths){
  const selected=entries.filter(entry=>entry.competence===month);
  for(const row of laborCostsByRole(data,obraId,selected).rows)roleMonths.push({...row,id:JSON.stringify([row.role,row.source]),month,label:row.role,amountCents:row.totalCents});
  for(const row of thirdPartyCosts(data,obraId,selected,[],[]).filter(row=>row.hasCost))thirdMonths.push({...row,month,label:`${row.name} · ${row.contractId||'Sem vínculo de contrato'}`,amountCents:row.incurred,source:'Custo reconhecido'});
 }
 const date=new Date(`${end}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);
 const completeMonths=date.toISOString().slice(0,7)!==end.slice(0,7);
 const compare=rows=>[...new Set(rows.map(row=>row.id))].map(id=>{
  const group=rows.filter(row=>row.id===id),current=group.filter(row=>currentMonths.includes(row.month)),previous=group.filter(row=>previousMonths.includes(row.month));
  const currentCents=current.length?sum(current,'amountCents'):null,previousCents=previous.length?sum(previous,'amountCents'):null;
  const difference=completeMonths&&currentCents!==null&&previousCents!==null?currentCents-previousCents:null;
  return {id,label:group[0].label,source:group[0].source,currentCents,previousCents,difference,change:difference!==null&&previousCents>0?difference/previousCents:null,origins:[...new Set(group.map(row=>row.origins))].join(', ')};
 }).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
 return {currentStart:currentMonths[0],currentEnd:currentMonths.at(-1),previousStart,previousEnd,monthCount:currentMonths.length,completeMonths,roleMonths:roleMonths.filter(row=>currentMonths.includes(row.month)),thirdMonths:thirdMonths.filter(row=>currentMonths.includes(row.month)),roles:compare(roleMonths),thirdParties:compare(thirdMonths)};
}
