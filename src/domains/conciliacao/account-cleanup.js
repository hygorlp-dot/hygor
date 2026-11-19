import {desfazerConciliacao} from './mutations.js';
import {isDateInClosedPeriod,isCompetenceInClosedPeriod} from '../financeiro/workflows.js';
import {classifyReceiptForDre} from '../dre/receipt-classification.js';
import {activeCashAllocations,reconciliationHold} from './cash-allocations.js';

export const UNASSIGNED_BANK_SCOPE='unassigned';
const generatedSections=new Set(['outrasDesp','despesasEmpresa','payments','caixaObra','pagsTerceiros','pagamentosFolha']);
const amount=row=>Math.abs(Number(row.valor??row.amount??0));
const belongs=(row,scope)=>scope===UNASSIGNED_BANK_SCOPE?!row.contaBancariaId:String(row.contaBancariaId)===scope;

// Deliberately restricted to the local simulation. Production has no handler
// for this operation. The original capture and an external backup survive.
export function previewBankAccountCleanup(data,scope){
  const account=(data.contasBancarias||[]).find(row=>String(row.id)===scope);
  const label=scope===UNASSIGNED_BANK_SCOPE?'Movimentos sem conta':account?.nome;
  const blockers=[],transactions=(data.transacoes||[]).filter(row=>belongs(row,scope));
  const ids=new Set(transactions.map(row=>String(row.id)));
  const statements=(data.extratos||[]).filter(row=>belongs(row,scope));
  const statementIds=new Set(statements.map(row=>String(row.id))),generated=[],generatedIds=new Set();
  if(ids.size!==transactions.length||transactions.some(row=>!row.id)||statementIds.size!==statements.length||statements.some(row=>!row.id))blockers.push('Há identidade ausente ou repetida nos movimentos ou extratos.');
  if(!label)blockers.push('Conta indisponível nesta empresa.');
  if(scope===UNASSIGNED_BANK_SCOPE&&account)blockers.push('O cadastro usa um identificador reservado ao grupo sem conta. Confira o cadastro antes de limpar.');
  for(const statement of statements)if((data.transacoes||[]).some(row=>String(row.extratoId)===String(statement.id)&&!ids.has(String(row.id))))blockers.push('Um extrato contém movimentos de outra conta; confira a origem antes de apagar.');
  for(const row of transactions){
    if(row.extratoId&&!statementIds.has(String(row.extratoId)))blockers.push('A conta do movimento diverge da conta do extrato. Confira o vínculo antes de apagar.');
    if(isDateInClosedPeriod(data,row.data)||(data.fechamentosBancarios||[]).some(close=>close.status==='fechado'&&(!close.contaBancariaId||belongs(close,scope))&&row.data>=close.dataInicio&&row.data<=close.dataFim))blockers.push('Há movimentos em período fechado. Reabra o período antes de apagar.');
    if(row.status==='parcial'||reconciliationHold(row)||activeCashAllocations(data).some(link=>String(link.transactionId)===String(row.id)))blockers.push('Há conciliação parcial ou movimento protegido. Desfaça esses vínculos antes de apagar.');
    if(row.vinculo?.tipo==='conciliacao_multipla')blockers.push('Há rateio múltiplo que exige reversão específica antes da limpeza.');
    if(row.vinculo?.tipo==='transferencia_interna'&&(data.transacoes||[]).some(other=>other.vinculo?.tipo==='transferencia_interna'&&other.vinculo.id===row.vinculo.id&&!ids.has(String(other.id))))blockers.push('Há transferência com outra conta. Desfaça a transferência antes de apagar.');
    for(const item of row.gerados||[]){
      const generatedId=`${item?.tipo}:${item?.id}`;
      if(generatedIds.has(generatedId)){blockers.push('Há um valor gerado repetido na conciliação. Confira a origem.');continue;}generatedIds.add(generatedId);
      if(!generatedSections.has(item?.tipo)){blockers.push('Há um lançamento gerado que exige reversão específica antes da limpeza.');continue;}
      const matches=(data[item.tipo]||[]).filter(record=>record.id===item.id);
      if(matches.length!==1||String(matches[0].transacaoId)!==String(row.id)){blockers.push('A origem de um valor gerado não está comprovada pelo ID da transação.');continue;}
      const record=matches[0];
      if((data.transacoes||[]).some(other=>other.id!==row.id&&(other.gerados||[]).some(g=>g.tipo===item.tipo&&g.id===item.id)))blockers.push('Um valor gerado também é usado por outra conciliação.');
      if(isCompetenceInClosedPeriod(data,record.competencia))blockers.push('A competência de um valor gerado está fechada.');
      const effect=['outrasDesp','despesasEmpresa'].includes(item.tipo)?'cost':item.tipo==='payments'&&classifyReceiptForDre(record).recognizeRevenue?'revenue':'cash';
      generated.push({section:item.tipo,id:item.id,transactionId:row.id,value:amount(record),effect});
    }
  }
  return {scope,label:label||'Conta indisponível',blockers:[...new Set(blockers)],transactionIds:[...ids],statementIds:[...statementIds],generated,
    counts:{transactions:transactions.length,statements:statements.length,generated:generated.length},
    values:{credits:transactions.filter(row=>Number(row.valor)>0).reduce((sum,row)=>sum+amount(row),0),debits:transactions.filter(row=>Number(row.valor)<0).reduce((sum,row)=>sum+amount(row),0),generated:generated.reduce((sum,row)=>sum+row.value,0),removedCosts:generated.filter(row=>row.effect==='cost').reduce((sum,row)=>sum+row.value,0),removedRevenue:generated.filter(row=>row.effect==='revenue').reduce((sum,row)=>sum+row.value,0)},
  };
}

