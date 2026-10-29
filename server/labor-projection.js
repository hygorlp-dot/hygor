import { createHash } from "node:crypto";
import { decodeAppData } from "./data-codec.js";
import { podeAcessarAba } from "../src/domains/administracao/abas-acesso.js";
import { getQ } from "../src/domains/ponto/attendance-engine.js";
import { normalizeAttendanceRecord } from "../src/domains/ponto/records.js";
import { resolveEmployeeAttendanceObraId } from "../src/domains/ponto/permissions.js";
import {
  businessDateIso, resolveActiveLaborPeriod, resolveLaborHistoryWindow,
  LABOR_PROJECTION_ISSUE_MESSAGES, LABOR_PROJECTION_ASSUMPTIONS,
} from "../src/domains/ponto/labor-projection.js";
import { LABOR_PROJECTION_CASH_ISSUE_MESSAGES } from "../src/domains/ponto/labor-projection-cash.js";

const DATA_KEY = "arced_ponto_v1";
const TIME_ZONE = "America/Bahia";
const CLASSIFIED_LEAVE_FROM = "2026-10-29";
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const copy = value => JSON.parse(JSON.stringify(value));
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
  && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const addDays = (value, amount) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const datesBetween = (start, end) => {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
};
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, stable(value[key])]));
  return value;
};
const fingerprint = value => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const validVersion = value => typeof value === "string" ? Boolean(value.trim())
  : value && typeof value === "object" && Object.keys(value).length > 0;

export const getLaborProjectionAccess = (user, data = {}) => {
  const role = String(user?.role || "");
  const hasPayroll = podeAcessarAba(user, "folha");
  const hasReports = podeAcessarAba(user, "relat");
  const workId = String(user?.obraId || "");
  const knownWork = !workId || (data.obras || []).some(work => String(work.id) === workId);
  const allowed = Boolean(user && user.active !== false && knownWork
    && ["admin", "rh", "financeiro"].includes(role) && (hasPayroll || hasReports));
  return {
    allowed,
    canViewPeople: allowed && ["admin", "rh"].includes(role) && hasPayroll,
    allowedWorkIds: workId ? [workId] : null,
    includeAdministrative: allowed && !workId,
  };
};

const requireAccess = access => {
  if (!access?.allowed) throw failure(403, "LABOR_PROJECTION_FORBIDDEN", "Este perfil não tem acesso à projeção de mão de obra.");
};

// A obra imposta pelo servidor acompanha o filtro visual, mas o domínio também
// recebe access: filtra cada parcela e cada dia histórico, não a lotação atual.
export const validateLaborProjectionFilters = (input = {}, access, data = {}) => {
  requireAccess(access);
  const raw = object(input);
  const result = {
    area: String(raw.area || "all"), obraId: String(raw.obraId || ""),
    employeeId: String(raw.employeeId || ""), mode: String(raw.mode || ""),
    role: String(raw.role || ""), onlyIssues: raw.onlyIssues === true,
  };
  if (!["all", "works", "administrative", "unassigned"].includes(result.area)
    || !["", "daily", "clt"].includes(result.mode) || result.role.length > 160) {
    throw failure(400, "LABOR_PROJECTION_FILTER_INVALID", "Filtro de projeção inválido.");
  }
  if (access.allowedWorkIds !== null) {
    const allowed = new Set((access.allowedWorkIds || []).map(String));
    if ((result.obraId && !allowed.has(result.obraId))
      || ["administrative", "unassigned"].includes(result.area)) {
      throw failure(403, "LABOR_PROJECTION_SCOPE_FORBIDDEN", "O filtro solicitado está fora do seu escopo de obra.");
    }
    if (!result.obraId && allowed.size === 1) result.obraId = [...allowed][0];
    result.area = "works";
  }
  if (result.obraId && !(data.obras || []).some(work => String(work.id) === result.obraId)) {
    throw failure(400, "LABOR_PROJECTION_FILTER_INVALID", "Obra inválida para a projeção.");
  }
  if (result.employeeId && !access.canViewPeople) {
    throw failure(403, "LABOR_PROJECTION_PEOPLE_FORBIDDEN", "Este perfil consulta apenas valores agregados.");
  }
  if (result.employeeId && !(data.employees || []).some(employee => String(employee.id) === result.employeeId)) {
    throw failure(400, "LABOR_PROJECTION_FILTER_INVALID", "Pessoa inválida para a projeção.");
  }
  if (result.employeeId && access.allowedWorkIds !== null) {
    const employee = (data.employees || []).find(item => String(item.id) === result.employeeId);
    const workIds = new Set((access.allowedWorkIds || []).map(String));
    const assigned = [employee.obra, employee.obraId, employee.lastObra,
      ...(employee.obraHistory || []).flatMap(item => [item.fromObraId || item.fromId, item.toObraId || item.toId])]
      .some(id => workIds.has(String(id || "")));
    const recorded = Object.entries(data.attendance?.[result.employeeId] || {}).some(([date, record]) =>
      workIds.has(resolveEmployeeAttendanceObraId({ data, employee, date, record })));
    if (!assigned && !recorded) throw failure(403, "LABOR_PROJECTION_SCOPE_FORBIDDEN", "A pessoa solicitada está fora do escopo autorizado.");
  }
  return result;
};

