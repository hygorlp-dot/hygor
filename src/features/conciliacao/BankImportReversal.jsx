import {useRef,useState} from 'react';
import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Textarea} from '../../design-system/primitives/Textarea.jsx';
import {Checkbox} from '../../design-system/primitives/Checkbox.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {Button} from '../../components/ui/button.jsx';
import {contar} from '../../design-system/copy.js';
import {fmtDate} from '../../legacy/format.js';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import FinancialPreview from '../financeiro/FinancialPreview.jsx';
import {BANK_IMPORT_REVERSED,previewBankReversal} from '../../domains/conciliacao/import-reversal.js';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';

export default function BankImportReversal({data,statementId,user,dispatchCommand,onClose}){
 useHelpTopic('conc','conc_reverter',1);
 const [plan,setPlan]=useState(()=>previewBankReversal(data,statementId));
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const retry=useRef(null),guard=useUnsavedChanges({reason,confirmed},onClose,{busy,identity:statementId});
 const canReverse=user?.role==='admin'&&!user.obraId;
 const save=async()=>{
  if(busy||!confirmed||!canReverse||!dispatchCommand)return;
  const payload={statementId,expectedVersion:Number(plan.statement.version),reason:reason.trim(),targets:plan.eligible.map(({transaction:t})=>({id:String(t.id),expectedVersion:Number(t.version)}))};
  const signature=JSON.stringify(payload);
  if(retry.current?.signature!==signature)retry.current={signature,key:'bank-reversal-'+crypto.randomUUID()};
  setBusy(true);setError('');
  try{
   const result=await dispatchCommand(()=>({type:BANK_IMPORT_REVERSED,idempotencyKey:retry.current.key,payload}));
   if(!result?.ok)throw Error(result?.reason||result?.error||'Não foi possível confirmar. Preserve a justificativa e tente novamente.');
   onClose();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const download=()=>{const a=document.createElement('a');a.href=plan.statement.originalFile.dataUrl;a.download=plan.statement.arquivo;a.click();};
 return <><Dialog open onOpenChange={open=>{if(!open)guard.requestClose();}} title="Reverter importação bancária">
  <HelpButton pageId="conc_reverter" allowedTabs={['conc']} label="Ajuda da reversão"/>
  <FormSection title={plan.statement?.arquivo||'Extrato indisponível'} description="Somente extratos bancários. Demais origens de importação exigem revisão específica nesta etapa.">
   <p>{contar(plan.eligible.length,'movimento reversível','movimentos reversíveis')} · {contar(plan.rows.length-plan.eligible.length,'movimento protegido','movimentos protegidos')}. Reverter retira apenas pendências sem uso; não estorna pagamento, conciliação, receita ou custo no DRE. O original e os registros permanecem auditáveis.</p>
   <Button variant="outline" disabled={busy||!plan.originalAvailable} onClick={download}>Baixar original</Button>
   <Button variant="outline" disabled={busy} onClick={()=>{setPlan(previewBankReversal(data,statementId));setConfirmed(false);setError('');}}>Atualizar prévia</Button>
   <Textarea label="Justificativa da reversão" value={reason} minLength={5} maxLength={1000} required disabled={busy||!canReverse} onChange={e=>setReason(e.target.value)}/>
   <Checkbox label="Conferi os movimentos reversíveis e os protegidos" checked={confirmed} disabled={busy||!canReverse} onChange={e=>setConfirmed(e.target.checked)}/>
   {!canReverse&&<p role="status">Somente administrador sem restrição de obra pode confirmar a reversão.</p>}
  </FormSection>
  {error&&<Alert variant="warning"><AlertDescription>{error}</AlertDescription></Alert>}
  <FinancialPreview description="Prévia congelada na versão consultada. O servidor confere novamente o lote e o uso de cada movimento antes de gravar."
   columns={['Movimento','Data','Valor','Resultado']} rows={plan.rows.map(({transaction:t,reason:blocked})=>({id:t.id,cells:[t.descricao,fmtDate(t.data),Number(t.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),blocked||'Reversível — pendência sem uso']}))}
   error={plan.error} pending={busy} disabled={!canReverse||!confirmed||reason.trim().length<5||!plan.eligible.length||!dispatchCommand}
   onCancel={guard.requestClose} onConfirm={()=>void save()} confirmLabel={`Reverter ${contar(plan.eligible.length,'movimento','movimentos')}`}/>
 </Dialog><UnsavedChangesPrompt guard={guard}/></>;
}
