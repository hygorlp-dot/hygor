import {buildLaborProjection} from "../src/domains/ponto/labor-projection.js";
import {buildLaborProjectionCash} from "../src/domains/ponto/labor-projection-cash.js";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import {
  applyLaborProjectionAccess, getLaborProjectionAccess, prepareLaborProjectionSource,
  sanitizeLaborProjectionReport, validateLaborProjectionFilters,
} from "./labor-projection.js";

const NOW = "2026-10-29T15:00:00.000Z";
const VERSION = { updatedAt: "2026-10-29T10:00:00Z", rowVersions: { core: "c1", config: "cfg1" }, rowVersionsPontoObra: { o1: "p1" } };
const employee = (extra = {}) => ({ id: "e1", name: "Pessoa de teste", role: "Pedreiro", workArea: "campo",
  obra: "o1", active: true, startDate: "2026-01-01", dailyRate: 150, vtDaily: 10, vrDaily: 15, ...extra });
const fixture = (extra = {}) => ({ employees: [employee()], obras: [{ id: "o1", name: "Obra A" }, { id: "o2", name: "Obra B" }],
  attendance: {}, config: {}, ...extra });
const archive = (extra = {}) => ({ meta: { quinzenaId: "2026-07-Q2", inicio: "2026-07-21", fim: "2026-08-05" },
  employeesSnapshot: [employee({ dailyRate: 100, obra: "o2" })],
  attendance: { e1: { "2026-07-22": { status: "F", obraId: "o2" } } }, ...extra });
const row = (payload, extra = {}) => ({ key: `arced_ponto_v1__arq__${payload.meta.quinzenaId}`,
  value: payload, updated_at: "2026-08-06T00:00:00Z", ...extra });
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const prepare = (data, archives = {}, extra = {}) => prepareLaborProjectionSource({ data,
  now: NOW, initialVersion: VERSION, readCurrentVersion: async () => VERSION,
  readArchive: async key => archives[key] || null, ...extra });
const marker = { "2026-07-Q2": { inicio: "2026-07-21", fim: "2026-08-05", archivedAt: "2026-08-06T00:00:00Z" } };
const key = "arced_ponto_v1__arq__2026-07-Q2";

