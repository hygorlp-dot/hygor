import { describe, expect, it } from "vitest";
import { applyOperationalCommand } from "../sync/operational-commands.js";
import { ENGINEERING_COMMAND as CMD } from "./commands.js";
import { orderedProjects, projectColumn } from "./kanban-model.js";

let sequence = 0;
const form = { name: "Casa Kanban", obraId: "a", responsibleId: "u1", discipline: "Arquitetura", stage: "Executivo", status: "ativo", plannedHours: 40 };
const command = (type, payload = {}, version = 0, extra = {}) => ({ type, expectedVersion: version, payload: { projectId: "p1", ...payload }, idempotencyKey: `kanban-command-${++sequence}`, actorId: "u1", actorRole: "engenheiro", actorName: "Ana", now: "2026-10-31T12:00:00Z", ...extra });
const apply = (data, type, payload = {}, version = data.engineeringProjects?.[0]?.version || 0, extra) => applyOperationalCommand(data, command(type, payload, version, extra));
function ok(data, type, payload = {}, version, extra) { const result = apply(data, type, payload, version, extra); expect(result.ok, result.reason).toBe(true); return result.data; }
const seed = () => ok({ obras: [{ id: "a" }], usuarios: [{ id: "u1", active: true }] }, CMD.ENG_PROJECT_SAVED, { project: form }, 0);
const task = (title, patch = {}) => ({ title, responsibleId: "u1", deadline: "", status: "pendente", ...patch });
function withTasks() { return ["Primeira", "Segunda", "Terceira"].reduce((data, title) => ok(data, CMD.ENG_TASK_SAVED, { task: task(title) }), seed()); }
const project = data => data.engineeringProjects[0];

