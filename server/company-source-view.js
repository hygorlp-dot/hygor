import {decodeAppData} from './data-codec.js';
import {DOMAIN_ROW,mergeDomainRows} from './domain-row-routing.js';
import {attendanceObraKeyPrefix,mergeAttendanceObjects,withAttendanceSyncedAt} from './attendance-obra-routing.js';
import {rebuildArchivedLaborCosts} from './financial-archived-costs-source.js';

// Same domain and attendance merge used by the server, over a private local
// capture. A snapshot is not an invitation to replay operational commands.
export function companySourceView(tables,companyId='arcd'){
  const key='arced_ponto_v1',rows=(tables.company_app_data||[]).filter(row=>row.company_id===companyId);
  const core=rows.find(row=>row.key===key);
  if(!core)throw new Error('Linha principal ausente na cópia local.');
  const domains=Object.values(DOMAIN_ROW).filter(domain=>domain!=='core');
  const parts=Object.fromEntries(domains.map(domain=>[domain,rows.find(row=>row.key===`${key}__${domain}`)]).filter(([,row])=>row).map(([domain,row])=>[domain,decodeAppData(row.value)]));
  let data=mergeDomainRows(decodeAppData(core.value),parts);
  const attendance=rows.filter(row=>row.key.startsWith(attendanceObraKeyPrefix(key+'__ponto'))).sort((a,b)=>String(a.updated_at||'').localeCompare(String(b.updated_at||'')));
  data={...data,attendance:mergeAttendanceObjects(data.attendance||{},...attendance.map(row=>{const value=decodeAppData(row.value);return withAttendanceSyncedAt(value.attendance,value.attendanceSyncedAt);}))};
  const rebuilt=rebuildArchivedLaborCosts({data,archiveRows:rows,key});
  return {data:rebuilt.data,missingArchives:rebuilt.missing};
}
