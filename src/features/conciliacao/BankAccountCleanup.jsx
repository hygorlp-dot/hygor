import {useEffect,useRef,useState} from 'react';
import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Textarea} from '../../design-system/primitives/Textarea.jsx';
import {Checkbox} from '../../design-system/primitives/Checkbox.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {preverLimpezaConciliacaoLocal,apagarConciliacaoLocal} from '../../api.js';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {fmt} from '../../legacy/format.js';
import {contar} from '../../design-system/copy.js';

export default function BankAccountCleanup({scope,user,update,onClose,showToast}){
  useHelpTopic('conc','conc_apagar_local',1);
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[reason,setReason]=useState(''),[confirmation,setConfirmation]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  const retry=useRef(null),guard=useUnsavedChanges({reason,confirmation,confirmed},onClose,{busy,identity:scope});
  const allowed=user?.role==='admin'&&!user.obraId;
  useEffect(()=>{let active=true;preverLimpezaConciliacaoLocal(scope).then(result=>{if(!active)return;if(result?.ok)setPreview(result.preview);else setError(result?.error||'Não foi possível conferir a conta.');}).catch(()=>{if(active)setError('Não foi possível carregar a prévia.');});return()=>{active=false;};},[scope]);
  const save=async()=>{
    if(busy||!preview||!allowed||!confirmed||confirmation!==preview.label)return;
    const command={scope,reason:reason.trim(),confirmation,expectedRevision:preview.revision};
    const signature=JSON.stringify(command);if(retry.current?.signature!==signature)retry.current={signature,key:'bank-cleanup-'+crypto.randomUUID()};
    setBusy(true);setError('');
    try{
      const result=await apagarConciliacaoLocal({...command,idempotencyKey:retry.current.key});
      if(!result?.ok)throw new Error(result?.error||'A limpeza não foi confirmada. Atualize os dados e confira a conta.');
      await update({__adotarServidor:true,data:result.data,updatedAt:result.updatedAt});
      showToast('Conciliação e valores criados por ela apagados somente na cópia local.');onClose();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <><Dialog open title="Apagar conciliação e valores" onOpenChange={open=>{if(!open)guard.requestClose();}}>
    <FormSection title={preview?.label||'Conferindo a conta'} description="Simulação local. A base publicada e os arquivos originais permanecem intactos.">
      {preview&&<>
        <p>{contar(preview.counts.statements,'extrato','extratos')}, {contar(preview.counts.transactions,'movimento','movimentos')} e {contar(preview.counts.generated,'valor criado','valores criados')} pela conciliação serão retirados desta cópia. O cadastro da conta permanece.</p>
        <p>Entradas: {fmt(preview.values.credits)}. Saídas: {fmt(preview.values.debits)}. Valores gerados a remover: {fmt(preview.values.generated)}.</p>
        <p>Redução de custos no DRE: {fmt(preview.values.removedCosts)}. Redução de receitas reconhecidas: {fmt(preview.values.removedRevenue)}. Pagamentos e recebimentos preexistentes serão apenas desvinculados.</p>
        <p>Uma cópia anterior à limpeza ficará preservada fora da área operacional da simulação. Nenhuma exclusão será enviada à nuvem.</p>
        {!!preview.blockers.length&&<Alert variant="warning"><AlertDescription>{preview.blockers.join(' ')}</AlertDescription></Alert>}
      </>}
      <Textarea label="Justificativa da limpeza" value={reason} required minLength={10} maxLength={1000} disabled={busy||!allowed} onChange={event=>setReason(event.target.value)}/>
      <Input label="Digite o nome da conta ou do grupo" description={preview?`Digite: ${preview.label}`:''} value={confirmation} disabled={busy||!preview||!allowed} onChange={event=>setConfirmation(event.target.value)}/>
      <Checkbox label="Conferi os valores e autorizo apagar somente na cópia local" checked={confirmed} disabled={busy||!allowed} onChange={event=>setConfirmed(event.target.checked)}/>
      {error&&<Alert variant="warning"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={guard.requestClose}>Cancelar</Button>
        <Button variant="destructive" disabled={busy||!allowed||!preview||!!preview.blockers.length||!confirmed||confirmation!==preview.label||reason.trim().length<10||!preview.counts.transactions} onClick={save}>{busy?'Apagando na cópia local…':'Apagar na cópia local'}</Button>
      </div>
    </FormSection>
  </Dialog><UnsavedChangesPrompt guard={guard}/></>;
}
