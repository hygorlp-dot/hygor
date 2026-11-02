import { describe, it, expect } from "vitest";
import { applyOperationalCommand } from "../sync/operational-commands.js";
import { ENGINEERING_COMMAND as CMD } from "./commands.js";
import { safeProjectUrl, sessionSeconds, projectSeconds, formatDuration } from "./model.js";

const at = "2026-10-31T12:00:00.000Z";
const user = { id: "u1", nome: "Ana", role: "engenheiro", active: true };
const form = { name: "Casa Portugal", obraId: "a", responsibleId: user.id, discipline: "Arquitetura", stage: "Executivo", status: "ativo", plannedHours: 40, deadline: "2026-11-30" };
const initial = () => ({ obras: [{ id: "a" }], usuarios: [user], engineeringProjects: [], payments: [{ id: "financial-untouched" }] });
let sequence = 0;
const command = (type, payload = {}, expectedVersion, overrides = {}) => ({ type, payload: { projectId: "p1", ...payload }, expectedVersion, idempotencyKey: `engineering-operation-${++sequence}`, actorId: user.id, actorRole: user.role, actorName: user.nome, now: at, ...overrides });
const created = () => applyOperationalCommand(initial(), command(CMD.ENG_PROJECT_SAVED, { project: form }, 0)).data;
const success = (data, type, payload = {}, version = data.engineeringProjects[0].version, overrides = {}) => {
  const result = applyOperationalCommand(data, command(type, payload, version, overrides));
  expect(result.ok, result.reason).toBe(true);
  return result.data;
};

