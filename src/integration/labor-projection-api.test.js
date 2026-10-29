import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ profile: null, data: {}, writes: 0, reads: 0, archiveReads: 0,
  archives: {}, versionChanges: false, archiveChanges: false, authenticated: true }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: state.authenticated ? { id: "auth-labor" } : null }, error: null }) },
  from(table) {
    let key = "", list = false;
    const write = () => { state.writes += 1; throw new Error("A consulta tentou gravar dados"); };
    const query = {
      select() { return query; }, eq(field, value) { if (field === "key") key = value; return query; },
      in() { list = true; return query; }, like() { list = true; return query; },
      order() { return query; }, range() { return query; }, update: write, insert: write, upsert: write, delete: write,
      async maybeSingle() {
        if (key.includes("__arq__")) {
          state.archiveReads += 1;
          const row = state.archives[key];
          return { data: row ? { key, value: row, updated_at: state.archiveChanges && state.archiveReads > 1
            ? "2026-10-29T13:01:00Z" : "2026-10-20T12:00:00Z" } : null, error: null };
        }
        state.reads += 1;
        return { data: { value: { ...state.data, usuarios: [state.profile] }, updated_at:
          state.versionChanges && state.reads > 1 ? "2026-10-29T13:01:00Z" : "2026-10-29T12:00:00Z" }, error: null };
      },
      then(resolve, reject) {
        if (table !== "company_app_data" || !list) throw new Error("Leitura inesperada na consulta de projeção");
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return query;
  },
  rpc: async () => ({ data: null, error: null }),
}) }));

let handler, sequence = 0;
const call = async (fields = {}) => {
  let status = 200, json;
  const res = { status(value) { status = value; return res; }, json(value) { json = value; return value; } };
  await handler({ method: "POST", body: { action: "labor-projection-report", accessToken: `labor-test-${++sequence}`, ...fields },
    query: {}, headers: {} }, res);
  return { status, json };
};
const makeData = () => {
  const attendance = { e1: {}, e2: {} };
  for (let date = new Date("2026-07-21T12:00:00Z"); date.toISOString().slice(0, 10) <= "2026-10-28"; date.setUTCDate(date.getUTCDate() + 1)) {
    if ([0, 6].includes(date.getUTCDay())) continue;
    const iso = date.toISOString().slice(0, 10);
    attendance.e1[iso] = { status: "P", obraId: "w1", note: "NOTA MÉDICA PRIVADA", ot: 0 };
    attendance.e2[iso] = { status: "P", obraId: "w2", ot: 0 };
  }
  return { obras: [{ id: "w1", name: "Obra A" }, { id: "w2", name: "Obra B" }],
    employees: [
      { id: "e1", name: "Nome individual restrito", role: "Pedreiro", obra: "w1", workArea: "campo", active: true,
        dailyRate: 150, vtDaily: 0, vrDaily: 0, remunerationMode: "daily", startDate: "2026-01-01",
        cpf: "11122233344", pixKey: "pix-restrito", facialVector: [0.4, 0.2] },
      { id: "e2", name: "Outra pessoa restrita", role: "Pedreiro", obra: "w2", workArea: "campo", active: true,
        dailyRate: 200, vtDaily: 0, vrDaily: 0, remunerationMode: "daily", startDate: "2026-01-01" },
    ], attendance, config: {}, advances: [], titulosFolha: [], pagamentosFolha: [] };
};

