// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {camadaSupabase} from "./ponto-eletronico/banco-pglite.test-helper.js";

const state=vi.hoisted(()=>({db:null}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>new Proxy({}, {
  get:(_,key)=>key==="auth"?{
    getUser:async()=>({data:{user:{id:"auth-fin",email:"financeiro@teste.invalid"}},error:null}),
  }:state.db[key],
})}));

let pg,handler;
const operator={id:"fin",role:"financeiro",email:"financeiro@teste.invalid",authUserId:"auth-fin",active:true};
const closing=month=>({
  id:`closed-${month}`,status:"fechado",competencia:`2026-${String(month+1).padStart(2,"0")}`,
  fechadoEm:"2026-10-01T00:00:00Z",fechadoPorId:"fin",
  snapshot:{canonicalDre:{payload:{lucroLiquido:month+100},canonicalRevision:"frozen",sourceRevision:"frozen-source"}},
});
const seed=async(fechamentosFinanceiros,extra={})=>{
  await pg.query("insert into company_app_data(company_id,key,value,updated_at) values ($1,$2,$3::jsonb,$4)",[
    "arcd","arced_ponto_v1",JSON.stringify({usuarios:[operator],obras:[],employees:[],config:{},
      quinzenasArquivadas:{"2026-07-Q1":{inicio:"2026-07-06",fim:"2026-07-20"}},
      fechamentosFinanceiros,...extra}),"2026-10-01T00:00:00Z",
  ]);
};
const call=async body=>{
  let status=200,response;
  const res={status(code){status=code;return res;},json(value){response=value;return value;}};
  await handler({body:{accessToken:"test-token",...body},headers:{"x-forwarded-for":"127.0.0.1"},query:{}},res);
  return {status,body:response};
};

describe("API de DRE fechado com arquivo histórico ausente",()=>{
  beforeAll(async()=>{
    vi.stubEnv("SUPABASE_URL","https://fixture.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","fixture-service");
    vi.stubEnv("COMPANY_ID","arcd");
    pg=new PGlite();
    await pg.exec(`
      create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz,primary key(company_id,key));
      create table financial_events(company_id text,event_type text,source_type text,source_id text,payload jsonb,effective_date date);
      create table financial_titles(company_id text,id text,origin_type text,obra_id text,direction text,competence date,due_date date,created_at timestamptz,original_amount numeric,status text,metadata jsonb);
      create table settlements(company_id text,id text,title_id text,bank_transaction_id text,amount numeric,settlement_date date,status text);
      create table bank_transactions(company_id text,id text,amount numeric,status text,metadata jsonb);
      create table reconciliation_links(company_id text,id text,bank_transaction_id text,amount numeric,status text);
    `);
    state.db=camadaSupabase(pg);
    ({default:handler}=await import("../api/data.js"));
  },60000);
  beforeEach(async()=>{await pg.exec("delete from company_app_data; delete from financial_events;");});
  afterAll(async()=>{await pg?.close();vi.unstubAllEnvs();});

  it("entrega o snapshot fechado e o histórico sem recalcular nem exigir arquivo",async()=>{
    await seed([closing(6)]);
    const result=await call({action:"financial-company-dre-report",year:2026,month:6,period:"mes"});
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({source:"closed_snapshot",current:{lucroLiquido:106},
      canonicalRevision:"frozen",closed:{competence:"2026-07"}});
    expect(result.body.history.at(-1)).toEqual({lucroLiquido:106});
    expect((await pg.query("select count(*)::int as n from financial_events")).rows[0].n).toBe(0);
  });

  it("entrega o ano totalmente fechado na ordem certa sem arquivos",async()=>{
    await seed(Array.from({length:12},(_,month)=>closing(month)).reverse());
    const result=await call({action:"financial-annual-dre-report",year:2026});
    expect(result.status).toBe(200);
    expect(result.body.months.map(month=>month.lucroLiquido)).toEqual(Array.from({length:12},(_,month)=>month+100));
    expect(result.body.closedCompetences).toHaveLength(12);
    expect((await pg.query("select count(*)::int as n from financial_events")).rows[0].n).toBe(0);
  });

  it("continua recusando reconstrução aberta quando falta fonte imutável",async()=>{
    await seed([closing(6)]);
    const result=await call({action:"financial-company-dre-report",year:2026,month:7,period:"mes"});
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({code:"ARCHIVED_LABOR_SOURCE_MISSING",missingArchivedPeriods:["2026-07-Q1"]});
  });

  it("não entrega snapshot empresarial a usuário restrito a obra",async()=>{
    await seed([closing(6)],{usuarios:[{...operator,obraId:"o1"}]});
    const result=await call({action:"financial-company-dre-report",year:2026,month:6,period:"mes"});
    expect(result.status).toBe(403);
  });
});