describe("projetos de engenharia: persistência por comandos", () => {
  it("cria projeto sem alterar finanças e descarta campos internos do formulário", () => {
    const data = success(initial(), CMD.ENG_PROJECT_SAVED, { project: { ...form, sessions: [{ malicious: true }], revisions: [{ status: "aprovada" }] } }, 0);
    expect(data.engineeringProjects[0]).toMatchObject({ name: form.name, version: 1, sessions: [], revisions: [], createdAt: at, createdById: user.id });
    expect(data.payments).toEqual(initial().payments);
  });
  it("preserva links, sessões e revisões quando edita cadastro e rejeita versão obsoleta", () => {
    const linked = success(created(), CMD.ENG_LINK_ADDED, { title: "Modelo", url: "https://example.com/model" });
    const result = applyOperationalCommand(linked, command(CMD.ENG_PROJECT_SAVED, { project: { ...form, name: "Casa atualizada", links: [] } }, 1));
    expect(result.ok).toBe(false);
    const edited = success(linked, CMD.ENG_PROJECT_SAVED, { project: { ...form, name: "Casa atualizada", links: [] } });
    expect(edited.engineeringProjects[0].links).toHaveLength(1);
  });
  it.each([{ deadline: "2026-02-30" }, { plannedHours: -1 }, { plannedHours: "Infinity" }, { responsibleId: "missing" }, { stage: "inválida" }, { status: "__proto__" }, { obraId: "missing" }])("valida cadastro %j", patch => {
    expect(applyOperationalCommand(initial(), command(CMD.ENG_PROJECT_SAVED, { project: { ...form, ...patch } }, 0)).ok).toBe(false);
  });
  it("não transfere projeto para outra obra", () => {
    const data = created(); data.obras.push({ id: "b" });
    expect(applyOperationalCommand(data, command(CMD.ENG_PROJECT_SAVED, { project: { ...form, obraId: "b" } }, 1)).ok).toBe(false);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///c:/project.dwg", "https://user:password@example.com", "relative/path"])("bloqueia endereço inseguro %s", url => {
    expect(safeProjectUrl(url)).toBe("");
    expect(applyOperationalCommand(created(), command(CMD.ENG_LINK_ADDED, { title: "Arquivo", url }, 1)).ok).toBe(false);
  });
  it("cronômetro usa timestamps e sobrevive à serialização e à recarga", () => {
    const start = command(CMD.ENG_TIMER_STARTED, { note: "Detalhamento" });
    const running = applyOperationalCommand(created(), start).data;
    const roundTrip = JSON.parse(JSON.stringify(running));
    expect(sessionSeconds(roundTrip.engineeringProjects[0].sessions[0], Date.parse(at) + 90000)).toBe(90);
    const stopped = success(roundTrip, CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey }, undefined, { now: "2026-10-31T13:30:00.000Z" });
    expect(projectSeconds(stopped.engineeringProjects[0], Date.parse(at) + 99999999)).toBe(5400);
    expect(formatDuration(5400)).toBe("01:30:00");
  });
  it("impede duas sessões do mesmo usuário, inclusive em projetos diferentes", () => {
    const data = success(created(), CMD.ENG_PROJECT_SAVED, { projectId: "p2", project: form }, 0);
    const running = success(data, CMD.ENG_TIMER_STARTED);
    expect(applyOperationalCommand(running, command(CMD.ENG_TIMER_STARTED, { projectId: "p2" })).reason).toContain("já possui");
    expect(applyOperationalCommand(running, command(CMD.ENG_TIMER_STARTED)).ok).toBe(false);
    expect(success(running, CMD.ENG_TIMER_STARTED, {}, undefined, { actorId: "u2" }).engineeringProjects[0].sessions).toHaveLength(2);
  });
  it("deduplica reenvio com a mesma chave sem criar sessão duplicada", () => {
    const start = command(CMD.ENG_TIMER_STARTED);
    const running = applyOperationalCommand(created(), start).data;
    const retry = applyOperationalCommand(running, start);
    expect(retry).toMatchObject({ ok: true, idempotent: true });
    expect(retry.data.engineeringProjects[0].sessions).toHaveLength(1);
  });
  it("só o dono pausa a sessão, recusa pausa repetida e horário anterior", () => {
    const start = command(CMD.ENG_TIMER_STARTED);
    const running = applyOperationalCommand(created(), start).data;
    expect(applyOperationalCommand(running, command(CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey }, undefined, { actorId: "other" })).ok).toBe(false);
    expect(applyOperationalCommand(running, command(CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey }, undefined, { now: "2026-10-30T12:00:00Z" })).ok).toBe(false);
    const stopped = success(running, CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey });
    expect(applyOperationalCommand(stopped, command(CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey })).ok).toBe(false);
  });
  it("reenvio antigo continua idempotente após expirar a janela compartilhada de recibos", () => {
    const start = command(CMD.ENG_TIMER_STARTED);
    const running = applyOperationalCommand(created(), start).data;
    const stopped = success(running, CMD.ENG_TIMER_STOPPED, { sessionId: start.idempotencyKey });
    stopped.operationalCommandReceipts = [];
    const retry = applyOperationalCommand(stopped, start);
    expect(retry).toMatchObject({ ok: true, idempotent: true });
    expect(retry.data.engineeringProjects[0].sessions).toHaveLength(1);
    expect(retry.data.engineeringProjects[0].sessions[0].endedAt).toBe(at);
  });
  it("ajustes exigem justificativa e preservam o antes/depois na auditoria", () => {
    const running = success(created(), CMD.ENG_TIMER_STARTED);
    const sessionId = running.engineeringProjects[0].sessions[0].id;
    const stopped = success(running, CMD.ENG_TIMER_STOPPED, { sessionId }, undefined, { now: "2026-10-31T13:00:00Z" });
    expect(applyOperationalCommand(stopped, command(CMD.ENG_TIME_ADJUSTED, { sessionId, seconds: 1800 }, 3)).ok).toBe(false);
    const adjusted = success(stopped, CMD.ENG_TIME_ADJUSTED, { sessionId, seconds: 1800, reason: "Intervalo não descontado" });
    expect(projectSeconds(adjusted.engineeringProjects[0])).toBe(1800);
    expect(adjusted.engineeringProjects[0].sessions[0].endedAt).toBe("2026-10-31T13:00:00Z");
    expect(adjusted.engineeringProjects[0].history.at(-1).detail).toContain("3600s → 1800s");
    expect(applyOperationalCommand(stopped, command(CMD.ENG_TIME_ADJUSTED, { sessionId, seconds: 1800, reason: "teste" }, 3, { actorId: "other" })).ok).toBe(false);
  });
  it("mantém versões anteriores e parecer imutável, nova revisão nasce pendente", () => {
    let data = success(created(), CMD.ENG_LINK_ADDED, { title: "Planta", url: "https://example.com/planta" });
    const linkId = data.engineeringProjects[0].links[0].id;
    data = success(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r1", description: "Emissão inicial" });
    const revisionId = data.engineeringProjects[0].revisions[0].id;
    data = success(data, CMD.ENG_REVISION_REVIEWED, { revisionId, status: "aprovada", comment: "Conferido" });
    expect(applyOperationalCommand(data, command(CMD.ENG_REVISION_REVIEWED, { revisionId, status: "ajustes", comment: "Substituir" }, 4)).ok).toBe(false);
    data = success(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r2", description: "Alteração de layout" });
    expect(data.engineeringProjects[0].revisions.map(revision => [revision.number, revision.status])).toEqual([[1, "aprovada"], [2, "pendente"]]);
  });
  it("não aprova revisão ultrapassada", () => {
    let data = success(created(), CMD.ENG_LINK_ADDED, { title: "Planta", url: "https://example.com" });
    const linkId = data.engineeringProjects[0].links[0].id;
    data = success(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r1", description: "Inicial" });
    const revisionId = data.engineeringProjects[0].revisions[0].id;
    data = success(data, CMD.ENG_REVISION_ADDED, { linkId, url: "https://example.com/r2", description: "Atual" });
    expect(applyOperationalCommand(data, command(CMD.ENG_REVISION_REVIEWED, { revisionId, status: "aprovada", comment: "ok" }, 4)).reason).toContain("mais recente");
  });
  it("não encerra projeto com cronômetro em andamento e bloqueia novos registros após encerramento", () => {
    const running = success(created(), CMD.ENG_TIMER_STARTED);
    expect(applyOperationalCommand(running, command(CMD.ENG_PROJECT_SAVED, { project: { ...form, status: "concluido" } }, 2)).ok).toBe(false);
    const closed = success(created(), CMD.ENG_PROJECT_SAVED, { project: { ...form, status: "concluido" } });
    expect(applyOperationalCommand(closed, command(CMD.ENG_TIMER_STARTED)).ok).toBe(false);
    expect(applyOperationalCommand(closed, command(CMD.ENG_LINK_ADDED, { title: "Arquivo", url: "https://example.com" }, 2)).ok).toBe(false);
  });
});
