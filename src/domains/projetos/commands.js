import { PROJECT_STAGES, PROJECT_DISCIPLINES, PROJECT_STATUSES, safeProjectUrl, activeProjectSession, sessionSeconds } from "./model.js";

export const ENGINEERING_COMMAND = Object.freeze({
  ENG_PROJECT_SAVED: "PROJETO_ENGENHARIA_SALVO",
  ENG_LINK_ADDED: "PROJETO_LINK_ADICIONADO",
  ENG_REVISION_ADDED: "PROJETO_REVISAO_ADICIONADA",
  ENG_REVISION_REVIEWED: "PROJETO_REVISAO_AVALIADA",
  ENG_TIMER_STARTED: "PROJETO_CRONOMETRO_INICIADO",
  ENG_TIMER_STOPPED: "PROJETO_CRONOMETRO_PAUSADO",
  ENG_TIME_ADJUSTED: "PROJETO_HORAS_AJUSTADAS",
  ENG_TASK_SAVED: "PROJETO_ATIVIDADE_SALVA",
});
export const ENGINEERING_COMMAND_TYPES = new Set(Object.values(ENGINEERING_COMMAND));
export const ENGINEERING_ROLES = ["admin", "engenheiro", "engenheiro_auditor", "compras", "financeiro", "rh", "comercial", "visualizador"];
const fail = reason => ({ ok: false, reason });
const text = (value, max = 200) => String(value || "").trim().slice(0, max);
const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const validUser = (data, id) => (data.usuarios || []).some(user => user.id === id && user.active !== false);
export const engineeringProjectForCommand = (data, command) => (data.engineeringProjects || []).find(project => project.id === command.payload?.projectId);

