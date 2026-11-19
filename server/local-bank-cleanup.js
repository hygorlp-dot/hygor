import {createHash} from 'node:crypto';
import {applyLocalBankAccountCleanup,previewBankAccountCleanup} from '../src/domains/conciliacao/account-cleanup.js';

export const simulationRevision=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
export function previewLocalBankCleanup(state,scope){
  const preview=previewBankAccountCleanup(state.data,scope),ids=new Set(preview.transactionIds);
  if((state.tables.accounting_periods||[]).some(period=>['closed','fechado'].includes(period.status)))preview.blockers.push('Há período contábil nativo fechado. Confira a reabertura formal antes da limpeza.');
  const banks=(state.tables.bank_transactions||[]).filter(row=>ids.has(String(row.metadata?.legacyId)));
  const nativeIds=new Set(banks.map(row=>row.id));
  for(const row of banks)if(row.account_id&&preview.scope==='unassigned')preview.blockers.push('O movimento nativo tem conta definida e o cadastro legado não. Confira a origem.');
  const nativeTypes={outrasDesp:'despesa_obra',despesasEmpresa:'despesa_empresa',payments:'recebimento_avulso',caixaObra:'caixa_obra',pagsTerceiros:'pagamento_terceiro',pagamentosFolha:'pagamento_folha'};
  const generated=new Set(preview.generated.map(row=>`${nativeTypes[row.section]}:${row.id}`));
  const titles=(state.tables.financial_titles||[]).filter(row=>generated.has(`${row.metadata?.legacyType}:${row.metadata?.legacyId}`));
  const titleIds=new Set(titles.map(row=>row.id));
  const settlements=(state.tables.settlements||[]).filter(row=>nativeIds.has(row.bank_transaction_id));
  if(settlements.some(row=>!titleIds.has(row.title_id)))preview.blockers.push('Há liquidação nativa de um lançamento preexistente. Confira a reversão específica antes de limpar.');
  if((state.tables.settlements||[]).some(row=>titleIds.has(row.title_id)&&!nativeIds.has(row.bank_transaction_id)))preview.blockers.push('Um título gerado possui pagamento de outra origem.');
  return {...preview,revision:simulationRevision(state),native:{bankIds:[...nativeIds],titleIds:[...titleIds],settlementIds:settlements.map(row=>row.id)}};
}
export function applyLocalBankCleanup(state,command,actor){
  if(!state.localOnly||state.companyId!==command.companyId)return {ok:false,error:'Simulação local de outra empresa ou não habilitada.'};
  const preview=previewLocalBankCleanup(state,command.scope);
  if(command.expectedRevision!==preview.revision)return {ok:false,error:'Os dados mudaram. Atualize a prévia antes de confirmar.'};
  if(preview.blockers.length)return {ok:false,error:[...new Set(preview.blockers)].join(' ')};
  const result=applyLocalBankAccountCleanup(state.data,command,{actor});if(!result.ok)return result;
  const tables=structuredClone(state.tables),banks=new Set(preview.native.bankIds),titles=new Set(preview.native.titleIds),settlements=new Set(preview.native.settlementIds);
  tables.bank_transactions=(tables.bank_transactions||[]).filter(row=>!banks.has(row.id));
  tables.financial_titles=(tables.financial_titles||[]).filter(row=>!titles.has(row.id));
  tables.settlements=(tables.settlements||[]).filter(row=>!settlements.has(row.id));
  tables.reconciliation_links=(tables.reconciliation_links||[]).filter(row=>!banks.has(row.bank_transaction_id)&&!settlements.has(row.settlement_id));
  const imports=new Set((state.tables.bank_transactions||[]).filter(row=>banks.has(row.id)).map(row=>row.import_batch_id).filter(Boolean));
  tables.bank_import_batches=(tables.bank_import_batches||[]).filter(row=>!imports.has(row.id)||(tables.bank_transactions||[]).some(bank=>bank.import_batch_id===row.id));
  return {ok:true,state:{...state,data:result.data,tables,revision:Number(state.revision||0)+1},preview};
}
