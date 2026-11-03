import {DataTable} from '../../../design-system/data/DataTable.jsx';
import {useMemo,useState} from 'react';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {Alert,AlertDescription} from '../../../components/ui/alert.jsx';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {useWorkspaceState} from '../../../features/workflow/workspace-session.jsx';
import {BASELINE_COMMAND,baselineRecords,approvedVersions,proposeBaselineSnapshot,scheduleSpi} from '../approved-baseline.js';
import {uid,today} from '../../../legacy/format.js';
import {contar} from '../../../design-system/copy.js';

const money=value=>value==null?'Não disponível':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>!value?'Não informada':value.includes('T')?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date(value)):value.slice(0,10).split('-').reverse().join('/');
function BaselineTable({title,headers,rows}){return <section aria-label={title}><h3>{title}</h3><DataTable data={rows.map((row,index)=>({id:String(index),values:row}))} columns={headers.map((header,index)=>({key:String(index),header,sortable:false,hideable:false,render:row=>row.values[index]}))} pagination={{pageSize:Math.max(20,rows.length)}} emptyMessage="Nenhum registro nesta versão."/></section>;}
export default function ApprovedBaselinePanel({data,obraId,currentUser,dispatchCommand}){
 const [state,setState]=useWorkspaceState('plan','approvedBaseline',{open:false,selected:'',reason:'',asOf:today()},obraId);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useHelpTopic('plan',state.open?'plan_baseline':'plan');
 const proposal=useMemo(()=>proposeBaselineSnapshot(data,obraId),[data,obraId]);
 const records=baselineRecords(data,obraId),latest=approvedVersions(data,obraId).at(-1);
 const selected=records.find(row=>row.id===state.selected)||latest||records.at(-1);
 const spi=scheduleSpi(data,{obraId,asOf:state.asOf,baselineId:selected?.status==='aprovada'?selected.id:undefined});
 const canPropose=['admin','diretoria','engenheiro','engenheiro_auditor','planejamento'].includes(currentUser?.role);
 const canApprove=['admin','diretoria'].includes(currentUser?.role);
 const update=patch=>setState(previous=>({...previous,...patch}));
 async function command(type){
  if(!dispatchCommand){setMessage('Conecte-se ao servidor para gravar a proposta ou aprovação.');return;}
  setBusy(true);setMessage('');
  const id=type===BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED?uid():selected?.id;
  try{
   const result=await dispatchCommand(()=>({type,idempotencyKey:`linha-base-${type}-${uid()}`,expectedVersion:type===BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED?Math.max(0,...records.map(row=>row.number)):selected.version,payload:{obraId,id,signature:proposal.signature,reason:state.reason}}));
   if(!result?.ok)setMessage(result?.reason||result?.error||'Não foi possível gravar. Confira a conexão e atualize os dados.');
   else{update({selected:id,reason:''});setMessage(type===BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED?'Proposta registrada. Confira os itens antes de solicitar a aprovação.':'Linha de base aprovada. As versões anteriores foram preservadas.');}
  }catch(error){setMessage(error.message||'Falha ao gravar a linha de base. Tente novamente.');}finally{setBusy(false);}
 }
 return <details open={state.open} onToggle={event=>{if(event.currentTarget.open!==state.open)update({open:event.currentTarget.open});}}>
  <summary>Linha de base aprovada e SPI</summary>
  <FormSection title="Versões da linha de base" description="Congele datas, calendário e pesos do orçamento aprovado. Propor não aprova; somente administrador ou diretoria podem aprovar. Cada revisão preserva as versões anteriores.">
   {message&&<Alert><AlertDescription>{message}</AlertDescription></Alert>}
   {!proposal.ok&&<Alert variant="warning"><AlertDescription>{proposal.reason} Ajuste a origem antes de preparar a proposta.</AlertDescription></Alert>}
   {canPropose&&<>
    <Textarea label="Justificativa da proposta ou revisão" value={state.reason} onChange={event=>update({reason:event.target.value})} description="Explique a aprovação inicial ou a mudança de datas, calendário e escopo. Mínimo de 10 caracteres."/>
    <p>Proposta atual: {proposal.ok?`${proposal.snapshot.activities.length} atividades, ${contar(proposal.snapshot.items.length,'item','itens')} com valor; orçamento ${money(proposal.snapshot.budgetCents)}.`:'Base ainda não calculável.'} O valor planejado será distribuído linearmente pelos dias trabalhados do calendário congelado; esta é uma premissa de planejamento que deve ser conferida antes de aprovar.</p>
    <Button disabled={busy||!proposal.ok||state.reason.trim().length<10} onClick={()=>command(BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED)}>Preparar proposta de linha de base</Button>
   </>}
   {records.length?<>
    <FilterBar label="Consulta das versões da linha de base" layout="grid">
     <Select label="Versão da linha de base" value={selected?.id||''} onChange={event=>update({selected:event.target.value})} options={records.map(row=>({value:row.id,label:`V${row.number} · ${row.status==='aprovada'?'Aprovada':'Proposta'}${latest?.id===row.id?' · vigente':''}`}))}/>
     <Input label="Referência do SPI" type="date" value={state.asOf} onChange={event=>update({asOf:event.target.value})}/>
    </FilterBar>
    <p>V{selected?.number} · {selected?.reason} · proposta por {selected?.createdBy||'Autor não informado'} em {date(selected?.createdAt)}. {selected?.status==='aprovada'?`Aprovada por ${selected.approvedBy} em ${date(selected.approvedAt)}. Conteúdo imutável.`:'Proposta ainda sem efeito no SPI.'}</p>
    {selected?.status==='rascunho'&&canApprove&&<Button disabled={busy||!proposal.ok||proposal.signature!==selected.sourceSignature} onClick={()=>command(BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED)}>Aprovar linha de base V{selected.number}</Button>}
    {selected?.status==='rascunho'&&proposal.signature!==selected.sourceSignature&&<Alert variant="warning"><AlertDescription>As fontes mudaram desde esta proposta. Prepare uma nova proposta; não será possível aprovar valores desatualizados.</AlertDescription></Alert>}
    <BaselineTable title="Histórico das linhas de base" headers={['Versão','Situação','Orçamento congelado','Proposta','Aprovação','Justificativa']} rows={records.map(row=>[`V${row.number} · ${row.id}`,row.status==='aprovada'?(row.id===latest?.id?'Aprovada vigente':'Aprovada anterior'):'Proposta',money(row.snapshot.budgetCents),`${row.createdBy} · ${date(row.createdAt)}`,row.approvedBy?`${row.approvedBy} · ${date(row.approvedAt)}`:'Aguardando aprovação',row.reason])}/>
    <details><summary>Conferir itens e calendário congelados</summary>
     <p>Dias da semana trabalhados: {selected?.snapshot.calendar.weekdays.map(day=>['domingo','segunda','terça','quarta','quinta','sexta','sábado'][day]).join(', ')}. Feriados excluídos: {selected?.snapshot.calendar.holidays.map(date).join(', ')||'Nenhum'}. Atividades sem valor não afetam o SPI.</p>
     <BaselineTable title="Itens congelados da versão" headers={['Item / atividade','Início','Fim','Quantidade','Peso orçamentário']} rows={(selected?.snapshot.items||[]).map(item=>[`${item.name} · ${item.id} / ${item.taskId}`,date(item.start),date(item.finish),`${item.quantity} ${item.unit}`,money(item.budgetCents)])}/>
    </details>
    {selected?.status==='aprovada'&&<><h3>SPI da versão consultada</h3><p>SPI: {spi.spi===null?'Não disponível':spi.spi.toLocaleString('pt-BR',{maximumFractionDigits:3})} · valor planejado: {money(spi.pv)} · valor agregado: {money(spi.ev)}. {spi.reason||'Abaixo de 1: valor agregado inferior ao planejado. Acima de 1: superior. Não converte desempenho em dias de atraso.'}</p></>}
   </>:<p>Nenhuma versão registrada. Prepare uma proposta, confira os itens e solicite aprovação. Fotografias antigas de datas não são convertidas automaticamente em versões aprovadas.</p>}
  </FormSection>
 </details>;
}
