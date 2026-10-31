import { describe, expect, it } from "vitest";
import { validateEngineeringScope } from "./engineering-project-policy.js";
import { projectDataForUser } from "./data-projection.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";
import { ENGINEERING_COMMAND as CMD } from "../src/domains/projetos/commands.js";

const data = { obras: [{ id: "a" }, { id: "b" }], engineeringProjects: [{ id: "pa", obraId: "a", sessions: [] }, { id: "pb", obraId: "b", sessions: [] }, { id: "office", obraId: "", sessions: [] }] };
const user = { id: "engineer", role: "engenheiro", obraId: "a" };
const command = projectId => ({ type: CMD.ENG_TIMER_STARTED, payload: { projectId, obraId: "a" } });
describe("autorização de projetos", () => {
  it("valida a obra do registro persistido e ignora obraId forjado no comando", () => {
    expect(validateOperationalCommandScope({ user, data, command: command("pa") }).ok).toBe(true);
    expect(validateOperationalCommandScope({ user, data, command: command("pb") }).ok).toBe(false);
    expect(validateOperationalCommandScope({ user, data, command: command("office") }).ok).toBe(false);
  });
  it("respeita concessão e revogação explícita da aba", () => {
    expect(validateEngineeringScope({ user: { ...user, accessTabs: [] }, data, command: command("pa") }).ok).toBe(false);
    expect(validateEngineeringScope({ user: { role: "financeiro" }, data, command: command("pa") }).ok).toBe(false);
    expect(validateEngineeringScope({ user: { role: "financeiro", accessTabs: ["projetos"] }, data, command: command("pa") }).ok).toBe(true);
  });
  it("bloqueia criação em outra obra e permite projeto de escritório ao operador sem restrição", () => {
    const creation = { type: CMD.ENG_PROJECT_SAVED, payload: { projectId: "new", project: { obraId: "b" } } };
    expect(validateEngineeringScope({ user, data, command: creation }).ok).toBe(false);
    expect(validateEngineeringScope({ user: { ...user, obraId: "" }, data, command: { ...creation, payload: { projectId: "new", project: { obraId: "" } } } }).ok).toBe(true);
  });
  it("não envia projetos de outras obras nem de escritório ao perfil restrito", () => {
    expect(projectDataForUser(data, user).engineeringProjects.map(project => project.id)).toEqual(["pa"]);
    expect(projectDataForUser(data, { ...user, obraId: "" }).engineeringProjects).toHaveLength(3);
    expect(projectDataForUser(data, { ...user, accessTabs: [] }).engineeringProjects).toBeUndefined();
    expect(projectDataForUser(data, { role: "financeiro" }).engineeringProjects).toBeUndefined();
    expect(projectDataForUser(data, { role: "financeiro", accessTabs: ["projetos"], obraId: "b" }).engineeringProjects.map(project => project.id)).toEqual(["pb"]);
  });
});