const archivePeriod = (id, metadata = {}) => {
  const match = String(id).match(/^(\d{4})-(0[1-9]|1[0-2])-Q([12])$/);
  if (!match) return null;
  const days = getQ(Number(match[1]), Number(match[2]) - 1)[`q${match[3]}`];
  const startDate = isoDate(metadata.inicio) ? metadata.inicio : days[0];
  const endDate = isoDate(metadata.fim) ? metadata.fim : days[days.length - 1];
  return startDate <= endDate ? { startDate, endDate } : null;
};
const archiveMarkers = (data, baseKey) => {
  const aliases = Array.isArray(data.archivedQuinzenas)
    ? Object.fromEntries(data.archivedQuinzenas.map(item => [String(item?.quinzenaId || item?.id || ""), item]))
    : object(data.archivedQuinzenas);
  const closed = { ...aliases, ...object(data.quinzenasArquivadas) };
  const restored = object(data.quinzenasRestauradas);
  return [...new Set([...Object.keys(closed), ...Object.keys(restored)])].sort().map(id => {
    let kind = own(closed, id) ? "archive" : "restored";
    if (own(closed, id) && own(restored, id)) {
      const closedAt = Date.parse(closed[id]?.archivedAt);
      const restoredAt = Date.parse(restored[id]?.restoredAt);
      if (!Number.isFinite(closedAt) || !Number.isFinite(restoredAt) || closedAt === restoredAt) {
        throw failure(409, "LABOR_ARCHIVE_STATE_CONFLICT", "O estado de uma quinzena arquivada é conflitante. Atualize os dados antes de consultar.");
      }
      kind = restoredAt > closedAt ? "restored" : "archive";
    }
    return { id, kind, metadata: object(closed[id] || restored[id]), key: `${baseKey}__arq__${id}` };
  });
};
const EMPLOYEE_FIELDS = [
  "id", "name", "role", "workArea", "obra", "obraId", "lastObra", "active", "startDate", "endDate",
  "dailyRate", "monthlySalary", "vtDaily", "vrDaily", "workdayHours", "workStart", "overtimeAdditionalPercent",
  "remunerationMode", "remunerationEffectiveFrom", "remunerationHistory", "obraHistory",
];
const pick = (value, fields) => Object.fromEntries(fields.filter(key => own(value, key)).map(key => [key, value[key]]));
const snapshotFor = (stored, current) => copy({
  ...pick(current, EMPLOYEE_FIELDS), ...pick(stored, EMPLOYEE_FIELDS),
  // Old archives did not save workArea. An administrative assignment today
  // cannot move a historical explicit construction-site record to that center.
  workArea: own(stored, "workArea") ? stored.workArea : "",
  // Keep absence explicit: the domain merges the dated snapshot over the
  // current employee again. Deleting the field here would revive today's work.
  ...Object.fromEntries(["obra", "obraId", "lastObra"].map(field => [field, own(stored, field) ? stored[field] : ""])),
});
const snapshotSignature = snapshot => snapshot ? pick(snapshot, EMPLOYEE_FIELDS.filter(field => field !== "name")) : null;
const recordSignature = record => record ? pick(record, [
  "status", "obraId", "obra", "role", "ot", "atrasoMin", "entrada", "intervaloSaida", "intervaloRetorno", "saida",
  "archivedDailyRate", "archivedVtDaily", "archivedVrDaily", "archivedWorkdayHours", "archivedWorkStart", "archivedOvertimeAdditionalPercent",
]) : null;
const withHistoricalRates = (record, employee, data, date) => {
  if (!record) return null;
  const result = { ...normalizeAttendanceRecord(record) };
  const rates = {
    archivedDailyRate: "dailyRate", archivedVtDaily: "vtDaily", archivedVrDaily: "vrDaily",
    archivedWorkdayHours: "workdayHours", archivedWorkStart: "workStart",
    archivedOvertimeAdditionalPercent: "overtimeAdditionalPercent",
  };
  for (const [target, field] of Object.entries(rates)) {
    if (result[target] == null && employee[field] != null) result[target] = employee[field];
  }
  result.obraId = resolveEmployeeAttendanceObraId({ data, employee, date, record: result });
  return result;
};
const issueFor = (entry, code, message, extra = {}) => ({
  code, severity: "warning", message, archiveKey: entry.key,
  startDate: entry.startDate, endDate: entry.endDate, affectsHistory: true, ...extra,
});