describe("labor projection source: immutable archives and coherent readers", () => {
  it("uses the server business date and leaves the complete input unchanged", async () => {
    const data = freeze(fixture({ attendance: { e1: { "2026-10-28": { status: "P" } } }, archivedLaborCosts: { old: { byDate: {} } } }));
    const before = JSON.stringify(data);
    const result = await prepare(data, {}, { now: "2026-10-30T01:00:00.000Z" });
    expect(result.asOf).toBe("2026-10-29");
    expect(result.timeZone).toBe("America/Bahia");
    expect(result.data.archivedLaborCosts).toEqual({});
    expect(result.attendanceSources.e1["2026-10-28"].kind).toBe("live");
    expect(result.sourceVersion).toMatch(/^labor-source-v1:[a-f0-9]{64}$/);
    expect(JSON.stringify(data)).toBe(before);
  });

  it("loads gzip archives that intersect a boundary and preserves historic rates, dates and works", async () => {
    const payload = archive({ attendance: { e1: { "2026-07-22": { status: "P" } } } });
    const packed = { __arcdEncoding: "arcd-gzip-base64-v1", data: gzipSync(JSON.stringify(payload)).toString("base64") };
    const reader = vi.fn(async () => row(payload, { value: packed }));
    const data = freeze(fixture({ quinzenasArquivadas: marker }));
    const result = await prepare(data, {}, { readArchive: reader });
    expect(reader).toHaveBeenCalledTimes(2);
    expect(reader).toHaveBeenCalledWith(key);
    expect(result.data.attendance.e1["2026-07-22"]).toMatchObject({ status: "P", obraId: "o2", archivedDailyRate: 100 });
    expect(result.employeeSnapshotsByDate["2026-07-23"].e1).toMatchObject({ dailyRate: 100, obra: "o2" });
    expect(result.attendanceSources.e1["2026-07-22"]).toMatchObject({ kind: "archive", archiveKey: key });
    expect(result.historyIssues).toEqual([]);
  });

  it("closed archive owns both recorded and empty cells over live remnants", async () => {
    const data = fixture({ quinzenasArquivadas: marker, attendance: { e1: {
      "2026-07-22": { status: "P", obraId: "o1" }, "2026-07-23": { status: "P", obraId: "o1" },
    } } });
    const result = await prepare(data, { [key]: row(archive()) });
    expect(result.data.attendance.e1["2026-07-22"].status).toBe("F");
    expect(result.data.attendance.e1["2026-07-23"]).toBeNull();
    expect(result.attendanceSources.e1["2026-07-22"].limitedClassification).toBe(true);
  });

  it("does not move an old work-site record to the employee's current administrative area", async () => {
    const old = employee({ obra: "o2" });
    delete old.workArea;
    const result = await prepare(fixture({ employees: [employee({ obra: "", workArea: "administrativo" })],
      quinzenasArquivadas: marker }), { [key]: row(archive({ employeesSnapshot: [old] })) });
    expect(result.employeeSnapshotsByDate["2026-07-22"].e1.workArea).toBe("");
    expect(result.data.attendance.e1["2026-07-22"].obraId).toBe("o2");
  });

  it("never fills an unknown archived assignment with the current work", async () => {
    const old = employee();
    delete old.obra;
    const result = await prepare(fixture({ employees: [employee({ obra: "o1", obraId: "o1", lastObra: "o1" })],
      quinzenasArquivadas: marker }), { [key]: row(archive({ employeesSnapshot: [old],
      attendance: { e1: { "2026-07-22": { status: "P" } } } })) });
    expect(result.employeeSnapshotsByDate["2026-07-22"].e1).toMatchObject({ obra: "", obraId: "", lastObra: "" });
    expect(result.data.attendance.e1["2026-07-22"].obraId).toBe("");
  });

  it("restored periods preserve current corrections and fill gaps without losing the snapshot", async () => {
    const data = fixture({ quinzenasRestauradas: { "2026-07-Q2": { restoredAt: "2026-08-08T00:00:00Z" } },
      attendance: { e1: { "2026-07-22": { status: "M", obraId: "o1", archivedDailyRate: 90 } } } });
    const payload = archive({ attendance: { e1: {
      "2026-07-22": { status: "F", obraId: "o2" }, "2026-07-23": { status: "P", obraId: "o2" },
    } } });
    const result = await prepare(data, { [key]: row(payload) });
    expect(result.data.attendance.e1["2026-07-22"]).toMatchObject({ status: "M", obraId: "o1", archivedDailyRate: 90 });
    expect(result.attendanceSources.e1["2026-07-22"].kind).toBe("live");
    expect(result.employeeSnapshotsByDate["2026-07-22"].e1.dailyRate).toBe(100);
    expect(result.data.attendance.e1["2026-07-23"]).toMatchObject({ status: "P", archivedDailyRate: 100 });
    expect(result.attendanceSources.e1["2026-07-23"].kind).toBe("restored");
  });

  it("does not silently select one of two conflicting closed photos", async () => {
    const second = archive({ meta: { quinzenaId: "2026-08-Q1", inicio: "2026-07-22", fim: "2026-07-22" },
      attendance: { e1: { "2026-07-22": { status: "P", obraId: "o2" } } } });
    const data = fixture({ quinzenasArquivadas: { ...marker, "2026-08-Q1": second.meta } });
    const result = await prepare(data, { [key]: row(archive()), "arced_ponto_v1__arq__2026-08-Q1": row(second) });
    expect(result.data.attendance.e1["2026-07-22"]).toBeNull();
    expect(result.attendanceSources.e1["2026-07-22"].kind).toBe("conflict");
    expect(result.historyIssues).toContainEqual(expect.objectContaining({ code: "LABOR_ARCHIVE_OVERLAP_CONFLICT", employeeId: "e1", date: "2026-07-22" }));
  });

  it("identical overlapping photos count one cell", async () => {
    const first = archive();
    const second = archive({ meta: { quinzenaId: "2026-08-Q1", inicio: "2026-07-22", fim: "2026-07-22" },
      attendance: { e1: { "2026-07-22": { status: "F", obraId: "o2", note: "administrative annotation", _syncedAt: "2026-08-06T12:00:00Z" } } } });
    const result = await prepare(fixture({ quinzenasArquivadas: { ...marker, "2026-08-Q1": second.meta } }), {
      [key]: row(first), "arced_ponto_v1__arq__2026-08-Q1": row(second),
    });
    expect(result.data.attendance.e1["2026-07-22"].status).toBe("F");
    expect(result.historyIssues.filter(issue => issue.code === "LABOR_ARCHIVE_OVERLAP_CONFLICT")).toEqual([]);
  });

  it("missing closed file marks the whole range unavailable, even if a live remnant exists", async () => {
    const result = await prepare(fixture({ quinzenasArquivadas: marker,
      attendance: { e1: { "2026-07-22": { status: "P" } } } }));
    expect(result.data.attendance.e1["2026-07-22"]).toBeNull();
    expect(result.attendanceSources.e1["2026-07-22"].kind).toBe("missing");
    expect(result.historyIssues).toContainEqual(expect.objectContaining({ code: "LABOR_ARCHIVE_MISSING",
      startDate: "2026-07-21", endDate: "2026-08-05", affectsHistory: true }));
  });

  it.each(["read failure", "invalid payload", "truncated result", "count mismatch"])("reports %s as incomplete evidence", async scenario => {
    const payload = archive();
    let resultRow = row(payload);
    if (scenario === "invalid payload") resultRow.value = { unexpected: true };
    if (scenario === "truncated result") resultRow.truncated = true;
    if (scenario === "count mismatch") payload.meta.totalLancamentos = 99;
    const result = await prepare(fixture({ quinzenasArquivadas: marker }), {}, { readArchive: async () => {
      if (scenario === "read failure") throw new Error("private connection details");
      return resultRow;
    } });
    expect(result.historyIssues).not.toHaveLength(0);
    expect(JSON.stringify(result.historyIssues)).not.toContain("private connection details");
  });

  it("keeps employees now terminated in the sample and recovers an archived-only person", async () => {
    const payload = archive({ employeesSnapshot: [employee({ active: true, dailyRate: 100 })] });
    const current = await prepare(fixture({ employees: [employee({ active: false, endDate: "2026-09-01" })], quinzenasArquivadas: marker }), { [key]: row(payload) });
    expect(current.data.employees).toHaveLength(1);
    expect(current.employeeSnapshotsByDate["2026-07-22"].e1.active).toBe(true);
    const removed = await prepare(fixture({ employees: [], quinzenasArquivadas: marker }), { [key]: row(payload) });
    expect(removed.data.employees[0]).toMatchObject({ id: "e1", active: false, _laborProjectionHistoricalOnly: true, endDate: "2026-08-05" });
  });

  it("does not inherit an artificial termination date from an earlier archive", async () => {
    const second = archive({ meta: { quinzenaId: "2026-08-Q1", inicio: "2026-08-06", fim: "2026-08-20" },
      attendance: { e1: { "2026-08-10": { status: "P", obraId: "o2" } } } });
    const result = await prepare(fixture({ employees: [], quinzenasArquivadas: { ...marker, "2026-08-Q1": second.meta } }), {
      [key]: row(archive()), "arced_ponto_v1__arq__2026-08-Q1": row(second),
    });
    expect(result.employeeSnapshotsByDate["2026-08-10"].e1.endDate).toBeUndefined();
    expect(result.data.employees[0]).toMatchObject({ active: false, endDate: "2026-08-20", _laborProjectionHistoricalOnly: true });
    expect(result.data.attendance.e1["2026-08-10"].status).toBe("P");
  });

  it("loads prior context for a holiday while skipping unrelated distant periods", async () => {
    const context = archive({ meta: { quinzenaId: "2026-07-Q1", inicio: "2026-07-06", fim: "2026-07-20" } });
    const reader = vi.fn(async archiveKey => archiveKey.includes("2026-07-Q1") ? row(context) : null);
    await prepare(fixture({ quinzenasArquivadas: { "2026-07-Q1": context.meta,
      "2026-01-Q1": { inicio: "2026-01-06", fim: "2026-01-20" } } }), {}, { readArchive: reader });
    expect(reader.mock.calls.every(([archiveKey]) => archiveKey.includes("2026-07-Q1"))).toBe(true);
  });

  it("rejects composite version changes before and during reading", async () => {
    const changed = { ...VERSION, rowVersionsPontoObra: { o1: "p2" } };
    for (const versions of [[changed], [VERSION, changed]]) {
      const readCurrentVersion = vi.fn(async () => versions.shift());
      await expect(prepare(fixture(), {}, { readCurrentVersion })).rejects.toMatchObject({ status: 409, code: "LABOR_SOURCE_CHANGED" });
    }
  });

  it("captures the initial version before an asynchronous reader can mutate its object", async () => {
    const mutableVersion = structuredClone(VERSION);
    await expect(prepare(fixture(), {}, { initialVersion: mutableVersion, readCurrentVersion: async () => {
      mutableVersion.rowVersionsPontoObra.o1 = "p2";
      return mutableVersion;
    } })).rejects.toMatchObject({ status: 409, code: "LABOR_SOURCE_CHANGED" });
  });

  it("detects replaced archive content even when its updated_at was reused", async () => {
    let reads = 0;
    const reader = async () => row(archive({ attendance: { e1: { "2026-07-22": { status: ++reads === 1 ? "P" : "F" } } } }));
    await expect(prepare(fixture({ quinzenasArquivadas: marker }), {}, { readArchive: reader }))
      .rejects.toMatchObject({ status: 409, code: "LABOR_ARCHIVE_CHANGED" });
  });

  it("detects a missing file appearing halfway through a consultation", async () => {
    let reads = 0;
    await expect(prepare(fixture({ quinzenasArquivadas: marker }), {}, { readArchive: async () => ++reads === 1 ? null : row(archive()) }))
      .rejects.toMatchObject({ status: 409, code: "LABOR_ARCHIVE_CHANGED" });
  });

  it("requires a verifiable initial version and reader", async () => {
    await expect(prepare(fixture(), {}, { initialVersion: null })).rejects.toMatchObject({ status: 503 });
    await expect(prepare(fixture(), {}, { readCurrentVersion: null })).rejects.toMatchObject({ status: 503 });
    await expect(prepare(fixture(), {}, { readCurrentVersion: async () => { throw new Error("database credentials"); } }))
      .rejects.toMatchObject({ status: 503, code: "LABOR_SOURCE_VERSION_UNAVAILABLE" });
  });

  it("honors the configured dataset key instead of reading the default tenant data", async () => {
    const reader = vi.fn(async archiveKey => row(archive(), { key: archiveKey }));
    await prepare(fixture({ quinzenasArquivadas: marker }), {}, { baseKey: "company_custom", readArchive: reader });
    expect(reader.mock.calls.map(([archiveKey]) => archiveKey)).toEqual([
      "company_custom__arq__2026-07-Q2", "company_custom__arq__2026-07-Q2",
    ]);
  });

  it("conflicting closed/restored markers require a reliable chronological order", async () => {
    await expect(prepare(fixture({ quinzenasArquivadas: marker, quinzenasRestauradas: { "2026-07-Q2": {} } })))
      .rejects.toMatchObject({ status: 409, code: "LABOR_ARCHIVE_STATE_CONFLICT" });
    const result = await prepare(fixture({ quinzenasArquivadas: marker,
      quinzenasRestauradas: { "2026-07-Q2": { restoredAt: "2026-08-10T00:00:00Z" } },
      attendance: { e1: { "2026-07-22": { status: "P" } } } }), { [key]: row(archive()) });
    expect(result.data.attendance.e1["2026-07-22"].status).toBe("P");
  });

  it("produces a deterministic fingerprint independent of object property order", async () => {
    const data = fixture();
    const first = await prepare(data);
    const reordered = Object.fromEntries(Object.entries(data).reverse());
    const second = await prepare(reordered, {}, { initialVersion: { rowVersionsPontoObra: { o1: "p1" }, rowVersions: { config: "cfg1", core: "c1" }, updatedAt: VERSION.updatedAt } });
    expect(second.sourceVersion).toBe(first.sourceVersion);
  });
});

