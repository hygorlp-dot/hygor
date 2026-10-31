import { useState } from "react";
import { Play, Pause, ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Badge } from "../../design-system/primitives/Badge.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import KanbanBoard from "./KanbanBoard.jsx";
import { ENGINEERING_COMMAND as CMD } from "./commands.js";
import { formatDuration, safeProjectUrl, REVISION_STATUSES } from "./model.js";
import { TASK_STATUSES, TASK_PRIORITIES, taskSeconds, taskDependencyError, checklistProgress, latestDeliveryRevision } from "./kanban-model.js";

const date = value => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia" }).format(new Date(`${value}T12:00:00-03:00`)) : "Sem prazo";
function TaskCard({ task, project, users, currentUser, now, active, busy, editable, send, onEdit }) {
  const [comment, setComment] = useState("");
  const [pendingChecklist, setPendingChecklist] = useState(null);
  const progress = checklistProgress(task);
  const revision = latestDeliveryRevision(project, task.linkId);
  const link = project.links?.find(item => item.id === task.linkId);
  const url = safeProjectUrl(revision?.url || link?.url);
  const blocked = task.blockedReason || taskDependencyError(project, task);
  const running = active?.project.id === project.id && active?.session.taskId === task.id;
  const priority = task.priority || "normal";
  return <div className="engineering-task-content">
    <h5>{task.title}</h5>
    <div className="engineering-card-badges"><Badge tone={priority === "urgente" ? "danger" : priority === "alta" ? "warning" : "neutral"}>{TASK_PRIORITIES[priority]}</Badge>{blocked && <Badge tone="warning">Bloqueada</Badge>}{running && <Badge tone="success">Seu cronômetro ativo</Badge>}</div>
    <p>{users.get(task.responsibleId) || "Responsável indisponível"} · {date(task.deadline)}</p>
    <p className="engineering-duration">{formatDuration(taskSeconds(project, task.id, now))} / {Number(task.plannedHours || 0).toLocaleString("pt-BR")} h previstas</p>
    {blocked && <p className="engineering-blocked">{blocked}</p>}
    {task.description && <p>{task.description}</p>}
    {progress.total > 0 && <fieldset className="engineering-checklist"><legend>Checklist · {progress.done}/{progress.total}{pendingChecklist ? " · salvando…" : ""}</legend>{task.checklist.map(item => <label key={item.id}><input type="checkbox" aria-label={`Checklist · ${task.title} · ${item.text}`} checked={pendingChecklist?.id === item.id ? pendingChecklist.done : item.done} disabled={busy || !editable || task.status === "concluida"} onChange={async event => { const done = event.target.checked; setPendingChecklist({ id: item.id, done }); await send(CMD.ENG_CHECKLIST_TOGGLED, project.id, { taskId: task.id, itemId: item.id, done }, project.version); setPendingChecklist(null); }} /><span>{item.text}</span></label>)}</fieldset>}
    {task.dependencies?.length > 0 && <p className="engineering-task-dependencies">Depende de: {task.dependencies.map(id => project.tasks.find(item => item.id === id)?.title || "Atividade indisponível").join("; ")}</p>}
    {link && <div className="engineering-task-delivery"><p>{link.title} · {revision ? `R${String(revision.number).padStart(2, "0")} · ${REVISION_STATUSES[revision.status]}` : "Sem revisão enviada"}</p>{task.requireReview && <Badge>Exige aprovação</Badge>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Abrir entrega<ExternalLink size={14} aria-hidden="true" /></a>}</div>}
    <div className="engineering-actions">
      <Button type="button" variant="outline" disabled={busy || !editable || (!running && (Boolean(active) || Boolean(blocked) || task.status === "concluida"))} aria-label={`${running ? "Pausar" : "Iniciar"} atividade ${task.title}`} onClick={() => running ? send(CMD.ENG_TIMER_STOPPED, project.id, { sessionId: active.session.id }) : send(CMD.ENG_TIMER_STARTED, project.id, { taskId: task.id, note: `Atividade: ${task.title}` })}>{running ? <Pause size={16} data-icon="inline-start" /> : <Play size={16} data-icon="inline-start" />}{running ? "Pausar" : "Iniciar"}</Button>
      <Button type="button" variant="ghost" disabled={busy || !editable} onClick={() => onEdit(task)} aria-label={`Editar atividade ${task.title}`}>Editar</Button>
    </div>
    <details className="engineering-task-comments"><summary>Comentários ({task.comments?.length || 0})</summary>{(task.comments || []).map(entry => <div key={entry.id}><strong>{entry.by}</strong><time dateTime={entry.at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(entry.at))}</time><p>{entry.text}</p></div>)}{editable && <form onSubmit={async event => { event.preventDefault(); if (await send(CMD.ENG_TASK_COMMENT_ADDED, project.id, { taskId: task.id, comment }, project.version)) setComment(""); }}><Input label={`Comentário em ${task.title}`} required maxLength={4000} value={comment} onChange={event => setComment(event.target.value)} disabled={busy} /><Button type="submit" variant="outline" disabled={busy || !comment.trim()}>Comentar</Button></form>}</details>
  </div>;
}

