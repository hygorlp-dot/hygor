import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Limpeza estreita do lado do blob (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): não existe comando de
// cancelamento/exclusão de solicitação de compra no aplicativo, então o
// registro de teste usado para verificar a escrita ao vivo em
// purchase_requests não tinha como ser removido pelo caminho normal.
// purchase-requests-cleanup-test-blob-entry só remove entradas de
// data.solicitacoesCompra/data.materiais cujo `numero` comece com
// "TESTE-". Mesmo padrão de mock de
// src/integration/operational-command-locked-path.test.js.

const CORE_KEY="arced_ponto_v1";

const testState=vi.hoisted(()=>({
  rows:{},
}));

const queryFor=table=>{
  const filters={};
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    in(){return query;},
    like(){return query;},
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
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-admin"}},error:null}))},
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
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-admin",active:true}],
  obras:[{id:"obra-1",name:"Obra 1"}],employees:[],
  materiais:[
    {id:"mat-teste-1",descricao:"Item de teste",solicitacaoOrigemId:"req-teste-1"},
    {id:"mat-real-1",descricao:"Item real",solicitacaoOrigemId:"req-real-1"},
  ],
  solicitacoesCompra:[
    {id:"req-teste-1",numero:"TESTE-CLAUDE-VERIFICACAO",obraId:"obra-1"},
    {id:"req-real-1",numero:"SC-001",obraId:"obra-1"},
  ],
  changeLog:[],
});

describe("/api/data · purchase-requests-cleanup-test-blob-entry",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://blob-cleanup.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-24T13:00:00.000Z"));
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-24T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("remove a solicitação e o material de teste associado, preservando os reais",async()=>{
    const result=await callApi({
      action:"purchase-requests-cleanup-test-blob-entry",accessToken:"valid-token",id:"req-teste-1",
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    const saved=testState.rows[CORE_KEY].value;
    expect(saved.solicitacoesCompra.map(item=>item.id)).toEqual(["req-real-1"]);
    expect(saved.materiais.map(item=>item.id)).toEqual(["mat-real-1"]);
  });

  it("recusa remover uma solicitação real (numero não começa com TESTE-)",async()=>{
    const result=await callApi({
      action:"purchase-requests-cleanup-test-blob-entry",accessToken:"valid-token",id:"req-real-1",
    });
    expect(result.status).toBe(400);
    expect(result.body.ok).toBeUndefined();
    // Nada foi removido.
    expect(testState.rows[CORE_KEY].value.solicitacoesCompra).toHaveLength(2);
  });

  it("devolve 404 para um id que não existe",async()=>{
    const result=await callApi({
      action:"purchase-requests-cleanup-test-blob-entry",accessToken:"valid-token",id:"req-inexistente",
    });
    expect(result.status).toBe(404);
  });
});
