import {beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Achado de 24/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção
// "Investigação da integração com o agente de IA"): authenticateAppContext
// nunca teve teste próprio. Achado ao depurar um teste de outro arquivo
// (src/integration/ai-agent-rate-limit.test.js) que usuários diferentes
// resolviam sempre para o MESMO usuário - a causa era um bug real aqui:
// `String(u.email||"").toLowerCase()===email` casava "" === "" sempre que
// TANTO a sessão do Supabase Auth quanto um usuário do ArcD tinham e-mail
// vazio, resolvendo a pessoa errada (o primeiro usuário sem e-mail da
// lista) em vez de falhar a autenticação por e-mail.

const CORE_KEY="arced_ponto_v1";
const PROFILE_KEY="arced_auth_profiles_v1";

const testState=vi.hoisted(()=>({rows:{}}));

const queryFor=table=>{
  const filters={};
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    upsert(){return Promise.resolve({error:null});},
    maybeSingle:async()=>{
      if(table!=="company_app_data")return{data:null,error:null};
      const row=testState.rows[filters.key];
      if(!row||(filters.company_id&&filters.company_id!==row.company_id))return{data:null,error:null};
      return{data:{value:row.value,updated_at:row.updated_at},error:null};
    },
  };
  return query;
};

const fakeDb=vi.hoisted(()=>({
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-sem-email"}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

let authenticateAppContext;

const initialData=()=>({
  usuarios:[
    // Sem e-mail e sem authUserId vinculado - o "primeiro da lista" que o
    // bug antigo faria qualquer sessão sem e-mail casar por engano.
    {id:"user-sem-email-1",nome:"Sem Email 1",role:"engenheiro",authUserId:"",email:"",active:true},
    {id:"user-sem-email-2",nome:"Sem Email 2",role:"compras",authUserId:"",email:"",active:true},
    {id:"user-com-authid",nome:"Com AuthId",role:"admin",authUserId:"auth-com-id",email:"",active:true},
    {id:"user-com-email",nome:"Com Email",role:"financeiro",authUserId:"",email:"pessoa@arcd.com",active:true},
  ],
  obras:[],
});

describe("authenticateAppContext · correspondência por accessToken",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://auth-email-match.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    vi.resetModules();
    ({authenticateAppContext}=await import("./auth.js"));
  },30000);

  beforeEach(()=>{
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-24T10:00:00.000Z"},
    };
    delete testState.rows[PROFILE_KEY];
    fakeDb.from.mockClear();
  });

  it("não casa por engano dois usuários sem e-mail quando a sessão também não tem e-mail",async()=>{
    fakeDb.auth.getUser.mockResolvedValueOnce({data:{user:{id:"auth-token-desconhecido"}},error:null});
    const result=await authenticateAppContext({accessToken:"token-desconhecido"});
    // Nenhum usuário tem authUserId "auth-token-desconhecido", e a
    // correspondência por e-mail vazio não deveria mais valer - sem PIN
    // enviado, a autenticação falha (devolve null), em vez de resolver
    // "Sem Email 1" (o bug antigo).
    expect(result).toBeNull();
  });

  it("continua casando corretamente por authUserId, sem depender de e-mail",async()=>{
    fakeDb.auth.getUser.mockResolvedValueOnce({data:{user:{id:"auth-com-id"}},error:null});
    const result=await authenticateAppContext({accessToken:"token-com-id"});
    expect(result?.user?.id).toBe("user-com-authid");
  });

  it("continua casando corretamente por e-mail quando ele existe de verdade",async()=>{
    fakeDb.auth.getUser.mockResolvedValueOnce({
      data:{user:{id:"auth-qualquer",email:"pessoa@arcd.com"}},error:null,
    });
    const result=await authenticateAppContext({accessToken:"token-email"});
    expect(result?.user?.id).toBe("user-com-email");
  });
});