const reportFixture = () => ({ methodologyVersion: "test-v1", sourceVersion: "v1", asOf: "2026-10-29",
  period: { key: "2026-10-Q2", startDate: "2026-10-21", endDate: "2026-11-05" },
  totals: { employeeCount: 1, projectedCost: 150, actualCost: 150, fullAttendanceReserve: 150 },
  history: { eligibleDays: 30, observedDays: 30, intervals: [{ key: "h1", eligibleDays: 30, observedDays: 30 }] },
  policy: { minimumObservedDays: 20, minimumCoverage: 0.8 },
  groups: [{ id: "work:o1", kind: "work", obraId: "o1", name: "Obra A", projectedCost: 150, actualCost: 150, fullAttendanceReserve: 150 }],
  people: [{ id: "e1", name: "Pessoa de teste", role: "Pedreiro", workArea: "campo", cpf: "123.456.789-00", pixKey: "private@example.com",
    projectedCost: 150, rate: { value: 0.1, source: "individual", numerator: 3, denominator: 30, coverage: 1 },
    days: [{ date: "2026-10-28", employeeId: "e1", obraId: "o1", groupId: "work:o1", totalCost: 150, note: "medical private note", status: "P", partition: "actual" }] }],
  issues: [{ code: "SOURCE_LIMITED", severity: "warning", employeeId: "e1", message: "Pessoa de teste: medical private note 123.456.789-00" }],
  assumptions: ["Pessoa de teste: private payroll detail"], filters: { employeeId: "e1" },
  options: { works: [{ id: "o1", name: "Obra A" }, { id: "o2", name: "Obra B" }], employees: [{ id: "e1", name: "Pessoa de teste", cpf: "123.456.789-00" }], roles: ["Pedreiro"], modes: ["daily"] },
  cash: { available: true, projectedNet: 100, responsibilities: [{ payer: "construtora", obraId: "o1", employeeId: "e1", employeeName: "Pessoa de teste", projectedNet: 100 }],
    issues: [{ code: "CASH_LIMITED", employeeId: "e1", message: "Pessoa de teste: private" }] },
});

