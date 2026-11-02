import {canManagePurchases,canReceivePurchases} from '../../domains/compras/permissions.js';
import {fmt,fmtDateFull} from '../../legacy/format.js';
import PaymentDialog from '../financeiro/PaymentDialog.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {useEffect,useState} from 'react';
import {attemptStore} from './attempt-store.js';
import {dispatchConfirmedAttempt} from './command-attempt.js';
import {Modal} from '../../legacy/ui.jsx';
import {Button} from '../../components/ui/button.jsx';
import {podeAcessarAba} from '../../domains/administracao/abas-acesso.js';
export default function PendingOperations({user,data,dispatch}){
 const [items,setItems]=useState([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[draft,setDraft]=useState(null);
 const pageId=podeAcessarAba(user,'fin')?'fin':'cmp';useHelpTopic(pageId,`${pageId}_recuperacao`,open?30:-10);
 useEffect(()=>{let active=true;const load=()=>attemptStore.list(user.id).then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setMessage('Não foi possível consultar as confirmações locais.');});load();window.addEventListener('marcell-confirmations',load);window.addEventListener('focus',load);return()=>{active=false;window.removeEventListener('marcell-confirmations',load);window.removeEventListener('focus',load);};},[user.id]);
 const retry=async item=>{setBusy(true);try{const result=await dispatchConfirmedAttempt({owner:user.id,command:item.command,context:item.context},dispatch,()=>item.command);setMessage(result?.ok?'Operação confirmada.':result?.reason||'Confirmação indisponível.');}finally{setBusy(false);}};
 const rows=items.filter(item=>item.owner===user.id&&(item.kind!=='draft'||!items.some(p=>p.kind==='pending'&&p.command.payload?.targetId===item.id&&p.command.payload?.targetType===item.type)));
 if(!rows.length&&!message&&!draft)return null;
 return <section className="mrc-pending-operations" aria-label="Confirmações locais"><p>Confirmações: {rows.filter(r=>r.kind==='pending').length} · Rascunhos: {rows.filter(r=>r.kind==='draft').length}</p><Button variant="outline" onClick={()=>setOpen(true)}>Retomar trabalho salvo</Button>
 {open&&<Modal title="Rascunhos e confirmações" onClose={()=>{if(!busy){setOpen(false);setMessage('');}}}><HelpButton pageId={pageId} allowedTabs={[pageId]}/>{rows.map(item=>{const c=item.context||{},allowed=(item.command?.type==='PEDIDO_RECEBIMENTO_REGISTRADO'?canReceivePurchases:canManagePurchases)(user.role)&&user.active!==false&&podeAcessarAba(user,c.pageId||'cmp')&&(!user.obraId||user.obraId===c.obraId);return <section key={item.key}><p>{item.kind==='draft'?'Rascunho não enviado':'Confirmação enviada, sem resposta'}</p><h4>{allowed?c.label||'Operação':'Operação fora do acesso atual'}</h4>{allowed&&<p>{c.obra||(data.obras||[]).find(w=>w.id===c.obraId)?.name||c.obraId} · {fmtDateFull((item.createdAt||'').slice(0,10))}{c.valor!=null?` · ${fmt(c.valor)}`:''}</p>}{item.kind==='draft'?<Button disabled={busy||!allowed} onClick={()=>{setDraft(item);setOpen(false);}}>Reabrir rascunho</Button>:<Button disabled={busy||!allowed} onClick={()=>retry(item)}>Retomar confirmação</Button>}{!allowed&&<p>Peça a revisão das permissões antes de retomar.</p>}</section>;})}{message&&<p role="status">{message}</p>}</Modal>}
 {draft&&<PaymentDialog key={draft.key} data={data} user={user} type={draft.type} id={draft.id} pageId={draft.context?.pageId||pageId} dispatch={dispatch} onClose={()=>setDraft(null)}/> }
 </section>;
}