describe("Kanban de projetos e atividades", () => {
  it("move o cartão de projeto preservando horas, vínculos e revisões", () => {
    let data = seed();
    data = ok(data, CMD.ENG_PROJECT_MOVED, { stage: "Anteprojeto" });
    expect(project(data)).toMatchObject({ stage: "Anteprojeto", status: "ativo", sessions: [], revisions: [], obraId: "a" });
    expect(project(data).history.at(-1).detail).toContain("Executivo → Anteprojeto");
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Executivo" }, 1).ok).toBe(false);
  });
  it("ordena projetos dentro da coluna e preserva a ordem após serialização", () => {
    let data = seed();
    data = ok(data, CMD.ENG_PROJECT_SAVED, { projectId: "p2", project: { ...form, name: "Segundo" } }, 0);
    data = ok(data, CMD.ENG_PROJECT_MOVED, { projectId: "p2", stage: "Executivo", beforeId: "p1" }, 1);
    expect(orderedProjects(JSON.parse(JSON.stringify(data.engineeringProjects))).map(item => item.id)).toEqual(["p2", "p1"]);
    expect(project(data).version).toBe(1);
  });
  it("rejeita destino inexistente, referência de outra coluna e projeto arquivado", () => {
    let data = seed();
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Inexistente" }).ok).toBe(false);
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Executivo", beforeId: "missing" }).ok).toBe(false);
    data = ok(data, CMD.ENG_PROJECT_SAVED, { project: { ...form, status: "arquivado" } });
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Executivo" }).reason).toContain("arquivado");
  });
  it("muda situação e ordem da atividade sem substituir seus metadados", () => {
    let data = withTasks();
    const [first, second, third] = project(data).tasks;
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: third.id, status: "pendente", beforeId: first.id });
    expect(project(data).tasks.map(item => item.id)).toEqual([third.id, first.id, second.id]);
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: third.id, status: "em_revisao" });
    expect(project(data).tasks.find(item => item.id === third.id)).toMatchObject({ title: "Terceira", status: "em_revisao", responsibleId: "u1" });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "pendente", beforeId: third.id }).ok).toBe(false);
  });
  it("limite de produção vale para criação, movimento e tentativa concorrente", () => {
    let data = withTasks();
    data = ok(data, CMD.ENG_PROJECT_SAVED, { project: { ...form, kanbanLimits: { em_andamento: 1, em_revisao: 1 } } });
    const [first, second] = project(data).tasks;
    const oldVersion = project(data).version;
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "em_andamento" });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "em_andamento" }, oldVersion).reason).toContain("alterado");
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "em_andamento" }).reason).toContain("limite");
    expect(apply(data, CMD.ENG_TASK_SAVED, { task: task("Quarta", { status: "em_andamento" }) }).reason).toContain("limite");
    data = ok(data, CMD.ENG_PROJECT_SAVED, { project: { ...form, kanbanLimits: { em_andamento: 0 } } });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "em_andamento" }).ok).toBe(true);
  });
  it.each([-1, 1.5, "bad", 1001])("recusa limite inválido %s", limit => {
    expect(apply(seed(), CMD.ENG_PROJECT_SAVED, { project: { ...form, kanbanLimits: { em_andamento: limit } } }).ok).toBe(false);
  });
  it("checklist incompleto bloqueia conclusão; alterações preservam histórico", () => {
    let data = ok(seed(), CMD.ENG_TASK_SAVED, { task: task("Conferir", { checklist: [{ id: "c1", text: "Conferir cotas", done: false }] }) });
    const current = project(data).tasks[0];
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: current.id, status: "concluida" }).reason).toContain("checklist");
    data = ok(data, CMD.ENG_CHECKLIST_TOGGLED, { taskId: current.id, itemId: "c1", done: true });
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: current.id, status: "concluida" });
    expect(project(data).tasks[0].checklist[0].done).toBe(true);
    expect(apply(data, CMD.ENG_CHECKLIST_TOGGLED, { taskId: current.id, itemId: "c1", done: false }).ok).toBe(false);
  });
  it("dependências bloqueiam início e conclusão; ciclos e referências externas são recusados", () => {
    let data = withTasks();
    const [first, second] = project(data).tasks;
    data = ok(data, CMD.ENG_TASK_SAVED, { task: { ...second, dependencies: [first.id] } });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "em_andamento" }).reason).toContain("predecessoras");
    expect(apply(data, CMD.ENG_TIMER_STARTED, { taskId: second.id }).reason).toContain("predecessoras");
    expect(apply(data, CMD.ENG_TASK_SAVED, { task: { ...first, dependencies: [second.id] } }).reason).toContain("ciclo");
    expect(apply(data, CMD.ENG_TASK_SAVED, { task: { ...first, dependencies: ["another-project-task"] } }).ok).toBe(false);
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "concluida" });
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "concluida" });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "pendente" }).reason).toContain("dependentes");
    expect(apply(data, CMD.ENG_TASK_SAVED, { task: { ...first, status: "pendente" } }).reason).toContain("dependentes");
  });
  it("não conclui atividade com sessão aberta nem inicia atividade concluída ou bloqueada", () => {
    let data = withTasks();
    const [first, second] = project(data).tasks;
    data = ok(data, CMD.ENG_TIMER_STARTED, { taskId: first.id });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "concluida" }).reason).toContain("cronômetro");
    data = ok(data, CMD.ENG_TIMER_STOPPED, { sessionId: project(data).sessions[0].id });
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId: first.id, status: "concluida" });
    expect(apply(data, CMD.ENG_TIMER_STARTED, { taskId: first.id }).ok).toBe(false);
    data = ok(data, CMD.ENG_TASK_SAVED, { task: { ...second, blockedReason: "Aguardando levantamento" } });
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId: second.id, status: "em_revisao" }).reason).toContain("bloqueada");
    expect(apply(data, CMD.ENG_TIMER_STARTED, { taskId: second.id }).ok).toBe(false);
  });
  it("última revisão deve estar aprovada quando a atividade ou o projeto exigem parecer", () => {
    let data = ok(seed(), CMD.ENG_LINK_ADDED, { title: "Memorial", url: "https://example.com/memorial" });
    const linkId = project(data).links[0].id;
    data = ok(data, CMD.ENG_TASK_SAVED, { task: task("Emitir", { requireReview: true, linkId }) });
    const taskId = project(data).tasks[0].id;
    expect(apply(data, CMD.ENG_TASK_MOVED, { taskId, status: "concluida" }).reason).toContain("aprovada");
    data = ok(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r1", description: "Inicial" });
    data = ok(data, CMD.ENG_REVISION_REVIEWED, { revisionId: project(data).revisions[0].id, status: "aprovada", comment: "Conferido" });
    data = ok(data, CMD.ENG_TASK_MOVED, { taskId, status: "concluida" });
    data = ok(data, CMD.ENG_PROJECT_SAVED, { project: { ...form, requireApprovedDeliveries: true } });
    data = ok(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r2", description: "Mudança" });
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Concluído" }).reason).toContain("aprovada");
    data = ok(data, CMD.ENG_REVISION_REVIEWED, { revisionId: project(data).revisions[1].id, status: "aprovada", comment: "Conferido novamente" });
    data = ok(data, CMD.ENG_PROJECT_MOVED, { stage: "Concluído" });
    expect(project(data)).toMatchObject({ status: "concluido", stage: "Concluído" });
    data = ok(data, CMD.ENG_PROJECT_MOVED, { stage: "Executivo" });
    expect(projectColumn(project(data))).toBe("Executivo");
  });
  it("comentários são auditados e o formulário não pode apagá-los nem forjar autoria", () => {
    let data = withTasks();
    const current = project(data).tasks[0];
    data = ok(data, CMD.ENG_TASK_COMMENT_ADDED, { taskId: current.id, comment: "Conferir detalhe", by: "forged" });
    const before = project(data).tasks[0].comments;
    expect(before[0]).toMatchObject({ byId: "u1", by: "Ana", text: "Conferir detalhe" });
    data = ok(data, CMD.ENG_TASK_SAVED, { task: { ...current, title: "Revisar detalhe", comments: [] } });
    expect(project(data).tasks[0].comments).toEqual(before);
  });
  it("não conclui projeto com trabalho pendente nem exige revisão de projeto legado por padrão", () => {
    expect(apply(withTasks(), CMD.ENG_PROJECT_MOVED, { stage: "Concluído" }).reason).toContain("atividades");
    let data = seed();
    data = ok(data, CMD.ENG_PROJECT_MOVED, { stage: "Concluído" });
    expect(project(data).status).toBe("concluido");
    data = ok(data, CMD.ENG_PROJECT_MOVED, { stage: "Executivo" });
    data = ok(data, CMD.ENG_PROJECT_SAVED, { project: { ...form, requireApprovedDeliveries: true } });
    expect(apply(data, CMD.ENG_PROJECT_MOVED, { stage: "Concluído" }).reason).toContain("aprovada");
  });
});