describe("labor projection access and minimal report", () => {
  it("honors role, custom tabs, inactive users and work restriction", () => {
    expect(getLaborProjectionAccess({ role: "rh" }, fixture())).toMatchObject({ allowed: true, canViewPeople: true });
    expect(getLaborProjectionAccess({ role: "financeiro" }, fixture())).toMatchObject({ allowed: true, canViewPeople: false });
    expect(getLaborProjectionAccess({ role: "financeiro", accessTabs: ["home"] }, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess({ role: "rh", accessTabs: ["ponto"] }, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess({ role: "engenheiro", accessTabs: ["folha"] }, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess({ role: "admin", active: false }, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess({ role: "rh", obraId: "missing" }, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess(null, fixture()).allowed).toBe(false);
    expect(getLaborProjectionAccess({ role: "admin", obraId: "o1" }, fixture())).toMatchObject({ allowedWorkIds: ["o1"], includeAdministrative: false });
  });

  it("enforces work filters and never accepts browser salaries, dates or rates", () => {
    const access = getLaborProjectionAccess({ role: "rh", obraId: "o1" }, fixture());
    expect(validateLaborProjectionFilters({ salary: 1, asOf: "2030-01-01", rate: 0 }, access, fixture()))
      .toEqual({ area: "all", obraId: "o1", employeeId: "", mode: "", role: "", onlyIssues: false });
    expect(() => validateLaborProjectionFilters({ obraId: "o2" }, access, fixture())).toThrow(expect.objectContaining({ status: 403 }));
    expect(validateLaborProjectionFilters({ area: "administrative" }, access, fixture())).toMatchObject({area:"administrative",obraId:"o1"});
    expect(() => validateLaborProjectionFilters({ mode: "fixed" }, access, fixture())).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("allows a transferred employee by actual historical work, not only current assignment", () => {
    const data = fixture({ employees: [employee({ obra: "o2" })], attendance: { e1: { "2026-10-22": { status: "P", obraId: "o1" } } } });
    const access = getLaborProjectionAccess({ role: "rh", obraId: "o1" }, data);
    expect(validateLaborProjectionFilters({ employeeId: "e1" }, access, data).employeeId).toBe("e1");
    expect(() => validateLaborProjectionFilters({ employeeId: "e1" }, access, { ...data, attendance: {} })).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("prevents an aggregate-only profile from narrowing to a named person", () => {
    const access = getLaborProjectionAccess({ role: "financeiro" }, fixture());
    expect(() => validateLaborProjectionFilters({ employeeId: "e1" }, access, fixture())).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("removes personal detail everywhere for Financeiro, including exports, issues and cash", () => {
    const report = freeze(reportFixture());
    const clean = sanitizeLaborProjectionReport(report, getLaborProjectionAccess({ role: "financeiro" }, fixture()));
    expect(clean.people).toEqual([]);
    expect(clean.options.employees).toEqual([]);
    expect(clean.permissions.canViewPeople).toBe(false);
    expect(clean.filters.employeeId).toBe("");
    for (const forbidden of ["Pessoa de teste", "e1", "123.456.789-00", "private@example.com", "medical private note", "private payroll detail"]) {
      expect(JSON.stringify(clean)).not.toContain(forbidden);
    }
    expect(clean.totals.projectedCost).toBe(150);
    expect(clean.cash.projectedNet).toBe(100);
    expect(clean.history.eligibleDays).toBe(30);
    expect(clean.policy).toEqual({ minimumObservedDays: 20, minimumCoverage: 0.8 });
  });

  it("RH can read names and daily financial memory but never CPF, PIX or medical notes", () => {
    const report = reportFixture();
    report._cashBasis = { people: [{ id: "private-basis", days: [{ obraId: "other-work" }] }] };
    const clean = sanitizeLaborProjectionReport(report, getLaborProjectionAccess({ role: "rh" }, fixture()));
    expect(clean.people[0]).toMatchObject({ id: "e1", name: "Pessoa de teste", projectedCost: 150 });
    expect(clean.people[0].days[0].totalCost).toBe(150);
    for (const forbidden of ["123.456.789-00", "private@example.com", "medical private note"]) expect(JSON.stringify(clean)).not.toContain(forbidden);
    expect(clean).not.toHaveProperty("_cashBasis");
    expect(JSON.stringify(clean)).not.toContain("private-basis");
  });

  it("rejects a scope violation at day level even when a group was already filtered", () => {
    const report = reportFixture();
    report.people[0].days.push({ date: "2026-10-29", obraId: "o2", totalCost: 99 });
    const access = getLaborProjectionAccess({ role: "rh", obraId: "o1" }, fixture());
    expect(() => applyLaborProjectionAccess(report, access)).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("rejects global totals attached to scoped rows and filters unauthorized options", () => {
    const report = reportFixture();
    const access = getLaborProjectionAccess({ role: "rh", obraId: "o1" }, fixture());
    expect(applyLaborProjectionAccess(report, access).options.works).toEqual([{ id: "o1", name: "Obra A" }]);
    report.totals.projectedCost = 249;
    expect(() => applyLaborProjectionAccess(report, access)).toThrow(expect.objectContaining({ status: 409 }));
  });

  it("rejects cash outside the work scope rather than hiding rows under a global total", () => {
    const report = reportFixture();
    const access = getLaborProjectionAccess({ role: "rh", obraId: "o1" }, fixture());
    report.cash.responsibilities[0].obraId = "o2";
    expect(() => applyLaborProjectionAccess(report, access)).toThrow(expect.objectContaining({ status: 403 }));
    report.cash.responsibilities[0].obraId = "o1";
    report.cash.projectedNet = 200;
    expect(() => applyLaborProjectionAccess(report, access)).toThrow(expect.objectContaining({ status: 409 }));
  });
});

it("administração local preserva obra autorizada da validação ao caixa e resposta",()=>{
 const data=fixture();data.employees[0]={...employee(),role:"Mestre de obras",dailyRate:100,vtDaily:0,vrDaily:0};data.obras[0].contractType="admin_only";data.attendance={e1:{"2026-10-21":{status:"P",obraId:"o1"}}};
 const access=getLaborProjectionAccess({role:"rh",obraId:"o1"},data),filters=validateLaborProjectionFilters({area:"administrative"},access,data);
 const report=buildLaborProjection(data,{asOf:"2026-10-29",access,filters});report.cash=buildLaborProjectionCash(data,report,{access});
 const safe=applyLaborProjectionAccess(report,access);expect(safe.people).toHaveLength(1);expect(safe.groups.every(group=>group.obraId==="o1")).toBe(true);expect(safe.people[0].days.every(day=>day.obraId==="o1")).toBe(true);
});
