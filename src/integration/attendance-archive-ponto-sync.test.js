import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Achado de 21/08/2026 (limitação documentada duas vezes sem correção, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): arquivar/restaurar uma quinzena
// sempre grava `attendance` na linha core, mesmo depois que a linha
// própria de Ponto passou a existir - a leitura normal (que sempre
// prioriza a linha de Ponto) ignorava silenciosamente esse resultado.
// Este teste cobre a correção: uma segunda escrita best-effort
// (sincronizarPontoAposArquivo) sincroniza a cópia de `attendance` na
// linha de Ponto logo depois que a transação principal confirma.

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";
const ARCHIVE_KEY="arced_ponto_v1__arq__2026-08-Q1";

const testState=vi.hoisted(()=>({
  rows:{},
  rpcCalls:[],
}));

const queryFor=table=>{
  const filters={};
  let inFilter=null;
  let likeFilter=null;
  let orderFilter=null;
  let columns="";
  const query={
    select(value){columns=value;return query;},
    eq(key,value){filters[key]=value;return query;},
    in(key,values){inFilter={key,values};return query;},
    // lerLinha() usa .like("key", `${prefix}%`) para descobrir as linhas de
    // Ponto por obra (número dinâmico, ver server/attendance-obra-routing.js)
    // - o mock só precisa entender o padrão de prefixo simples usado ali.
    like(key,pattern){likeFilter={key,prefix:String(pattern||"").replace(/%$/,"")};return query;},
    order(field,opts){orderFilter={field,ascending:opts?.ascending!==false};return query;},
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      const row=testState.rows[filters.key];
      if(!row||(filters.company_id&&filters.company_id!==row.company_id))return{data:null,error:null};
      return{data:{value:row.value,updated_at:row.updated_at,key:row.key},error:null};
    },
    then(resolve,reject){
      let result;
      if(inFilter){
        const matches=(inFilter.values||[])
          .map(key=>testState.rows[key])
          .filter(Boolean)
          .map(row=>({key:row.key,value:row.value,updated_at:row.updated_at}));
        result={data:matches,error:null};
      }else if(likeFilter){
        const matches=Object.values(testState.rows)
          .filter(row=>String(row[likeFilter.key]||"").startsWith(likeFilter.prefix))
          .filter(row=>!filters.company_id||filters.company_id===row.company_id)
          .map(row=>({key:row.key,value:row.value,updated_at:row.updated_at}));
        if(orderFilter){
          const direction=orderFilter.ascending?1:-1;
          matches.sort((a,b)=>direction*String(a[orderFilter.field]||"").localeCompare(String(b[orderFilter.field]||"")));
        }
        result={data:columns==="key, updated_at, value->meta"
          ? matches.map(row=>({key:row.key,updated_at:row.updated_at,meta:row.value?.meta}))
          : matches,error:null};
      }else{
        result={data:[],error:null};
      }
      return Promise.resolve(result).then(resolve,reject);
    },
  };
  return query;
};

const bumpUpdatedAt=isoString=>new Date(new Date(isoString).getTime()+1000).toISOString();

const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-admin"}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async(name,args)=>{
    testState.rpcCalls.push({name,args});
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    if(name==="attendance_archive_transaction"){
      const row=testState.rows[args.p_main_key];
      const updatedAt=bumpUpdatedAt(row?.updated_at||new Date(0).toISOString());
      testState.rows[args.p_main_key]={...row,value:args.p_main_value,updated_at:updatedAt};
      testState.rows[args.p_archive_key]={company_id:args.p_company_id,key:args.p_archive_key,value:args.p_archive_value,updated_at:updatedAt};
      return{data:[{applied:true,updated_at:updatedAt,reason:""}],error:null};
    }
    if(name==="company_save_with_audit"){
      const row=testState.rows[args.p_key];
      if(!row||row.updated_at!==args.p_expected_updated_at){
        return{data:[{applied:false,updated_at:row?.updated_at||null}],error:null};
      }
      const updatedAt=bumpUpdatedAt(row.updated_at);
      testState.rows[args.p_key]={...row,value:args.p_value,updated_at:updatedAt};
      return{data:[{updated_at:updatedAt,applied:true}],error:null};
    }
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

let handler;
const callApi=async body=>{
  let statusCode=200;
  let payload;
  const req={body,query:{},headers:{"x-forwarded-for":"127.0.0.1"}};
  const res={
    status(code){statusCode=code;return res;},
    json(value){payload=value;return value;},
  };
  await handler(req,res);
  return{status:statusCode,body:payload};
};