export function applyLocalBankAccountCleanup(data,{scope,reason,confirmation,companyId},{actor,now=new Date().toISOString()}={}){
  const fail=error=>({ok:false,error});
  if(data.localCompanySimulation?.enabled!==true||data.localCompanySimulation.companyId!==companyId)return fail('A limpeza está disponível somente na simulação local da empresa.');
  if(actor?.role!=='admin'||actor.active===false||actor.obraId)return fail('Somente administrador sem restrição de obra pode apagar a conciliação.');
  const preview=previewBankAccountCleanup(data,scope);
  if(preview.blockers.length)return fail(preview.blockers.join(' '));
  if(confirmation!==preview.label)return fail('Digite exatamente o nome do grupo ou da conta para confirmar.');
  if(typeof reason!=='string'||reason.trim().length<10||reason.trim().length>1000)return fail('Informe uma justificativa de 10 a 1.000 caracteres.');
  if(!preview.counts.transactions&&!preview.counts.statements)return fail('Não há movimentos ou extratos para apagar.');
  let next=structuredClone(data);
  for(const id of preview.transactionIds){
    const row=next.transacoes.find(row=>String(row.id)===id);
    if(row.status==='conciliado'){
      const undone=desfazerConciliacao(next,id,actor,reason.trim());
      if(!undone.resumo?.ok)return fail(undone.resumo?.motivo||'Não foi possível desfazer um vínculo; nada foi apagado.');
      next=undone.data;
    }
  }
  for(const section of generatedSections){
    const remove=new Set(preview.generated.filter(item=>item.section===section).map(item=>item.id));
    if(remove.size)next[section]=(next[section]||[]).filter(row=>!remove.has(row.id));
  }
  const ids=new Set(preview.transactionIds),statementIds=new Set(preview.statementIds);
  next.transacoes=(next.transacoes||[]).filter(row=>!ids.has(String(row.id)));
  next.extratos=(next.extratos||[]).filter(row=>!statementIds.has(String(row.id)));
  next.historicoConc=(next.historicoConc||[]).filter(row=>!ids.has(String(row.transacaoId))&&!statementIds.has(String(row.extratoId)));
  next.conciliacoes=(next.conciliacoes||[]).filter(row=>!(row.transacaoIds||[]).some(id=>ids.has(String(id))));
  next.reconciliationLinks=(next.reconciliationLinks||[]).filter(row=>![row.transacaoId,row.transactionId,row.bankTransactionId].some(id=>id!==undefined&&ids.has(String(id))));
  next.localCompanySimulation={...next.localCompanySimulation,lastCleanup:{scope,reason:reason.trim(),actorId:actor.id,at:now,counts:preview.counts}};
  return {ok:true,data:next,preview};
}
