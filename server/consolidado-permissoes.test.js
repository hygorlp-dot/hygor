import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateOperationalCommandScope } from "./operational-command-policy.js";
import { projectDataForUser } from "./data-projection.js";
import { validatePlanningBaselinePolicy } from "./section-authorizations.js";
import { ACCOUNTING_COMMAND, validateAccountingSnapshotPolicy } from "../src/domains/financeiro/accounting-indicators.js";
import { BASELINE_COMMAND } from "../src/domains/planejamento/approved-baseline.js";

// Regras de acesso que vieram com a base contábil, a linha de base aprovada e
// o RDO resumido do financeiro (release consolidado de 02/11). Cada regra é
// conferida nos dois sentidos: quem pode e quem é recusado.
const data = { obras: [{ id: "obra-a" }, { id: "obra-b" }] };
const accounting = { type: ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED, payload: {} };
const proposed = { type: BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED, payload: { obraId: "obra-a" } };
const approved = { type: BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED, payload: { obraId: "obra-a" } };
const scope = (user, command) => validateOperationalCommandScope({ user, data, command });

describe("base contábil da empresa", () => {
  it("aceita só administrador ou financeiro sem obra vinculada", () => {
    expect(scope({ role: "admin" }, accounting)).toMatchObject({ ok: true, scope: "company" });
    expect(scope({ role: "financeiro" }, accounting)).toMatchObject({ ok: true, scope: "company" });
    expect(scope({ role: "financeiro", obraId: "obra-a" }, accounting)).toMatchObject({ ok: false });
    expect(scope({ role: "admin", active: false }, accounting)).toMatchObject({ ok: false });
    for (const role of ["engenheiro", "compras", "rh", "diretoria", "planejamento"]) {
      expect(scope({ role }, accounting)).toMatchObject({ ok: false });
    }
  });

  it("só entrega as bases contábeis a quem pode usá-las", () => {
    const payload = { accountingBases: [{ id: "base-1", saldo: 1000 }], obras: data.obras };
    expect(projectDataForUser(payload, { role: "admin" }).accountingBases).toEqual(payload.accountingBases);
    expect(projectDataForUser(payload, { role: "financeiro" }).accountingBases).toEqual(payload.accountingBases);
    expect(projectDataForUser(payload, { role: "admin", obraId: "obra-a" }).accountingBases).toBeUndefined();
    for (const role of ["engenheiro", "compras", "rh", "planejamento"]) {
      expect(projectDataForUser(payload, { role }).accountingBases).toBeUndefined();
    }
  });

  it("recusa gravar bases contábeis fora dos comandos próprios (403 no servidor)", () => {
    const before = { accountingBases: [{ id: "base-1", saldo: 1000 }] };
    expect(validateAccountingSnapshotPolicy(before, { ...before })).toBe("");
    expect(validateAccountingSnapshotPolicy(before, { accountingBases: [{ id: "base-1", saldo: 9999 }] })).toMatch(/comandos próprios/);
    expect(validateAccountingSnapshotPolicy(before, { accountingBases: [] })).toMatch(/comandos próprios/);
    const api = fs.readFileSync(path.resolve(process.cwd(), "api/data.js"), "utf8");
    expect(api.match(/if\(erroBaseContabil\)return (?:res\.status\(403\)|\{kind:"error",status:403)/g)).toHaveLength(3);
  });
});

describe("linha de base aprovada do planejamento", () => {
  // Os papéis "diretoria" e "planejamento" citados na política não existem no
  // cadastro (ROLE_TABS); na prática propõe engenharia da obra e aprova o admin.
  it("proposta: admin e engenharia da própria obra", () => {
    expect(scope({ role: "admin" }, proposed)).toMatchObject({ ok: true, obraId: "obra-a", scope: "work" });
    expect(scope({ role: "engenheiro", obraId: "obra-a" }, proposed)).toMatchObject({ ok: true });
    expect(scope({ role: "engenheiro_auditor", obraId: "obra-a" }, proposed)).toMatchObject({ ok: true });
    expect(scope({ role: "engenheiro", obraId: "obra-b" }, proposed)).toMatchObject({ ok: false });
    expect(scope({ role: "financeiro" }, proposed)).toMatchObject({ ok: false });
    expect(scope({ role: "compras" }, proposed)).toMatchObject({ ok: false });
    expect(scope({ role: "admin" }, { ...proposed, payload: { obraId: "obra-inexistente" } })).toMatchObject({ ok: false });
  });

  it("aprovação: só o administrador", () => {
    expect(scope({ role: "admin" }, approved)).toMatchObject({ ok: true });
    expect(scope({ role: "admin", active: false }, approved)).toMatchObject({ ok: false });
    for (const role of ["engenheiro", "engenheiro_auditor", "financeiro", "compras", "rh", "comercial", "visualizador"]) {
      expect(scope({ role, obraId: "obra-a" }, approved)).toMatchObject({ ok: false });
    }
  });

  it("histórico versionado não muda por gravação de seção", () => {
    const base = { id: "lb-1", schemaVersion: 2, obraId: "obra-a", status: "aprovada", number: 1 };
    const previous = { scheduleBaselines: [base] };
    expect(validatePlanningBaselinePolicy(previous, { scheduleBaselines: [{ ...base, status: "proposta" }] }, { role: "admin" })).toMatch(/imutável/);
    expect(validatePlanningBaselinePolicy(previous, { scheduleBaselines: [] }, { role: "admin" })).toMatch(/imutável/);
  });
});

describe("RDO resumido para o financeiro", () => {
  // Formato real do RDO (campos de diarioObra): o financeiro precisa da
  // produção para o relatório por obra, nunca de fotos, presenças ou falas.
  const rdo = {
    id: "rdo-1", obraId: "obra-a", data: "2026-11-01", status: "concluido", version: 3, productionVersion: 1,
    servicos: [{ tarefaId: "t-1", quantidade: 12, unidade: "m²", horas: 16 }],
    revisaoEngenheiro: { status: "revisado", em: "2026-11-02" },
    fotos: ["foto.jpg"], anexos: ["laudo.pdf"], presencas: [{ employeeId: "e-1", horas: 8 }], efetivo: 4,
    ocorrencias: ["chuva"], comentarios: [{ autor: "Ana", texto: "interno" }], transcricaoVoz: "fala gravada", reflexaoIA: { texto: "resumo" },
  };
  const payload = { obras: data.obras, rdos: [rdo, { ...rdo, id: "rdo-2", obraId: "obra-b" }] };

  it("financeiro da obra recebe só os campos de produção do RDO da própria obra", () => {
    const out = projectDataForUser(payload, { role: "financeiro", obraId: "obra-a" }).rdos;
    expect(out.map(r => r.id)).toEqual(["rdo-1"]);
    expect(Object.keys(out[0]).sort()).toEqual(["data", "id", "obraId", "productionVersion", "revisaoEngenheiro", "servicos", "status", "version"]);
    for (const field of ["fotos", "anexos", "presencas", "efetivo", "ocorrencias", "comentarios", "transcricaoVoz", "reflexaoIA"]) expect(out[0]).not.toHaveProperty(field);
  });

  it("compras continua sem RDO", () => {
    expect(projectDataForUser(payload, { role: "compras", obraId: "obra-a" }).rdos).toBeUndefined();
  });
});
