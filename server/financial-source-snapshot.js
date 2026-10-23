import {decodeAppData} from "./data-codec.js";
import {mergeDomainRows,SPLITTABLE_DOMAINS} from "./domain-row-routing.js";
import {mergeAttendanceObjects,withAttendanceSyncedAt} from "./attendance-obra-routing.js";

// Read the same source as /api/data, including equipment, configuration and
// attendance stored in separate rows. Never write those rows during a repair.
export const mergeFinancialSourceRows=(core,rows,key="arced_ponto_v1")=>{
  const domains={};
  for(const domain of SPLITTABLE_DOMAINS){
    const row=rows.find(item=>item.key===`${key}__${domain}`);
    if(row)domains[domain]=decodeAppData(row.value);
  }
  const merged=mergeDomainRows(core,domains);
  const attendance=[merged.attendance||{}];
  for(const row of [...rows].sort((a,b)=>String(a.updated_at||"").localeCompare(String(b.updated_at||"")))){
    if(!row.key.startsWith(`${key}__ponto__obra__`))continue;
    const payload=decodeAppData(row.value);
    attendance.push(withAttendanceSyncedAt(payload.attendance,payload.attendanceSyncedAt));
  }
  return {...merged,attendance:mergeAttendanceObjects(...attendance)};
};
