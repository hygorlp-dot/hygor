import {AsyncLocalStorage} from 'node:async_hooks';
import {createClient} from '@supabase/supabase-js';
import {assertCompanyProjectScope} from './company-project-guard.js';

export const COMPANIES=Object.freeze([{id:'arcd',name:'ARCD'},{id:'mrc',name:'MRC'}]);
export const COMPANY_ISOLATION_KEY='marcell_company_isolation_v1';
const context=new AsyncLocalStorage();
export const isolationEnabled=()=>process.env.COMPANY_ISOLATION_ENABLED==='true';
export const currentCompany=()=>context.getStore()?.companyId||process.env.COMPANY_ID||'arcd';
export const runWithCompany=(companyId,callback)=>context.run({companyId},callback);

export function requestedCompany(req){
  const supplied=[req.body?.companyId,req.query?.companyId,req.headers?.['x-mrc-company']].filter(value=>value!==undefined);
  if(supplied.some(value=>typeof value!=='string'||!COMPANIES.some(company=>company.id===value))||new Set(supplied).size>1){
    throw Object.assign(new Error('Empresa inválida ou divergente na requisição.'),{status:400});
  }
  const companyId=supplied[0]||process.env.COMPANY_ID||'arcd';
  if(!isolationEnabled()&&companyId!==(process.env.COMPANY_ID||'arcd')){
    throw Object.assign(new Error('A separação das empresas ainda não foi ativada neste ambiente.'),{status:503});
  }
  return companyId;
}

// Sem cache: a autorização de uma requisição nunca herda a empresa de outra.
// O certificado só é instalado depois da migração e da reconciliação local.
export async function assertCompanyReady(companyId,db){
  const {data,error}=await db.from('company_app_data').select('value').eq('company_id',companyId).eq('key',COMPANY_ISOLATION_KEY).maybeSingle();
  if(error||data?.value?.version!==1||data.value.companyId!==companyId||data.value.status!=='verified'){
    throw Object.assign(new Error('A separação desta empresa aguarda migração e conferência dos dados.'),{status:503,code:'COMPANY_NOT_READY'});
  }
  return data.value;
}

export function withCompanyContext(handler,{readiness=true}={}){
  return async function companyHandler(req,res){
    try{
      const companyId=requestedCompany(req);
      return await runWithCompany(companyId,async()=>{
        if(isolationEnabled()){
          res.setHeader('Cache-Control','no-store');
          res.setHeader('X-MRC-Company',companyId);
        }
        if(isolationEnabled()&&readiness){
          if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Object.assign(new Error('Persistência não configurada.'),{status:503});
          const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
          const certificate=await assertCompanyReady(companyId,db);
          assertCompanyProjectScope(req.body,certificate.projectCompanies,companyId);
          assertCompanyProjectScope(req.query,certificate.projectCompanies,companyId);
        }
        const json=res.json.bind(res);
        if(isolationEnabled())res.json=body=>json(body&&typeof body==='object'?{...body,companyId,companyIsolationEnabled:true,
          ...(body.usuario?.role==='admin'?{companies:COMPANIES}:{}),
        }:body);
        return handler(req,res);
      });
    }catch(error){
      if(!error?.status)throw error;
      return res.status(error.status).json({ok:false,error:error.message,code:error.code||'COMPANY_SCOPE_INVALID'});
    }
  };
}
