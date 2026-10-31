// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {camadaSupabase} from "./ponto-eletronico/banco-pglite.test-helper.js";

const state=vi.hoisted(()=>({db:null,email:""}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>new Proxy({}, {
  get:(_,key)=>key==="auth"?{
    getUser:async()=>({data:{user:{id:`auth-${state.email}`,email:state.email}},error:null}),
  }:state.db[key],
})}));

let pg,handler;
const usuario=(id,extra={})=>({id,email:`${id}@teste.invalid`,authUserId:`auth-${id}@teste.invalid`,active:true,...extra});
const admin=usuario("admin",{role:"admin"});
const engenheiro=usuario("eng",{role:"engenheiro"});
const financeiroDeObra=usuario("fin-obra",{role:"financeiro",accessTabs:["obras","dre"],obraId:"o1"});

const seed=async()=>{
  await pg.query("insert into company_app_data(company_id,key,value,updated_at) values ($1,$2,$3::jsonb,$4)",[
    "arcd","arced_ponto_v1",JSON.stringify({usuarios:[admin,engenheiro,financeiroDeObra],employees:[],config:{},
      obras:[{id:"o1",name:"Obra 1",status:"active",startDate:"2026-07-01"},{id:"o2",name:"Obra 2",status:"active",startDate:"2026-08-01"},
        {id:"o3",name:"Encerrada",status:"done",startDate:"2026-01-01"}],
      outrasDesp:[{id:"d1",obraId:"o1",competencia:"2026-07",valor:1000},{id:"d2",obraId:"o2",competencia:"2026-09",valor:300},
        {id:"d3",obraId:"o1",competencia:"2026-10",valor:9999}]}),"2026-10-01T00:00:00Z",
  ]);
  // Título lançado direto no Financeiro: não existe no JSON da empresa, só no razão canônico.
  await pg.query(`insert into financial_titles(company_id,id,origin_type,obra_id,direction,competence,original_amount,status,metadata)
    values ('arcd','t1','manual','o1','payable','2026-08-10',500,'open','{"financialKind":"cost"}'::jsonb)`);
};
const call=async(user,body)=>{
  state.email=user.email;
  let status=200,response;
  const res={status(code){status=code;return res;},json(value){response=value;return value;}};
  await handler({body:{accessToken:"test-token",action:"obras-custo-acumulado",...body},headers:{"x-forwarded-for":"127.0.0.1"},query:{}},res);
  return {status,body:response};
};

describe("API do custo acumulado do painel de obras",()=>{
  beforeAll(async()=>{
    vi.stubEnv("SUPABASE_URL","https://fixture.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","fixture-service");
    vi.stubEnv("COMPANY_ID","arcd");
    pg=new PGlite();
    await pg.exec(`
      create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz,primary key(company_id,key));
      create table financial_events(company_id text,event_type text,source_type text,source_id text,payload jsonb,effective_date date,created_by text,unique(company_id,event_type,source_type,source_id));
      create table financial_titles(company_id text,id text,origin_type text,obra_id text,direction text,competence date,due_date date,created_at timestamptz,original_amount numeric,status text,metadata jsonb);
      create table settlements(company_id text,id text,title_id text,bank_transaction_id text,amount numeric,settlement_date date,status text);
      create table bank_transactions(company_id text,id text,amount numeric,status text,metadata jsonb);
      create table reconciliation_links(company_id text,id text,bank_transaction_id text,amount numeric,status text);
    `);
    state.db=camadaSupabase(pg);
    ({default:handler}=await import("../api/data.js"));
  },60000);
  beforeEach(async()=>{await pg.exec("delete from company_app_data; delete from financial_titles;");await seed();});
  afterAll(async()=>{await pg?.close();vi.unstubAllEnvs();});

  it("soma os DREs até o mês pedido, com o título nativo do Financeiro e só obras ativas",async()=>{
    const result=await call(admin,{year:2026,month:8});
    expect(result.status).toBe(200);
    expect(result.body.custoAte).toBe("2026-09");
    expect(Object.keys(result.body.obras).sort()).toEqual(["o1","o2"]);
    expect(result.body.obras.o1).toMatchObject({custo:1500,inicio:"2026-07",meses:3});
    expect(result.body.obras.o2).toMatchObject({custo:300,meses:2});
  });

  it("perfil sem acesso à DRE recebe 403",async()=>{
    const result=await call(engenheiro,{year:2026,month:8});
    expect(result.status).toBe(403);
    expect(result.body.obras).toBeUndefined();
  });

  it("perfil restrito a uma obra só recebe a própria obra",async()=>{
    const result=await call(financeiroDeObra,{year:2026,month:8});
    expect(result.status).toBe(200);
    expect(Object.keys(result.body.obras)).toEqual(["o1"]);
  });

  it("período inválido é recusado",async()=>{
    expect((await call(admin,{year:2026,month:12})).status).toBe(400);
  });
});
