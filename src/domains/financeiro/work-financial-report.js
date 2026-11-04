import {selectDRE,selectCashFlow,selectAccountsPayable,selectAccountsReceivable} from './ledger.js';
import {financialEntry,positionEntries} from './workspace.js';
import {reportCategoryLabel} from './report-center.js';
import {safeReportText} from './report-export.js';
import {contar} from '../../design-system/copy.js';

const monthValid=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'');
export const workReportEnd=month=>monthValid(month)?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10):'';
const sign=event=>event.effect.endsWith('_reversal')?-1:1;
const sum=items=>items.reduce((s,item)=>s+item.amountCents,0);
const laborCategories=new Set(['mao_obra','beneficio','beneficios','encargos','rescisao']);
const category=entry=>({beneficio:'beneficios',beneficios:'beneficios',material:'material',compras:'material',equipamentos:'equipamento'})[entry.category]||entry.category||'unclassified';
const label=id=>({unclassified:'Sem categoria',rescisao:'Rescisões',encargos:'Encargos',equipamento:'Equipamentos'})[id]||reportCategoryLabel(id);
export function buildWorkFinancialReport(data,calcPeriod,{obraId,start,end},generatedAt=new Date().toISOString()){
 const work=(data.obras||[]).find(w=>String(w.id)===String(obraId));
 if(!work)return {error:'Selecione uma obra para consultar o relatório completo.'};
 if(!monthValid(start)||!monthValid(end)||start>end)return {error:'Informe competências válidas, com início anterior ou igual ao fim.'};
 const distance=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5))-Number(start.slice(5));
 if(distance>=120)return {error:'Consulte até dez anos por relatório.'};
 const events=new Map(),issues=new Map(),labor=[],months=[];
 for(let m=start;m<=end;){
  const selected=calcPeriod(data,Number(m.slice(0,4)),Number(m.slice(5))-1,obraId).selected;
  for(const event of selected.ledger.events)events.set(event.id,event);
  for(const issue of selected.ledger.issues||[])issues.set(JSON.stringify(issue),issue);
  labor.push({month:m,calculation:selected.moData||null});months.push(m);
  const y=Number(m.slice(0,4)),n=Number(m.slice(5));m=n===12?`${y+1}-01`:`${y}-${String(n+1).padStart(2,'0')}`;
 }
 const ledger={events:[...events.values()],issues:[...issues.values()]},scope={obraId,startDate:start,endDate:end};
 const result=selectDRE(ledger,scope),lastDate=workReportEnd(end);
 const decorate=event=>{
  const entry={...financialEntry(data,event),competence:event.competence||event.date?.slice(0,7)||'',amountCents:event.amountCents*sign(event)};
  const allocation=entry.record?.rateios?.find(r=>String(r.id)===String(event.sourceSubId)&&String(r.obraId)===String(obraId));
  const stageId=allocation?.etapaId||event.metadata?.etapaId||(entry.record?.rateios?.length>1?'':entry.record?.etapaId||entry.record?.orcNivel1Id)||'';
  const stage=(data.orcamentos||[]).filter(b=>b.obraId===obraId).flatMap(b=>b.etapas||[]).find(s=>String(s.id)===String(stageId));
  const calculation=event.sourceType==='ponto'?labor.find(row=>row.month===event.competence)?.calculation:null;
  return {...entry,category:category(entry),stageId,stage:stage?.nome||(stageId?'Etapa não localizada':'Sem etapa identificada'),...(calculation?{record:{competencia:event.competence,obra:work.name,calculation:{'Mão de obra e encargos (R$)':calculation.laborCost,'Benefícios (R$)':calculation.benefitCost,'Encargos identificáveis já incluídos (R$)':calculation.chargesCost??'Indisponíveis'},nota:'Encargos identificados já estão incluídos na mão de obra. Não somar novamente. O histórico arquivado pode estar consolidado sem abertura individual de encargos.'}}:{})};
 };
 const costs=result.events.filter(e=>e.effect.startsWith('cost')).map(decorate),revenues=result.events.filter(e=>e.effect.startsWith('revenue')).map(decorate);
 const cash=selectCashFlow(ledger,{obraId,startDate:`${start}-01`,endDate:lastDate});
 const cashIn=cash.events.filter(e=>e.effect==='cash_in').map(decorate),cashOut=cash.events.filter(e=>e.effect==='cash_out').map(decorate),clientPaid=cash.thirdPartyEvents.map(decorate);
 const payable=positionEntries(data,selectAccountsPayable(ledger,{obraId,asOfDate:lastDate})),receivable=positionEntries(data,selectAccountsReceivable(ledger,{obraId,asOfDate:lastDate}));
 const group=(items,key,getLabel)=>{const groups=new Map();for(const entry of items){const id=key(entry),row=groups.get(id)||{id,label:getLabel(entry),amountCents:0,items:[]};row.amountCents+=entry.amountCents;row.items.push(entry);groups.set(id,row);}return [...groups.values()].sort((a,b)=>b.amountCents-a.amountCents||a.label.localeCompare(b.label,'pt-BR'));};
 const monthly=months.map(month=>{const c=costs.filter(e=>e.competence===month),r=revenues.filter(e=>e.competence===month);return {id:month,label:month,amountCents:sum(c),revenue:sum(r),labor:sum(c.filter(e=>laborCategories.has(e.category))),thirdParty:sum(c.filter(e=>e.category==='terceirizado')),items:c};});
 const detailTotal=sum(costs);if(detailTotal!==result.costCents)throw new Error('O memorial de custos diverge do total do razão.');
 return {work,start,end,lastDate,generatedAt,costs,revenues,cashIn,cashOut,clientPaid,payable,receivable,labor,monthly,
  categories:group(costs,e=>e.category,e=>label(e.category)),stages:group(costs,e=>e.stageId||'unassigned',e=>e.stage),
  summary:{cost:detailTotal,revenue:result.revenueCents,result:result.resultCents,labor:sum(costs.filter(e=>laborCategories.has(e.category))),thirdParty:sum(costs.filter(e=>e.category==='terceirizado')),cashIn:sum(cashIn),cashOut:sum(cashOut),clientPaid:sum(clientPaid),payable:sum(payable),receivable:sum(receivable)},
  issues:ledger.issues.filter(issue=>!issue.obraId||issue.obraId===obraId),unassigned:costs.filter(e=>!e.stageId).length,
  basis:'Custos e receitas por competência; caixa por data efetiva; títulos em aberto acumulados até a data de posição. Base atual do ERP, não snapshot de fechamento. Administração central rateada não incluída.'};
}

