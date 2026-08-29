import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Motor de associação item→composição (28/08/2026, pedido do usuário: "quero
// que você construa esse motor de associação automática"). Cobre a ação
// "budget-match" de api/ai-agent.js: a IA só pode ESCOLHER entre os
// candidatos reais enviados pelo cliente (nunca inventar código/preço), e
// nunca grava nada sozinha - só devolve a sugestão. Mesmo padrão de mock de
// src/integration/ai-agent-rate-limit.test.js (Supabase + fetch global).

const CORE_KEY="arced_ponto_v1";

const testState=vi.hoisted(()=>({rows:{}}));

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
    then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);},
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async token=>({data:{user:{id:`auth-${token}`}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
}));

vi.mock("@supabase/supabase-js",()=>({createClient:()=>fakeDb}));

let handler;
const callApi=async body=>{
  let statusCode=200,payload;
  const req={method:"POST",body,query:{},headers:{"x-forwarded-for":"127.0.0.1"}};
  const res={status(code){statusCode=code;return res;},setHeader(){},json(value){payload=value;return value;}};
  await handler(req,res);
  return{status:statusCode,body:payload};
};

const initialData=()=>({
  usuarios:[{id:"eng-0",nome:"Engenheira",role:"engenheiro",authUserId:"auth-token-a",active:true}],
  obras:[],employees:[],changeLog:[],
});

const geminiJsonResponse=matches=>({
  ok:true,status:200,
  json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({matches})}]}}]}),
});

describe("/api/ai-agent · ação budget-match",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://ai-agent-budget-match.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.GEMINI_API_KEY="test-gemini-key-1234567890";
    vi.resetModules();
    ({default:handler}=await import("../../api/ai-agent.js"));
  },30000);

  beforeEach(()=>{
    testState.rows={[CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-28T10:00:00.000Z"}};
    fakeDb.from.mockClear();
  });
  afterEach(()=>vi.unstubAllGlobals());

  const itens=[{id:"tubosRigidos-0",descricao:"Tubo PVC soldável Ø25mm - Água fria",quantidade:12,unidade:"m"}];
  const candidatos=[
    {fonte:"SINAPI",codigo:"88485",descricao:"Tubo PVC soldável DN 25mm, instalado em ramal de água fria",unidade:"m",precoUnit:8.42},
    {fonte:"SINAPI",codigo:"91000",descricao:"Tubo PVC esgoto DN 100mm",unidade:"m",precoUnit:22.10},
  ];

  it("devolve a composição escolhida quando o código bate com um candidato real",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>geminiJsonResponse([
      {itemId:"tubosRigidos-0",status:"associado",fonte:"SINAPI",codigo:"88485",confianca:0.9,justificativa:"Mesmo sistema (água fria) e diâmetro (25mm)."},
    ])));
    const result=await callApi({accessToken:"token-a",action:"budget-match",itens,candidatos});
    expect(result.status).toBe(200);
    expect(result.body.matches).toHaveLength(1);
    expect(result.body.matches[0]).toMatchObject({itemId:"tubosRigidos-0",status:"associado",fonte:"SINAPI",codigo:"88485",descricao:candidatos[0].descricao,precoUnit:8.42});
  });

  it("nunca inventa: se a IA devolver um código fora da lista de candidatos, vira pendente",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>geminiJsonResponse([
      {itemId:"tubosRigidos-0",status:"associado",fonte:"SINAPI",codigo:"99999-inexistente",confianca:0.8,justificativa:"..."},
    ])));
    const result=await callApi({accessToken:"token-a",action:"budget-match",itens,candidatos});
    expect(result.status).toBe(200);
    expect(result.body.matches[0].status).toBe("pendente");
    expect(result.body.matches[0].codigo).toBeUndefined();
  });

  it("mantém pendente quando a própria IA já marcou ambiguidade",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>geminiJsonResponse([
      {itemId:"tubosRigidos-0",status:"pendente",confianca:0.4,justificativa:"Dois candidatos plausíveis, sem diferença técnica clara."},
    ])));
    const result=await callApi({accessToken:"token-a",action:"budget-match",itens,candidatos});
    expect(result.status).toBe(200);
    expect(result.body.matches[0]).toMatchObject({itemId:"tubosRigidos-0",status:"pendente"});
  });

  it("rejeita com 400 quando não há itens",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>geminiJsonResponse([])));
    const result=await callApi({accessToken:"token-a",action:"budget-match",itens:[],candidatos});
    expect(result.status).toBe(400);
  });

  it("rejeita com 400 quando não há candidatos",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>geminiJsonResponse([])));
    const result=await callApi({accessToken:"token-a",action:"budget-match",itens,candidatos:[]});
    expect(result.status).toBe(400);
  });
});
