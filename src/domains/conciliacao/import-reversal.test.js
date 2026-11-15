import {expect,it} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND as C} from '../sync/operational-commands.js';
import {BANK_IMPORT_REVERSED,bankImportStamp,previewBankReversal,validBankOriginal} from './import-reversal.js';
import {buildFinancialLedger,selectDRE,selectCashFlow} from '../financeiro/ledger.js';
import {calcConciliacao} from './calculations.js';
import {validateNoPhysicalDeletes} from '../../../server/section-authorizations.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {applyReconciliationCommand} from '../../../server/reconciliation-command.js';
const actor={actorId:'admin',actorName:'Administrador',actorRole:'admin'};
const now='2026-11-14T13:00:00Z';
const imported=()=>applyOperationalCommand({obras:[{id:'work'}],outrasDesp:[{id:'expense',obraId:'work',valor:700,data:'2026-11-10'}]},
 {...actor,now,type:C.BANK_TRANSACTIONS_IMPORTED,idempotencyKey:'bank-import-source-0001',payload:{statement:{id:'statement',arquivo:'banco.csv',hashArquivo:'source-hash',originalFile:{size:1,dataUrl:'data:application/octet-stream;base64,YQ=='}},transactions:[1,2].map(n=>({id:'t'+n,data:'2026-11-10',descricao:'Movimento '+n,valor:-100*n,chave:'key-'+n,contaBancariaId:'bank'}))}}).data;