const readArchiveState = async (readArchive, entry) => {
  try {
    const row = await readArchive(entry.key);
    if (row == null) return { state: "missing", fingerprint: "missing" };
    if (row.error) throw new Error("archive reader failed");
    const wrapped = own(row, "value");
    if (wrapped && row.key && row.key !== entry.key) return { state: "invalid", fingerprint: fingerprint(row) };
    const payload = decodeAppData(wrapped ? row.value : row);
    const valid = payload && typeof payload === "object" && !Array.isArray(payload)
      && payload.attendance && typeof payload.attendance === "object" && !Array.isArray(payload.attendance)
      && Object.values(payload.attendance).every(dates => dates && typeof dates === "object" && !Array.isArray(dates))
      && (!payload.meta?.quinzenaId || payload.meta.quinzenaId === entry.id);
    return {
      state: valid ? "available" : "invalid", payload,
      fingerprint: fingerprint({ key: entry.key, updatedAt: row.updated_at || row.updatedAt || "", payload }),
      truncated: row.truncated === true || row.complete === false || payload?.complete === false,
    };
  } catch {
    return { state: "failed", fingerprint: "failed" };
  }
};

// Read-only source preparation. The surrounding handler supplies the already
// authenticated composite dataset, never a browser salary/rate/cutoff payload.
export const prepareLaborProjectionSource = async ({
  data = {}, readArchive, readCurrentVersion, initialVersion, now = new Date(), baseKey = DATA_KEY,
} = {}) => {
  if (typeof readCurrentVersion !== "function" || !validVersion(initialVersion)) {
    throw failure(503, "LABOR_SOURCE_VERSION_UNAVAILABLE", "Não foi possível comprovar a versão dos dados da projeção.");
  }
  const generatedAt = new Date(now).toISOString();
  const asOf = businessDateIso(new Date(generatedAt), TIME_ZONE);
  const period = resolveActiveLaborPeriod(asOf, data);
  const history = resolveLaborHistoryWindow(period);
  const contextStart = addDays(history.startDate, -31);
  const contextEnd = addDays(period.endDate, 7);
  const historyIssues = [];
  const expectedVersion = copy(initialVersion);
  const expectedFingerprint = fingerprint(expectedVersion);
  const assertVersion = async () => {
    let current;
    try { current = await readCurrentVersion(); }
    catch { throw failure(503, "LABOR_SOURCE_VERSION_UNAVAILABLE", "Não foi possível confirmar a versão dos dados. Atualize a projeção."); }
    if (!validVersion(current) || fingerprint(current) !== expectedFingerprint) {
      throw failure(409, "LABOR_SOURCE_CHANGED", "Os dados mudaram durante a consulta. Atualize a projeção.");
    }
  };
  await assertVersion();
  const entries = archiveMarkers(data, String(baseKey || DATA_KEY)).flatMap(entry => {
    const range = archivePeriod(entry.id, entry.metadata);
    if (!range) {
      historyIssues.push({ code: "LABOR_ARCHIVE_PERIOD_INVALID", severity: "warning",
        message: "Uma referência de arquivo tem período inválido.", startDate: history.startDate,
        endDate: history.endDate, affectsHistory: true });
      return [];
    }
    return range.endDate >= contextStart && range.startDate <= contextEnd ? [{ ...entry, ...range }] : [];
  });
  if (entries.length && typeof readArchive !== "function") {
    throw failure(503, "LABOR_ARCHIVE_READER_UNAVAILABLE", "A leitura dos arquivos históricos não está disponível.");
  }
  const states = await Promise.all(entries.map(entry => readArchiveState(readArchive, entry)));
  const attendance = {};
  const attendanceSources = {};
  const employeeSnapshotsByDate = {};
  const employees = (data.employees || []).map(employee => copy(employee));
  const currentById = new Map(employees.map(employee => [String(employee.id), employee]));
  // Synthetic historical-only entries are population markers, never a source
  // of salary or employment dates for a later archive of the same person.
  const originalCurrentById = new Map(currentById);
  const selections = new Map();
  const put = (employeeId, date, record, source, snapshot, priority) => {
    const key = `${employeeId}|${date}`;
    const existing = selections.get(key);
    const signature = fingerprint({ record: recordSignature(record), snapshot: snapshotSignature(snapshot) });
    if (existing && existing.priority > priority) {
      if (priority === 0 && existing.source.kind === "live" && snapshot) {
        if (existing.snapshot && fingerprint(snapshotSignature(existing.snapshot)) !== fingerprint(snapshotSignature(snapshot))) {
          historyIssues.push({ code: "LABOR_ARCHIVE_OVERLAP_CONFLICT", severity: "warning", employeeId, date,
            startDate: date, endDate: date, affectsHistory: true,
            message: "Fotografias restauradas divergem sobre o vínculo histórico da mesma pessoa." });
          selections.set(key, { priority: existing.priority, signature: "conflict", record: null, source: { kind: "conflict" } });
        } else existing.snapshot = snapshot;
      }
      return;
    }
    if (existing && existing.priority === priority && existing.signature !== signature) {
      if (existing.source.kind !== "conflict") historyIssues.push({
        code: "LABOR_ARCHIVE_OVERLAP_CONFLICT", severity: "warning", employeeId, date,
        startDate: date, endDate: date, affectsHistory: true,
        message: "Duas fotografias históricas divergem para a mesma pessoa e data.",
      });
      selections.set(key, { priority, signature: "conflict", record: null, source: { kind: "conflict" } });
      return;
    }
    selections.set(key, { priority, signature, record, source, snapshot });
  };
  for (const [employeeId, dates] of Object.entries(data.attendance || {})) {
    for (const [date, raw] of Object.entries(dates || {})) {
      // Keep live context outside the displayed window too: a configured run
      // of holidays can move the next ordinary workday beyond seven days.
      // The pure domain clips the report and the sample to their own periods.
      if (!isoDate(date)) continue;
      const record = normalizeAttendanceRecord(raw);
      put(employeeId, date, record, { kind: "live", limitedClassification: record?.status === "F" && date < CLASSIFIED_LEAVE_FROM }, null, 1);
    }
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index], state = states[index];
    const start = entry.startDate > contextStart ? entry.startDate : contextStart;
    const end = entry.endDate < contextEnd ? entry.endDate : contextEnd;
    const dates = datesBetween(start, end);
    if (state.state !== "available") {
      const codes = { missing: "LABOR_ARCHIVE_MISSING", failed: "LABOR_ARCHIVE_READ_FAILED", invalid: "LABOR_ARCHIVE_INVALID" };
      historyIssues.push(issueFor(entry, codes[state.state], "Uma fonte histórica não pôde ser comprovada; o resultado é parcial."));
      if (entry.kind === "archive") for (const employeeId of currentById.keys()) for (const date of dates) {
        put(employeeId, date, null, { kind: "missing", archiveKey: entry.key }, null, 3);
      }
      continue;
    }
    const archive = state.payload;
    const storedEmployees = Array.isArray(archive.employeesSnapshot) ? archive.employeesSnapshot : [];
    const storedById = new Map(storedEmployees.filter(employee => employee?.id).map(employee => [String(employee.id), employee]));
    const recordsCount = Object.values(archive.attendance).reduce((count, rows) => count + Object.keys(rows || {}).length, 0);
    if (state.truncated || (archive.meta?.totalLancamentos != null && Number(archive.meta.totalLancamentos) !== recordsCount)) {
      historyIssues.push(issueFor(entry, "LABOR_ARCHIVE_INCOMPLETE", "A cobertura do arquivo histórico está incompleta."));
    }
    if (Object.values(archive.attendance).some(rows => Object.keys(rows).some(date =>
      !isoDate(date) || date < entry.startDate || date > entry.endDate))) {
      historyIssues.push(issueFor(entry, "LABOR_ARCHIVE_RECORD_RANGE", "O arquivo contém registros fora do período declarado."));
    }
    const payloadRange = archivePeriod(entry.id, archive.meta);
    if (payloadRange && (payloadRange.startDate !== entry.startDate || payloadRange.endDate !== entry.endDate)) {
      historyIssues.push(issueFor(entry, "LABOR_ARCHIVE_METADATA_MISMATCH", "O período do arquivo diverge do índice de quinzenas."));
    }
    if (!Array.isArray(archive.employeesSnapshot)) {
      historyIssues.push(issueFor(entry, "LABOR_ARCHIVE_SNAPSHOT_MISSING", "O arquivo não contém a fotografia do vínculo e da remuneração."));
    }
    for (const [employeeId, stored] of storedById) {
      if (!currentById.has(employeeId)) {
        const historical = { ...copy(stored), active: false,
          endDate: stored.endDate || entry.endDate, _laborProjectionHistoricalOnly: true };
        currentById.set(employeeId, historical);
        employees.push(historical);
      } else if (currentById.get(employeeId)._laborProjectionHistoricalOnly) {
        const historical = currentById.get(employeeId);
        if (!stored.endDate && entry.endDate > historical.endDate) historical.endDate = entry.endDate;
      }
    }
    const ids = entry.kind === "archive"
      ? new Set([...currentById.keys(), ...Object.keys(archive.attendance)])
      : new Set([...storedById.keys(), ...Object.keys(archive.attendance)]);
    for (const employeeId of ids) {
      const stored = storedById.get(employeeId);
      const current = originalCurrentById.get(employeeId) || { id: employeeId };
      const snapshot = stored ? snapshotFor(stored, current) : null;
      if (!stored && own(archive.attendance, employeeId)) historyIssues.push(issueFor(entry,
        "LABOR_ARCHIVE_EMPLOYEE_MISSING", "Falta a fotografia de uma pessoa presente no arquivo.", { employeeId }));
      if (stored && !own(stored, "workArea") && !stored.obra && !stored.obraId
        && !Object.values(archive.attendance[employeeId] || {}).some(record => record?.obraId || record?.obra)) {
        historyIssues.push(issueFor(entry, "LABOR_ARCHIVE_WORK_AREA_UNKNOWN",
          "A área histórica de trabalho não foi registrada. A parcela permanece sem lotação comprovada.", { employeeId, affectsHistory: false }));
      }
      for (const date of dates) {
        const raw = archive.attendance[employeeId]?.[date];
        // A restored period retains current corrections. Closed snapshots own
        // even an empty cell: a later stray live value cannot rewrite history.
        const record = withHistoricalRates(raw, snapshot || current, data, date);
        put(employeeId, date, record, {
          kind: entry.kind, archiveKey: entry.key,
          limitedClassification: record?.status === "F" && date < CLASSIFIED_LEAVE_FROM,
        }, snapshot, entry.kind === "archive" ? 2 : 0);
      }
    }
  }
  for (const [key, selected] of selections) {
    const separator = key.lastIndexOf("|");
    const employeeId = key.slice(0, separator), date = key.slice(separator + 1);
    attendance[employeeId] ||= {};
    attendanceSources[employeeId] ||= {};
    attendance[employeeId][date] = selected.record ? copy(selected.record) : null;
    attendanceSources[employeeId][date] = selected.source;
    if (selected.snapshot) {
      employeeSnapshotsByDate[date] ||= {};
      employeeSnapshotsByDate[date][employeeId] = selected.snapshot;
    }
  }
  // Re-read each immutable row as well as the composite versions: timestamps
  // alone cannot detect a replaced legacy archive with a reused timestamp.
  const verifiedStates = await Promise.all(entries.map(entry => readArchiveState(readArchive, entry)));
  if (states.some((state, index) => state.fingerprint !== verifiedStates[index].fingerprint)) {
    throw failure(409, "LABOR_ARCHIVE_CHANGED", "Um arquivo histórico mudou durante a consulta. Atualize a projeção.");
  }
  await assertVersion();
  const sourceVersion = `labor-source-v1:${fingerprint({
    initialVersion: expectedVersion, asOf, baseKey,
    archives: entries.map((entry, index) => ({ key: entry.key, kind: entry.kind, hash: states[index].fingerprint })),
    source: pick(data, ["employees", "attendance", "obras", "config", "changeLog", "quinzenasArquivadas", "quinzenasRestauradas", "titulosFolha", "pagamentosFolha", "advances"]),
  })}`;
  return {
    data: { ...data, employees, attendance, archivedLaborCosts: {} }, asOf, generatedAt, timeZone: TIME_ZONE,
    historyIssues, attendanceSources, employeeSnapshotsByDate, sourceVersion,
  };
};

