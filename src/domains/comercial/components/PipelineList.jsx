import {useState,useRef} from 'react';
import {useWorkspaceState} from '../../../features/workflow/workspace-session.jsx';
import {useRecordPage} from '../../../design-system/data/useRecordPage.js';
import {RecordListPagination} from '../../../design-system/data/RecordListPagination.jsx';
import {Input} from '../../../design-system/primitives/Input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {RecordAction} from '../../../design-system/primitives/RecordAction.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {FilterBar} from '../../../design-system/patterns/FilterBar.jsx';
import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';
import {EmptyState} from '../../../design-system/patterns/FeedbackState.jsx';
import {useBreakpoint} from '../../../hooks/useBreakpoint.js';
import {COM_ETAPAS,comEtapaLabel} from '../legacy-model.js';
import {fmt,fmtDateFull} from '../../../legacy/format.js';

const priorities=[
 {value:'all',label:'Todas as oportunidades'},
 {value:'overdue',label:'Atividade vencida'},
 {value:'missing',label:'Sem data para próxima ação'},
];

export function pipelineRows(leads,query='',priority='all',now=Date.now()){
 const normalized=String(query).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 const overdue=l=>!!l.proximaAtividadeEm&&Date.parse(l.proximaAtividadeEm)<now;
 return leads.filter(l=>[l.nome,l.telefone,l.email,l.servico].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(normalized))
  .filter(l=>priority==='all'||(priority==='overdue'?overdue(l):!l.proximaAtividadeEm))
  .slice().sort((a,b)=>Number(overdue(b))-Number(overdue(a))||String(a.etapaDesde||'').localeCompare(String(b.etapaDesde||''))||a.nome.localeCompare(b.nome));
}
function LeadRow({lead,owner,onOpen,onMove,busy,isMobile}){
 const [target,setTarget]=useState(lead.etapa);
 const [moving,setMoving]=useState(false),[error,setError]=useState(''),inFlight=useRef(false);
 const move=async()=>{if(inFlight.current)return;inFlight.current=true;setMoving(true);setError('');try{await onMove(lead,target);}catch{setError('Não foi possível confirmar a mudança. Confira a conexão e tente novamente.');}finally{inFlight.current=false;setMoving(false);}};
 return <FormSection title={<RecordAction onClick={()=>onOpen(lead)}>{lead.nome}</RecordAction>} description={`${comEtapaLabel(lead.etapa)} · ${fmt(lead.orcamentoEstimado)}`}>
  <p>Responsável: {owner||'Não informado'}</p>
  <p>Próxima ação: {lead.proximaAtividade||'Definir próximo contato'} · {lead.proximaAtividadeEm?fmtDateFull(lead.proximaAtividadeEm.slice(0,10)):'Sem data'}</p>
  <TaskDisclosure enabled={isMobile} summary="Mover etapa">
   <Select label={`Mover etapa de ${lead.nome}`} value={target} disabled={busy||moving} onChange={e=>setTarget(e.target.value)} options={COM_ETAPAS.map(([value,label])=>({value,label}))}/>
   {error&&<p role="alert">{error}</p>}
   <Button variant="secondary" disabled={busy||moving||target===lead.etapa} onClick={move}>{moving?'Confirmando mudança…':'Mover lead'}</Button>
  </TaskDisclosure>
 </FormSection>;
}
export function PipelineList({leads,users,onOpen,onMove,busy=false,viewControl}){
 const {isMobile}=useBreakpoint();
 const [query,setQuery]=useWorkspaceState('com_funil','mobileQuery','');
 const [priority,setPriority]=useWorkspaceState('com_funil','mobilePriority','all');
 const rows=pipelineRows(leads,query,priority),pagination=useRecordPage('com_funil',rows,JSON.stringify([query,priority]));
 const priorityControl=<Select label="Prioridade no Pipeline" value={priority} onChange={e=>setPriority(e.target.value)} options={priorities}/>;
 const activePriority=priorities.find(option=>option.value===priority&&option.value!=='all');
 return <>
  {!isMobile&&viewControl}
  <FilterBar label="Busca e prioridades do Pipeline" layout="grid">
   <Input label="Pesquisar no Pipeline" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, serviço, telefone ou e-mail"/>
   {!isMobile&&priorityControl}
  </FilterBar>
  {isMobile&&<TaskDisclosure summary={activePriority?`Visualização e prioridade · ${activePriority.label}`:'Visualização e prioridade'}>
   {viewControl}
   {priorityControl}
  </TaskDisclosure>}
  <RecordListPagination pagination={pagination} label="oportunidades"/>
  {!rows.length&&<EmptyState title="Nenhuma oportunidade neste recorte" description="Ajuste a prioridade ou limpe a busca para consultar as demais oportunidades." action={<Button variant="secondary" onClick={()=>{setQuery('');setPriority('all');}}>Limpar filtros do Pipeline</Button>}/>}
  {pagination.rows.map(lead=><LeadRow key={`${lead.id}:${lead.etapa}`} lead={lead} owner={users.find(u=>u.id===lead.responsavelId)?.nome} onOpen={onOpen} onMove={onMove} busy={busy} isMobile={isMobile}/>)}
 </>;
}
