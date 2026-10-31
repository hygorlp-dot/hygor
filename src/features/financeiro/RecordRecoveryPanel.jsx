import {useEffect,useRef,useState} from 'react';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {Button} from '../../design-system/primitives/Button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {mergeRecordEdits,recoveryFieldLabel} from './record-recovery.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import './record-continuity.css';
const valueLabel=(value,data={},field)=>{
 if(value==null||value==='')return 'Não informado';
 if(field==='obraId')return data.obras?.find(w=>w.id===value)?.name||'Obra não identificada';
 if(field==='pedidoId')return data.pedidos?.find(p=>p.id===value)?.numero||'Pedido não identificado';
 if(['valorBruto','valorLiquido'].includes(field))return Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 if(['emissao','vencimento'].includes(field))return financialDateLabel(value);
 return Array.isArray(value)?value.map(item=>item.nome||item.legenda||item.descricao||(item.obraId?`${data.obras?.find(w=>w.id===item.obraId)?.name||'Obra não identificada'} · ${item.valor??''}`:'Referência cadastrada')).join('\n'):typeof value==='object'?Object.entries(value).map(([key,v])=>`${key.toUpperCase()}: ${v}`).join('\n'):String(value);
};
export function SessionRenewalFields({user,busy=false,onRenew}){
 const [password,setPassword]=useState(''),[pending,setPending]=useState(false),lock=useRef(false);
 return <div className="record-recovery__auth"><Input label="Conta da edição" value={user?.email||''} readOnly/><Input label="Senha para renovar a sessão" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/><Button variant="secondary" disabled={busy||pending||!password} onClick={async()=>{if(lock.current)return;lock.current=true;const secret=password;setPassword('');setPending(true);try{await onRenew(secret);}finally{lock.current=false;setPending(false);}}}>Renovar sessão</Button></div>;
}
export default function RecordRecoveryPanel({recovery,draft,fields,user,data,onRebase,onConfirmed}){
 const panel=useRef(null);
 useEffect(()=>{if(recovery.failure)panel.current?.scrollIntoView?.({block:'nearest'});},[recovery.failure?.message]);
 if(!recovery.failure)return null;
 const differences=recovery.latest?mergeRecordEdits(recovery.base.current||{},draft,recovery.latest,fields).conflicts:[];
 return <section ref={panel} className="record-recovery" aria-label="Recuperação da edição"><Alert variant={recovery.failure.info?(differences.length?'warning':'default'):'destructive'} role={recovery.failure.info?'status':'alert'}><AlertDescription>{recovery.failure.message} O preenchimento permanece nesta tela.</AlertDescription></Alert>
 {recovery.failure.status===401&&<SessionRenewalFields user={user} busy={recovery.busy} onRenew={password=>recovery.renew(user,password)}/>}
 <div className="financial-record-flow__actions"><Button variant="secondary" disabled={recovery.busy} onClick={recovery.check}>{recovery.busy?'Consultando…':'Consultar versão atual'}</Button>{recovery.confirmed&&<Button onClick={()=>onConfirmed(recovery.confirmed)}>Aplicar confirmação recebida</Button>}</div>
 {recovery.latest&&<><p>Dados alterados somente por outra pessoa serão preservados. Quando o mesmo campo mudou dos dois lados, escolha o valor que deseja manter.</p>{differences.map(field=><fieldset key={field}><legend>Conflito em {recoveryFieldLabel(field)}</legend><div className="record-recovery__comparison"><pre>Minha edição: {valueLabel(draft[field],data,field)}</pre><pre>Versão atual: {valueLabel(recovery.latest[field],data,field)}</pre></div><Select label={`Valor para ${recoveryFieldLabel(field)}`} value={recovery.choices[field]||''} onChange={e=>recovery.setChoices(previous=>({...previous,[field]:e.target.value}))} options={[{value:'',label:'Escolha o valor a manter'},{value:'mine',label:'Manter minha edição'},{value:'current',label:'Usar versão atual'}]}/></fieldset>)}<Button variant="secondary" disabled={recovery.conflicts(draft).length>0} onClick={()=>{const merged=recovery.rebase(draft);if(merged)onRebase(merged);}}>Aplicar revisão ao formulário</Button></>}
 </section>;
}
