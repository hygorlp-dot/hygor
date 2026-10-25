// @vitest-environment node
// API + SQL + auditoria reais e locais. Autenticação e relógio são dublês;
// nenhum acesso a homologação, upload, envio externo ou banco financeiro.
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {camadaSupabase,lerMigration,PAPEIS_SUPABASE} from '../../server/ponto-eletronico/banco-pglite.test-helper.js';
import {decodeAppData} from '../../server/data-codec.js';
import {EMPLOYEE_ENGINEERING_COMMAND as OP} from '../domains/rh/employee-engineering.js';

vi.setConfig({testTimeout:30000,hookTimeout:30000});
const state=vi.hoisted(()=>({pg:null,db:null}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
  from:(...args)=>state.db.from(...args),rpc:(...args)=>state.db.rpc(...args),
  auth:{getUser:async token=>({data:{user:token?.startsWith('qa-')?{id:`auth-${token}`} :null},error:null})},
})}));
const JSON_VALUE=Symbol('json');
const adapter=pg=>{
  const sql=async(strings,...values)=>{
    const query=strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
    return (await pg.query(query,values.map(value=>value&&typeof value==='object'&&JSON_VALUE in value?JSON.stringify(value[JSON_VALUE]):value))).rows;
  };
  sql.json=value=>({[JSON_VALUE]:value});return sql;
};
vi.mock('postgres',()=>({default:()=>Object.assign(adapter(state.pg),{
  begin:fn=>state.pg.transaction(transaction=>fn(adapter(transaction))),end:async()=>{},
})}));
const CORE='arced_ponto_v1',NOW='2026-10-25T12:00:00.000Z';
const initial={
  usuarios:[['admin','admin',''],['eng','engenheiro','A'],['outro','engenheiro','B'],['rh','rh',''],['fin','financeiro','']]
    .map(([id,role,obraId])=>({id:`qa-${id}`,nome:`Nome ${id}`,authUserId:`auth-qa-${id}`,role,obraId,active:true})),
  obras:[{id:'A',name:'Obra A'},{id:'B',name:'Obra B'}],
  employees:[{id:'e-a',name:'Funcionário A',obra:'A',active:true,startDate:'2026-10-01',cpf:'dado privado de teste',monthlySalary:3300,address:{street:'Endereço privado'},cltPayroll:{drafts:{private:true}}},{id:'e-b',name:'Funcionário B',obra:'B',active:true,startDate:'2026-10-01'}],
  attendance:{'e-a':{'2026-10-20':{status:'P',obraId:'A'}}},titulosFolha:[],advances:[],employeeEngineeringRecords:[],operationalCommandReceipts:[],
};
let handler;
const call=async(body,user='qa-eng')=>{
  let status=200,payload;const res={status(value){status=value;return res;},json(value){payload=value;return value;}};
  await handler({body:{accessToken:user,...body},query:{},headers:{'x-forwarded-for':'127.0.0.1'}},res);
  return {status,body:payload};
};
const raw=async()=>decodeAppData((await state.pg.query('select value from company_app_data where key=$1',[CORE])).rows[0].value);
const audits=async()=>(await state.pg.query('select action,actor_id,actor_name,before_snapshot from audit_events order by created_at,id')).rows;
const create=(id='aviso-api-0001')=>({action:'operational-command',command:{
  type:OP.EMPLOYEE_ENGINEERING_CREATED,idempotencyKey:`criar-${id}-seguro`,expectedVersion:0,
  now:'2035-01-01T00:00:00Z',actorId:'forjado',actorRole:'admin',actorName:'Autor forjado',actorObraId:'B',
  payload:{record:{id,employeeId:'e-a',obraId:'A',title:'Orientação de integração',message:'Conferir orientação operacional antes de iniciar a atividade.',kind:'orientation',createdBy:'forjado',createdAt:'2035-01-01',history:[{note:'forjado'}]}},
}});
const transition=(status,version=1)=>({action:'operational-command',command:{
  type:OP.EMPLOYEE_ENGINEERING_STATUS_SET,idempotencyKey:`situacao-${status}-${version}-seguro`,expectedVersion:version,
  now:'2035-01-01T00:00:00Z',actorId:'forjado',actorRole:'admin',actorObraId:'B',
  payload:{recordId:'aviso-api-0001',status,note:'Providência registrada pelo responsável autenticado.',obraId:'B'},
}});

