import {useRef,useState} from 'react';
import {Button} from '../../../components/ui/button.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';
import {RecordPanel} from '../../../features/workflow/RecordPanel.jsx';
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {fmtDateFull} from '../../../legacy/format.js';

const statusLabels={em_andamento:'Aguardando aprovação',bloqueada:'Aguardando configuração',
 aprovada:'Aprovada',reprovada:'Reprovada'};
const dateLabel=value=>typeof value==='string'&&value?fmtDateFull(value.slice(0,10)):'Sem prazo informado';

export default function PurchaseApprovalPanel({request,data,user,onClose,onDecide}){
 useHelpTopic('cmp','cmp_aprovacoes',20);
 const [notes,setNotes]=useState({});
 const [saving,setSaving]=useState(null);
 const [confirmed,setConfirmed]=useState({});
 const inFlight=useRef(false);
 const instance=(data.instanciasAprovacao||[]).find(item=>item.id===request.aprovacaoInstanciaId&&
  (!item.entidadeId||item.entidadeId===request.id)&&(!item.entidadeTipo||item.entidadeTipo==='solicitacaoCompra'));
 const policySteps=Array.isArray(instance?.snapshotPolitica?.etapas)?instance.snapshotPolitica.etapas:[];
 const history=(data.decisoesAprovacao||[]).filter(item=>instance&&item.instanciaId===instance.id);
 const pending=instance?.status==='em_andamento'?(instance.resultadosEtapas||[]).flatMap((result,index)=>{
  if(result?.status!=='em_andamento')return [];
  const step=policySteps[index];
  const eligible=result.aprovadoresElegiveis||[];
  const configured=Boolean(step?.id&&(!result.etapaId||result.etapaId===step.id));
  const decided=confirmed[step?.id]||history.some(item=>item.etapaId===step?.id&&item.aprovadorId===user?.id);
  return [{
   id:result.etapaId||step?.id||index,
   stepId:step?.id,
   name:configured?(step.nome||'Etapa de aprovação'):result.etapaId==='fila_administrativa'?'Fila administrativa':'Etapa sem configuração',
   names:[...new Set(eligible.map(person=>person.nome||person.email).filter(Boolean))],
   due:result.vencimentoEm,
   configured,
   decided,
   canDecide:configured&&!decided&&eligible.some(person=>person.id===user?.id),
  }];
 }):[];
 const needsConfiguration=!instance||instance.status==='bloqueada'||(instance.status==='em_andamento'&&!pending.some(stage=>stage.configured));
 const next=needsConfiguration?'Peça à Administração para conferir a configuração da aprovação desta solicitação.'
  :instance.status==='aprovada'?'Confira a solicitação para continuar o fluxo de Compras.'
  :instance.status==='reprovada'?'Confira o motivo no histórico e alinhe a revisão com o solicitante.'
  :pending.some(stage=>stage.canDecide)?'Revise os materiais e registre sua decisão na etapa em que você é aprovador.'
  :'Acompanhe a decisão dos aprovadores indicados abaixo.';
 const number=request.numero||request.id;
 const obra=data.obras?.find(item=>item.id===request.obraId)?.name||'Obra não informada';
 const decide=async(stage,decision)=>{
  if(inFlight.current||!stage.canDecide)return;
  inFlight.current=true;
  setSaving(stage.id);
  try{
   if(await onDecide(instance,stage.stepId,decision,decision==='reprovado'?notes[stage.id]:'')){
    setConfirmed(previous=>({...previous,[stage.stepId]:true}));
   }
  }finally{
   inFlight.current=false;
   setSaving(null);
  }
 };
 return <RecordPanel title={`Aprovação · ${number}`} recordKey={`request:${request.id}`} pageId="cmp" onClose={onClose}>
  <h4>Próxima ação</h4>
  <p role="status">{next}</p>
  <dl className="mrc-record-panel__facts">
   <div><dt>Situação</dt><dd>{needsConfiguration?'Aguardando configuração':statusLabels[instance?.status]||'Aprovação a conferir'}</dd></div>
   <div><dt>Obra</dt><dd>{obra}</dd></div>
   <div><dt>Material necessário em</dt><dd>{dateLabel(request.necessidade)}</dd></div>
  </dl>
  {pending.map(stage=><section key={stage.id} aria-label={stage.name} className="purchase-record-flow">
   <h4>{stage.name}</h4>
   <p>Aprovadores elegíveis · {stage.names.join(', ')||'Não informados'}</p>
   <p>Prazo da etapa · {dateLabel(stage.due)}</p>
   {!stage.configured&&<p>Esta etapa aguarda configuração.</p>}
   {stage.decided&&<p>Você já registrou sua decisão nesta etapa.</p>}
   {stage.canDecide&&<>
    <Textarea label="Motivo da reprovação" value={notes[stage.id]||''} rows={2}
     onChange={event=>setNotes(previous=>({...previous,[stage.id]:event.target.value}))}/>
    <div className="mrc-record-panel__actions">
     <Button disabled={saving!==null} onClick={()=>decide(stage,'aprovado')}>Aprovar</Button>
     <Button variant="outline" disabled={saving!==null||!notes[stage.id]?.trim()} onClick={()=>decide(stage,'reprovado')}>Reprovar</Button>
    </div>
   </>}
  </section>)}
  <TaskDisclosure summary="Materiais solicitados">
   <ul>{(request.itens||[]).map(item=><li key={item.id}>{item.descricaoRef||'Material não informado'} · {item.quantidade} {item.unidadeCompra||item.unidadeRef}</li>)}</ul>
   {request.observacao&&<p>{request.observacao}</p>}
  </TaskDisclosure>
  <TaskDisclosure summary="Histórico de decisões">
   {history.length?<ul>{history.map(item=><li key={item.id}>
    {item.aprovadorNome||'Aprovador não informado'} · {item.decisao==='aprovado'?'Aprovação':'Reprovação'} · {policySteps.find(step=>step.id===item.etapaId)?.nome||'Etapa de aprovação'} · {item.data?dateLabel(item.data):'Data não informada'}
    {item.justificativa&&<p>{item.justificativa}</p>}
   </li>)}</ul>:<p>Nenhuma decisão registrada para esta aprovação.</p>}
  </TaskDisclosure>
  <div className="mrc-record-panel__actions"><Button variant="outline" onClick={onClose}>Voltar à fila</Button></div>
 </RecordPanel>;
}