const TOTAL_FIELDS = ["employeeCount", "actualCost", "confirmedFutureCost", "estimatedCost", "pendingCost", "projectedCost", "fullAttendanceReserve", "futureDays", "pendingDays", "unpricedDays", "excludedStaleEmployees", "partial", "provisional"];
const MONEY_FIELDS = ["actualCost", "confirmedFutureCost", "estimatedCost", "pendingCost", "projectedCost", "fullAttendanceReserve"];
const HISTORY_FIELDS = ["startDate", "endDate", "expectedDays", "eligibleDays", "observedDays", "missingDays", "excludedDays", "holidayDays", "nonWorkingDays", "absenceDays", "halfDays", "presentDays", "coverage", "representedIntervals", "limitedClassification", "trackingStart"];
const isAllowedPart = (part, access) => {
  if (["administrative", "unassigned"].includes(part.kind)) return access.includeAdministrative;
  const workId = String(part.obraId || "");
  if (!workId) return access.includeAdministrative;
  return access.allowedWorkIds === null || (access.allowedWorkIds || []).map(String).includes(workId);
};

// The domain computes scoped totals from scoped day parcels. This boundary
// verifies that invariant instead of trimming rows and leaking global totals.
export const applyLaborProjectionAccess = (report, access) => {
  requireAccess(access);
  const groups = report.groups || [], people = report.people || [];
  const forbidden = groups.some(group => !isAllowedPart(group, access))
    || people.some(person => (person.days || []).some(day => !isAllowedPart(day, access)))
    || (report.issues || []).some(issue => issue.obraId && !isAllowedPart(issue, access))
    || (report.cash?.responsibilities || []).some(row => !isAllowedPart(row, access))
    || (report.cash?.issues || []).some(issue => issue.obraId && !isAllowedPart(issue, access));
  if (forbidden) throw failure(403, "LABOR_PROJECTION_SCOPE_FORBIDDEN", "A projeção contém parcelas fora do escopo autorizado.");
  if (access.allowedWorkIds !== null) for (const field of MONEY_FIELDS) {
    if (typeof report.totals?.[field] !== "number") continue;
    const groupCents = groups.reduce((sum, group) => sum + Math.round(Number(group[field] || 0) * 100), 0);
    if (Math.abs(groupCents - Math.round(report.totals[field] * 100)) > 1) {
      throw failure(409, "LABOR_PROJECTION_SCOPE_TOTAL_MISMATCH", "Os totais da projeção não correspondem às parcelas autorizadas.");
    }
  }
  if (access.allowedWorkIds !== null && report.cash) {
    const fields = { projectedNet: "projectedNet", knownNetAmount: "projectedNet", paidAmount: "paidAmount",
      remainingToPay: "remainingToPay", knownRemainingToPay: "knownRemainingToPay" };
    for (const [totalField, rowField] of Object.entries(fields)) {
      if (typeof report.cash[totalField] !== "number") continue;
      const cents = (report.cash.responsibilities || []).reduce((sum, row) => sum + Math.round(Number(
        (rowField==="knownRemainingToPay"?row.knownRemainingToPay??row.remainingToPay:row[rowField]) || 0) * 100), 0);
      if (Math.abs(cents - Math.round(report.cash[totalField] * 100)) > 1) {
        throw failure(409, "LABOR_PROJECTION_SCOPE_TOTAL_MISMATCH", "Os totais de caixa não correspondem às parcelas autorizadas.");
      }
    }
  }
  const visiblePeople = new Set(people.map(person => String(person.id)));
  for(const proof of report._authorizedPeople||[]){
    if(Array.isArray(proof.groups)&&proof.groups.length&&proof.groups.every(group=>isAllowedPart(group,access))){
      visiblePeople.add(String(proof.id));
    }
  }
  return { ...report, options: {
    ...object(report.options),
    works: (report.options?.works || []).filter(work => isAllowedPart({ obraId: work.id }, access)),
    employees: access.canViewPeople ? (report.options?.employees || []).filter(employee => access.allowedWorkIds===null||visiblePeople.has(String(employee.id))) : [],
  } };
};

