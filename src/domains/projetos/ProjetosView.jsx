import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, ArrowLeft, Pause } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Alert, AlertDescription } from "../../components/ui/alert.jsx";
import { Input } from "../../design-system/primitives/Input.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";
import { Badge } from "../../design-system/primitives/Badge.jsx";
import { PageHeader } from "../../design-system/patterns/PageHeader.jsx";
import { EmptyState } from "../../design-system/patterns/FeedbackState.jsx";
import ProjectDetail, { displayDate } from "./ProjectDetail.jsx";
import { ProjectForm } from "./ProjectForms.jsx";
import { ENGINEERING_COMMAND as CMD } from "./commands.js";
import { PROJECT_STATUSES, activeProjectSession, formatDuration, projectSeconds } from "./model.js";
import "./projetos.css";

export default function ProjetosView({ data, currentUser, dispatchCommand, showToast, onRefresh }) {
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [obraId, setObraId] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const retry = useRef(null);
  const projects = data.engineeringProjects || [];
  const active = activeProjectSession(projects, currentUser.id);
  const hasRunning = projects.some(project => project.sessions?.some(session => !session.endedAt));
  const selected = projects.find(project => project.id === selectedId);
  useEffect(() => {
    if (!hasRunning) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  async function send(type, projectId, payload = {}, expectedVersion) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError("");
    const signature = JSON.stringify({ type, projectId, payload, expectedVersion });
    if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() };
    const command = { type, idempotencyKey: retry.current.key, expectedVersion, payload: { ...payload, projectId }, actorId: currentUser.id, actorRole: currentUser.role, actorName: currentUser.nome };
    try {
      const result = await dispatchCommand(command);
      if (!result?.ok) throw new Error(result?.reason || "O servidor não confirmou a alteração. Tente novamente ou atualize os dados.");
      retry.current = null;
      setNow(Date.now());
      showToast?.("Registro salvo.");
      return true;
    } catch (cause) {
      setError(cause.message || "Não foi possível salvar. Verifique a conexão e tente novamente.");
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await onRefresh(); setNow(Date.now()); }
    catch { setError("Não foi possível atualizar. Verifique a conexão e tente novamente."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function saveProject(form) {
    const id = editing.id;
    if (await send(CMD.ENG_PROJECT_SAVED, id, { project: form }, editing.project?.version || 0)) { setEditing(null); setSelectedId(id); }
  }
  const visible = projects.filter(project => (!status || project.status === status) && (!obraId || project.obraId === obraId) && (!responsibleId || project.responsibleId === responsibleId) && (!search || `${project.name} ${project.client} ${project.discipline}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
  const userNames = new Map((data.usuarios || []).map(user => [user.id, user.nome]));
  return <div className="engineering-workspace">
    <PageHeader title="Projetos" description="Engenharia e arquitetura: entregas, revisões e horas em um só lugar." primaryAction={<Button disabled={busy} onClick={() => setEditing({ id: crypto.randomUUID(), project: null })}><Plus data-icon="inline-start" size={16} />Novo projeto</Button>} secondaryActions={<Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw data-icon="inline-start" size={16} />Atualizar dados</Button>} />
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {active && (!selected || active.project.id !== selected.id || editing) && <div className="engineering-active"><div><strong>Cronômetro ativo em {active.project.name}</strong><p>Pause antes de iniciar trabalho em outro projeto.</p></div><Button variant="outline" disabled={busy} onClick={() => { setSelectedId(active.project.id); setEditing(null); }}>Abrir projeto ativo</Button><Button disabled={busy} onClick={() => send(CMD.ENG_TIMER_STOPPED, active.project.id, { sessionId: active.session.id })}><Pause data-icon="inline-start" size={16} />Pausar cronômetro</Button></div>}
    {editing ? <ProjectForm key={`${editing.id}-${editing.project?.version || 0}`} project={editing.project} data={data} currentUser={currentUser} busy={busy} onSave={saveProject} onCancel={() => setEditing(null)} /> : selected ? <>
      <Button variant="ghost" onClick={() => setSelectedId("")} disabled={busy}><ArrowLeft data-icon="inline-start" size={16} />Todos os projetos</Button>
      <ProjectDetail key={selected.id} project={selected} data={data} currentUser={currentUser} now={now} active={active} busy={busy} send={send} onEdit={() => setEditing({ id: selected.id, project: selected })} />
    </> : <>
      <div className="engineering-filters"><Input label="Buscar projetos" placeholder="Nome, cliente ou disciplina" value={search} onChange={event => setSearch(event.target.value)} /><Select label="Situação dos projetos" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todas as situações</option>{Object.entries(PROJECT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Select label="Obra dos projetos" value={obraId} onChange={event => setObraId(event.target.value)}><option value="">Todas as obras e escritório</option>{(data.obras || []).map(obra => <option key={obra.id} value={obra.id}>{obra.name}</option>)}</Select><Select label="Responsável dos projetos" value={responsibleId} onChange={event => setResponsibleId(event.target.value)}><option value="">Todos os responsáveis</option>{(data.usuarios || []).map(user => <option key={user.id} value={user.id}>{user.nome}</option>)}</Select></div>
      <p className="engineering-help">{visible.length} projeto(s) · {formatDuration(visible.reduce((total, project) => total + projectSeconds(project, now), 0))} de trabalho registrado</p>
      {!visible.length ? <EmptyState title={projects.length ? "Nenhum projeto com estes filtros" : "Seu primeiro projeto começa aqui"} description={projects.length ? "Ajuste a busca ou os filtros para encontrar o projeto." : "Cadastre o projeto, organize os links e inicie o cronômetro quando começar a trabalhar."} /> : <div className="engineering-portfolio">{visible.map(project => <article key={project.id} className="engineering-project-row">
        <div className="engineering-project-name"><Button variant="link" onClick={() => setSelectedId(project.id)}>{project.name}</Button><p>{project.client || "Cliente não informado"} · {(data.obras || []).find(obra => obra.id === project.obraId)?.name || "Escritório"}</p></div>
        <div><span className="engineering-label">Disciplina / etapa</span><strong>{project.discipline}</strong><p>{project.stage}</p></div><div><span className="engineering-label">Responsável / prazo</span><strong>{userNames.get(project.responsibleId) || "Indisponível"}</strong><p>{displayDate(project.deadline)}</p></div><div><span className="engineering-label">Horas / situação</span><strong className="engineering-duration">{formatDuration(projectSeconds(project, now))} / {project.plannedHours} h</strong><Badge>{PROJECT_STATUSES[project.status]}</Badge></div>
      </article>)}</div>}
    </>}
  </div>;
}
