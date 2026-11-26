import { getLaborProjectionAccess, prepareLaborProjectionSource, sanitizeLaborProjectionReport, validateLaborProjectionFilters } from "./labor-projection.js";
import { buildLaborProjection } from "../src/domains/ponto/labor-projection.js";
import { buildLaborProjectionCash } from "../src/domains/ponto/labor-projection-cash.js";
import { currentCompany } from "./company-context.js";
import { DOMAIN_ROW } from "./domain-row-routing.js";

export async function handleLaborProjectionReport({
  req, res, usuario, atual, updatedAt, rowVersions, rowVersionsPontoObra, db, lerLinha, baseKey,
}) {
  try{
    const access=getLaborProjectionAccess(usuario,atual);
    // Permissões e escopo de obra são verificados antes de ler arquivos.
    // A identidade histórica é validada depois da reconstrução, pois uma
    // pessoa pode existir só na fotografia de uma quinzena arquivada.
    validateLaborProjectionFilters({...req.body?.filters,
      employeeId:access.canViewPeople?"":req.body?.filters?.employeeId},access,atual);
    const source=await prepareLaborProjectionSource({
      data:atual,baseKey,now:new Date(),
      initialVersion:{updatedAt,rowVersions:{...rowVersions,[DOMAIN_ROW.CORE]:updatedAt},rowVersionsPontoObra},
      readCurrentVersion:async()=>{
        const current=await lerLinha();
        return {updatedAt:current.updatedAt,rowVersions:current.rowVersions,rowVersionsPontoObra:current.rowVersionsPontoObra};
      },
      readArchive:async key=>{
        const {data:archive,error}=await db.from("company_app_data").select("key,value,updated_at")
          .eq("company_id",currentCompany()).eq("key",key).maybeSingle();
        if(error)throw error;
        return archive;
      },
    });
    const {data:projectionData,...sourceOptions}=source;
    const filters=validateLaborProjectionFilters(req.body?.filters,access,projectionData);
    const report=buildLaborProjection(projectionData,{...sourceOptions,access,filters,includeCashBasis:true});
    report.sourceVersion=source.sourceVersion;
    report.cash=buildLaborProjectionCash(projectionData,report,{access});
    return res.status(200).json({ok:true,report:sanitizeLaborProjectionReport(report,access)});
  }catch(error){
    if(String(error?.code||"").startsWith("LABOR_")&&[400,403,409,503].includes(error.status)){
      return res.status(error.status).json({error:error.message,code:error.code,retryable:error.status===409});
    }
    throw error;
  }
}
