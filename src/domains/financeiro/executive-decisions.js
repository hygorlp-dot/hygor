import {contar} from '../../design-system/copy.js';
// Presentation of existing findings only: never changes financial calculations.
export function executiveDecisions(report){
 const items=[];
 const add=(row,area,message,action,{date='',source=''}={})=>items.push({obraId:row.work.id,work:row.work.name,area,message,action,date,source});
 for(const row of report.rows){
  const cashMessages=new Set([`${contar(row.forecast.overdue.length,'título vencido separado','títulos vencidos separados')} do caixa futuro.`,`${contar(row.forecast.undated.length,'título','títulos')} sem vencimento válido fora do caixa previsto.`]);
  for(const message of row.warnings){
   if(cashMessages.has(message))continue;
   const labor=message==='Previsão de mão de obra com pendências de origem ou cobertura parcial.';
   add(row,labor?'Equipe e produção':'Custos da obra',message,labor?'Em Diário de obra e Ponto, confira levantamento, revisão e horários. Depois consulte Previsão de mão de obra.':'Em Financeiro → Custos por etapa, confira orçamento, apropriação e revisão da estimativa.');
  }
  for(const [records,message,action] of [
   [row.forecast.undated,'Título sem vencimento válido; fora do caixa previsto.','Em Financeiro, localize o título na memória de títulos e confira o vencimento no documento de origem.'],
   [row.forecast.overdue,'Título vencido separado do caixa futuro.','Em Financeiro, confira o saldo e a situação do título no documento de origem; não presuma pagamento.'],
  ])for(const entry of records)add(row,'Títulos e caixa',`${message} ${entry.description||''}`,action,{date:entry.dueDate||'',source:`${entry.sourceType||'Título'}:${entry.sourceId||entry.id||'Origem não informada'}`});
  for(const message of row.laborSource.issues)add(row,'Equipe e produção',message,'Em Diário de obra e Ponto, confira os registros do período e a revisão do engenheiro.');
  for(const issue of row.labor?.issues||[])add(row,'Equipe e produção',issue.message,'Em Previsão de mão de obra, confira a premissa indicada e os registros do diário, ponto e RH.',{date:issue.date||'',source:issue.source||''});
  for(const issue of row.schedule?.issues||[])add(row,'Prazo da obra',issue.message,'Em Planejamento, confira as datas e a atividade. Em Diário de obra, confira o avanço acumulado e a revisão técnica.',{date:issue.date||'',source:issue.source||''});
  for(const issue of row.performance.issues||[])add(row,'Equipe e produção',issue.message,'Em Diário de obra, Ponto ou Planejamento, localize a data e o registro indicados e confira a evidência.',{date:issue.date||'',source:issue.source||''});
 }
 for(const issue of report.issues)if(!report.rows.some(row=>row.work.id===issue.obraId&&row.warnings.includes(issue.message))){
  const row=report.rows.find(row=>row.work.id===issue.obraId);
  // Unscoped ledger findings keep their original label; no guessed work/link.
  add(row||{work:{id:issue.obraId||'',name:issue.work}},'Base financeira',issue.message,'Em Financeiro, confira o documento e a memória do razão no recorte informado.');
 }
 return items.filter((item,index)=>items.findIndex(other=>JSON.stringify(other)===JSON.stringify(item))===index);
}
