import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Fase 1.5 reduzida (22/08/2026, ver server/attendance-obra-routing.js e
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): attendance-upsert/attendance-batch-
// upsert passam a gravar `data.attendance` em uma linha própria POR OBRA
// (não mais na linha "meta" de Ponto), via executarComandoPontoBloqueado -
// travando a linha meta (locks/unlockRequests/dailyCheckDate/receipts) MAIS
// uma linha por obra distinta tocada pelo comando, tudo na mesma transação.
// Este arquivo mocka tanto @supabase/supabase-js (lerLinha(), sem lock)
// quanto o pacote "postgres" (a transação real), no mesmo padrão de
// src/integration/operational-command-locked-path.test.js.

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";
const pontoObraKey=obraId=>`${PONTO_KEY}__obra__${obraId||"sem_obra"}`;

const testState=vi.hoisted(()=>({
  rows:{},
  transactionCalls:[],
}));

const queryFor=table=>{
  const filters={};
  let inFilter=null;
  let likeFilter=null;
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    in(key,values){inFilter={key,values};return query;},
    like(key,pattern){likeFilter={key,prefix:String(pattern||"").replace(/%$/,"")};return query;},
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      const row=testState.rows[filters.key];
      if(!row||(filters.company_id&&filters.company_id!==row.company_id))return{data:null,error:null};
      return{data:{value:row.value,updated_at:row.updated_at},error:null};
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
        result={data:matches,error:null};
      }else{
        result={data:[],error:null};
      }
      return Promise.resolve(result).then(resolve,reject);
    },
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-eng"}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async name=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

const bumpUpdatedAt=isoString=>new Date(new Date(isoString).getTime()+1000).toISOString();

// Mock mínimo do pacote "postgres" - entende as 5 formas de query que
// executarComandoPontoBloqueado emite: SELECT...FOR UPDATE (linha meta e
// linhas de obra), UPDATE...RETURNING (linha meta), INSERT...ON CONFLICT DO
// NOTHING (cria a linha de obra sob demanda) e UPDATE sem RETURNING (grava a
// linha de obra), além do INSERT em audit_events.
const makeTransaction=()=>async(strings,...values)=>{
  const sql=strings.join("?");
  testState.transactionCalls.push(sql.replace(/\s+/g," ").trim().slice(0,60));
  if(sql.includes("for update")){
    const [,key]=values;
    const row=testState.rows[key];
    if(!row)return[];
    return[{value:row.value,updated_at:row.updated_at}];
  }
  if(sql.includes("insert into company_app_data")&&sql.includes("on conflict")){
    const [companyId,key,value]=values;
    if(!testState.rows[key]){
      testState.rows[key]={company_id:companyId,key,value:JSON.parse(value),updated_at:new Date(0).toISOString()};
    }
    return[];
  }
  if(sql.includes("update company_app_data")&&sql.includes("returning updated_at")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt(row?.updated_at||new Date(0).toISOString());
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[{updated_at:updatedAt}];
  }
  if(sql.includes("update company_app_data")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt(row?.updated_at||new Date(0).toISOString());
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[];
  }
  if(sql.includes("insert into audit_events")){
    return[];
  }
  throw new Error(`Query inesperada no mock de postgres: ${sql.slice(0,80)}`);
};

vi.mock("postgres",()=>({
  default:vi.fn(()=>({
    begin:async callback=>callback(makeTransaction()),
    end:async()=>{},
  })),
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
  // admin não é escopado por obra (ensureScopedObra,
  // server/attendance-command.js:61-66) - necessário para o teste de lote
  // com duas obras distintas no mesmo request continuar válido.
  usuarios:[{
    id:"admin-a",nome:"Administradora A",role:"admin",
    authUserId:"auth-eng",active:true,
  }],
  obras:[{id:"obra-a",name:"Obra A"},{id:"obra-b",name:"Obra B"}],
  employees:[
    {id:"e-a",name:"Equipe A",obra:"obra-a",active:true,startDate:"2020-01-01"},
    {id:"e-b",name:"Equipe B",obra:"obra-b",active:true,startDate:"2020-01-01"},
  ],
  changeLog:[],
});

const initialPontoData=()=>({
  attendanceLocks:{},unlockRequests:[],dailyCheckDate:"",attendanceOperationReceipts:[],
});

describe("/api/data · caminho travado do Ponto particiona attendance por obra",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://ponto-locked.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T15:00:00.000Z"));
    testState.transactionCalls.length=0;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-22T12:00:00.000Z"},
      [PONTO_KEY]:{company_id:"arcd",key:PONTO_KEY,value:initialPontoData(),updated_at:"2026-08-22T12:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("upsert de uma obra grava só na linha própria dessa obra, sem tocar a linha meta de Ponto",async()=>{
    const result=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000001",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",ot:0,note:"Turno normal",obraId:"obra-a"},
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.result.attendance[0]).toMatchObject({employeeId:"e-a",date:"2026-08-22",obraId:"obra-a"});

    const obraRow=testState.rows[pontoObraKey("obra-a")];
    expect(obraRow).toBeDefined();
    expect(obraRow.value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",note:"Turno normal"});
    // A linha meta nunca ganha um campo `attendance` - só os 4 campos meta.
    expect(testState.rows[PONTO_KEY].value).not.toHaveProperty("attendance");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-22T12:00:00.000Z");

    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",note:"Turno normal"});
  });

  it("lote com duas obras grava as duas linhas de obra na MESMA transação",async()=>{
    const result=await callApi({
      action:"attendance-batch-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000002",
      patches:[
        {employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",record:{status:"P",obraId:"obra-a"}},
        {employeeId:"e-b",date:"2026-08-22",selectedObraId:"obra-b",record:{status:"F",obraId:"obra-b"}},
      ],
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P"});
    expect(testState.rows[pontoObraKey("obra-b")].value.attendance["e-b"]["2026-08-22"]).toMatchObject({status:"F"});
  });

  it("reenviar o mesmo operationId é idempotente - não grava de novo",async()=>{
    const command={
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000003",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    };
    await callApi(command);
    testState.transactionCalls.length=0;
    const repeated=await callApi(command);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.transactionCalls.some(sql=>sql.includes("update company_app_data"))).toBe(false);
  });

  it("sem a linha meta de Ponto ainda semeada, attendance grava mesmo assim na própria linha de obra - só o recibo de idempotência cai para a core",async()=>{
    delete testState.rows[PONTO_KEY];
    const result=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000004",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    // A linha de obra é autossuficiente (criada sob demanda) - não depende
    // de scripts/seed-split-domain-rows.mjs já ter rodado para a linha meta.
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P"});
    // Só o recibo de idempotência (campo "meta") cai de volta para a core,
    // exatamente como os outros domínios sem linha própria ainda -
    // ver linhaEfetivaParaEscrita.
    expect(testState.rows[CORE_KEY].value.attendanceOperationReceipts).toEqual(
      expect.arrayContaining([expect.objectContaining({operationId:"20000000-0000-4000-8000-000000000004"})]),
    );
  });
});
