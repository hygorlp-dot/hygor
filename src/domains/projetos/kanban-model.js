import { sessionSeconds } from "./model.js";

export const TASK_STATUSES = { pendente: "A fazer", em_andamento: "Em produção", em_revisao: "Revisão técnica", aguardando_cliente: "Aguardando cliente", concluida: "Concluído" };
export const TASK_PRIORITIES = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
export const projectColumn = project => project.status === "concluido" ? "Concluído" : project.stage;
export const taskSeconds = (project, taskId, now) => (project.sessions || []).filter(session => session.taskId === taskId).reduce((total, session) => total + sessionSeconds(session, now), 0);
export const latestDeliveryRevision = (project, linkId) => (project.revisions || []).filter(revision => revision.linkId === linkId).reduce((latest, revision) => !latest || revision.number > latest.number ? revision : latest, null);
export const taskChecklist = task => Array.isArray(task.checklist) ? task.checklist : [];
export const checklistProgress = task => ({ done: taskChecklist(task).filter(item => item.done).length, total: taskChecklist(task).length });

export function taskDependencyError(project, task) {
  const dependencies = task.dependencies || [];
  if (dependencies.some(id => !(project.tasks || []).some(item => item.id === id))) return "Há uma dependência que não existe neste projeto.";
  if (dependencies.some(id => !(project.tasks || []).some(item => item.id === id && item.status === "concluida"))) return "Conclua as atividades predecessoras antes de avançar esta atividade.";
  return "";
}

export function taskTransitionError(project, task, status, previousStatus = task.status) {
  if (previousStatus === "concluida" && status !== "concluida" && (project.tasks || []).some(item=>item.status === "concluida" && item.dependencies?.includes(task.id))) return "Reabra as atividades dependentes antes de reabrir esta predecessora.";
  if (status !== "pendente" && (status !== previousStatus || status === "concluida")) {
    if (task.blockedReason) return `Atividade bloqueada: ${task.blockedReason}`;
    const dependencyError = taskDependencyError(project, task);
    if (dependencyError) return dependencyError;
  }
  if (status === "concluida") {
    if (taskChecklist(task).some(item => !item.done)) return "Conclua todos os itens do checklist antes de concluir a atividade.";
    if ((project.sessions || []).some(session => session.taskId === task.id && !session.endedAt)) return "Pause o cronômetro desta atividade antes de concluí-la.";
    if (task.requireReview && latestDeliveryRevision(project, task.linkId)?.status !== "aprovada") return "A última revisão da entrega desta atividade precisa estar aprovada.";
  }
  if (previousStatus !== status) {
    const limit = Number(project.kanbanLimits?.[status] || 0);
    const count = (project.tasks || []).filter(item => item.id !== task.id && item.status === status).length;
    if (limit && count >= limit) return `A coluna ${TASK_STATUSES[status]} atingiu o limite de ${limit} atividade(s).`;
  }
  return "";
}

export function projectCompletionError(project) {
  if ((project.sessions || []).some(session => !session.endedAt)) return "Pause todos os cronômetros antes de encerrar ou arquivar o projeto.";
  if ((project.tasks || []).some(task => task.status !== "concluida")) return "Conclua todas as atividades antes de concluir o projeto.";
  for (const task of project.tasks || []) { const error=taskTransitionError(project,task,"concluida"); if(error) return error; }
  if (project.requireApprovedDeliveries) {
    const links = [...new Set((project.revisions || []).map(revision => revision.linkId))];
    if (!links.length || links.some(linkId => latestDeliveryRevision(project, linkId)?.status !== "aprovada")) return "A última revisão de cada entrega submetida precisa estar aprovada antes de concluir o projeto.";
  }
  return "";
}

export function cyclicDependencies(tasks) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((byId.get(id)?.dependencies || []).some(visit)) return true;
    visiting.delete(id); visited.add(id);
    return false;
  }
  return tasks.some(task => visit(task.id));
}

export function reorderTask(tasks, taskId, status, beforeId) {
  const moving = tasks.find(task => task.id === taskId);
  const rest = tasks.filter(task => task.id !== taskId);
  const target = beforeId ? rest.findIndex(task => task.id === beforeId) : -1;
  if (beforeId && (target < 0 || rest[target].status !== status)) return null;
  const last = rest.map((task, index) => task.status === status ? index : -1).filter(index => index >= 0).at(-1);
  rest.splice(target >= 0 ? target : last == null ? rest.length : last + 1, 0, { ...moving, status });
  return rest;
}

export function orderedProjects(projects) {
  return projects.map((project, index) => ({ project, order: Number.isFinite(project.boardOrder) ? project.boardOrder : (index + 1) * 1024 }))
    .sort((a, b) => a.order - b.order || a.project.id.localeCompare(b.project.id)).map(item => item.project);
}

export function projectOrderForMove(projects, projectId, stage, beforeId) {
  const ranked = projects.map((project, index) => ({ ...project, rank: Number.isFinite(project.boardOrder) ? project.boardOrder : (index + 1) * 1024 }));
  const targets = ranked.filter(project => project.id !== projectId && projectColumn(project) === stage).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const index = beforeId ? targets.findIndex(project => project.id === beforeId) : targets.length;
  if (index < 0) return null;
  const previous = targets[index - 1]?.rank;
  const next = targets[index]?.rank;
  const rank = previous == null ? (next == null ? 1024 : next - 1024) : next == null ? previous + 1024 : (previous + next) / 2;
  return Number.isFinite(rank) && rank !== previous && rank !== next ? rank : null;
}
