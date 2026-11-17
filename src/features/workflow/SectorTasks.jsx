import {conferenceTasks} from './sector-tasks.js';
import {useWorkspaceState} from './workspace-session.jsx';
import {useWorkflow} from './WorkflowNavigation.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Button} from '../../design-system/primitives/Button.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {EmptyState} from '../../design-system/patterns/FeedbackState.jsx';
import {ScopeNote} from '../../design-system/patterns/ScopeNote.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {fmtDateFull} from '../../legacy/format.js';

export function SectorTasks({data,user}){
 const {navigate}=useWorkflow(),[status,setStatus]=useWorkspaceState('chat','taskStatus','open');
 const tasks=conferenceTasks(data,user).filter(t=>status==='all'||(status==='closed'?t.terminal:!t.terminal));
 return <>
  <FormSection title="Tarefas de conferência">
  <ScopeNote title="Escopo">Todas as conferências do seu acesso. Obra em foco não filtra este quadro.</ScopeNote>
  <Select label="Situação das tarefas" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'open',label:'Em aberto'},{value:'closed',label:'Resolvidas ou canceladas'},{value:'all',label:'Todas'}]}/>
  </FormSection>
  {!tasks.length&&<EmptyState title="Nenhuma tarefa de conferência neste recorte" description="Este quadro respeita seu acesso e a situação selecionada. As prioridades de ponto e diário aparecem abaixo."/>}
  {tasks.map(t=><FormSection key={`${t.conferenceId}:${t.findingId}`} title={t.title} description={`${t.code} · ${t.work}`}>
   <p>Responsável pelo ajuste: <strong>{t.owner}</strong> · Prazo: {t.deadline?fmtDateFull(t.deadline.slice(0,10)):'Não definido'}</p>
   <p>Situação: <strong>{({aberta:'Aberta',em_ajuste:'Correção solicitada',aguardando_validacao:'Aguardando validação',resolvida:'Conforme',cancelada:'Cancelada'})[t.status]||t.status}</strong> · Validação: {t.reviewer}</p>
   <p>Próxima ação: {t.terminal?'Consultar o encerramento e o histórico na vistoria.':t.status==='aguardando_validacao'?'O vistoriador confere a evidência e registra Conforme ou Não conforme.':'O responsável envia a evidência da correção na pendência.'}</p>
   {t.status==='resolvida'&&<p>Conclusão: {t.resolvedAt?fmtDateFull(t.resolvedAt.slice(0,10)):'Data não informada'}{t.resolvedBy?` · ${t.resolvedBy}`:''}</p>}
   {navigate&&<Button variant="secondary" onClick={()=>navigate('conferencia',{obraId:t.workId},{record:{type:'conferenceFinding',id:t.findingId,conferenceId:t.conferenceId}})}>Abrir pendência · {t.code}</Button>}
  </FormSection>)}
  <TaskDisclosure summary="Conversa, decisões e acompanhamento">
   <ScopeNote title="Conversa e decisão">Use Abrir chat da equipe no cabeçalho para conversar. Uma mensagem não aprova solicitações nem valida correções; registre a decisão na área responsável.</ScopeNote>
   <ScopeNote title="Acompanhamento">O quadro consulta as pendências existentes e respeita a obra do perfil, quando houver. A conclusão aparece depois da validação na Conferência; uma evidência enviada ainda aguarda essa decisão.</ScopeNote>
  </TaskDisclosure>
 </>;
}