// Pure reducer, run only after server scope checks and inside the existing
// locked/CAS operational persistence. Nested records cannot be replaced by forms.
export function applyEngineeringCommand(data, command, now) {
  if (!ENGINEERING_COMMAND_TYPES.has(command.type)) return null;
  if (!command.actorId || !Number.isFinite(Date.parse(now))) return fail("Sessão ou horário do servidor inválido.");
  const payload = command.payload || {};
  const projects = data.engineeringProjects || [];
  // The shared receipt window is bounded; project audit history keeps old
  // retries idempotent even after more than 2,000 unrelated ERP operations.
  const previouslyApplied = projects.find(project => project.history?.some(event => event.id === command.idempotencyKey));
  if (previouslyApplied) return { ok: true, idempotent: true, entityId: previouslyApplied.id, data };
  const current = engineeringProjectForCommand(data, command);
  const isSave = command.type === ENGINEERING_COMMAND.ENG_PROJECT_SAVED;
  if (!current && !isSave) return fail("Projeto não encontrado. Atualize a tela.");
  if (!text(payload.projectId) || text(payload.projectId) !== payload.projectId) return fail("Identificação do projeto inválida.");
  const isTimer = [ENGINEERING_COMMAND.ENG_TIMER_STARTED, ENGINEERING_COMMAND.ENG_TIMER_STOPPED].includes(command.type);
  if (!isTimer && Number(command.expectedVersion) !== Number(current?.version || 0)) return fail("O projeto foi alterado. Atualize a tela antes de salvar novamente.");
  let project = current ? { ...current } : { id: payload.projectId, links: [], revisions: [], sessions: [], tasks: [], history: [], createdAt: now, createdById: command.actorId };
  let detail = "";

  if (isSave) {
    const form = payload.project || {};
    const name = text(form.name);
    const obraId = text(form.obraId);
    const hours = Number(form.plannedHours || 0);
    if (!name) return fail("Informe o nome do projeto.");
    if (obraId && !(data.obras || []).some(obra => obra.id === obraId)) return fail("Obra vinculada não encontrada.");
    if (current && obraId !== current.obraId) return fail("A obra vinculada não pode ser alterada após o cadastro.");
    if (!PROJECT_STAGES.includes(form.stage) || !PROJECT_DISCIPLINES.includes(form.discipline) || !Object.hasOwn(PROJECT_STATUSES, form.status)) return fail("Etapa, disciplina ou situação inválida.");
    if (!validUser(data, form.responsibleId)) return fail("Selecione um responsável ativo.");
    if (!validDate(form.deadline || "")) return fail("Informe um prazo válido.");
    if (!Number.isFinite(hours) || hours < 0 || hours > 1000000) return fail("As horas previstas devem estar entre zero e um milhão.");
    if (form.status !== "ativo" && (project.sessions || []).some(session => !session.endedAt)) return fail("Pause todos os cronômetros antes de encerrar ou arquivar o projeto.");
    project = { ...project, name, obraId, client: text(form.client), responsibleId: form.responsibleId, discipline: form.discipline, stage: form.stage, status: form.status, deadline: form.deadline || "", plannedHours: hours, description: text(form.description, 4000) };
    detail = current ? "Cadastro atualizado" : "Projeto criado";
  } else if (command.type === ENGINEERING_COMMAND.ENG_TIMER_STOPPED) {
    const session = (project.sessions || []).find(item => item.id === payload.sessionId);
    if (!session || session.userId !== command.actorId) return fail("Você só pode pausar seu próprio cronômetro.");
    if (session.endedAt) return fail("Este cronômetro já foi pausado. Atualize a tela.");
    if (Date.parse(now) < Date.parse(session.startedAt)) return fail("O encerramento não pode anteceder o início.");
    project.sessions = project.sessions.map(item => item.id === session.id ? { ...item, endedAt: now } : item);
    detail = "Cronômetro pausado";
  } else {
    if (project.status !== "ativo") return fail("Reabra o projeto antes de registrar trabalho ou revisões.");
    if (command.type === ENGINEERING_COMMAND.ENG_TIMER_STARTED) {
      if (activeProjectSession(projects, command.actorId)) return fail("Você já possui um cronômetro ativo. Pause-o antes de iniciar outro.");
      if (payload.taskId && !(project.tasks || []).some(task => task.id === payload.taskId)) return fail("Atividade não encontrada.");
      project.sessions = [...(project.sessions || []), { id: command.idempotencyKey, userId: command.actorId, userName: text(command.actorName), startedAt: now, endedAt: "", taskId: payload.taskId || "", note: text(payload.note, 1000) }];
      detail = "Cronômetro iniciado";
    } else if (command.type === ENGINEERING_COMMAND.ENG_LINK_ADDED) {
      const url = safeProjectUrl(payload.url);
      if (!url || !text(payload.title)) return fail("Informe um título e um link HTTP ou HTTPS válido, sem credenciais.");
      project.links = [...(project.links || []), { id: command.idempotencyKey, title: text(payload.title), url, createdAt: now, createdById: command.actorId }];
      detail = `Link adicionado: ${text(payload.title)}`;
    } else if (command.type === ENGINEERING_COMMAND.ENG_REVISION_ADDED) {
      const link = (project.links || []).find(item => item.id === payload.linkId);
      const url = safeProjectUrl(payload.url);
      if (!link || !url || !text(payload.description, 4000)) return fail("Selecione uma entrega, informe o link da versão e descreva as mudanças.");
      const number = (project.revisions || []).filter(item => item.linkId === link.id).length + 1;
      project.revisions = [...(project.revisions || []), { id: command.idempotencyKey, linkId: link.id, number, url, description: text(payload.description, 4000), status: "pendente", createdAt: now, createdById: command.actorId, createdBy: text(command.actorName) }];
      detail = `${link.title} · revisão ${number} enviada`;
    } else if (command.type === ENGINEERING_COMMAND.ENG_REVISION_REVIEWED) {
      const revision = (project.revisions || []).find(item => item.id === payload.revisionId);
      if (!revision || revision.status !== "pendente") return fail("Esta revisão já recebeu um parecer ou não foi encontrada.");
      if (project.revisions.some(item => item.linkId === revision.linkId && item.number > revision.number)) return fail("Avalie a versão mais recente desta entrega.");
      if (!["aprovada", "ajustes"].includes(payload.status) || !text(payload.comment, 4000)) return fail("Escolha o parecer e registre uma justificativa.");
      project.revisions = project.revisions.map(item => item.id === revision.id ? { ...item, status: payload.status, comment: text(payload.comment, 4000), reviewedAt: now, reviewedById: command.actorId, reviewedBy: text(command.actorName) } : item);
      detail = `Revisão ${revision.number}: ${payload.status === "aprovada" ? "aprovada" : "ajustes solicitados"}`;
    } else if (command.type === ENGINEERING_COMMAND.ENG_TIME_ADJUSTED) {
      const session = (project.sessions || []).find(item => item.id === payload.sessionId);
      if (!session?.endedAt || (session.userId !== command.actorId && command.actorRole !== "admin")) return fail("Ajuste apenas sessões encerradas próprias, ou solicite ao administrador.");
      const seconds = Number(payload.seconds);
      if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 31536000 || !text(payload.reason, 1000)) return fail("Informe uma duração válida e justifique o ajuste.");
      project.sessions = project.sessions.map(item => item.id === session.id ? { ...item, adjustedSeconds: seconds } : item);
      detail = `Sessão ${session.id}: ${sessionSeconds(session)}s → ${seconds}s. Motivo: ${text(payload.reason, 1000)}`;
    } else if (command.type === ENGINEERING_COMMAND.ENG_TASK_SAVED) {
      const task = payload.task || {};
      if (!text(task.title) || !validUser(data, task.responsibleId) || !validDate(task.deadline || "") || !["pendente", "em_andamento", "concluida"].includes(task.status)) return fail("Informe título, responsável, prazo e situação válidos para a atividade.");
      if (task.id && !(project.tasks || []).some(item => item.id === task.id)) return fail("Atividade não encontrada.");
      const next = { id: task.id || command.idempotencyKey, title: text(task.title), responsibleId: task.responsibleId, deadline: task.deadline || "", status: task.status, updatedAt: now, updatedById: command.actorId };
      project.tasks = task.id ? project.tasks.map(item => item.id === task.id ? next : item) : [...(project.tasks || []), next];
      detail = `Atividade: ${next.title} · ${next.status}`;
    }
  }
  project.version = Number(current?.version || 0) + 1;
  project.updatedAt = now;
  project.updatedById = command.actorId;
  project.history = [...(project.history || []), { id: command.idempotencyKey, type: command.type, detail, at: now, byId: command.actorId, by: text(command.actorName) }];
  return { ok: true, entityId: project.id, data: { ...data, engineeringProjects: current ? projects.map(item => item.id === project.id ? project : item) : [...projects, project] } };
}