const PUBLIC_ISSUE_MESSAGES = Object.freeze({
  ...LABOR_PROJECTION_ISSUE_MESSAGES, ...LABOR_PROJECTION_CASH_ISSUE_MESSAGES,
  LABOR_ARCHIVE_PERIOD_INVALID: "Uma referência de arquivo tem período inválido; a cobertura histórica é parcial.",
  LABOR_ARCHIVE_OVERLAP_CONFLICT: "Duas fotografias históricas divergem para a mesma pessoa e data. A parcela fica pendente.",
  LABOR_ARCHIVE_MISSING: "Falta um arquivo imutável da janela consultada; a cobertura histórica é parcial.",
  LABOR_ARCHIVE_READ_FAILED: "Não foi possível ler um arquivo histórico. Atualize a consulta e confira a cobertura.",
  LABOR_ARCHIVE_INVALID: "Um arquivo histórico tem formato inválido e não foi utilizado como evidência.",
  LABOR_ARCHIVE_INCOMPLETE: "A cobertura de um arquivo está incompleta; não é possível confirmar toda a amostra.",
  LABOR_ARCHIVE_RECORD_RANGE: "Um arquivo contém registros fora do período declarado; confira a fonte histórica.",
  LABOR_ARCHIVE_METADATA_MISMATCH: "O período de um arquivo diverge do índice de quinzenas; a fonte requer conferência.",
  LABOR_ARCHIVE_SNAPSHOT_MISSING: "Um arquivo não contém a fotografia do vínculo e da remuneração da época.",
  LABOR_ARCHIVE_EMPLOYEE_MISSING: "Falta a fotografia de uma pessoa presente no arquivo histórico.",
  LABOR_ARCHIVE_WORK_AREA_UNKNOWN: "A área histórica de trabalho não foi registrada; não foi inferida a partir da lotação atual.",
  LABOR_PROJECTION_REVIEW_REQUIRED: "Há uma limitação ou pendência nesta parcela. Consulte a memória e a cobertura da projeção.",
});
const publicIssue = (value, canViewPeople) => {
  const issue = typeof value === "string" ? { code: value } : value;
  const originalCode = String(issue?.code || "");
  const code = own(PUBLIC_ISSUE_MESSAGES, originalCode) ? originalCode
    : Object.keys(PUBLIC_ISSUE_MESSAGES).find(key => PUBLIC_ISSUE_MESSAGES[key] === originalCode)
      || "LABOR_PROJECTION_REVIEW_REQUIRED";
  return {
    ...pick(issue, ["severity", "date", "startDate", "endDate", "obraId", "groupId", "affectsHistory"]), code,
    ...(canViewPeople && issue?.employeeId ? { employeeId: String(issue.employeeId) } : {}),
    // Only catalogued text crosses the boundary; free notes and names do not.
    message: PUBLIC_ISSUE_MESSAGES[code],
  };
};
const cleanHistory = history => ({ ...pick(history, HISTORY_FIELDS),
  intervals: (history?.intervals || []).map(interval => pick(interval, ["key", ...HISTORY_FIELDS])),
});
const PUBLIC_ASSUMPTIONS = new Set(Array.isArray(LABOR_PROJECTION_ASSUMPTIONS)
  ? LABOR_PROJECTION_ASSUMPTIONS : Object.values(LABOR_PROJECTION_ASSUMPTIONS));
