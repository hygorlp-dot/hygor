import {buildRequestedDreProjectionRows,dreProjectionRequests} from './dre-projection.js';
import {closedCompanyDreBySourceId} from './financial-closing-read.js';
import {podeAcessarAba} from '../src/domains/administracao/abas-acesso.js';

export const canGenerateMissingDre=(company,user)=>
  company==='mrc'&&user?.role==='admin'&&!user.obraId&&user.active!==false&&podeAcessarAba(user,'fin');

export function missingDrePlan(data,sourceIds){
  if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.length>150||sourceIds.some(id=>typeof id!=='string'))return null;
  const eligible=new Map(dreProjectionRequests(data).map(request=>{
    const {year,month,period,scope}=request;
    const sourceId=`${year}-${String(month+1).padStart(2,'0')}:${period}:${scope}`;
    return [sourceId,{...request,sourceId,includeMemorial:scope==='company_dre'}];
  }));
  const requests=[...new Set(sourceIds)].map(id=>eligible.get(id));
  return requests.every(Boolean)?requests:null;
}

export function buildMissingDreRows({data,requests,canonicalEvents,company,actor,sourceRevision,projectionVersion}){
  const closed=closedCompanyDreBySourceId(data);
  const calculated=buildRequestedDreProjectionRows(
    data,requests.filter(request=>!closed.has(request.sourceId)),canonicalEvents,
  );
  const byId=new Map(calculated.map(row=>[row.sourceId,row]));
  return requests.map(request=>{
    const {sourceId,year,month,period}=request;
    const frozen=closed.get(sourceId);
    const row=frozen||byId.get(sourceId);
    return {
      company_id:company,event_type:'dre_snapshot',source_type:'dre_projection',
      source_id:sourceId,effective_date:`${year}-${String(month+1).padStart(2,'0')}-01`,created_by:String(actor),
      payload:{...row.payload,active:true,obraId:row.obraId||'',year,month,period,
        sourceRevision:frozen?frozen.sourceRevision:sourceRevision,
        projectionVersion:frozen?frozen.projectionVersion:projectionVersion},
    };
  });
}
