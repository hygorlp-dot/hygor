import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Achado de 21/08/2026: o caminho travado (executarMutacaoEmpresaBloqueada/
// gravarMutacaoNaTransacao, ativo em produção sempre que
// POSTGRES_URL_NON_POOLING está configurado) travava e gravava SEMPRE a
// linha core, ignorando o roteamento por domínio inteiramente - mesmo
// depois de Ponto/Lookahead/Config/Equipamentos/RDO ganharem linha própria.
// Esse caminho nunca tinha teste algum (nenhum arquivo mockava o pacote
// "postgres" antes deste) - é exatamente por isso que a regressão passou
// despercebida. Este arquivo mocka tanto @supabase/supabase-js (usado por
// lerLinha(), a leitura sem lock antes da transação) quanto o pacote
// "postgres" (usado só dentro de executarMutacaoEmpresaBloqueada), para
// exercitar de ponta a ponta o caminho que roda de verdade em produção.

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";
const LOOKAHEAD_KEY="arced_ponto_v1__lookahead";
const CONFIG_KEY="arced_ponto_v1__config";
const EQUIPAMENTOS_KEY="arced_ponto_v1__equipamentos";
const RDO_KEY="arced_ponto_v1__rdo";

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
    // lerLinha() usa .like("key", `${prefix}%`) para descobrir as linhas de
    // Ponto por obra (número dinâmico, ver server/attendance-obra-routing.js)
    // - o mock só precisa entender o padrão de prefixo simples usado ali.
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

// Mock mínimo do pacote "postgres" - só o suficiente para
// executarMutacaoEmpresaBloqueada/gravarMutacaoNaTransacao funcionarem: um
// SELECT...FOR UPDATE, um UPDATE de company_app_data e um INSERT em
// audit_events (o branch financeiro não é exercitado aqui, já tem
// cobertura própria via a suíte de FINANCIAL_ENGINE_ENFORCE).
const bumpUpdatedAt=isoString=>new Date(new Date(isoString).getTime()+1000).toISOString();

const makeTransaction=()=>async(strings,...values)=>{
  const sql=strings.join("?");
  testState.transactionCalls.push(sql.slice(0,40));
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
    // `value` chega como JSON.stringify(encodeAppData(...)) - a mesma coisa
    // que o driver real manda para uma coluna jsonb. O Supabase client
    // devolve jsonb já desserializado num read normal, então o mock precisa
    // fazer o parse aqui para simular o mesmo formato no próximo lerLinha().
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[{updated_at:updatedAt}];
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
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-admin",active:true}],
  obras:[],employees:[],changeLog:[],
});

const opCommand=(type,payload,extra={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{type,payload,expectedVersion:0,idempotencyKey:`test-idem-key-${type.toLowerCase()}`,...extra},
});

describe("/api/data · caminho travado (executarMutacaoEmpresaBloqueada) roteia por domínio de verdade",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://locked.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    testState.transactionCalls.length=0;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-21T10:00:00.000Z"},
      [PONTO_KEY]:{company_id:"arcd",key:PONTO_KEY,value:{attendance:{}},updated_at:"2026-08-21T10:00:00.000Z"},
      [LOOKAHEAD_KEY]:{company_id:"arcd",key:LOOKAHEAD_KEY,value:{lookaheadWindows:[]},updated_at:"2026-08-21T10:00:00.000Z"},
      [CONFIG_KEY]:{company_id:"arcd",key:CONFIG_KEY,value:{config:{}},updated_at:"2026-08-21T10:00:00.000Z"},
      [EQUIPAMENTOS_KEY]:{company_id:"arcd",key:EQUIPAMENTOS_KEY,value:{equipamentos:[]},updated_at:"2026-08-21T10:00:00.000Z"},
      [RDO_KEY]:{company_id:"arcd",key:RDO_KEY,value:{rdos:[]},updated_at:"2026-08-21T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("reaproveita a lerLinha() já feita no topo do handler - não relê pelo Supabase dentro de executarMutacaoEmpresaBloqueada",async()=>{
    await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-reuse",nome:"Compactador"}}));
    // lerLinha() faz 3 chamadas (linha core + linhas separadas via .in() +
    // linhas de Ponto por obra via .like(), Fase 1.5 - ver
    // server/attendance-obra-routing.js). Sem o reaproveitamento de `linha`,
    // executarMutacaoEmpresaBloqueada faria uma SEGUNDA lerLinha() antes de
    // travar - 6 chamadas ao todo.
    expect(fakeDb.from.mock.calls.filter(([table])=>table==="company_app_data")).toHaveLength(3);
  });

  it("grava EQUIPAMENTO_SALVO na linha de equipamentos, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-1",nome:"Betoneira"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[EQUIPAMENTOS_KEY].value.equipamentos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava LOOKAHEAD_CRIADO na linha de lookahead, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-1",obraId:"obra-x",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[LOOKAHEAD_KEY].value.lookaheadWindows).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava CONFIGURACAO_EMPRESA_SALVA na linha de config, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("CONFIGURACAO_EMPRESA_SALVA",{config:{companyName:"ARCD Obras"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CONFIG_KEY].value.config.companyName).toBe("ARCD Obras");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava RDO_CAMPO_ALTERADO na linha de RDO, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("RDO_CAMPO_ALTERADO",{report:{id:"rdo-1",obraId:"obra-x",data:"2026-08-20",status:"preparacao"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[RDO_KEY].value.rdos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("mantém FUNCIONARIO_SALVO na linha core, comportamento inalterado",async()=>{
    const result=await callApi(opCommand("FUNCIONARIO_SALVO",{employee:{id:"emp-1",name:"João",dailyRate:150,startDate:"2026-08-20"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.employees).toHaveLength(1);
  });

  it("cai de volta a gravar a linha core quando a linha separada ainda não foi semeada",async()=>{
    delete testState.rows[EQUIPAMENTOS_KEY];
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-2",nome:"Guincho"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.equipamentos).toHaveLength(1);
  });
});
