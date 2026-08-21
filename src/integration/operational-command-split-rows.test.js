import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

const CORE_KEY="arced_ponto_v1";
const LOOKAHEAD_KEY="arced_ponto_v1__lookahead";
const CONFIG_KEY="arced_ponto_v1__config";
const EQUIPAMENTOS_KEY="arced_ponto_v1__equipamentos";

const testState=vi.hoisted(()=>({
  rows:{},
  rpcCalls:[],
}));

// Mesmo mock multi-linha de src/integration/attendance-api-handler.test.js -
// simula a tabela company_app_data de verdade (várias linhas por
// company_id+key), agora exercitando o roteamento de OPERATIONAL_COMMAND
// para Lookahead/Config/Equipamentos (achado de 20/08/2026, ver
// server/domain-row-routing.js).
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
    getUser:vi.fn(async()=>({data:{user:{id:"auth-admin"}},error:null})),
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
    id:"admin-a",nome:"Administradora A",role:"admin",
    authUserId:"auth-admin",active:true,
  }],
  obras:[],employees:[],changeLog:[],
});

const opCommand=(type,payload,extra={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{
    type,payload,expectedVersion:0,
    idempotencyKey:`test-idem-key-${type.toLowerCase()}`,
    ...extra,
  },
});

describe("/api/data · roteamento de OPERATIONAL_COMMAND por linha separada",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://opcmd.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    testState.rows={
      [CORE_KEY]:{
        company_id:"arcd",key:CORE_KEY,value:initialData(),
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [LOOKAHEAD_KEY]:{
        company_id:"arcd",key:LOOKAHEAD_KEY,value:{lookaheadWindows:[]},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [CONFIG_KEY]:{
        company_id:"arcd",key:CONFIG_KEY,value:{config:{}},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [EQUIPAMENTOS_KEY]:{
        company_id:"arcd",key:EQUIPAMENTOS_KEY,value:{equipamentos:[]},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
    };
    testState.rpcCalls.length=0;
    fakeDb.rpc.mockClear();
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("grava EQUIPMENT_SAVED na linha de equipamentos, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-1",nome:"Betoneira"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
    expect(testState.rpcCalls[0].p_key).toBe(EQUIPAMENTOS_KEY);
    expect(testState.rows[EQUIPAMENTOS_KEY].value.equipamentos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("grava LOOKAHEAD_CRIADO na linha de lookahead, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-1",obraId:"obra-x",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(LOOKAHEAD_KEY);
    expect(testState.rows[LOOKAHEAD_KEY].value.lookaheadWindows).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("grava CONFIGURACAO_EMPRESA_SALVA na linha de config, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("CONFIGURACAO_EMPRESA_SALVA",{config:{companyName:"ARCD Obras"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(CONFIG_KEY);
    expect(testState.rows[CONFIG_KEY].value.config.companyName).toBe("ARCD Obras");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("mantém EMPLOYEE_SAVED na linha core, comportamento inalterado",async()=>{
    const result=await callApi(opCommand("FUNCIONARIO_SALVO",{employee:{id:"emp-1",name:"João",dailyRate:150,startDate:"2026-08-20"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(CORE_KEY);
    expect(testState.rows[CORE_KEY].value.employees).toHaveLength(1);
  });

  it("devolve 503 SPLIT_ROW_MIGRATION_REQUIRED quando a linha separada ainda não foi semeada",async()=>{
    delete testState.rows[EQUIPAMENTOS_KEY];
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-2",nome:"Guincho"}}));
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ok:false,code:"SPLIT_ROW_MIGRATION_REQUIRED"});
    expect(testState.rpcCalls).toHaveLength(0);
  });

  it("une o razão de idempotência entre Equipamentos e Lookahead - a repetição de qualquer um dos dois é detectada",async()=>{
    const equip=opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-3",nome:"Compactador"}});
    const first=await callApi(equip);
    expect(first.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);

    const lookahead=opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-2",obraId:"obra-y",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}});
    const second=await callApi(lookahead);
    expect(second.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(2);

    // Reenvia o comando de equipamento com a MESMA idempotencyKey - precisa
    // ser detectado como duplicado mesmo depois de Lookahead ter gravado sua
    // própria linha por último (a mesclagem por sobrescrita simples faria
    // isso falhar, escondendo o recibo do equipamento).
    const repeatEquip=await callApi(equip);
    expect(repeatEquip.body.idempotent).toBe(true);
    expect(testState.rpcCalls).toHaveLength(2);
  });
});
