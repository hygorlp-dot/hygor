import {useEffect,useState} from 'react';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {ChoiceControl} from '../../../design-system/primitives/ChoiceControl.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {workforceReserveConfig,calculateWorkforceReserve} from '../../financeiro/workforce-reserve.js';
import {OPERATIONAL_COMMAND} from '../../sync/operational-commands.js';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {uid,fmt} from '../../../legacy/format.js';
const fields=[['employerPercent','Encargos patronais: CPP, RAT e terceiros (%)'],['fgtsPercent','FGTS (%)'],['finePercent','Multa do FGTS (%)'],['tenureMonths','Permanência média (meses)'],['dismissalPercent','Desligamentos sem justa causa (%)'],['noticePercent','Avisos indenizados (%)'],['noticeDays','Dias de aviso prévio']];
export function WorkforceReserveSettings({data,currentUser,dispatchCommand,showToast}){
 useHelpTopic('folha','folha_repasse',1);
 const [draft,setDraft]=useState(()=>workforceReserveConfig(data.config)),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>setDraft(workforceReserveConfig(data.config)),[data.config?.workforceReserve,data.config?.laborCharges]);
 const canEdit=currentUser?.role==='admin';
 const preview=calculateWorkforceReserve(100,{...data.config,workforceReserve:draft});
 const save=async()=>{
  if(!canEdit||saving||preview.errors.length)return;
  setSaving(true);setError('');
  try{
   const settings={enabled:draft.enabled,...Object.fromEntries(fields.map(([key])=>[key,Number(draft[key])]))};
   const result=await dispatchCommand(current=>({type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,idempotencyKey:`reserva-repasse-${uid()}`,expectedVersion:Number(current.config?.version||0),payload:{config:{...current.config,workforceReserve:settings}}}));
   if(!result?.ok)throw new Error(result?.reason||'Não foi possível salvar os parâmetros.');
   showToast('Parâmetros do repasse salvos. Nenhuma folha ou cobrança foi emitida.');
  }catch(failure){setError(failure.message);}finally{setSaving(false);}
 };
 return <FormSection title="Reservas no repasse ao cliente" description="Estimativa sobre a remuneração apropriada à obra. Parâmetros do modelo profissional/servente, ajustáveis pela administração.">
 <label><ChoiceControl type="checkbox" checked={draft.enabled} disabled={!canEdit||saving} onChange={event=>setDraft(value=>({...value,enabled:event.target.checked}))}/> Usar o modelo de encargos e reservas no repasse previsto</label>
 <div className="payroll-union__fields">{fields.map(([key,label])=><Input key={key} label={label} type="number" min={key==='tenureMonths'?0.01:0} max={key.endsWith('Percent')?100:undefined} step="0.01" value={draft[key]} disabled={!canEdit||saving} onChange={event=>setDraft(value=>({...value,[key]:event.target.value}))}/>)}</div>
 <p>Inclui 13º, férias e um terço, encargos dessas verbas, aviso indenizado, reflexos do aviso e multa do FGTS. EPI, uniformes, exames de admissão/demissão e demais serviços de segurança são compras ou despesas reais da obra; não entram nesta reserva.</p>
 {preview.errors.length?<Alert variant="destructive"><AlertDescription>{preview.errors.join(' ')}</AlertDescription></Alert>:<p>Para cada R$ 100 de remuneração: encargos mensais estimados {fmt(preview.ordinaryCharges)} e reserva estimada {fmt(preview.monthly)}. O que já está incluído no custo da obra é descontado para não cobrar em duplicidade.</p>}
 <p>Este ajuste não altera o vínculo do funcionário, o ponto, a folha fechada nem o custo já reconhecido no DRE. Os valores do portal são previsões para conferência antes da emissão.</p>
 {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
 <Button variant="secondary" disabled={!canEdit||saving||preview.errors.length>0} loading={saving} onClick={save}>Salvar parâmetros do repasse</Button>
 </FormSection>;
}
