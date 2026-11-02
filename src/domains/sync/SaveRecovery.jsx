import {useEffect,useState} from 'react';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Modal} from '../../legacy/ui.jsx';
import {SessionRenewalFields} from '../../features/financeiro/RecordRecoveryPanel.jsx';
import {renewEditingSession,readRecoveryData} from '../../api.js';
import {snapshotJournal,recoveryTab,canRecoverSnapshot,expandSnapshot} from './snapshot-journal.js';
import {reviewSnapshot} from './snapshot-merge.js';
import {useHelpTopic} from '../../features/help/HelpContext.jsx';

const names={eventosEmpresa:'Eventos da empresa',tipo:'Categoria',criadoPor:'Registrado por',status:'Situação',titulo:'Título',nome:'Nome',descricao:'Descrição',data:'Data',valor:'Valor',obraId:'Obra',config:'Configurações',pedidos:'Pedidos',fornecedores:'Fornecedores',orcamentos:'Orçamentos'};
const label=value=>value===undefined?'Registro removido':typeof value==='object'?Object.entries(value).filter(([key])=>!['id','criadoPorId','criadoEm'].includes(key)&&value[key]!=='').map(([key,v])=>`${names[key]||key}: ${typeof v==='object'?JSON.stringify(v):v}`).join(' · '):String(value??'Não informado');
const pathLabel=(path,data,expanded)=>path.map((key,index)=>{
 if(index===1){const record=[...(Array.isArray(expanded?.intended[path[0]])?expanded.intended[path[0]]:[]),...(Array.isArray(data[path[0]])?data[path[0]]:[])].find(r=>String(r?.id)===key);return record?.titulo||record?.nome||record?.numero||names[key]||key;}
 return names[key]||key;
}).join(' · ');

