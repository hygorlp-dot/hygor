import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Achado de 24/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção
// "Investigação da integração com o agente de IA"): /api/ai-agent não
// tinha nenhum teste, e a ação de chat/análise (a única que chama o
// Gemini de verdade, custando cota real) não tinha limite de requisições
// por usuário. Este arquivo cobre o limite novo (aiRateLimited,
// api/ai-agent.js) via a rota HTTP completa - mocka @supabase/supabase-js
// (autenticação, mesmo padrão de src/integration/attendance-api-handler.
// test.js) e o fetch global (chamada ao Gemini).

const CORE_KEY="arced_ponto_v1";

const testState=vi.hoisted(()=>({
  rows:{},
}));

const queryFor=table=>{
  const filters={};
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    upsert(){return Promise.resolve({error:null});},
    delete(){return query;},
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

// getUser devolve um id derivado do próprio accessToken (em vez de fixo) -
// cada teste usa um token diferente, dando a cada um seu próprio contador
// de limite (aiRequestLog é um Map de módulo, não resetado entre testes
// do mesmo arquivo - mesma vida útil de uma instância "quente" real).
const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async token=>({data:{user:{id:`auth-${token}`}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

let handler;
const callApi=async body=>{
  let statusCode=200;
  let payload;
  const req={method:"POST",body,query:{},headers:{"x-forwarded-for":"127.0.0.1"}};
  const res={
    status(code){statusCode=code;return res;},
    setHeader(){},
    json(value){payload=value;return value;},
  };
  await handler(req,res);
  return{status:statusCode,body:payload};
};

const initialData=()=>({
  usuarios:["token-a","token-b","token-c"].map((token,index)=>({
    id:`eng-${index}`,nome:`Engenheira ${index}`,role:"engenheiro",
    authUserId:`auth-${token}`,active:true,
  })),
  obras:[],employees:[],changeLog:[],
});

const geminiOkResponse=()=>({
  ok:true,status:200,
  json:async()=>({candidates:[{content:{parts:[{text:"Resposta do Gemini."}]}}]}),
});

describe("/api/ai-agent · limite de requisições na ação de chat",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://ai-agent-rate-limit.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.GEMINI_API_KEY="test-gemini-key-1234567890";
    vi.resetModules();
    ({default:handler}=await import("../../api/ai-agent.js"));
  },30000);

  beforeEach(()=>{
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-24T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
    vi.stubGlobal("fetch",vi.fn(async()=>geminiOkResponse()));
  });
  afterEach(()=>vi.unstubAllGlobals());

  const chatCommand=(token,overrides={})=>({
    accessToken:token,prompt:"Qual o status da obra?",modulo:"geral",...overrides,
  });

  it("permite as primeiras 20 requisições de chat normalmente",async()=>{
    for(let i=0;i<20;i+=1){
      const result=await callApi(chatCommand("token-a"));
      expect(result.status).toBe(200);
    }
  });

  it("bloqueia a 21ª requisição de chat na mesma janela com 429",async()=>{
    for(let i=0;i<20;i+=1)await callApi(chatCommand("token-b"));
    const blocked=await callApi(chatCommand("token-b"));
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("AI_RATE_LIMIT_LOCAL");
  });

  it("não conta ações que não chamam o Gemini (status) contra o limite",async()=>{
    for(let i=0;i<25;i+=1){
      const result=await callApi({accessToken:"token-c",action:"status"});
      expect(result.status).toBe(200);
    }
    // O limite é só para o caminho de chat - ainda deve funcionar depois de 25 status.
    const chat=await callApi(chatCommand("token-c"));
    expect(chat.status).toBe(200);
  });
});