describe("API autenticada da projeção da quinzena ativa", () => {
  beforeAll(async () => {
    process.env.SUPABASE_URL = "https://labor-projection.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-key";
    ({ default: handler } = await import("../../api/data.js"));
  }, 30000);
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T15:00:00Z"));
    Object.assign(state, { profile: { id: "u1", authUserId: "auth-labor", nome: "Administrador", role: "admin", active: true },
      data: makeData(), writes: 0, reads: 0, archiveReads: 0, archives: {}, versionChanges: false,
      archiveChanges: false, authenticated: true });
  });
  afterEach(() => vi.useRealTimers());

  it("usa corte e valores do servidor, entrega memória mínima e não grava a simulação", async () => {
    const before = structuredClone(state.data);
    const result = await call({ asOf: "2040-01-01", company: "outra", rate: 0.99, salary: 1,
      total: 1, filters: {} });
    expect(result.status).toBe(200);
    expect(result.json.report).toMatchObject({ asOf: "2026-10-29", timeZone: "America/Bahia",
      period: { key: "2026-10-Q2", startDate: "2026-10-21", endDate: "2026-11-05" },
      history: { startDate: "2026-07-21", endDate: "2026-10-20" }, permissions: { canViewPeople: true } });
    expect(result.json.report.people).toHaveLength(2);
    expect(result.json.report.totals.projectedCost).toBeGreaterThan(1);
    expect(result.json.report.sourceVersion).toBeTruthy();
    const serialized = JSON.stringify(result.json);
    for (const secret of ["11122233344", "pix-restrito", "NOTA MÉDICA PRIVADA", "facialVector", "_cashBasis"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(state.writes).toBe(0);
    expect(state.data).toEqual(before);
  });

  it("financeiro recebe agregados sem nomes, memória nem opções individuais", async () => {
    state.profile.role = "financeiro";
    const result = await call();
    expect(result.status).toBe(200);
    expect(result.json.report.permissions.canViewPeople).toBe(false);
    expect(result.json.report.people || []).toEqual([]);
    expect(result.json.report.options.employees || []).toEqual([]);
    const serialized = JSON.stringify(result.json);
    expect(serialized).not.toContain("Nome individual restrito");
    expect(serialized).not.toContain("Outra pessoa restrita");
    expect([...result.json.report.issues,...result.json.report.cash.issues]
      .every(issue=>!Object.hasOwn(issue,"employeeId"))).toBe(true);
    expect(result.json.report.filters.employeeId).toBe("");
    expect((await call({ filters: { employeeId: "e1" } })).status).toBe(403);
  });

  it("impõe obra do usuário por parcela e nega filtros fora do escopo", async () => {
    const all = await call();
    state.profile.obraId = "w1";
    const scoped = await call();
    expect(scoped.status).toBe(200);
    expect(scoped.json.report.filters).toMatchObject({ area: "works", obraId: "w1" });
    expect(scoped.json.report.groups.every(group => group.obraId === "w1")).toBe(true);
    expect(scoped.json.report.people.flatMap(person => person.days).every(day => day.obraId === "w1")).toBe(true);
    expect(scoped.json.report.totals.projectedCost).toBeLessThan(all.json.report.totals.projectedCost);
    expect(JSON.stringify(scoped.json)).not.toContain("Obra B");
    expect((await call({ filters: { obraId: "w2" } })).status).toBe(403);
    expect((await call({ filters: { area: "administrative" } })).status).toBe(403);
  });

  it("mantém subtotal conhecido quando outra pessoa da mesma obra tem pagamento sem data", async () => {
    state.profile.obraId = "w1";
    state.data.employees[1].obra = "w1";
    for (const record of Object.values(state.data.attendance.e2)) record.obraId = "w1";
    state.data.titulosFolha = [{ id: "title-e2", employeeId: "e2", periodKey: "2026-10-Q2",
      liquido: 800, valorPago: 100, rateiosPorObra: [{ obraId: "w1", valor: 800 }] }];
    const result = await call();
    expect(result.status).toBe(200);
    expect(result.json.report.cash.remainingToPay).toBeNull();
    expect(result.json.report.cash.knownRemainingToPay).toBeGreaterThan(0);
    expect(result.json.report.cash.responsibilities[0].knownRemainingToPay)
      .toBe(result.json.report.cash.knownRemainingToPay);
  });

  it("mantém opções autorizadas de pessoas após filtrar uma delas", async () => {
    state.profile.obraId = "w1";
    state.data.employees[1].obra = "w1";
    for (const record of Object.values(state.data.attendance.e2)) record.obraId = "w1";
    const result = await call({ filters: { employeeId: "e1" } });
    expect(result.status).toBe(200);
    expect(result.json.report.people.map(person => person.id)).toEqual(["e1"]);
    expect(result.json.report.options.employees.map(person => person.id).sort()).toEqual(["e1", "e2"]);
    expect(result.json.report).not.toHaveProperty("_authorizedPeople");
  });

  it("nega papel, aba personalizada e sessão inválida antes de ler arquivos", async () => {
    for (const profile of [{ role: "engenheiro", accessTabs: ["folha", "relat"] },
      { role: "financeiro", accessTabs: ["fin"] }, { role: "rh", accessTabs: ["rh"] }]) {
      Object.assign(state.profile, profile);
      expect((await call()).status).toBe(403);
    }
    expect(state.archiveReads).toBe(0);
    state.authenticated = false;
    expect((await call()).status).toBe(401);
    expect(state.writes).toBe(0);
  });

  it("não muda a janela na virada do mês e respeita a data empresarial", async () => {
    vi.setSystemTime(new Date("2026-11-01T01:00:00Z"));
    const result = await call();
    expect(result.json.report.asOf).toBe("2026-10-31");
    expect(result.json.report.period.key).toBe("2026-10-Q2");
    expect(result.json.report.history.startDate).toBe("2026-07-21");
  });

  it("rejeita filtro inválido e versão composta alterada durante a leitura", async () => {
    expect((await call({ filters: { area: "futuro" } })).status).toBe(400);
    state.reads = 0;
    state.versionChanges = true;
    const result = await call();
    expect(result.status).toBe(409);
    expect(result.json.code).toBe("LABOR_SOURCE_CHANGED");
  });

  it("identifica arquivo ausente e não anuncia cobertura histórica completa", async () => {
    state.data.quinzenasArquivadas = { "2026-09-Q1": { inicio: "2026-09-06", fim: "2026-09-20", archivedAt: "2026-09-21T12:00:00Z" } };
    const result = await call();
    expect(result.status).toBe(200);
    expect(result.json.report.issues.some(issue => issue.code.includes("ARCHIVE") && issue.severity === "warning")).toBe(true);
    expect(result.json.report.history.coverage).toBeLessThan(1);
    expect(state.archiveReads).toBeGreaterThan(0);
  });

  it("recusa arquivo alterado entre as duas leituras", async () => {
    state.data.quinzenasArquivadas = { "2026-09-Q1": { inicio: "2026-09-06", fim: "2026-09-20", archivedAt: "2026-09-21T12:00:00Z" } };
    state.archives["arced_ponto_v1__arq__2026-09-Q1"] = { meta: { quinzenaId: "2026-09-Q1" },
      attendance: { e1: { "2026-09-08": { status: "P", obraId: "w1" } } }, employeesSnapshot: state.data.employees };
    state.archiveChanges = true;
    const result = await call();
    expect(result.status).toBe(409);
    expect(result.json.code).toBe("LABOR_ARCHIVE_CHANGED");
    expect(state.writes).toBe(0);
  });
});