beforeAll(async()=>{
  state.pg=new PGlite({extensions:{pgcrypto}});state.db=camadaSupabase(state.pg);
  await state.pg.exec(PAPEIS_SUPABASE);
  await state.pg.exec('create table company_app_data(company_id text not null,key text not null,value jsonb not null,updated_at timestamptz not null default now(),updated_by uuid,primary key(company_id,key))');
  for(const migration of ['20260725_append_only_audit.sql','20260726_auth_rate_limit.sql','20260727_auth_rate_limit_success.sql'])await state.pg.exec(lerMigration(migration));
  const {attendance,...core}=initial;
  await state.pg.query('insert into company_app_data(company_id,key,value) values ($1,$2,$3::jsonb)',['arcd',CORE,JSON.stringify(core)]);
  await state.pg.query('insert into company_app_data(company_id,key,value) values ($1,$2,$3::jsonb)',['arcd',CORE+'__ponto',JSON.stringify({attendance,attendanceLocks:{},attendanceOperationReceipts:[]})]);
  vi.stubEnv('SUPABASE_URL','https://isolated-test.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only');vi.stubEnv('POSTGRES_URL_NON_POOLING','postgres://local-pglite-only');vi.stubEnv('COMPANY_ID','arcd');
  ({default:handler}=await import('../../api/data.js'));
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(NOW));
});
afterAll(async()=>{vi.useRealTimers();vi.unstubAllEnvs();if(state.pg&&!state.pg.closed)await state.pg.close();});

it('grava aviso e providências com autor/horário reais, SQL auditado, escopo, versão e reenvio seguros',async()=>{
  const created=await call(create());expect(created.status,JSON.stringify(created.body)).toBe(200);
  const first=await raw();expect(first.employeeEngineeringRecords).toHaveLength(1);
  expect(first.employeeEngineeringRecords[0]).toMatchObject({createdBy:'qa-eng',createdByName:'Nome eng',createdByRole:'engenheiro',createdAt:NOW,status:'pending',version:1,history:[{actorId:'qa-eng',actorName:'Nome eng',at:NOW,status:'pending'}]});
  expect((await audits())[0]).toMatchObject({actor_id:'qa-eng',actor_name:'Nome eng',before_snapshot:{entityId:'aviso-api-0001'}});
  const repeated=await call(create());expect(repeated.body.idempotent).toBe(true);expect(await raw()).toEqual(first);expect(await audits()).toHaveLength(1);
  expect((await call(create('aviso-errado-0002'),'qa-outro')).status).toBe(403);
  expect((await call(create('aviso-financeiro-0003'),'qa-fin')).status).toBe(403);
  expect((await call(transition('acknowledged'),'qa-outro')).status).toBe(403);
  expect((await call(transition('cancelled'))).status).toBe(409);
  expect((await call(transition('acknowledged'))).status).toBe(200);
  expect((await call(transition('resolved',1))).status).toBe(409);
  expect((await call(transition('resolved',2),'qa-rh')).status).toBe(200);
  const last=await raw(),record=last.employeeEngineeringRecords[0];
  expect(record).toMatchObject({status:'resolved',version:3,createdBy:'qa-eng'});
  expect(record.history.map(event=>event.actorId)).toEqual(['qa-eng','qa-eng','qa-rh']);
  expect(record.history.every(event=>event.at===NOW)).toBe(true);expect(await audits()).toHaveLength(3);
  const reloaded=await call({action:'load'},'qa-admin');
  // A persistência existente pode separar o ponto em sua própria linha.
  // A recarga canônica precisa preservar o conteúdo, independentemente do shard.
  expect(reloaded.body.data.attendance).toEqual(initial.attendance);expect(last.titulosFolha).toEqual(initial.titulosFolha);expect(last.employees).toEqual(initial.employees);
});

it('projeta apenas o escopo de engenharia e bloqueia substituição dos avisos pelas rotas legadas',async()=>{
  const engineer=await call({action:'load'}),other=await call({action:'load'},'qa-outro');
  expect(engineer.status).toBe(200);expect(engineer.body.data.employeeEngineeringRecords).toHaveLength(1);
  expect(engineer.body.data.employees[0]).not.toHaveProperty('cpf');expect(engineer.body.data.employees[0]).not.toHaveProperty('monthlySalary');expect(engineer.body.data.employees[0]).not.toHaveProperty('cltPayroll');expect(engineer.body.data.employees[0]).not.toHaveProperty('address');
  expect(other.body.data.employeeEngineeringRecords).toEqual([]);
  const before=await raw(),count=(await audits()).length;
  const sections=await call({action:'save-sections',sections:{employeeEngineeringRecords:[]},baseSections:{employeeEngineeringRecords:before.employeeEngineeringRecords}},'qa-admin');
  expect(sections.status).toBe(409);
  const legacy=await call({action:'save',payload:{...before,employeeEngineeringRecords:[]}},'qa-admin');expect(legacy.status).toBe(409);
  expect(await raw()).toEqual(before);expect(await audits()).toHaveLength(count);
});
