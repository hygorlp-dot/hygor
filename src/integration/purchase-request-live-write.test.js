import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Primeira escrita transacional real de Fase 2 (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): SOLICITACAO_COMPRA_SALVA, além de
// gravar o blob como sempre (o caminho existente, inalterado), também
// grava ao vivo em purchase_requests (migration 010) como efeito colateral
// de melhor esforço. Mesmo padrão de mock de
// src/integration/operational-command-locked-path.test.js (Supabase +
// postgres), com .upsert() adicionado ao mock do Supabase para exercitar
// a escrita nova.

const CORE_KEY="arced_ponto_v1";

const testState=vi.hoisted(()=>({
  rows:{},
  upsertCalls:[],
  upsertShouldFail:false,
}));

const queryFor=table=>{
  const filters={};
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    in(){return query;},
    like(){return query;},
    upsert(row,options){
      testState.upsertCalls.push({table,row,options});
      return Promise.resolve(
        testState.upsertShouldFail
          ? {error:{message:"upsert falhou (simulado)"}}
          : {error:null},
      );
    },
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      const row=testState.rows[filters.key];
      if(!row||(filters.company_id&&filters.company_id!==row.company_id))return{data:null,error:null};
      return{data:{value:row.value,updated_at:row.updated_at},error:null};
    },
    then(resolve,reject){
      return Promise.resolve({data:[],error:null}).then(resolve,reject);
    },
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-compras"}},error:null}))},
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

const makeTransaction=()=>async(strings,...values)=>{
  const sql=strings.join("?");
  if(sql.includes("for update")){
    const [,key]=values;
    const row=testState.rows[key];
    if(!row)return[];
    return[{value:row.value,updated_at:row.updated_at}];
  }
  if(sql.includes("update company_app_data")&&sql.includes("returning updated_at")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt(row?.updated_at||new Date(0).toISOString());
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[{updated_at:updatedAt}];
  }
  if(sql.includes("insert into audit_events"))return[];
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
  // admin - autorizado tanto para SOLICITACAO_COMPRA_SALVA quanto para
  // EMPLOYEE_SAVED (usado no teste de "não grava para outros comandos"),
  // evitando misturar checagem de papel com o comportamento sob teste.
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-compras",active:true}],
  obras:[{id:"obra-1",name:"Obra 1"}],
  employees:[],materiais:[],solicitacoesCompra:[],changeLog:[],
});

const purchaseRequestCommand=(overrides={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{
    type:"SOLICITACAO_COMPRA_SALVA",
    payload:{
      request:{
        id:"req-1",numero:"SC-001",obraId:"obra-1",necessidade:"2026-09-01",
        prioridade:"normal",observacao:"",
        itens:[{id:"item-1",materialId:"mat-1",descricaoRef:"Cimento",unidadeRef:"SC",unidadeCompra:"SC",quantidade:10}],
      },
      catalogMaterials:[{id:"mat-1",descricao:"Cimento",unidade:"SC"}],
    },
    expectedVersion:0,idempotencyKey:"test-idem-key-purchase-request-1",
    ...overrides,
  },
});

describe("/api/data · SOLICITACAO_COMPRA_SALVA grava ao vivo em purchase_requests",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://purchase-live.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
    testState.upsertCalls.length=0;
    testState.upsertShouldFail=false;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-24T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("grava a solicitação em purchase_requests depois do comando ser aplicado com sucesso",async()=>{
    const result=await callApi(purchaseRequestCommand());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    const [{table,row,options}]=testState.upsertCalls;
    expect(table).toBe("purchase_requests");
    expect(options).toEqual({onConflict:"company_id,id"});
    expect(row).toMatchObject({
      company_id:"arcd",id:"req-1",request_number:"SC-001",project_id:"obra-1",
      needed_by:"2026-09-01",priority:"normal",source_version:1,
    });
    expect(row.payload.itens).toHaveLength(1);
  });

  it("reenviar o mesmo idempotencyKey não grava de novo em purchase_requests",async()=>{
    const command=purchaseRequestCommand();
    await callApi(command);
    testState.upsertCalls.length=0;
    const repeated=await callApi(command);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.upsertCalls).toHaveLength(0);
  });

  it("se a escrita em purchase_requests falhar, a resposta ao usuário continua ok",async()=>{
    testState.upsertShouldFail=true;
    const result=await callApi(purchaseRequestCommand());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    // O blob foi gravado normalmente, mesmo com a escrita ao vivo falhando.
    expect(testState.rows[CORE_KEY].value.solicitacoesCompra).toHaveLength(1);
  });

  it("não grava em purchase_requests para outros tipos de comando",async()=>{
    await callApi({
      action:"operational-command",accessToken:"valid-token",
      command:{
        type:"EMPLOYEE_SAVED",payload:{employee:{id:"emp-1",name:"Funcionário Teste"}},
        expectedVersion:0,idempotencyKey:"test-idem-key-employee-1",
      },
    });
    expect(testState.upsertCalls).toHaveLength(0);
  });

  it("SOLICITACAO_COMPRA_CANCELADA também atualiza purchase_requests, refletindo status:cancelada no payload",async()=>{
    await callApi(purchaseRequestCommand());
    testState.upsertCalls.length=0;
    const result=await callApi({
      action:"operational-command",accessToken:"valid-token",
      command:{
        type:"SOLICITACAO_COMPRA_CANCELADA",
        payload:{requestId:"req-1",reason:"Pedido duplicado"},
        expectedVersion:1,idempotencyKey:"test-idem-key-purchase-request-cancel-1",
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    const [{row}]=testState.upsertCalls;
    expect(row.id).toBe("req-1");
    expect(row.payload).toMatchObject({status:"cancelada",motivoCancelamento:"Pedido duplicado"});
    // O blob também reflete o cancelamento - soft-delete, o registro continua no array.
    const blobRecord=testState.rows[CORE_KEY].value.solicitacoesCompra.find(item=>item.id==="req-1");
    expect(blobRecord).toMatchObject({status:"cancelada"});
  });
});