const assumptions = values => [...new Set((values || []).map(value => PUBLIC_ASSUMPTIONS.has(value) ? value
  : "Valores futuros são estimativas conforme a metodologia; não constituem lançamentos ou descontos de folha."))];
const cleanRate = rate => ({
  ...pick(rate, ["value", "source", "numerator", "denominator", "coverage", "limitedClassification", "halfDayProbability", "presentProbability", "representedIntervals"]),
  reason: rate?.source === "aggregate"
    ? "Histórico descritivo ponderado do recorte; cada pessoa usa sua própria origem de taxa."
    : rate?.source === "group" ? LABOR_PROJECTION_ISSUE_MESSAGES.HISTORY_GROUP_FALLBACK
      : rate?.source === "unavailable" ? LABOR_PROJECTION_ISSUE_MESSAGES.HISTORY_INSUFFICIENT
        : "Taxa individual ponderada pelos dias classificados da referência.",
});
const cleanDay = day => ({
  ...pick(day, ["date", "employeeId", "obraId", "groupId", "status", "partition", "component", "mode", "laborCost", "chargesCost", "benefitCost", "totalCost", "reserveCost", "workedDaysWeight", "reserveWorkedDaysWeight", "partial", "provisional"]),
  source: typeof day.source === "string" ? day.source : pick(day.source, ["kind", "limitedClassification"]),
  issues: (day.issues || []).map(issue => publicIssue(issue, true)),
  assumptions: assumptions(day.assumptions),
});