const command=(data,patch={})=>({...actor,now,type:BANK_IMPORT_REVERSED,idempotencyKey:'bank-reversal-attempt-0001',payload:{statementId:'statement',expectedVersion:data.extratos[0].version,reason:'Arquivo de teste incorreto',targets:previewBankReversal(data,'statement').eligible.map(({transaction:t})=>({id:t.id,expectedVersion:t.version}))},...patch});
it('reverte pendências atomicamente sem excluir original, custos, pagamentos ou trilha e sem efeito no DRE',()=>{
 const data=imported(),dre=selectDRE(buildFinancialLedger(data)),cash=selectCashFlow(buildFinancialLedger(data));
 const result=applyOperationalCommand(data,command(data));expect(result.ok).toBe(true);
 expect(result.data.transacoes).toHaveLength(2);expect(result.data.transacoes.every(t=>t.status==='cancelado'&&t.version===2)).toBe(true);
 expect(result.data.extratos[0].originalFile).toEqual(data.extratos[0].originalFile);
 expect(result.data.extratos[0].importManifest.ids).toEqual(['t1','t2']);expect(result.data.extratos[0].importReversals[0].actorId).toBe('admin');
 expect(result.data.historicoConc.filter(e=>e.acao==='importacao_revertida')).toHaveLength(2);
 expect(selectDRE(buildFinancialLedger(result.data))).toEqual(dre);expect(selectCashFlow(buildFinancialLedger(result.data))).toEqual(cash);
 expect(calcConciliacao(result.data).total).toBe(0);
});
it.each([
 d=>{d.transacoes[0].status='conciliado';},d=>{d.transacoes[0].status='parcial';},d=>{d.transacoes[0].pago=true;},
 d=>{d.transacoes[0].gerados=[{id:'expense'}];},d=>{d.transacoes[0].rateios=[{valor:100}];},d=>{d.transacoes[0].vinculo={id:'paid'};},
 d=>{d.pedidos=[{pagamentos:[{transacaoId:'t1',status:'estornado'}]}];},d=>{d.reconciliationLinks=[{transactionId:'t1',status:'reversed'}];},
 d=>{d.historicoConc.push({transacaoId:'t1',acao:'reaberta'});},d=>{d.custom={nested:{transactionIds:['t1']}};},
 d=>{d.transacoes[0].descricao='Alterada sem versão';},d=>{d.transacoes[0].version=2;},
 d=>{d.fechamentosBancarios=[{status:'fechado',contaBancariaId:'bank',dataInicio:'2026-11-01',dataFim:'2026-11-30'}];},
 d=>{d.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-11-01',dataFim:'2026-11-30'}];},
])('protege uso atual ou histórico, alteração e período fechado (%#)',mutate=>{
 const data=imported();mutate(data);const plan=previewBankReversal(data,'statement');expect(plan.rows[0].reason).not.toBe('');
 if(plan.eligible.length){const result=applyOperationalCommand(data,command(data));expect(result.ok).toBe(true);expect(result.data.transacoes[0]).toEqual(data.transacoes[0]);}
});
it.each(['originalFile','importManifest'])('legado sem %s exige revisão sem inferir lote',field=>{
 const data=imported();delete data.extratos[0][field];expect(previewBankReversal(data,'statement').eligible).toHaveLength(0);
 expect(applyOperationalCommand(data,command(data)).ok).toBe(false);
});
it('protege conta de origem indefinida quando existe fechamento bancário na data',()=>{
 const data=imported();data.transacoes=data.transacoes.map(t=>{const row={...t,contaBancariaId:''};return {...row,importStamp:bankImportStamp(row)};});
 data.fechamentosBancarios=[{status:'fechado',contaBancariaId:'bank',dataInicio:'2026-11-01',dataFim:'2026-11-30'}];
 const plan=previewBankReversal(data,'statement');expect(plan.eligible).toHaveLength(0);expect(plan.rows[0].reason).toContain('período fechado');
 expect(applyOperationalCommand(data,command(data)).ok).toBe(false);
});
it('detecta conflito após a prévia, não cancela parcialmente e permite repetir confirmação com recibo permanente',()=>{
 const data=imported(),cmd=command(data),changed=structuredClone(data);changed.payments=[{transacaoId:'t2',amount:200}];
 expect(applyOperationalCommand(changed,cmd).ok).toBe(false);expect(changed.transacoes.every(t=>t.status==='pendente')).toBe(true);
 const result=applyOperationalCommand(data,cmd),again=applyOperationalCommand({...result.data,operationalCommandReceipts:[]},cmd);
 expect(again.ok).toBe(true);expect(again.summary.idempotent).toBe(true);expect(again.data.historicoConc).toEqual(result.data.historicoConc);
 expect(applyOperationalCommand(result.data,{...cmd,payload:{...cmd.payload,reason:'Outra justificativa'}}).ok).toBe(false);
 expect(applyOperationalCommand(data,{...cmd,payload:{...cmd.payload,expectedVersion:99}}).ok).toBe(false);
});
it('não libera reimportação duplicada ou reaproveitamento bancário de tombstones',()=>{
 const data=imported(),reversed=applyOperationalCommand(data,command(data)).data;
 for(const type of ['CONFIRM_REVERSAL','CONFIRM_TRANSFER','CONFIRM_ALLOCATION'])expect(applyReconciliationCommand(reversed,{type,payload:{transactionId:'t1'}},{role:'admin'}).resumo.ok).toBe(false);
 const result=applyOperationalCommand(reversed,{...actor,type:C.BANK_TRANSACTIONS_IMPORTED,idempotencyKey:'bank-reimport-0002',payload:{statement:{id:'another',arquivo:'again.csv'},transactions:[{id:'other',data:'2026-11-10',valor:-100,descricao:'Movimento',chave:'key-1'}]}});
 expect(result.summary.duplicates).toBe(1);expect(result.data.transacoes).toHaveLength(2);
});
it('snapshot não forja origem, cancela registros nem reescreve original e trilha; arquivamento preservado é permitido',()=>{
 const data=imported(),reversed=applyOperationalCommand(data,command(data)).data;
 for(const mutate of [d=>{delete d.extratos[0].originalFile;},d=>{d.extratos[0].importManifest.ids=[];},d=>{d.transacoes[0].status='cancelado';},d=>{d.transacoes[0].importStamp='fake';}]){const next=structuredClone(data);mutate(next);expect(validateNoPhysicalDeletes(data,next)).not.toBe('');}
 const next=structuredClone(reversed);next.transacoes[0].status='pendente';expect(validateNoPhysicalDeletes(reversed,next)).not.toBe('');
 expect(validateNoPhysicalDeletes({},data)).not.toBe('');
 const archived=structuredClone(data);archived.extratos[0].status='arquivado';expect(validateNoPhysicalDeletes(data,archived)).toBe('');
});
it('valida original e restringe execução a administrador irrestrito',()=>{
 expect(validBankOriginal({size:1,dataUrl:'https://external.test/file'})).toBe(false);expect(validBankOriginal({size:2,dataUrl:'data:application/octet-stream;base64,YQ=='})).toBe(false);
 for(const user of [{role:'financeiro'},{role:'admin',obraId:'work'},{role:'admin',active:false}])expect(validateOperationalCommandScope({user,command:{type:BANK_IMPORT_REVERSED}}).ok).toBe(false);
 expect(validateOperationalCommandScope({user:{role:'admin'},command:{type:BANK_IMPORT_REVERSED}}).ok).toBe(true);
 const data=imported();expect(applyOperationalCommand(data,command(data,{actorRole:'financeiro'})).ok).toBe(false);
 const duplicate=structuredClone(data);duplicate.transacoes.push({...duplicate.transacoes[0],extratoId:'other'});expect(previewBankReversal(duplicate,'statement').eligible).toHaveLength(0);
});
