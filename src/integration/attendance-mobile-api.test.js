// @vitest-environment node
import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({rows:{},events:[],appropriations:[],sql:[],writes:0}));
const CORE='arced_ponto_v1',PONTO=CORE+'__ponto';
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
  auth:{getUser:async()=>({data:{user:{id:'auth-rh'}},error:null})},
  rpc:async name=>({data:null,error:name.startsWith('auth_rate_limit_')?null:{message:'Unexpected RPC'}}),
  from:table=>{
    const filters={};let keys=null,prefix=null;
    const result=()=>({data:table==='company_app_data'?Object.values(state.rows).filter(r=>(!filters.key||r.key===filters.key)&&(!keys||keys.includes(r.key))&&(!prefix||r.key.startsWith(prefix))):[],error:null});
    const q={select(){return q;},eq(k,v){filters[k]=v;return q;},in(k,v){keys=v;return q;},like(k,v){prefix=v.replace(/%$/,'');return q;},order(){return q;},maybeSingle:async()=>({data:result().data[0]||null,error:null}),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return q;
  },
})}));
vi.mock('postgres',()=>({default:()=>{
  const sql=async(strings,...args)=>{
    const query=strings.join('?').replace(/\s+/g,' ').trim();state.sql.push(query);
    if(query.startsWith('set local')||query.startsWith('lock table'))return [];
    if(query.includes('from ponto_eventos'))return structuredClone(state.events);
    if(query.includes('from ponto_apropriacoes'))return structuredClone(state.appropriations);
    if(query.startsWith('select key,value from company_app_data'))return Object.values(state.rows);
    if(query.startsWith('select value'))return [state.rows[args[1]]].filter(Boolean);
    if(query.startsWith('insert into company_app_data')){state.rows[args[1]]??={company_id:args[0],key:args[1],value:args[2],updated_at:'2026-10-02T12:00:00Z'};return [];}
    if(query.startsWith('update company_app_data')){state.writes++;state.rows[args[2]].value=args[0];return [{updated_at:'2026-10-02T12:00:00Z'}];}
    if(query.startsWith('insert into audit_events'))return [];
    throw Error('Unexpected SQL '+query);
  };
  sql.json=x=>x;sql.begin=async fn=>fn(sql);sql.end=async()=>{};return sql;
}}));
let handler;
const call=async body=>{let status=200,payload;const res={status(v){status=v;return res;},json(v){payload=v;return v;}};await handler({body:{accessToken:'test-token',...body},query:{},headers:{'x-forwarded-for':'127.0.0.1'}},res);return {status,body:payload};};
beforeAll(async()=>{process.env.SUPABASE_URL='https://mobile.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.POSTGRES_URL_NON_POOLING='postgres://mock-only';vi.resetModules();({default:handler}=await import('../../api/data.js'));},30000);
afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});
beforeEach(()=>{
  state.rows={[CORE]:{company_id:'arcd',key:CORE,value:{usuarios:[{id:'rh',role:'rh',authUserId:'auth-rh',active:true}],employees:[{id:'e',active:true,obra:'A'}],obras:[{id:'A'}],financialSettlements:[{id:'real',amount:800}],titulosFolha:[]},updated_at:'2026-10-02T10:00:00Z'},[PONTO]:{company_id:'arcd',key:PONTO,value:{attendanceLocks:{},attendanceOperationReceipts:[]},updated_at:'2026-10-02T10:00:00Z'}};
  state.events=[{event_id:'1',dispositivo_id:'d',estabelecimento_id:'est',nsr:1,timezone:'America/Recife',marcado_em:'2026-10-01T10:00:00Z',obra_id:'A',hora_confiavel:true},{event_id:'2',dispositivo_id:'d',estabelecimento_id:'est',nsr:2,timezone:'America/Recife',marcado_em:'2026-10-01T15:00:00Z',obra_id:'A',hora_confiavel:true}];state.appropriations=[{id:'a',employee_id:'e',inicio:'2026-10-01T10:00:00Z',fim:'2026-10-01T15:00:00Z',obra_apropriada_id:'A',status:'ativa',version:1}];state.sql=[];state.writes=0;
});
const cmd=()=>({action:'attendance-import-mobile',operationId:'10000000-0000-4000-8000-000000000001',employeeId:'e',date:'2026-10-01',status:'P',ot:0,atrasoMin:0,note:'Conferido',sourceEventIds:['1','2'],appropriationVersions:[{id:'a',version:1}]});
it('API efetiva lê fonte global sob lock, persiste ponto com auditoria e retry é idempotente sem tocar pagamentos',async()=>{
  const core=structuredClone(state.rows[CORE]);const r=await call(cmd());expect(r.status).toBe(200);expect(r.body.result.attendance[0].record).toMatchObject({entrada:'07:00',saida:'12:00',mobileSource:{eventIds:['1','2']}});expect(state.sql.some(q=>q.includes('lock table ponto_eventos, ponto_apropriacoes in share mode'))).toBe(true);expect(state.rows[CORE]).toEqual(core);expect(r.body.result.attendance[0].record.mobileSource.publicacao).toMatchObject({contratoVersao:1,estado:'aprovado',eventos:[{eventId:'1',nsr:'1',dispositivoId:'d'},{eventId:'2',nsr:'2',dispositivoId:'d'}]});
  const coreLock=state.sql.findIndex(q=>q.startsWith('select value from company_app_data')&&q.endsWith('for share'));
  const pointLock=state.sql.findIndex(q=>q.startsWith('select value,updated_at')&&q.endsWith('for update'));expect(coreLock).toBeGreaterThanOrEqual(0);expect(coreLock).toBeLessThan(pointLock);
  const writes=state.writes,retry=await call(cmd());expect(retry.body.idempotent).toBe(true);expect(state.writes).toBe(writes);
});
it('API recusa versão desatualizada, fechamento e fonte enviada pelo cliente sem gravar',async()=>{
  const r=await call({...cmd(),appropriationVersions:[{id:'a',version:9}],mobileSource:{fake:true}});expect(r.status).toBe(409);expect(state.writes).toBe(0);
  state.rows[PONTO].value.attendanceLocks={'2026-10-01__A':{locked:true}};expect((await call(cmd())).status).toBe(409);expect(state.writes).toBe(0);
});
it('API não oferece fallback sem transação para a importação',async()=>{
  const old=process.env.POSTGRES_URL_NON_POOLING;delete process.env.POSTGRES_URL_NON_POOLING;try{expect((await call(cmd())).status).toBe(503);expect(state.writes).toBe(0);}finally{process.env.POSTGRES_URL_NON_POOLING=old;}
});