export function workFinancialSheets(report){
 const s=report.summary;
 const details=items=>[['Identificador','Competência','Data','Descrição','Categoria','Etapa','Contraparte','Documento','Origem','Valor (R$)'],...items.map(e=>[e.id,e.competence||'',e.date||'',e.description,label(e.category),e.stage||'',e.counterparty||'',e.documentNumber||'',e.sourceType,e.amountCents/100])];
 return {Recorte:[['Obra',report.work.name],['Competência inicial',report.start],['Competência final',report.end],['Posição dos títulos',report.lastDate],['Gerado em',report.generatedAt],['Base',report.basis],['Mão de obra','Equipe própria e encargos reconhecidos, benefícios e rescisões; terceiros separados. Encargos já incorporados não são somados novamente.'],['Qualidade',`${contar(report.issues.length,'alerta','alertas')} do razão; ${contar(report.unassigned,'custo','custos')} sem etapa. Componentes ausentes não foram estimados.`]],
  Resumo:[['Indicador','Valor (R$)'],...Object.entries({Custos:s.cost,'Mão de obra própria e componentes':s.labor,Terceiros:s.thirdParty,Receita:s.revenue,'Resultado gerencial':s.result,Entradas:s.cashIn,Saídas:s.cashOut,'Pagos diretamente pelo cliente':s.clientPaid,'A pagar na posição':s.payable,'A receber na posição':s.receivable}).map(([k,v])=>[k,v/100])],
  Categorias:[['Categoria','Custo (R$)'],...report.categories.map(g=>[g.label,g.amountCents/100])],
  Mensal:[['Competência','Custo (R$)','Mão de obra própria (R$)','Terceiros (R$)','Receita (R$)'],...report.monthly.map(m=>[m.id,m.amountCents/100,m.labor/100,m.thirdParty/100,m.revenue/100])],
  Custos:details(report.costs),Receitas:details(report.revenues),Entradas:details(report.cashIn),Saídas:details(report.cashOut),'Cliente direto':details(report.clientPaid),
  'Em aberto':[['Tipo','Descrição','Vencimento','Saldo (R$)'],...report.payable.map(e=>['A pagar',e.description,e.dueDate||'',e.amountCents/100]),...report.receivable.map(e=>['A receber',e.description,e.dueDate||'',e.amountCents/100])]};
}
export function workFinancialCsv(report){
 const rows=Object.entries(workFinancialSheets(report)).flatMap(([name,rows])=>[[name],...rows,[]]);
 return '\uFEFF'+rows.map(row=>row.map(v=>`"${(typeof v==='number'?String(v).replace('.',','):safeReportText(v)).replaceAll('"','""')}"`).join(';')).join('\r\n');
}
export function workFinancialPrint(report){
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Financeiro por obra</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#0d1b2e}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{padding:6px;text-align:left;border-bottom:1px solid #ddd;overflow-wrap:anywhere}thead{display:table-header-group}h2{break-after:avoid}@media print{button{display:none}}</style></head><body><div class="logo">MARCELL</div><h1>Financeiro · ${escape(report.work.name)}</h1><button onclick="window.print()">Imprimir / salvar PDF</button>${Object.entries(workFinancialSheets(report)).map(([name,rows])=>`<h2>${escape(name)}</h2><table><thead><tr>${rows[0].map(v=>`<th>${escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row=>`<tr>${row.map(v=>`<td>${escape(typeof v==='number'?v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}</body></html>`;
}
