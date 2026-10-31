import { useState } from "react";
import { Play, Pause, ExternalLink, Plus } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs.jsx";
import { Badge } from "../../design-system/primitives/Badge.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import { RecordForm } from "./ProjectForms.jsx";
import { ENGINEERING_COMMAND as CMD } from "./commands.js";
import { formatDuration, projectSeconds, sessionSeconds, safeProjectUrl, REVISION_STATUSES, PROJECT_STATUSES } from "./model.js";

export const displayDate = value => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia" }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)) : "Sem prazo";
export const displayTimestamp = value => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Em andamento";
function ProjectLink({ url, children }) {
  const safe = safeProjectUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={14} aria-hidden="true" /></a> : <span>Link indisponível</span>;
}

export default function ProjectDetail({ project, data, currentUser, now, active, busy, send, onEdit }) {
  const [tab, setTab] = useState("overview");
  const [editor, setEditor] = useState(null);
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState("");
  const activeHere = active?.project.id === project.id;
  const users = new Map((data.usuarios || []).map(user => [user.id, user.nome]));
  const editable = project.status === "ativo";
  async function saveRecord(form) {
    const type = { link: CMD.ENG_LINK_ADDED, revision: CMD.ENG_REVISION_ADDED, review: CMD.ENG_REVISION_REVIEWED, task: CMD.ENG_TASK_SAVED, adjust: CMD.ENG_TIME_ADJUSTED }[editor.kind];
    let payload = form;
    if (editor.kind === "task") payload = { task: form };
    if (editor.kind === "review") payload = { ...form, revisionId: editor.record.id };
    if (editor.kind === "adjust") payload = { sessionId: editor.record.id, seconds: Number(form.minutes) * 60, reason: form.reason };
    const result = await send(type, project.id, payload, editor.version);
    if (result) setEditor(null);
  }
  const open = (kind, record) => setEditor({ kind, record, version: project.version });
  const changeTab = value => { setTab(value); setEditor(null); };
  const hoursByUser = (project.sessions || []).reduce((totals, session) => ({ ...totals, [session.userId]: (totals[session.userId] || 0) + sessionSeconds(session, now) }), {});

  return <section className="engineering-detail" aria-label={`Projeto ${project.name}`}>
    <header className="engineering-detail-heading"><div><h2>{project.name}</h2><p>{project.discipline} · {project.stage} · {users.get(project.responsibleId) || "Responsável indisponível"}</p></div><Button variant="outline" disabled={busy} onClick={onEdit}>Editar projeto</Button></header>
    <dl className="engineering-summary"><div><dt>Situação</dt><dd><Badge>{PROJECT_STATUSES[project.status]}</Badge></dd></div><div><dt>Entrega</dt><dd>{displayDate(project.deadline)}</dd></div><div><dt>Horas previstas</dt><dd>{Number(project.plannedHours).toLocaleString("pt-BR")} h</dd></div><div><dt>Horas realizadas</dt><dd className="engineering-duration">{formatDuration(projectSeconds(project, now))}</dd></div></dl>
    <div className="engineering-timer" aria-label="Cronômetro do projeto">
      <div><strong>{activeHere ? "Seu trabalho está sendo contado" : "Registrar tempo de trabalho"}</strong><p>O cronômetro continua até você pausar, mesmo ao sair da página ou fechar o navegador.</p></div>
      {activeHere ? <><output className="engineering-duration" aria-label="Tempo da sessão">{formatDuration(sessionSeconds(active.session, now))}</output><Button disabled={busy} onClick={() => send(CMD.ENG_TIMER_STOPPED, project.id, { sessionId: active.session.id })}><Pause data-icon="inline-start" size={16} />Pausar cronômetro</Button></> : <>
        <Select label="Atividade do cronômetro" value={taskId} onChange={event => setTaskId(event.target.value)}><option value="">Trabalho geral do projeto</option>{(project.tasks || []).map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</Select>
        <Input label="Nota da sessão" value={note} maxLength={1000} onChange={event => setNote(event.target.value)} />
        <Button disabled={busy || Boolean(active) || !editable} onClick={() => send(CMD.ENG_TIMER_STARTED, project.id, { taskId, note })}><Play data-icon="inline-start" size={16} />Iniciar cronômetro</Button>
      </>}
    </div>
    <Tabs value={tab} onValueChange={changeTab}>
      <div className="engineering-mobile-areas"><Select label="Área do projeto" value={tab} onChange={event => changeTab(event.target.value)} options={[{ value: "overview", label: "Visão geral" }, { value: "links", label: "Links e entregas" }, { value: "hours", label: "Horas" }, { value: "revisions", label: "Revisões" }]} /></div>
      <TabsList aria-label="Áreas do projeto" className="engineering-tabs"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="links">Links e entregas</TabsTrigger><TabsTrigger value="hours">Horas</TabsTrigger><TabsTrigger value="revisions">Revisões</TabsTrigger></TabsList>
      <TabsContent value="overview">
        {project.description && <p className="engineering-description">{project.description}</p>}
        <div className="engineering-section-heading"><h3>Atividades</h3><Button variant="outline" disabled={busy || !editable} onClick={() => open("task")}><Plus size={16} data-icon="inline-start" />Nova atividade</Button></div>
        {!(project.tasks || []).length && <p className="engineering-empty">Organize as entregas em atividades com responsável e prazo.</p>}
        {(project.tasks || []).map(task => <div className="engineering-record" key={task.id}><div><strong>{task.title}</strong><p>{users.get(task.responsibleId) || "Responsável indisponível"} · {displayDate(task.deadline)} · {{ pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída" }[task.status]}</p></div><Button variant="ghost" disabled={busy || !editable} onClick={() => open("task", task)} aria-label={`Editar atividade ${task.title}`}>Editar</Button></div>)}
        <details className="engineering-audit"><summary>Histórico de alterações ({(project.history || []).length})</summary><ol>{[...(project.history || [])].reverse().map(event => <li key={event.id}><strong>{event.detail}</strong><p>{event.by || "Usuário"} · {displayTimestamp(event.at)}</p></li>)}</ol></details>
      </TabsContent>
      <TabsContent value="links">
        <div className="engineering-section-heading"><h3>Links e entregas</h3><Button variant="outline" disabled={busy || !editable} onClick={() => open("link")}><Plus size={16} data-icon="inline-start" />Adicionar link</Button></div>
        <p className="engineering-help">Centralize pastas, modelos e documentos. As permissões dos arquivos permanecem no serviço de origem.</p>
        {!(project.links || []).length && <p className="engineering-empty">Adicione o primeiro link para organizar os arquivos e registrar suas revisões.</p>}
        {(project.links || []).map(link => { const latest=[...(project.revisions||[])].reverse().find(revision=>revision.linkId===link.id); return <div key={link.id} className="engineering-record"><div><strong>{link.title}</strong><p>{new URL(safeProjectUrl(link.url) || "https://invalid.local").hostname}{latest ? ` · R${String(latest.number).padStart(2,"0")} · ${REVISION_STATUSES[latest.status]}` : ""}</p></div><div className="engineering-actions"><ProjectLink url={link.url}>Abrir arquivo ou pasta</ProjectLink>{latest && <ProjectLink url={latest.url}>Abrir última revisão</ProjectLink>}</div></div>; })}
      </TabsContent>
      <TabsContent value="hours">
        <h3>Horas por pessoa</h3><dl className="engineering-people">{Object.entries(hoursByUser).map(([userId, seconds]) => <div key={userId}><dt>{users.get(userId) || project.sessions.find(session => session.userId === userId)?.userName || "Usuário"}</dt><dd className="engineering-duration">{formatDuration(seconds)}</dd></div>)}</dl>
        <h3>Sessões de trabalho</h3>
        {!(project.sessions || []).length && <p className="engineering-empty">As sessões aparecerão aqui após iniciar o cronômetro.</p>}
        {[...(project.sessions || [])].reverse().map(session => <div className="engineering-record" key={session.id}><div><strong>{session.userName || users.get(session.userId) || "Usuário"}</strong><p>{displayTimestamp(session.startedAt)} → {displayTimestamp(session.endedAt)}{session.adjustedSeconds != null ? " · Duração ajustada" : ""}{sessionSeconds(session, now) > 43200 ? " · Conferir sessão acima de 12h" : ""}</p>{session.taskId && <p>Atividade: {project.tasks?.find(task => task.id === session.taskId)?.title || "Atividade indisponível"}</p>}{session.note && <p>{session.note}</p>}</div><div className="engineering-actions"><span className="engineering-duration">{formatDuration(sessionSeconds(session, now))}</span>{editable && session.endedAt && (session.userId === currentUser.id || currentUser.role === "admin") && <Button variant="ghost" disabled={busy} onClick={() => open("adjust", session)}>Ajustar horas</Button>}</div></div>)}
      </TabsContent>
      <TabsContent value="revisions">
        <div className="engineering-section-heading"><h3>Histórico de revisões</h3><Button variant="outline" disabled={busy || !editable || !project.links?.length} onClick={() => open("revision")}><Plus size={16} data-icon="inline-start" />Enviar revisão</Button></div>
        <p className="engineering-help">Registre cada versão e o parecer da equipe. Os desenhos são conferidos no arquivo de origem.</p>
        {!project.links?.length && <p className="engineering-empty">Adicione uma entrega em “Links e entregas” antes de enviar sua primeira revisão.</p>}
        {project.links?.length > 0 && !project.revisions?.length && <p className="engineering-empty">Nenhuma revisão enviada. Registre a primeira versão da entrega.</p>}
        {[...(project.revisions || [])].reverse().map(revision => <article className="engineering-revision" key={revision.id}>
          <div className="engineering-section-heading"><h4>{project.links?.find(link => link.id === revision.linkId)?.title} · R{String(revision.number).padStart(2, "0")}</h4><Badge tone={revision.status === "aprovada" ? "success" : revision.status === "ajustes" ? "warning" : "neutral"}>{REVISION_STATUSES[revision.status]}</Badge></div>
          <p>{revision.description}</p><p className="engineering-help">Enviada por {revision.createdBy || "Usuário"} em {displayTimestamp(revision.createdAt)}</p>
          <div className="engineering-actions"><ProjectLink url={revision.url}>Abrir esta versão</ProjectLink>{editable && revision.status === "pendente" && !project.revisions.some(item => item.linkId === revision.linkId && item.number > revision.number) && <Button variant="outline" disabled={busy} onClick={() => open("review", revision)}>Registrar parecer</Button>}</div>
          {revision.reviewedAt && <p className="engineering-review"><strong>{revision.reviewedBy} · {displayTimestamp(revision.reviewedAt)}</strong><br />{revision.comment}</p>}
        </article>)}
      </TabsContent>
    </Tabs>
    {editor && <RecordForm key={`${editor.kind}-${editor.record?.id || "new"}`} kind={editor.kind} record={editor.record} project={project} data={data} currentUser={currentUser} busy={busy} onSave={saveRecord} onCancel={() => setEditor(null)} />}
  </section>;
}
