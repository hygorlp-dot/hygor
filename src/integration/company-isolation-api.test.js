import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({rows:{},queries:[],authId:'auth-admin'}));
const queryFor=()=>{
  const filters={},query={select(){return this;},eq(key,value){filters[key]=value;return this;},in(){return this;},like(){return this;},order(){return this;},
    upsert:async()=>({error:null}),
    maybeSingle:async()=>{
      state.queries.push({...filters});
      return {data:state.rows[filters.company_id]?.[filters.key]||null,error:null};
    },then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);},
  };return query;
};
const db=vi.hoisted(()=>({from:vi.fn(()=>queryFor()),rpc:vi.fn(async()=>({data:null,error:null})),auth:{getUser:vi.fn(async token=>token==='valid'?{data:{user:{id:state.authId,email:''}},error:null}:{data:null,error:{message:'invalid'}})}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>db}));
let handler;
const request=async body=>{
  let status=200,json;const res={headersSent:false,setHeader(){},status(value){status=value;return this;},json(value){json=value;return value;}};
  await handler({method:'POST',body,query:{},headers:{'x-forwarded-for':'local'}},res);return {status,json};
};
beforeAll(async()=>{
  vi.stubEnv('SUPABASE_URL','https://isolated.local.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','local-only');
  vi.stubEnv('COMPANY_ISOLATION_ENABLED','true');vi.stubEnv('POSTGRES_URL_NON_POOLING','');
  ({default:handler}=await import('../../api/data.js'));
},30000);
afterAll(()=>{vi.unstubAllEnvs();vi.resetModules();});
beforeEach(()=>{
  state.queries=[];state.authId='auth-admin';
  state.rows=Object.fromEntries(['arcd','mrc'].map(company=>[company,{
    marcell_company_isolation_v1:{value:{version:1,companyId:company,status:'verified'}},
    arced_ponto_v1:{value:{usuarios:[{id:'admin',role:'admin',active:true,authUserId:'auth-admin'}],obras:[{id:company+'-work',name:company}],employees:[]},updated_at:company+'-version'},
  }]));
});
it('consulta somente linhas da empresa pedida e não mistura cargas simultâneas',async()=>{
  const responses=await Promise.all(['mrc','arcd'].map(companyId=>request({action:'load',companyId,accessToken:'valid'})));
  expect(responses.map(result=>result.status)).toEqual([200,200]);
  expect(responses.map(result=>result.json.data.obras.map(work=>work.id))).toEqual([['mrc-work'],['arcd-work']]);
  expect(responses.map(result=>result.json.companyId)).toEqual(['mrc','arcd']);
  expect(state.queries.every(query=>['mrc','arcd'].includes(query.company_id))).toBe(true);
});
it('um operador autorizado só na ARCD não ganha acesso à MRC pelo parâmetro',async()=>{
  state.rows.mrc.arced_ponto_v1.value.usuarios=[];
  expect((await request({action:'load',companyId:'arcd',accessToken:'valid'})).status).toBe(200);
  const result=await request({action:'load',companyId:'mrc',accessToken:'valid'});
  expect(result.status).toBe(401);expect(result.json.data).toBeUndefined();
});
it('recusa migração incompleta antes de consultar os dados de negócio',async()=>{
  delete state.rows.mrc.marcell_company_isolation_v1;
  const result=await request({action:'load',companyId:'mrc',accessToken:'valid'});
  expect(result).toMatchObject({status:503,json:{code:'COMPANY_NOT_READY'}});
  expect(state.queries).toEqual([{company_id:'mrc',key:'marcell_company_isolation_v1'}]);
});