export default function TasksView({ project, data, currentUser, now, active, busy, send, onEdit }) {
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [priority, setPriority] = useState("");
  const users = new Map((data.usuarios || []).map(user => [user.id, user.nome]));
  const editable = project.status === "ativo";
  const tasks = project.tasks || [];
  const visible = tasks.filter(task => (!search || `${task.title} ${task.description || ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) && (!responsibleId || task.responsibleId === responsibleId) && (!priority || (task.priority || "normal") === priority));
  const render = task => <TaskCard task={task} project={project} users={users} currentUser={currentUser} now={now} active={active} busy={busy} editable={editable} send={send} onEdit={onEdit} />;
  return <div className="engineering-tasks-view">
    <div className="engineering-filters"><Input label="Buscar atividades" value={search} onChange={event => setSearch(event.target.value)} placeholder="Título ou descrição" /><Select label="Responsável das atividades" value={responsibleId} onChange={event => setResponsibleId(event.target.value)}><option value="">Todos</option>{(data.usuarios || []).map(user => <option key={user.id} value={user.id}>{user.nome}</option>)}</Select><Select label="Prioridade das atividades" value={priority} onChange={event => setPriority(event.target.value)}><option value="">Todas</option>{Object.entries(TASK_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select label="Visualização das atividades" value={view} onChange={event => setView(event.target.value)} options={[{ value: "board", label: "Quadro Kanban" }, { value: "list", label: "Lista" }]} /></div>
    <p className="engineering-help">{visible.length} de {tasks.length} atividade(s) · {tasks.filter(task => task.status === "concluida").length} concluída(s)</p>
    {view === "board" ? <KanbanBoard label="Kanban das atividades" columns={Object.entries(TASK_STATUSES).map(([id, label]) => ({ id, label }))} items={visible} counts={Object.fromEntries(Object.keys(TASK_STATUSES).map(status => [status, tasks.filter(task => task.status === status).length]))} columnOf={task => task.status} titleOf={task => task.title} busy={busy} canMove={() => editable} limits={project.kanbanLimits} renderCard={render} onMove={(task, status, beforeId) => send(CMD.ENG_TASK_MOVED, project.id, { taskId: task.id, status, beforeId }, project.version)} /> : <div className="engineering-task-list">{visible.map(task => <article key={task.id} className="engineering-record" aria-label={task.title}><Badge>{TASK_STATUSES[task.status]}</Badge>{render(task)}</article>)}</div>}
    {!visible.length && <p className="engineering-empty">{tasks.length ? "Nenhuma atividade com estes filtros." : "Organize as entregas em atividades com responsável e prazo."}</p>}
  </div>;
}
