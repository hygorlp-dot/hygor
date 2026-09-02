import crypto from "node:crypto";

export const ATTENDANCE_REGISTRY_SCHEMA_VERSION = 1;

const array = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? "").trim();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : "";
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]),
  );
};
const hash = value => crypto
  .createHash("sha256")
  .update(JSON.stringify(stable(value)))
  .digest("hex");
const withHash = row => ({ ...row, sourceHash:hash(row.payload) });

const VALID_STATUS = new Set(["P", "M", "F"]);

// CORE-004 (02/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): projeta
// data.attendance - a fonte canônica ainda gravada via attendance-upsert/
// attendance-batch-upsert (server/attendance-command.js), particionada por
// obra no blob (server/attendance-obra-routing.js). Aqui é o oposto de
// propósito: UMA linha por (funcionário,data), sem partição - `id` é
// sintetizado como `${employeeId}__${date}` (não existe id próprio no
// registro de origem). Um dia "sem registro" nunca existiu no blob e não
// entra aqui; só dias com status (P/M/F) de verdade viram linha.
export const recordId = (employeeId, dateIso) => `${text(employeeId)}__${text(dateIso)}`;

const recordRow = (employeeId, dateIso, record) => withHash({
  id:recordId(employeeId, dateIso),
  employeeId:text(employeeId),
  date:dateIso,
  projectId:text(record?.obraId),
  status:text(record?.status),
  ot:Number(record?.ot) || 0,
  workedMinutes:Number(record?.workedMinutes) || 0,
  atrasoMin:Number(record?.atrasoMin) || 0,
  note:text(record?.note),
  payload:record || {},
});

export const buildAttendanceRegistrySnapshot = data => {
  const employeeIds=new Set(array(data?.employees).map(employee => text(employee?.id)).filter(Boolean));
  const projectIds=new Set(array(data?.obras).map(obra => text(obra?.id)).filter(Boolean));
  const records=[];
  Object.entries(data?.attendance || {}).forEach(([employeeId, days]) => {
    if (!employeeIds.has(text(employeeId))) return; // órfão - FK quebraria
    Object.entries(days || {}).forEach(([dateIso, record]) => {
      if (!record || !VALID_STATUS.has(text(record.status)) || !date(dateIso)) return;
      const projectId=text(record.obraId);
      if (projectId && !projectIds.has(projectId)) return; // órfão - FK quebraria
      records.push(recordRow(employeeId, dateIso, record));
    });
  });
  const snapshot={
    schemaVersion:ATTENDANCE_REGISTRY_SCHEMA_VERSION,
    complete:true,
    records,
  };
  return {
    ...snapshot,
    counts:{ records:records.length },
  };
};

export const compareAttendanceRegistrySnapshot = (snapshot, canonical = {}) => {
  const divergences=[];
  const expected=new Map(array(snapshot?.records).map(row => [text(row.id), row.sourceHash]));
  const actualRows=array(canonical?.records).filter(row => !row.archived_at);
  const actual=new Map(actualRows.map(row => [text(row.id), text(row.source_hash ?? row.sourceHash)]));
  expected.forEach((sourceHash, key) => {
    if (!actual.has(key)) divergences.push({ section:"records", key, reason:"missing" });
    else if (actual.get(key) !== sourceHash) divergences.push({ section:"records", key, reason:"hash_mismatch" });
  });
  actual.forEach((_, key) => {
    if (!expected.has(key)) divergences.push({ section:"records", key, reason:"unexpected" });
  });
  return divergences;
};
