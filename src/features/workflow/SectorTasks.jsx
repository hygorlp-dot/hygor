import {Input} from '../../design-system/primitives/Input.jsx';
import {RecordListPagination} from '../../design-system/data/RecordListPagination.jsx';
import {useRecordPage} from '../../design-system/data/useRecordPage.js';
import {conferenceTasks} from './sector-tasks.js';
import {useWorkspaceState} from './workspace-session.jsx';
import {useWorkflow} from './WorkflowNavigation.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Button} from '../../design-system/primitives/Button.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {EmptyState} from '../../design-system/patterns/FeedbackState.jsx';
import {ScopeNote} from '../../design-system/patterns/ScopeNote.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {useBreakpoint} from '../../hooks/useBreakpoint.js';
import {fmtDateFull} from '../../legacy/format.js';

export function SectorTasks({data,user}){
 const {isMobile}=useBreakpoint();
 const {navigate}=useWorkflow(),[status,setStatus]=useWorkspaceState('chat','taskStatus','open');
 const [search,setSearch]=useWorkspaceState('chat','taskSearch','');
 const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const query=fold(search.trim());
 const tasks=conferenceTasks(data,user).filter(task=>
  (status==='all'||(status==='closed'?task.terminal:!task.terminal))&&
  fold([task.code,task.work,task.owner,task.reviewer,task.title].join(' ')).includes(query));
 const pageSize=isMobile?6:12;
 const page=useRecordPage('chat',tasks,JSON.stringify([status,query,pageSize]),'conferenceTasks',pageSize);
 return <>
  <FormSection title="Tarefas de conferência">
  {!isMobile&&<ScopeNote title="Escopo">Todas as conferências do seu acesso. Obra em foco não filtra este quadro.</ScopeNote>}
  <Select label="Situação das tarefas" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'open',label:'Em aberto'},{value:'closed',label:'Resolvidas ou canceladas'},{value:'all',label:'Todas'}]}/>
  <Input label="Buscar tarefas" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Obra, responsável ou descrição"/>
  </FormSection>
  <RecordListPagination pagination={page} label="tarefas de conferência"/>
  {!tasks.length&&<EmptyState title="Nenhuma tarefa de conferência neste recorte" description="Altere a situação ou ajuste a busca por obra, responsável ou descrição."/>}
  {page.rows.map(t=><FormSection key={`${t.conferenceId}:${t.findingId}`} title={t.title} description={`${t.code} · ${t.work}`}>
   <p>Responsável pelo ajuste: <strong>{t.owner}</strong> · Prazo: {t.deadline?fmtDateFull(t.deadline.slice(0,10)):'Não definido'}</p>
   <p>Situação: <strong>{({aberta:'Aberta',em_ajuste:'Correção solicitada',aguardando_validacao:'Aguardando validação',resolvida:'Conforme',cancelada:'Cancelada'})[t.status]||t.status}</strong> · Validação: {t.reviewer}</p>
   <p>Próxima ação: {t.terminal?'Consultar o encerramento e o histórico na vistoria.':t.status==='aguardando_validacao'?'O vistoriador confere a evidência e registra Conforme ou Não conforme.':'O responsável envia a evidência da correção na pendência.'}</p>
   {t.status==='resolvida'&&<p>Conclusão: {t.resolvedAt?fmtDateFull(t.resolvedAt.slice(0,10)):'Data não informada'}{t.resolvedBy?` · ${t.resolvedBy}`:''}</p>}
   {navigate&&<Button variant="secondary" onClick={()=>navigate('conferencia',{obraId:t.workId},{record:{type:'conferenceFinding',id:t.findingId,conferenceId:t.conferenceId}})}>Abrir pendência · {t.code}</Button>}
  </FormSection>)}
  <TaskDisclosure summary="Conversa, decisões e acompanhamento">
   {isMobile&&<ScopeNote title="Escopo">Todas as conferências do seu acesso. Obra em foco não filtra este quadro.</ScopeNote>}
   <ScopeNote title="Conversa e decisão">Use Abrir chat da equipe no cabeçalho para conversar. Uma mensagem não aprova solicitações nem valida correções; registre a decisão na área responsável.</ScopeNote>
   <ScopeNote title="Acompanhamento">O quadro consulta as pendências existentes e respeita a obra do perfil, quando houver. A conclusão aparece depois da validação na Conferência; uma evidência enviada ainda aguarda essa decisão.</ScopeNote>
  </TaskDisclosure>
 </>;
}