export const sanitizeLaborProjectionReport = (input, access) => {
  const report = applyLaborProjectionAccess(input, access);
  const canViewPeople = access.canViewPeople === true;
  return {
    ...pick(report, ["methodologyVersion", "generatedAt", "asOf", "timeZone", "sourceVersion"]),
    policy: pick(report.policy, ["minimumObservedDays", "minimumCoverage"]),
    period: pick(report.period, ["key", "startDate", "endDate", "days", "year", "monthIndex", "fortnight", "paymentDate", "basePaymentDate"]),
    history: cleanHistory(report.history), totals: pick(report.totals, TOTAL_FIELDS),
    groups: (report.groups || []).map(group => ({
      ...pick(group, ["id", "kind", "obraId", "name", ...TOTAL_FIELDS]), history: cleanHistory(group.history),
      ...(group.rate ? { rate: cleanRate(group.rate) } : {}),
    })),
    people: canViewPeople ? (report.people || []).map(person => ({
      ...pick(person, ["id", "name", "role", "workArea", "mode", ...TOTAL_FIELDS]),
      rate: cleanRate(person.rate),
      history: cleanHistory(person.history), days: (person.days || []).map(cleanDay),
    })) : [],
    issues: (report.issues || []).map(issue => publicIssue(issue, canViewPeople)), assumptions: assumptions(report.assumptions),
    filters: { ...pick(report.filters, ["area", "obraId", "mode", "role", "onlyIssues"]), employeeId: canViewPeople ? String(report.filters?.employeeId || "") : "" },
    permissions: { canViewPeople },
    options: {
      works: (report.options?.works || []).map(work => pick(work, ["id", "name"])),
      roles: (report.options?.roles || []).filter(value => typeof value === "string"),
      modes: (report.options?.modes || []).filter(value => ["daily", "clt"].includes(value)),
      employees: canViewPeople ? (report.options?.employees || []).map(employee => pick(employee, ["id", "name"])) : [],
    },
    ...(report.cash ? { cash: {
      ...pick(report.cash, ["available", "partial", "projectedNet", "remainingToPay", "knownNetAmount", "knownRemainingToPay", "paidAmount", "existingObligations", "advancesApplied", "withheldTransfer", "unionWithheldAmount"]),
      responsibilities: (report.cash.responsibilities || [])
        .map(row => pick(row, ["id", "payer", "label", "payerLabel", "kind", "obraId", "obraName", "partial", "projectedNet", "remainingToPay", "knownNetAmount", "knownRemainingToPay", "paidAmount", "existingObligations", "advancesApplied", "withheldTransfer", "unionWithheldAmount"])),
      issues: (report.cash.issues || []).map(issue => publicIssue(issue, canViewPeople)),
    } } : {}),
  };
};