const initialData=()=>({
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-admin",active:true}],
  obras:[],
  employees:[{id:"emp-1",name:"Ana",dailyRate:100,startDate:"2026-01-01"}],
  attendance:{"emp-1":{"2026-08-05":{status:"P"},"2026-09-01":{status:"P"}}},
  changeLog:[],
});

describe("/api/data · arquivar quinzena sincroniza a linha de Ponto quando ela já existe",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://archive-sync.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    delete process.env.POSTGRES_URL_NON_POOLING;
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    testState.rpcCalls.length=0;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-20T10:00:00.000Z"},
    };
    fakeDb.rpc.mockClear();
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  const archiveBody=()=>({
    action:"archive-quinzena",accessToken:"valid-token",
    archive:{quinzenaId:"2026-08-Q1",label:"Agosto Q1",dates:["2026-08-05"]},
  });

  it("lista metadados por data e abre somente a quinzena da empresa da sessão",async()=>{
    const older="2026-07-Q2";
    const foreign="2026-09-Q1";
    const updatedAt="2026-09-20T10:00:00.000Z";
    const row=(quinzenaId,inicio,company_id)=>({
      company_id,key:`${CORE_KEY}__arq__${quinzenaId}`,updated_at:updatedAt,
      value:{meta:{inicio},attendance:{"emp-1":{"2026-08-05":{status:"P"}}}},
    });
    const archive=row("2026-08-Q1","2026-08-01","arcd");
    const legacy=row(older,"2026-07-16","arcd");
    const external=row(foreign,"2026-09-01","mrc");
    Object.assign(testState.rows,{[legacy.key]:legacy,[archive.key]:archive,[external.key]:external});
    const before=structuredClone(testState.rows);

    const list=await callApi({action:"list-quinzena-archives",accessToken:"valid-token"});
    expect(list).toEqual({status:200,body:{ok:true,arquivos:[archive,legacy].map(item=>({
      key:item.key,updatedAt,meta:item.value.meta,
    }))}});
    const open=quinzenaId=>callApi({action:"load-quinzena-archive",accessToken:"valid-token",quinzenaId});
    expect(await open("2026-08-Q1")).toEqual({status:200,body:{ok:true,arquivo:archive.value,updatedAt}});
    expect(await open(foreign)).toMatchObject({status:404});
    expect(await open("2026-08")).toMatchObject({status:400});
    expect(testState.rows).toEqual(before);
    expect(testState.rpcCalls).toEqual([]);
  });

  it("quando a linha de Ponto NÃO existe ainda, arquiva só na core - sem chamada extra",async()=>{
    const result=await callApi(archiveBody());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls.map(c=>c.name)).toEqual(["attendance_archive_transaction"]);
  });

  it("quando a linha de Ponto já existe, sincroniza attendance nela após o arquivamento confirmar",async()=>{
    testState.rows[PONTO_KEY]={
      company_id:"arcd",key:PONTO_KEY,
      value:{attendance:{"emp-1":{"2026-08-05":{status:"P"},"2026-09-01":{status:"P"}}}},
      updated_at:"2026-08-20T10:00:00.000Z",
    };
    const result=await callApi(archiveBody());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls.map(c=>c.name)).toEqual(["attendance_archive_transaction","company_save_with_audit"]);
    const syncCall=testState.rpcCalls.find(c=>c.name==="company_save_with_audit");
    expect(syncCall.args.p_key).toBe(PONTO_KEY);
    // 05/08 foi arquivado (removido); 01/09 continua batido - a linha de
    // Ponto precisa refletir exatamente o mesmo "restante" que a core.
    expect(testState.rows[PONTO_KEY].value.attendance["emp-1"]).not.toHaveProperty("2026-08-05");
    expect(testState.rows[PONTO_KEY].value.attendance["emp-1"]).toHaveProperty("2026-09-01");
  });

  it("se a sincronização com a linha de Ponto falhar (versão desatualizada), o arquivamento em si continua ok",async()=>{
    testState.rows[PONTO_KEY]={
      company_id:"arcd",key:PONTO_KEY,
      value:{attendance:{"emp-1":{"2026-08-05":{status:"P"}}}},
      updated_at:"2026-08-20T10:00:00.000Z",
    };
    const originalRpc=fakeDb.rpc.getMockImplementation();
    fakeDb.rpc.mockImplementation(async(name,args)=>{
      if(name==="company_save_with_audit"){
        testState.rpcCalls.push({name,args});
        return{data:[{applied:false,updated_at:testState.rows[PONTO_KEY].updated_at}],error:null};
      }
      return originalRpc(name,args);
    });
    const result=await callApi(archiveBody());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });
});
