import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";

const testState=vi.hoisted(()=>({
  rows:{},
  rpcCalls:[],
}));

// O mock simula a tabela company_app_data de verdade: várias linhas por
// (company_id,key). Desde a separação de linhas por domínio (20/08/2026,
// ver server/domain-row-routing.js), o ponto grava numa linha própria
// (PONTO_KEY) em vez da linha core (CORE_KEY) - o mock precisa saber
// diferenciar as duas para os testes continuarem exercitando o caminho real.
const queryFor=table=>{
  const filters={};
  let mode="select";
  let values=null;
  let inFilter=null;
  const query={
    select(){return query;},
    update(next){mode="update";values=next;return query;},
    eq(key,value){filters[key]=value;return query;},
    in(key,values){inFilter={key,values};return query;},
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      const row=testState.rows[filters.key];
      if(!row||(filters.company_id&&filters.company_id!==row.company_id))return{data:null,error:null};
      if(mode==="update"){
        testState.rows[filters.key]={...row,...values};
        return{data:testState.rows[filters.key],error:null};
      }
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
      }else{
        result={data:[],error:null};
      }
      return Promise.resolve(result).then(resolve,reject);
    },
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{
    getUser:vi.fn(async()=>({data:{user:{id:"auth-eng"}},error:null})),
  },
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async(name,args)=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    if(name==="company_save_with_audit"){
      testState.rpcCalls.push(args);
      const row=testState.rows[args.p_key];
      if(!row||row.updated_at!==args.p_expected_updated_at){
        return{data:[{updated_at:row?.updated_at||null,applied:false}],error:null};
      }
      const updatedAt=new Date(new Date(row.updated_at).getTime()+1000).toISOString();
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
  usuarios:[{
    id:"eng-a",nome:"Engenheira A",role:"engenheiro",obraId:"obra-a",
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
  attendance:{},attendanceLocks:{},unlockRequests:[],
  dailyCheckDate:"",attendanceOperationReceipts:[],
});

describe("/api/data · persistência granular do ponto",()=>{
  // Timeout maior que o padrão de 10s: reimportar api/data.js puxa um
  // grafo de módulos pesado, e sob a suíte inteira rodando em paralelo
  // (disputa de CPU entre ~215 arquivos) isso passou de 10s por duas
  // vezes seguidas, mesmo levando poucas centenas de ms isolado.
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://attendance.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T15:00:00.000Z"));
    // As duas linhas já existem - simula scripts/seed-split-domain-rows.mjs
    // já ter rodado, o pré-requisito documentado para o ponto gravar na
    // própria linha em produção.
    testState.rows={
      [CORE_KEY]:{
        company_id:"arcd",key:CORE_KEY,value:initialData(),
        updated_at:"2026-07-28T12:00:00.000Z",
      },
      [PONTO_KEY]:{
        company_id:"arcd",key:PONTO_KEY,value:initialPontoData(),
        updated_at:"2026-07-28T12:00:00.000Z",
      },
    };
    testState.rpcCalls.length=0;
    fakeDb.rpc.mockClear();
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("confirma no servidor, persiste após nova leitura e audita uma única vez",async()=>{
    const command={
      action:"attendance-upsert",
      operationId:"10000000-0000-4000-8000-000000000001",
      employeeId:"e-a",date:"2026-07-28",selectedObraId:"obra-a",
      record:{status:"P",ot:0,note:"Conferido",obraId:"obra-a"},
      confirmDailyCheck:true,accessToken:"valid-token",
    };
    const saved=await callApi(command);

    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      ok:true,
      result:{
        attendance:[expect.objectContaining({
          employeeId:"e-a",date:"2026-07-28",obraId:"obra-a",
          record:expect.objectContaining({status:"P",note:"Conferido"}),
        })],
        dailyCheckDate:"2026-07-28",
      },
      updatedAt:"2026-07-28T12:00:01.000Z",
    });
    expect(saved.body).not.toHaveProperty("data");
    expect(testState.rpcCalls).toHaveLength(1);
    // A gravação vai para a linha própria de ponto, não a linha core -
    // achado de 20/08/2026 (contenção EMPLOYEE_SAVED x ATTENDANCE_COMMANDS).
    expect(testState.rpcCalls[0]).toMatchObject({
      p_key:PONTO_KEY,
      p_action:"attendance_upsert",
      p_before:{attendance:expect.objectContaining({employeeId:"e-a",date:"2026-07-28"})},
      p_after:{attendance:expect.objectContaining({employeeId:"e-a",date:"2026-07-28"})},
    });
    // A linha core nunca foi tocada por esta gravação.
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-07-28T12:00:00.000Z");

    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.data.attendance["e-a"]["2026-07-28"]).toMatchObject({
      status:"P",note:"Conferido",obraId:"obra-a",
    });

    const repeated=await callApi(command);
    expect(repeated.status).toBe(200);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
  });

  it("recusa no servidor a escrita de outra obra sem alterar o dataset",async()=>{
    const before=JSON.stringify(testState.rows[PONTO_KEY].value);
    const denied=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"10000000-0000-4000-8000-000000000002",
      employeeId:"e-b",date:"2026-07-28",selectedObraId:"obra-b",
      record:{status:"P",obraId:"obra-b"},
    });

    expect(denied).toMatchObject({status:403,body:{ok:false}});
    expect(JSON.stringify(testState.rows[PONTO_KEY].value)).toBe(before);
    expect(testState.rpcCalls).toHaveLength(0);
  });

  it("cai de volta a gravar a linha core quando a linha separada ainda não foi semeada (sem exigir ordem de deploy)",async()=>{
    delete testState.rows[PONTO_KEY];
    const result=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"10000000-0000-4000-8000-000000000003",
      employeeId:"e-a",date:"2026-07-28",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
    expect(testState.rpcCalls[0].p_key).toBe(CORE_KEY);
    expect(testState.rows[CORE_KEY].value.attendance["e-a"]["2026-07-28"]).toMatchObject({status:"P"});
  });
});
