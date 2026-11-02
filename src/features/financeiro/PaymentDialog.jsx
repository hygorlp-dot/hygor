import {PAYABLE_PAYMENT_COMMAND as CMD} from '../../domains/financeiro/payable-payment-commands.js';
import {availableOrderPayments} from '../../domains/financeiro/order-payment-links.js';
import {active} from '../../domains/financeiro/facts.js';
import AdvanceAllocation from './AdvanceAllocation.jsx';
import {isFinancialDate} from '../../domains/financeiro/dates.js';
import {podeAcessarAba} from '../../domains/administracao/abas-acesso.js';
import {useEffect,useRef,useState} from 'react';
import {Modal,Inp,Sel} from '../../legacy/ui.jsx';
import {Button} from '../../components/ui/button.jsx';
import {FilePicker} from '../../design-system/patterns/FilePicker.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {attemptStore} from '../workflow/attempt-store.js';
import {dispatchConfirmedAttempt,UNCONFIRMED_COMMAND} from '../workflow/command-attempt.js';
import {totalPedido,saldoPagamentoPedido,situacaoCaixaObra} from '../../domains/compras/calculations.js';
import {saldoPagamentoNota} from '../../domains/financeiro/payables.js';
import {validatePurchasePayment} from '../../domains/financeiro/purchase-payment-validation.js';
import {UNALLOCATED_ORDER_PAYMENT} from '../../domains/financeiro/workspace.js';
import {arquivoComoDataUrl} from '../../legacy/files.js';
import {enviarArquivoOneDrive} from '../../api.js';
import {today,uid,fmt} from '../../legacy/format.js';
import './payment-dialog.css';
const initial=target=>({valor:String((target.type==='nota'?saldoPagamentoNota(target.record):saldoPagamentoPedido(target.record)).toFixed(2)),data:today(),origem:target.record.origemPagamento||'empresa',transacaoId:'',referencia:'',observacao:'',motivoAdiantamento:'',comprovanteFile:null,comprovanteLegenda:''});
export default function PaymentDialog({data,user,type,id,pageId='fin',dispatch,onClose,onSaved}){
 const record=(data[type==='nota'?'notasFiscais':'pedidos']||[]).find(r=>r.id===id),target={type,record};
 const [form,setForm]=useState(()=>record?initial(target):{}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[draftStatus,setDraftStatus]=useState(''),[otherPending,setOtherPending]=useState(false);
 const attempt=useRef({owner:user.id}),dirty=useRef(false),lock=useRef(false),done=useRef(false);
 useHelpTopic(pageId,pageId==='cmp'?'cmp_pagamento':'fin_pagamentos',20);
 useEffect(()=>{let active=true;(async()=>{try{const saved=await attemptStore.draft(user.id,type,id);const pending=(await attemptStore.pending(user.id)).find(p=>p.command.payload.targetType===type&&p.command.payload.targetId===id);if(!active)return;if(pending&&pending.command.type!==CMD.PAYABLE_PAYMENT_RECORDED){setOtherPending(true);setMessage('Confirmação pendente. Feche a ficha e use Retomar trabalho salvo.');}else if(pending){attempt.current={owner:user.id,command:pending.command,context:pending.context};const p=pending.command.payload.payment;setForm({...initial(target),...p,valor:String(p.valor),motivoAdiantamento:pending.command.payload.motivoAdiantamento||'',comprovanteFile:null});setMessage(UNCONFIRMED_COMMAND);}else if(saved){setForm(saved);dirty.current=true;setDraftStatus('Rascunho recuperado. Confira os dados.');}setReady(true);}catch{if(active)setMessage('Armazenamento local indisponível. Libere-o e reabra a ficha. Envio bloqueado.');}})();return()=>{active=false;};},[user.id,type,id]);
 useEffect(()=>{if(!ready||!dirty.current||done.current)return;let active=true;attemptStore.draft(user.id,type,id,form,{pageId,obraId:record?.obraId,obra:(data.obras||[]).find(w=>w.id===record?.obraId)?.name,label:`Pagamento · ${record?.numero||id}`}).then(()=>{if(active)setDraftStatus('Rascunho salvo neste navegador.');}).catch(()=>{if(active)setDraftStatus('Rascunho não salvo. Confira o armazenamento local.');});return()=>{active=false;};},[form,ready,user.id,type,id]);
 const close=useUnsavedChanges(form,onClose,{identity:`${type}:${id}`,busy});
 const patch=(key,value)=>{dirty.current=true;setForm(f=>({...f,[key]:value}));};
 if(!record)return <Modal title="Registro indisponível" onClose={onClose}><p>Confira a obra e o acesso antes de registrar um pagamento.</p></Modal>;
 const work=(data.obras||[]).find(w=>w.id===record.obraId),balance=type==='nota'?saldoPagamentoNota(record):saldoPagamentoPedido(record),total=type==='nota'?Number(record.valorLiquido||record.valorBruto):totalPedido(record),value=Number(String(form.valor||'').replace(',','.'));
 const canPay=['admin','financeiro',...(pageId==='cmp'?['compras']:[])].includes(user.role)&&podeAcessarAba(user,pageId)&&user.active!==false&&(!user.obraId||user.obraId===record.obraId);
 const validation=validatePurchasePayment(data,{type,target:record,value,motivo:form.motivoAdiantamento,actorRole:user.role});
 const usedTransactions=new Set([...(data.pedidos||[]),...(data.notasFiscais||[])].flatMap(r=>r.pagamentos||[]).filter(active).map(p=>p.transacaoId));
 const cash=situacaoCaixaObra(data,record.obraId);
 const save=async()=>{
  if(lock.current||busy||!canPay||!ready||otherPending)return;lock.current=true;setBusy(true);setMessage('');
  try{
   if(!attempt.current.command&&(validation.error||!isFinancialDate(form.data)))throw Error(validation.error||'Informe a data do pagamento.');
   await attemptStore.draft(user.id,type,id,form,{pageId,obraId:record?.obraId,obra:(data.obras||[]).find(w=>w.id===record?.obraId)?.name,label:`Pagamento · ${record?.numero||id}`});
   let docs=[],workspace=null;
   if(form.comprovanteFile&&!attempt.current.command){const file=form.comprovanteFile;const response=await enviarArquivoOneDrive({dataUrl:await arquivoComoDataUrl(file),obraName:work?.name||'Obra',driveId:work?.oneDriveDriveId,folderId:work?.oneDriveFolderId,folders:work?.oneDriveFolders,category:'financeiro',subfolder:`Pagamentos/${record.numero||id}`,date:form.data,fileName:file.name});if(!response.ok&&!response.url)throw Error(response.error||'Não foi possível salvar o comprovante.');docs=[{id:response.item?.id||uid(),nome:file.name,legenda:form.comprovanteLegenda||file.name,url:response.item?.webUrl||response.url,tipo:file.type,tamanho:file.size}];workspace=response.workspace||null;}
   attempt.current.context={pageId,obraId:record.obraId,obra:work?.name,label:`Pagamento · ${record.numero||id}`,valor:value};
   const result=await dispatchConfirmedAttempt(attempt.current,dispatch,current=>({type:CMD.PAYABLE_PAYMENT_RECORDED,idempotencyKey:`payment-${uid()}`,expectedVersion:Number((current[type==='nota'?'notasFiscais':'pedidos']||[]).find(r=>r.id===id)?.version||0),actorId:user.id,actorName:user.nome,payload:{targetType:type,targetId:id,payment:{id:uid(),valor:value,data:form.data,origem:form.origem,transacaoId:form.origem==='empresa'?form.transacaoId:'',referencia:form.referencia,observacao:form.observacao,comprovantes:docs},workCashMovementId:form.origem==='caixa_obra'?uid():'',workspace,motivoAdiantamento:form.motivoAdiantamento}}));
   if(!result?.ok)throw Error(result?.reason||UNCONFIRMED_COMMAND);
   done.current=true;onSaved?.(result);onClose();
  }catch(error){setMessage(attempt.current.command?UNCONFIRMED_COMMAND:error.message||UNCONFIRMED_COMMAND);}finally{lock.current=false;setBusy(false);}
 };
 return <><Modal title={`Pagamento · ${record.numero||id}`} onClose={close.requestClose} panelClass="mrc-payment-dialog"><div className="mrc-payment-dialog__body">
 <HelpButton pageId={pageId} allowedTabs={[pageId]}/><p>{work?.name||'Obra não informada'} · Total {fmt(total)} · Saldo {fmt(balance)}</p>
 {message&&<p role="alert">{message}</p>}{draftStatus&&<p role="status">{draftStatus}</p>}
 {type==='nota'&&availableOrderPayments(data,record).length>0&&<p role="status">{UNALLOCATED_ORDER_PAYMENT}</p>}
 {type==='nota'&&canPay&&<AdvanceAllocation data={data} note={record} user={user} dispatch={dispatch} busy={busy||!ready||otherPending||!!attempt.current.command} onBusy={setBusy} onPending={()=>setOtherPending(true)} onSaved={result=>{done.current=true;onSaved?.(result);onClose();}}/>}
 {!ready?(!message&&<p role="status">Preparando rascunho local…</p>):<fieldset className="mrc-command-fields" aria-label="Dados do pagamento" disabled={busy||!!attempt.current.command||otherPending||!canPay}>
 <Sel label="Origem real do pagamento *" value={form.origem} onChange={v=>{patch('origem',v);patch('transacaoId','');}} options={[{v:'empresa',l:'Conta bancária da empresa'},{v:'caixa_obra',l:'Caixa da obra'},{v:'cliente_direto',l:'Cliente pagou diretamente'}]}/>
 {form.origem==='caixa_obra'&&<p role="status">Saldo do caixa: {fmt(cash.saldo)} · após este pagamento: {fmt(cash.saldo-value)}. {!work?.hasCaixa?'Caixa não ativado. ':''}{cash.saldo-value<0?'O caixa ficará negativo. Confira a origem real.':''}</p>}
 <div className="mrc-payment-dialog__grid"><Inp label="Valor pago *" type="number" min="0.01" value={form.valor} onChange={v=>patch('valor',v)}/><Inp label="Data *" type="date" value={form.data} onChange={v=>patch('data',v)}/></div>
 {validation.campos?.tipo==='adiantamento'&&<><p role="status">Este valor será registrado como adiantamento. Entrega e nota continuam independentes.</p><Inp label="Motivo do adiantamento (recomendado)" value={form.motivoAdiantamento} onChange={v=>patch('motivoAdiantamento',v)}/></>}
 {type==='nota'&&validation.warnings?.filter(w=>w.code!=='ORDER_PAYMENTS_TO_REVIEW').map(w=><p key={w.code} role="status">{w.message} {w.resolution}</p>)}
 {form.origem==='empresa'&&<Sel label="Vincular à transação bancária (opcional)" value={form.transacaoId} onChange={v=>patch('transacaoId',v)} options={[{v:'',l:'Sem transação vinculada'},...(data.transacoes||[]).filter(t=>Number(t.valor)<0&&!['conciliado','ignorado'].includes(t.status)&&!usedTransactions.has(t.id)).map(t=>({v:t.id,l:`${t.data} · ${fmt(Math.abs(t.valor))} · ${t.descricao||'Saída bancária'}`}))]}/>}
 <Inp label="Referência do pagamento" value={form.referencia} onChange={v=>patch('referencia',v)}/>
 <FilePicker buttonLabel="Selecionar comprovante" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>5.5*1024*1024){setMessage('O comprovante deve ter no máximo 5,5 MB.');return;}patch('comprovanteFile',file);}}>{form.comprovanteFile?.name||'PDF ou imagem do comprovante'}</FilePicker>
 {form.comprovanteFile&&<Button variant="outline" onClick={()=>patch('comprovanteFile',null)}>Remover comprovante</Button>}{form.comprovanteFile&&<Inp label="Legenda do comprovante" value={form.comprovanteLegenda} onChange={v=>patch('comprovanteLegenda',v)}/>}<Inp label="Observação" multiline value={form.observacao} onChange={v=>patch('observacao',v)}/>
 </fieldset>}
 <div className="mrc-payment-dialog__actions"><Button variant="outline" disabled={busy} onClick={close.requestClose}>Cancelar</Button><Button disabled={busy||!ready||otherPending||!canPay} onClick={save}>{busy?'Registrando pagamento…':'Registrar pagamento'}</Button></div>
 </div></Modal><UnsavedChangesPrompt guard={{...close,discard:async()=>{done.current=true;if(!attempt.current.command){try{await attemptStore.draft(user.id,type,id,null);}catch{done.current=false;setMessage('Rascunho não descartado. Confira o armazenamento local.');close.continueEditing();return;}}close.discard();}}} description={attempt.current.command?'Fechar mantém a confirmação pendente neste navegador; não cancela uma operação já enviada.':'Descartar remove o rascunho deste formulário do navegador.'} confirmLabel={attempt.current.command?'Fechar e manter confirmação':'Descartar alterações'}/></>;
}
