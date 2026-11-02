import {PAYABLE_PAYMENT_COMMAND as CMD} from '../../domains/financeiro/payable-payment-commands.js';
import {useRef,useState} from 'react';
import {availableOrderPayments} from '../../domains/financeiro/order-payment-links.js';
import {saldoPagamentoNota} from '../../domains/financeiro/payables.js';
import {active} from '../../domains/financeiro/facts.js';
import {Inp,Sel} from '../../legacy/ui.jsx';
import {Button} from '../../components/ui/button.jsx';
import {dispatchConfirmedAttempt,UNCONFIRMED_COMMAND} from '../workflow/command-attempt.js';
import {uid,fmt} from '../../legacy/format.js';
export default function AdvanceAllocation({data,note,user,dispatch,busy,onBusy,onPending,onSaved}){
 const rows=availableOrderPayments(data,note),existing=(note.pagamentos||[]).filter(p=>p.pedidoPagamentoId&&active(p));
 const [selected,setSelected]=useState(rows[0]?.payment.id||''),[value,setValue]=useState(()=>String(Math.min((rows[0]?.availableCents||0)/100,saldoPagamentoNota(note)).toFixed(2))),[message,setMessage]=useState(''),[undo,setUndo]=useState(null),[reason,setReason]=useState('');
 const attempt=useRef({owner:user.id}),lock=useRef(false);const source=rows.find(r=>r.payment.id===selected);
 const submit=async reversing=>{
  if(lock.current||busy)return;lock.current=true;onBusy(true);setMessage('');
  try{
   if(!reversing&&(!source||Number(value)<=0))throw Error('Escolha o pagamento e informe o valor a alocar.');
   if(reversing&&!reason.trim())throw Error('Informe o motivo para desfazer a alocação.');
   attempt.current.context={pageId:'fin',obraId:note.obraId,label:`Alocação · ${note.numero||note.id}`,valor:reversing?undo.valor:Number(value)};
   const result=await dispatchConfirmedAttempt(attempt.current,dispatch,()=>({type:reversing?CMD.PAYABLE_PAYMENT_REVERSED:CMD.ORDER_PAYMENT_ALLOCATED,idempotencyKey:`allocation-${uid()}`,expectedVersion:Number(note.version||0),actorId:user.id,actorName:user.nome,payload:reversing?{targetType:'nota',targetId:note.id,paymentId:undo.id,reason,adjustmentId:uid()}:{targetType:'nota',targetId:note.id,paymentId:selected,orderVersion:Number(source.order.version||0),allocationId:uid(),valor:Number(value)}}));
   if(!result?.ok)throw Error(result?.reason||UNCONFIRMED_COMMAND);onSaved(result);
  }catch(error){setMessage(attempt.current.command?UNCONFIRMED_COMMAND:error.message||UNCONFIRMED_COMMAND);if(attempt.current.command)onPending?.();}finally{lock.current=false;onBusy(false);}
 };
 if(!rows.length&&!existing.length)return null;
 return <section aria-label="Alocação de adiantamentos"><h3>Alocar pagamento já realizado</h3><p>Vincule um pagamento do pedido à nota para reduzir o saldo sem nova saída de caixa.</p>
 {message&&<p role="alert">{message}</p>}
 <fieldset className="mrc-command-fields" disabled={busy||!!attempt.current.command}>
 {rows.length>0&&<><Sel label="Pagamento do pedido" value={selected} onChange={id=>{setSelected(id);const row=rows.find(r=>r.payment.id===id);setValue(String(Math.min((row?.availableCents||0)/100,saldoPagamentoNota(note)).toFixed(2)));}} options={[{v:'',l:'Selecione o pagamento'},...rows.map(r=>({v:r.payment.id,l:`${r.payment.data} · ${r.payment.referencia||r.payment.id} · disponível ${fmt(r.availableCents/100)}`}))]}/><Inp label="Valor a alocar" type="number" min="0.01" value={value} onChange={setValue}/></>}
 {existing.map(p=><div key={p.id}><p>Alocado: {fmt(p.valor)} · {p.data}</p><Button variant="outline" onClick={()=>setUndo(p)}>Desfazer alocação</Button></div>)}
 {undo&&<Inp label="Motivo para desfazer a alocação" value={reason} onChange={setReason}/>}
 </fieldset>
 {rows.length>0&&!undo&&<Button disabled={busy} onClick={()=>submit(false)}>Alocar adiantamento</Button>}{undo&&<Button disabled={busy} onClick={()=>submit(true)}>Confirmar desfazer alocação</Button>}
 </section>;
}
