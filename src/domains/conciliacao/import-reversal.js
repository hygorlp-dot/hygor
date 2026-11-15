import {isDateInClosedPeriod} from '../financeiro/workflows.js';
import {reconciliationHold} from './cash-allocations.js';

export const BANK_IMPORT_REVERSED='IMPORTACAO_BANCARIA_REVERTIDA';
export const bankImportStamp=t=>JSON.stringify([t.id,t.extratoId,t.data,t.descricao,Number(t.valor),t.chave,t.contaBancariaId||'',t.fitid||'']);
export const validBankOriginal=file=>Boolean(file&&Number.isSafeInteger(file.size)&&file.size>0&&file.size<=2097152&&typeof file.dataUrl==='string'&&/^data:application\/octet-stream;base64,[A-Za-z0-9+/]+={0,2}$/.test(file.dataUrl)&&Math.floor(file.dataUrl.split(',')[1].length*3/4)-(file.dataUrl.endsWith('==')?2:file.dataUrl.endsWith('=')?1:0)===file.size);

export function previewBankReversal(data,id){
 const statement=(data.extratos||[]).find(item=>String(item.id)===String(id));
 const transactions=(data.transacoes||[]).filter(t=>String(t.extratoId)===String(id));
 const ids=new Set(transactions.map(t=>String(t.id))),used=new Set(),seen=new WeakSet();
 const stack=Object.values(data);
 while(stack.length){
  const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);
  for(const [key,value] of Object.entries(item)){
   if(['transacaoId','transactionId','bankTransactionId','originalTransactionId','transacaoOrigemId','transacaoDestinoId','outraTransacaoId','transacaoEstornoId'].includes(key)&&ids.has(String(value)))used.add(String(value));
   if(['transactionIds','transacaoIds','bankTransactionIds'].includes(key)&&Array.isArray(value))for(const ref of value)if(ids.has(String(ref)))used.add(String(ref));
   if(value&&typeof value==='object')stack.push(value);
  }
 }
 const manifest=statement?.importManifest;
 const registered=Array.isArray(manifest?.ids)?manifest.ids:[];
 const invalid=(data.extratos||[]).filter(s=>String(s.id)===String(id)).length!==1||(data.transacoes||[]).filter(t=>ids.has(String(t.id))).length!==transactions.length||!statement||!validBankOriginal(statement.originalFile)||!registered.length||new Set(registered).size!==registered.length||registered.length!==transactions.length||registered.some(key=>!ids.has(key));
 const rows=transactions.map(t=>{
  const reason=t.importReversal?'Já revertida':invalid?'Lote ou original sem rastreabilidade: revisão necessária':
   !registered.includes(String(t.id))||!t.importStamp?'Movimento sem origem confirmada':
   t.status!=='pendente'?'Situação diferente de pendente':
   used.has(String(t.id))||t.vinculo||t.conciliado||t.pago||t.obs||t.statusAtualizadoEm||t.pagamentoId||t.paymentId||(t.pagamentos||[]).length||(t.rateios||[]).length||(t.gerados||[]).length?'Movimento utilizado, vinculado ou com histórico':
   Number(t.version)!==1||t.importStamp!==bankImportStamp(t)||t.updatedAt!==t.createdAt?'Movimento alterado após a importação':
   reconciliationHold(t)||isDateInClosedPeriod(data,t.data)||(data.fechamentosBancarios||[]).some(f=>f.status==='fechado'&&(!f.contaBancariaId||!t.contaBancariaId||f.contaBancariaId===t.contaBancariaId)&&t.data>=f.dataInicio&&t.data<=f.dataFim)?'Movimento bloqueado ou em período fechado':'';
  return {transaction:t,reason};
 });
 return {statement,rows,originalAvailable:validBankOriginal(statement?.originalFile),eligible:rows.filter(r=>!r.reason),error:invalid?'Este lote exige revisão da origem; não será revertido automaticamente.':''};
}

export function applyBankReversal(data,command,now){
 const fail=reason=>({ok:false,reason});
 if(command.actorRole!=='admin'||command.actorObraId)return fail('Somente administrador sem restrição de obra pode reverter importações.');
 const payload=command.payload||{},plan=previewBankReversal(data,payload.statementId),statement=plan.statement;
 if(!statement)return fail('Extrato não encontrado.');
 const previous=(statement.importReversals||[]).find(item=>item.key===command.idempotencyKey);
 if(previous){
  if(previous.reason!==String(payload.reason||'').trim()||previous.sourceVersion!==payload.expectedVersion||JSON.stringify(previous.ids)!==JSON.stringify((payload.targets||[]).map(t=>String(t.id))))return fail('Chave de reversão já utilizada com outros dados.');
  return {ok:true,data,entityId:statement.id,summary:{reversed:previous.ids.length,idempotent:true}};
 }
 const reason=String(payload.reason||'').trim();
 if(reason.length<5||reason.length>1000)return fail('Informe uma justificativa de 5 a 1.000 caracteres.');
 const targets=payload.targets;
 if(plan.error)return fail(plan.error);
 if(!Array.isArray(targets)||!targets.length||targets.length>5000||new Set(targets.map(t=>t.id)).size!==targets.length)return fail('Seleção de reversão inválida.');
 if(!Number.isInteger(payload.expectedVersion)||payload.expectedVersion!==Number(statement.version))return fail('O lote mudou. Atualize a prévia antes de confirmar.');
 const eligible=new Map(plan.eligible.map(r=>[String(r.transaction.id),r.transaction]));
 for(const target of targets)if(!eligible.has(String(target.id))||target.expectedVersion!==Number(eligible.get(String(target.id)).version))return fail('Um movimento mudou ou está protegido. Atualize a prévia; nada foi revertido.');
 const selected=new Set(targets.map(t=>String(t.id)));
 const event={key:command.idempotencyKey,sourceVersion:payload.expectedVersion,ids:[...selected],reason,at:now,actorId:command.actorId,actor:command.actorName||'Administrador'};
 return {ok:true,entityId:statement.id,summary:{reversed:selected.size,protected:plan.rows.length-selected.size},data:{...data,
  transacoes:(data.transacoes||[]).map(t=>String(t.extratoId)===String(statement.id)&&selected.has(String(t.id))?{...t,status:'cancelado',motivoCancelamento:reason,importReversal:event.key,version:Number(t.version)+1,updatedAt:now,updatedById:event.actorId,updatedBy:event.actor}:t),
  extratos:(data.extratos||[]).map(s=>s.id===statement.id?{...s,version:Number(s.version)+1,importReversals:[...(s.importReversals||[]),event]}:s),
  historicoConc:[...(data.historicoConc||[]),...plan.eligible.filter(r=>selected.has(String(r.transaction.id))).map(({transaction:t})=>({id:`reversal_${event.key}_${t.id}`,extratoId:statement.id,transacaoId:t.id,acao:'importacao_revertida',statusAnterior:t.status,statusNovo:'cancelado',descricao:t.descricao,valor:t.valor,detalhes:reason,operadorId:event.actorId,operador:event.actor,criadoEm:now,loteId:event.key}))],
 }};
}
