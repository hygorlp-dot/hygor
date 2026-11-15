import FinancialColumnsHelp from './FinancialColumnsHelp.jsx';
import {tableColumnsKey} from '../../design-system/data/useTableColumns.js';
import {useMemo,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Checkbox} from '../../design-system/primitives/Checkbox.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {DataTable} from '../../design-system/data/DataTable.jsx';
import {RecordAction} from '../../design-system/primitives/RecordAction.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {Modal} from '../../legacy/ui.jsx';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {thirdPartyMeasurementFinancialPanels} from '../../domains/terceirizados/measurement-workspace.js';
import {technicalRetentionCents} from '../../domains/terceirizados/technical-retention.js';
import {calculateWithholdings} from '../../domains/terceirizados/withholdings.js';
import {OPERATIONAL_COMMAND as C} from '../../domains/sync/operational-commands.js';
import {today} from '../../legacy/format.js';

const money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const label=m=>'Medição '+(m.numero||m.id);
const state=row=>!technicalRetentionCents(row.measurement)?'Sem garantia definida':row.measurement.status!=='aprovada'?'Aguardando aprovação':row.guarantee?.balanceCents===0?'Garantia baixada':row.measurement.technicalRetention?.release?'Liberada para pagamento':'Retida até cumprir condição';
export default function TechnicalRetentions({data,obraId,measurementId,user,dispatchCommand}){
 const [selected,setSelected]=useState(null);
 const models=useMemo(()=>measurementId&&!selected?new Map():thirdPartyMeasurementFinancialPanels(data),[data,measurementId,selected]);
 const rows=[...models.values()].filter(row=>row.measurement.obraId===obraId&&(!measurementId||row.measurement.id===measurementId)&&!['cancelada','estornada'].includes(row.measurement.status)).map(row=>({...row,id:row.measurement.id,name:label(row.measurement),contract:(data.terceirizados||[]).find(c=>c.id===row.measurement.tercId)?.name||'Contrato indisponível'}));
 const columns=[
  {key:'name',header:'Medição',render:row=><RecordAction aria-label={'Conferir garantia de '+row.name} onClick={()=>setSelected(row.id)}>{row.name} · {row.contract}</RecordAction>},
  {key:'gross',header:'Bruto medido',render:row=>money(Math.round(Number(row.measurement.total)*100))},
  {key:'retained',header:'Garantia definida',render:row=>money(technicalRetentionCents(row.measurement))},
  {key:'balance',header:'Saldo da garantia',render:row=>money(row.guarantee?.balanceCents||0)},
  {key:'state',header:'Situação',render:state},
 ].map(column=>({...column,hideable:!['name','state'].includes(column.key),sortable:false}));
 const selectedModel=selected?models.get(selected):null;
 return <section aria-label={measurementId?'Garantia da medição':'Garantias técnicas das medições'}>
  {measurementId?<Button variant="outline" onClick={()=>setSelected(measurementId)}>Conferir garantia técnica</Button>:<details><summary>Garantias técnicas das medições ({rows.length})</summary>
   <p>O bruto continua sendo o custo da medição. Garantia técnica não é ISS ou INSS; fica separada até liberação expressa. Contrato, beneficiário e obra vêm da medição.</p>
   <DataTable columnsHelp={<FinancialColumnsHelp/>} columnPreferenceKey={tableColumnsKey(user,data.config,'fin-guarantees')} data={rows} columns={columns} search={{placeholder:'Pesquisar medição ou contrato',fields:['name','contract']}} emptyMessage="Nenhuma medição disponível nesta obra."/>
  </details>}
  {selectedModel&&<RetentionEditor key={selected} data={data} model={selectedModel} user={user} dispatchCommand={dispatchCommand} onClose={()=>setSelected(null)}/>}
 </section>;
}
function RetentionEditor({data,model,user,dispatchCommand,onClose}){
 useHelpTopic('fin','terc_garantia',2);useHelpTopic('terc','terc_garantia',2);
 const [initial]=useState(()=>({model,data}));
 const m=initial.model.measurement,retention=m.technicalRetention,held=technicalRetentionCents(m);
 const contract=(initial.data.terceirizados||[]).find(c=>c.id===m.tercId);
 const [form,setForm]=useState(()=>({mode:!held?'define':!m.pagamentoId&&held<Math.round(Number(m.total)*100)?'principal':!retention?.release?'release':'pay',amount:String(held/100),condition:retention?.condition||'',reason:'',date:today(),dueDate:today(),evidence:'',confirmed:false,riskAccepted:false,payer:''}));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),retry=useRef(null);
 const canEdit=dispatchCommand&&['admin','financeiro'].includes(user?.role);
 const guard=useUnsavedChanges(form,onClose,{busy,identity:m.id});
 const set=(key,value)=>setForm(old=>({...old,[key]:value}));
 const payments=(initial.data.pagsTerceiros||[]).filter(p=>p.medicaoTercId===m.id);
 const preview=calculateWithholdings(m.total,contract,held),gross=Math.round(Number(m.total)*100);
 const send=async reverse=>{
  if(busy||!canEdit)return;
  const type=reverse?C.THIRD_PARTY_PAYMENT_REVERSED:({define:C.THIRD_PARTY_RETENTION_SAVED,release:C.THIRD_PARTY_RETENTION_RELEASED,principal:C.THIRD_PARTY_MEASUREMENT_PAID,pay:C.THIRD_PARTY_RETENTION_PAID})[form.mode];
  const payload=reverse?{paymentId:reverse.id,reason:form.reason}:{measurementId:m.id,reason:form.reason,...(form.mode==='define'?{amountCents:Math.round(Number(form.amount)*100),condition:form.condition}:form.mode==='release'?{date:form.date,dueDate:form.dueDate,evidence:form.evidence,conditionConfirmed:form.confirmed}:{riskAccepted:form.riskAccepted,payment:{date:form.date,pagador:form.payer}})};
  const signature=JSON.stringify({type,payload});
  if(retry.current?.signature!==signature)retry.current={signature,key:'retention-'+crypto.randomUUID(),paymentId:'retention-payment-'+crypto.randomUUID()};
  if(payload.payment)payload.payment.id=retry.current.paymentId;
  setBusy(true);setError('');
  try{
   const result=await dispatchCommand(()=>({type,idempotencyKey:retry.current.key,expectedVersion:Number(reverse?.version??m.version??0),actorId:user.id,actorName:user.nome,actorRole:user.role,payload}));
   if(!result?.ok)throw Error(result?.reason||result?.error||'Não foi possível confirmar. Preserve o formulário e tente novamente.');
   onClose();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <><Modal title={'Garantia técnica · '+label(m)} onClose={guard.requestClose}>
  <HelpButton pageId="terc_garantia" allowedTabs={['terc','fin']} label="Ajuda da garantia técnica"/>
  <p>{contract?.name||'Contrato indisponível'} · {(initial.data.obras||[]).find(w=>w.id===m.obraId)?.name||m.obraId}. Beneficiário: {retention?.beneficiaryName||contract?.name||'Não disponível'}.</p>
  <FormSection title="Valores da origem" description="Bruto, tributos e beneficiário são reaproveitados; não há outro cadastro de contrato.">
   <p>Bruto medido: {money(gross)} · obrigação reconhecida: {money(initial.model.recognizedCents)} · baixado: {money(initial.model.settledCents)}.</p>
   <p>ISS: {money(Math.round(preview.issRetido*100))} · INSS: {money(Math.round(preview.inssRetido*100))} · garantia: {money(held)} · líquido previsto do principal: {money(Math.round(preview.liquido*100))}.</p>
   <p>Saldo total da obrigação: {money(initial.model.balanceCents)} · saldo da garantia: {money(initial.model.guarantee?.balanceCents||0)} · {state(initial.model)}.</p>
  </FormSection>
  <Alert><AlertDescription>O DRE reconhece o bruto uma vez, após aprovação. Definir, liberar e pagar a garantia não cria outro custo. A garantia fica sem vencimento no caixa até sua liberação. Tributos não são retidos novamente no pagamento da garantia.</AlertDescription></Alert>
  {canEdit?<form onSubmit={e=>{e.preventDefault();void send();}}><fieldset disabled={busy}><legend>Operação da garantia</legend>
   <Select label="Operação da medição" value={form.mode} onChange={e=>set('mode',e.target.value)} options={[
    {value:'define',label:'Definir ou remover garantia'},
    {value:'principal',label:'Registrar pagamento do principal'},
    {value:'release',label:'Liberar garantia técnica'},
    {value:'pay',label:'Registrar pagamento da garantia'},
   ]}/>
   {form.mode==='define'?<FormSection title="Condição da garantia">
    <Input label="Garantia técnica da medição (R$)" type="number" min="0" max={gross/100} step="0.01" required value={form.amount} onChange={e=>set('amount',e.target.value)}/>
    <Input label="Condição de liberação" minLength={Number(form.amount)>0?5:0} maxLength={2000} required={Number(form.amount)>0} value={form.condition} onChange={e=>set('condition',e.target.value)}/>
    <p>Use zero para remover antes de qualquer baixa ou liberação. Medições já baixadas exigem conciliação e estorno na origem; o histórico permanece.</p>
   </FormSection>:<>
    <Input label={form.mode==='release'?'Data da liberação':'Data do pagamento'} type="date" value={form.date} required onChange={e=>set('date',e.target.value)}/>
    {form.mode==='release'?<FormSection title="Conferência da liberação" description={retention?.condition||'Defina uma garantia e sua condição antes de liberar.'}>
     <Input label="Vencimento da garantia liberada" type="date" required value={form.dueDate} onChange={e=>set('dueDate',e.target.value)}/>
     <Input label="Evidência da condição cumprida" minLength={5} maxLength={2000} required value={form.evidence} onChange={e=>set('evidence',e.target.value)}/>
     <Checkbox label="Conferi que a condição de liberação foi cumprida" checked={form.confirmed} onChange={e=>set('confirmed',e.target.checked)}/>
    </FormSection>:<>
     <Select label="Quem realizou o pagamento" required value={form.payer} onChange={e=>set('payer',e.target.value)} options={[{value:'',label:'Escolha o pagador'},{value:'empresa',label:'Empresa'},{value:'obra',label:'Obra'}]}/>
     <p>Valor do pagamento: {money(form.mode==='pay'?held:Math.round(preview.liquido*100))}. Valor reaproveitado da medição, sem redigitar.</p>
     {form.mode==='principal'&&!m.fotos?.length&&<Checkbox label="Aceito o pagamento do principal sem evidência fotográfica" checked={form.riskAccepted} onChange={e=>set('riskAccepted',e.target.checked)}/>}
    </>}
   </>}
   <Input label="Justificativa da operação" required minLength={5} maxLength={2000} value={form.reason} onChange={e=>set('reason',e.target.value)}/>
   <Button type="submit" disabled={form.reason.trim().length<5||form.mode==='release'&&!form.confirmed}>{busy?'Confirmando…':({define:'Salvar garantia técnica',release:'Confirmar liberação da garantia',principal:'Confirmar pagamento do principal',pay:'Confirmar pagamento da garantia'})[form.mode]}</Button>
  </fieldset></form>:<p>Consulta da garantia. Somente administrador ou financeiro pode definir, liberar e registrar baixas.</p>}
  {error&&<p role="alert">{error}</p>}
  <details><summary>Histórico da garantia e pagamentos</summary>
   <ul>{(m.technicalRetentionHistory||[]).map((entry,i)=><li key={i}>{({defined:'Garantia definida',released:'Garantia liberada',paid:'Pagamento da garantia'})[entry.kind]||entry.kind} · {entry.at} · {entry.by}: {entry.reason}</li>)}</ul>
   {!m.technicalRetentionHistory?.length&&<p>Sem operações de garantia registradas.</p>}
   {payments.map(payment=><p key={payment.id}>{payment.guaranteePayment?'Garantia':'Principal'} · {money(Math.round(Number(payment.liquido??payment.amount)*100))} · {payment.date||payment.data} · {payment.status||'ativo'} {canEdit&&payment.status!=='estornado'&&<Button type="button" variant="outline" disabled={busy||form.reason.trim().length<5} onClick={()=>void send(payment)}>Estornar baixa {payment.id}</Button>}</p>)}
   <p>Para estornar, informe a justificativa da operação acima. Desfaça a conciliação bancária antes de estornar uma baixa conciliada.</p>
  </details>
 </Modal><UnsavedChangesPrompt guard={guard}/></>;
}
