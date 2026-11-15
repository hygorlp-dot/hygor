import {decodeAppData} from "./data-codec.js";
import {DOMAIN_ROW,mergeDomainRows} from "./domain-row-routing.js";
import {attendanceObraKeyPrefix,mergeAttendanceObjects,withAttendanceSyncedAt} from "./attendance-obra-routing.js";
import {archivedLaborKeys,rebuildArchivedLaborCosts} from "./financial-archived-costs-source.js";
import {loadCanonicalDre} from "./financial-dre-integration.js";
const KEY="arced_ponto_v1";
const domains=Object.values(DOMAIN_ROW).filter(domain=>domain!=="core");
/** Leitura apenas no servidor: não compacta, migra ou grava o dataset. */
export async function readClientPortalSource(db,companyId,{financial=true}={}){
  const {data:rows,error}=await db.from("company_app_data").select("key,value,updated_at")
    .eq("company_id",companyId).in("key",[KEY,...domains.map(domain=>`${KEY}__${domain}`)]);
  if(error)throw error;
  const core=rows?.find(row=>row.key===KEY);
  if(!core)throw new Error("Dados da obra indisponíveis.");
  const decoded=Object.fromEntries(domains.map(domain=>[domain,rows.find(row=>row.key===`${KEY}__${domain}`)]).filter(([,row])=>row).map(([domain,row])=>[domain,decodeAppData(row.value)]));
  let data=mergeDomainRows(decodeAppData(core.value),decoded);
  if(!financial)return {data,canonical:{events:[],issues:[]}};
  const attendance=[];
  for(let offset=0;;offset+=1000){
    const result=await db.from("company_app_data").select("key,value").eq("company_id",companyId).like("key",`${attendanceObraKeyPrefix(`${KEY}__ponto`)}%`).order("updated_at",{ascending:true}).range(offset,offset+999);
    if(result.error)throw result.error;
    attendance.push(...(result.data||[]));
    if((result.data||[]).length<1000)break;
  }
  data={...data,attendance:mergeAttendanceObjects(data.attendance||{},...attendance.map(row=>{const decodedRow=decodeAppData(row.value);return withAttendanceSyncedAt(decodedRow.attendance,decodedRow.attendanceSyncedAt);}))};
  const archives=archivedLaborKeys(data,KEY);
  const archiveRows=[];
  for(let index=0;index<archives.length;index+=100){
    const result=await db.from("company_app_data").select("key,value").eq("company_id",companyId).in("key",archives.slice(index,index+100).map(item=>item.key));
    if(result.error)throw result.error;
    archiveRows.push(...(result.data||[]));
  }
  const rebuilt=rebuildArchivedLaborCosts({data,archiveRows,key:KEY});
  const canonical=await loadCanonicalDre(db,companyId);
  const issues=rebuilt.missing.length?[...canonical.issues,{code:"ARCHIVED_LABOR_SOURCE_MISSING",severity:"error"}]:canonical.issues;
  return {data:rebuilt.data,canonical:{...canonical,issues}};
}
