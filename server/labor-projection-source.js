import { decodeAppData } from "./data-codec.js";
import { normalizeAttendanceRecord } from "../src/domains/ponto/records.js";
import { validDate } from "../src/domains/rh/date-validation.js";
import { getQ } from "../src/domains/ponto/attendance-engine.js";
import { dateRange, projectionArchiveKeys } from "../src/domains/ponto/labor-projection.js";

// Lê somente as fotografias indicadas pelos metadados autoritativos.
// A API recebe o dataset composto de completarLinha, nunca uma única linha JSON.
export async function loadLaborProjectionArchives({ db, company, key, data, start, end }) {
  const expected = projectionArchiveKeys(data.quinzenasArquivadas,start,end);
  if (!expected.length) return { archives:[], missing:[], versions:[] };
  const keys = expected.map(id => `${key}__arq__${id}`);
  const response = await db.from("company_app_data").select("key,value,updated_at").eq("company_id",company).in("key",keys);
  if (response.error) return { archives:[], missing:expected, versions:[], error:"Falha na leitura dos arquivos" };
  const byKey = new Map((response.data || []).map(row => [row.key,row]));
  const archives=[],missing=[],versions=[];
  for (const id of expected) {
    const row=byKey.get(`${key}__arq__${id}`);
    if (!row) { missing.push(id); continue; }
    try {
      const archive=decodeAppData(row.value);
      if (!archive?.attendance || typeof archive.attendance !== "object" || !Array.isArray(archive.employeesSnapshot)) throw new Error("Arquivo incompleto");
      const count=Object.values(archive.attendance).reduce((sum,records)=>sum+Object.values(records||{}).filter(Boolean).length,0);
      if (Number.isFinite(archive.meta?.totalLancamentos) && count!==archive.meta.totalLancamentos) throw new Error("Arquivo truncado");
      const ids=new Set(archive.employeesSnapshot.map(employee=>String(employee.id)));
      if(Object.keys(archive.attendance).some(id=>!ids.has(id)))throw new Error("Fotografia de funcionário ausente");
      if(Object.values(archive.attendance).some(records=>!records||Array.isArray(records)||Object.keys(records).some(date=>!validDate(date))))throw new Error("Datas ou formato inválidos no arquivo");
      if([archive.meta?.inicio,archive.meta?.fim].filter(Boolean).some(date=>!validDate(date)))throw new Error("Limites inválidos no arquivo");
      archives.push({id,archive}); versions.push([id,row.updated_at || ""]);
    } catch { missing.push(id); }
  }
  return { archives,missing,versions };
}

export function composeLaborProjectionSource(data, archives, start, end) {
  const attendance={}, snapshots={}, origins={}, conflicts=new Set();
  const employees=new Map((data.employees || []).map(employee=>[String(employee.id),employee]));
  for (const [id,records] of Object.entries(data.attendance || {})) {
    attendance[id]={};
    for (const [date,record] of Object.entries(records || {})) if (date>=start&&date<=end) {
      attendance[id][date]=normalizeAttendanceRecord(record); origins[`${id}|${date}`]="live";
    }
  }
  for (const {id,archive} of archives) {
    if (data.quinzenasRestauradas?.[id]) continue; // a restauração já preservou/mesclou os fatos vivos
    const metadata=data.quinzenasArquivadas?.[id];
    if (!metadata) continue;
    const match=/^(\d{4})-(\d{2})-Q([12])$/.exec(id);
    if (!match) continue;
    // Metadados modernos trazem os limites; os antigos usam o calendário.
    const calendar=getQ(Number(match[1]),Number(match[2])-1)[match[3]==="1"?"q1":"q2"];
    const dates=dateRange(archive.meta?.inicio || metadata.inicio || calendar[0],archive.meta?.fim || metadata.fim || calendar.at(-1)).filter(date=>date>=start&&date<=end);
    for (const stored of archive.employeesSnapshot) {
      const employeeId=String(stored.id),current=employees.get(employeeId)||{};
      const snapshot={...current,...stored,remunerationHistory:stored.remunerationHistory??current.remunerationHistory};
      if (!employees.has(employeeId)) employees.set(employeeId,{...snapshot,projectionArchiveOnly:true});
      attendance[employeeId]??={};
      for (const date of dates) {
        const pair=`${employeeId}|${date}`,record=normalizeAttendanceRecord(archive.attendance?.[employeeId]?.[date]);
        if (origins[pair] && origins[pair]!=="live" && JSON.stringify(attendance[employeeId][date])!==JSON.stringify(record)) conflicts.add(pair);
        attendance[employeeId][date]=record;
        snapshots[pair]=snapshot;origins[pair]=id;
      }
    }
  }
  for (const pair of conflicts) { const [id,date]=pair.split("|");attendance[id][date]=null; }
  return { data:{...data,employees:[...employees.values()],attendance,archivedLaborCosts:{},projectionSnapshots:snapshots},origins,conflicts:[...conflicts] };
}