export function SaveRecovery({queue,state,user,open,onOpen,onClose,onApply,onUser,onAvailable,onReady,revision,onDiscard,pageId,normalize,onRecovered,onDiscardMemory,memoryCount,onProtectMemory}){
 const [row,setRow]=useState(null),[error,setError]=useState('');
 const [current,setCurrent]=useState(null),[choices,setChoices]=useState({});
 const [busy,setBusy]=useState(false),[authRequired,setAuthRequired]=useState(false),[sessionRenewed,setSessionRenewed]=useState(false),[notice,setNotice]=useState('');
 useHelpTopic(pageId,open?'home_recuperacao':pageId,open?50:-100);
 useEffect(()=>{
  let active=true;
  const load=()=>{
   try{snapshotJournal.readLatest(user.id,recoveryTab()).then(r=>{if(active){setRow(r||null);onReady(true);}}).catch(()=>{if(active)setError('Falha ao ler a edição local. Mantenha esta aba aberta.');});}
   catch{if(active)setError('Armazenamento local indisponível. Mantenha esta aba aberta.');}
  };
  load();window.addEventListener('marcell-workspace-journal',load);window.addEventListener('focus',load);
  return()=>{active=false;window.removeEventListener('marcell-workspace-journal',load);window.removeEventListener('focus',load);};
 },[user.id,revision,onReady]);
 const sending=['saving','retry_scheduled'].includes(state);
 const available=!!memoryCount||!!row||state==='failed'||state==='conflict'||!!error;
 useEffect(()=>onAvailable(available),[available,onAvailable]);
 useEffect(()=>{if(open){setCurrent(null);setChoices({});}},[open]);
 const consult=async()=>{
  setBusy(true);setError('');setNotice('');setCurrent(null);
  try{
   const fresh=await readRecoveryData();
   if(!fresh.ok){setAuthRequired(fresh.status===401);setError(fresh.error);return;}
   fresh.data=normalize(fresh.data);
   let saved=await snapshotJournal.readLatest(user.id,recoveryTab());
   const account=fresh.usuario||user;
   if(!saved&&queue.hasPending()){await queue.protectPending();saved=await snapshotJournal.readLatest(user.id,recoveryTab());}
   onUser(account);
   if(!saved){setError('Nenhuma edição protegida. Verifique o armazenamento.');return;}
   if(!canRecoverSnapshot(saved,account,fresh.data)){setError('Acesso ou obra alterados. Retomada bloqueada; solicite revisão do acesso.');return;}
   setAuthRequired(false);setRow(saved);setCurrent({...fresh,revision:saved.revision});setChoices({});
  }catch{setError('Falha na consulta. Mantenha esta aba aberta.');}
  finally{setBusy(false);}
 };
 let expanded=null,review=null,reviewError='';
 try{expanded=current&&row&&current.revision===row.revision?expandSnapshot(row.changes,current.data):null;review=expanded?reviewSnapshot(expanded.base,expanded.intended,current.data,choices):null;}
 catch{reviewError='Edição incompleta. Envio bloqueado; mantenha esta aba aberta.';}
 const save=async()=>{
  if(busy||sending||!review?.ready)return;
  setBusy(true);
  try{const result=await onApply(review.merged,current,row);if(result?.ok)onClose();else setError(result?.reason||'Falha ao salvar. Consulte a versão atual.');}
  finally{setBusy(false);}
 };
 return <>
  {available&&!sending&&<Alert variant="warning" data-testid="save-recovery" className="mb-3"><AlertDescription>
   {error||(memoryCount?'Há preenchimentos somente na memória. Não recarregue.':queue.getFailure()?.reason)||'Há uma edição protegida para revisar.'} A recarga não reenvia automaticamente. <Button variant="outline" onClick={onOpen}>Resolver salvamento</Button>
  </AlertDescription></Alert>}
  {open&&<Modal title="Recuperar salvamento" onClose={()=>{if(!busy)onClose();}}><div className="flex flex-col gap-3 min-w-0 break-words">
   {row&&<p>Edição protegida em {new Date(row.createdAt).toLocaleString('pt-BR')}.</p>}
   <p>Salve ou cancele os outros formulários antes de recuperar. {row?'Fechar mantém a edição protegida.':'Não feche a aba sem proteger a edição.'}</p>
   {(error||reviewError)&&<Alert variant="destructive"><AlertDescription>{error||reviewError}</AlertDescription></Alert>}{notice&&<Alert><AlertDescription>{notice}</AlertDescription></Alert>}
   {((queue.getFailure()?.status===401&&!sessionRenewed)||authRequired)&&<SessionRenewalFields user={user} busy={busy} onRenew={async password=>{
    const result=await renewEditingSession({email:user.email,password,userId:user.id});
    if(!result.ok){setError(result.error);return;}
    onUser(result.usuario||user);setAuthRequired(false);setSessionRenewed(true);setCurrent(null);setError('');setNotice('Acesso renovado. Consulte a versão atual antes de salvar.');
   }}/>}
   {(memoryCount||queue.getFailure()?.local)&&<>
    <p>{memoryCount?`${memoryCount} preenchimento(s) ainda estão apenas na memória.`:'Edição somente na memória.'} Verifique o armazenamento.</p>
    <Button disabled={busy||sending} onClick={async()=>{
     setBusy(true);
     try{
      if(memoryCount){const result=await onProtectMemory();setError(result.ok?'':result.reason);}
      else{queue.resume();const result=await queue.waitForIdle();if(result.ok){onRecovered();onClose();}}
     }finally{setBusy(false);}
    }}>{memoryCount?'Proteger preenchimentos':'Proteger e reenviar edição'}</Button>
    <Button variant="destructive" disabled={busy||sending} onClick={onDiscardMemory}>Descartar edição da memória</Button>
   </>}
   <Button variant="outline" disabled={busy||sending||queue.getFailure()?.local} onClick={consult}>{busy?'Aguarde…':'Consultar versão atual'}</Button>
   {review&&<>
    <p>{review.conflicts.length?'Escolha o valor de cada campo em conflito.':'Confira os valores.'}</p>
    {review.changes.map(change=>{
     const heading=pathLabel(change.path,current.data,expanded);
     return <section key={change.key}>
      <p><strong>{heading}</strong></p><p>Sua edição: {change.local===undefined?'Excluir este registro ou campo':label(change.local)}</p><p>Servidor: {change.current===undefined?'Não consta na versão atual':label(change.current)}</p>
      <Select label={`Usar valor em ${heading}`} value={choices[change.key]||change.choice||''} onChange={event=>setChoices(v=>({...v,[change.key]:event.target.value}))}>
       <option value="">Escolha uma opção</option><option value="local">Usar minha edição</option><option value="current">Manter servidor</option>
      </Select>
     </section>;
    })}
    <Button disabled={busy||sending||!!memoryCount||!review.ready} onClick={save}>{review.changes.length?'Salvar alterações revisadas':'Concluir conferência'}</Button>
   </>}
   {!row&&!queue.hasPending()&&!memoryCount&&<Button variant="outline" disabled={busy} onClick={async()=>{
    try{snapshotJournal.db.close();await snapshotJournal.db.open();await snapshotJournal.readLatest(user.id,recoveryTab());onReady(true);setError('');onClose();}
    catch{setError('Armazenamento indisponível. Mantenha esta aba aberta.');}
   }}>Verificar armazenamento</Button>}
   {row&&<Button variant="outline" disabled={busy||sending||queue.getFailure()?.local} onClick={()=>onDiscard(row)}>Descartar edição protegida</Button>}
  </div></Modal>}
 </>;
}
