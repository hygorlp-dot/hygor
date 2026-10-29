import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authRateLimitSubject, hashAppPin } from "../../server/app-auth-security.js";

const estado=vi.hoisted(() => ({
  usuarios:[], consultas:{nucleo:0,separadas:0,pontoObra:0}, limites:new Map(), chamadas:[], rpcDisponivel:true,
}));

const queryFor=() => {
  let modo="", chave="";
  const query={
    select() { return query; },
    eq(campo,valor) { if(campo==="key")chave=valor; return query; },
    upsert:async () => ({error:null}),
    in() { modo="separadas"; return query; },
    like() { modo="pontoObra"; return query; },
    order() { return query; },
    maybeSingle:async () => {
      if(chave==="arced_auth_profiles_v1")return {data:{value:{usuarios:estado.usuarios}},error:null};
      if(chave!=="arced_ponto_v1")return {data:null,error:null};
      estado.consultas.nucleo++;
      return {data:{value:{usuarios:estado.usuarios,obras:[],employees:[]},updated_at:"2026-10-29T12:00:00.000Z"},error:null};
    },
    then(resolve,reject) {
      estado.consultas[modo==="pontoObra"?"pontoObra":"separadas"]++;
      return Promise.resolve({data:[],error:null}).then(resolve,reject);
    },
  };
  return query;
};

const bancoFalso=vi.hoisted(() => ({
  auth:{getUser:vi.fn(async token => token==="jwt-valido"
    ?{data:{user:{id:"auth-admin",email:"joao@arcd.test"}},error:null}
    :{data:null,error:{message:"invalid"}})},
  from:vi.fn(() => queryFor()),
  rpc:vi.fn(async (funcao,args) => {
    if(!funcao.startsWith("auth_rate_limit_"))return {data:null,error:null};
    estado.chamadas.push({funcao,...args});
    if(!estado.rpcDisponivel)return {data:null,error:{message:"RPC indisponível"}};
    const subject=args.p_subject_hash;
    if(funcao==="auth_rate_limit_failure")estado.limites.set(subject,(estado.limites.get(subject)||0)+1);
    if(funcao==="auth_rate_limit_success")estado.limites.delete(subject);
    const blocked=(estado.limites.get(subject)||0)>=8;
    return {data:[{blocked,retry_after_seconds:blocked?300:0}],error:null};
  }),
}));
vi.mock("@supabase/supabase-js", () => ({createClient:() => bancoFalso}));

let handler, pinHash, sequencia=0, janela=0;
const chamar=async (body,ip=`192.0.2.${++sequencia}`) => {
  let status=200,corpo;
  const res={headersSent:false,setHeader() {},status(codigo) { status=codigo; return res; },json(valor) { corpo=valor; return valor; }};
  await handler({method:"POST",body,query:{},headers:{"x-forwarded-for":ip}},res);
  return {status,corpo};
};
const sujeito=valor => authRateLimitSubject("arcd-login-test",valor);

describe("login privado · API e limite compartilhado", () => {
  beforeAll(async () => {
    vi.stubEnv("SUPABASE_URL","https://login-privacy.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","service-role-test");
    vi.stubEnv("COMPANY_ID","arcd-login-test");
    vi.stubEnv("POSTGRES_URL_NON_POOLING","");
    pinHash=hashAppPin("123456");
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);
  afterAll(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  afterEach(() => { vi.useRealTimers(); });
  beforeEach(() => {
    // Expira o fallback em memória entre cenários sem esperar cinco minutos.
    vi.useFakeTimers({toFake:["Date"]});
    vi.setSystemTime(new Date(Date.UTC(2026,9,29,12)+ ++janela*300001));
    estado.usuarios=[
      {id:"admin-a",nome:"João Silva",email:"joao@arcd.test",role:"admin",authUserId:"auth-admin",active:true,pin:pinHash},
      {id:"sem-email",nome:"Maria de Souza",email:"",role:"admin",active:true,pin:pinHash},
      {id:"inativo",nome:"Pedro Antigo",email:"pedro@arcd.test",role:"admin",active:false,pin:pinHash},
      {id:"paulo-a",nome:"Paulo Lima",email:"paulo-a@arcd.test",role:"admin",pin:pinHash},
      {id:"paulo-b",nome:"Paulo Lima",email:"paulo-b@arcd.test",role:"admin",pin:pinHash},
    ];
    Object.assign(estado.consultas,{nucleo:0,separadas:0,pontoObra:0});
    estado.limites.clear();
    estado.chamadas.length=0;
    estado.rpcDisponivel=true;
  });

  it("profiles não enumera IDs, nomes, cargos nem credenciais", async () => {
    expect(await chamar({action:"profiles"})).toEqual({status:200,corpo:{precisaSetup:false}});
    expect(estado.consultas).toEqual({nucleo:0,separadas:0,pontoObra:0});
  });

  it("não oferece o setup encerrado quando só há operadores inativos", async () => {
    estado.usuarios=[estado.usuarios.find(usuario => usuario.active===false)];
    expect(await chamar({action:"profiles"})).toEqual({status:200,corpo:{precisaSetup:false}});
    estado.usuarios=[];
    expect(await chamar({action:"profiles"})).toEqual({status:200,corpo:{precisaSetup:true}});
  });

  it.each([["  JOAO@arcd.test ","admin-a"],["joao   silva","admin-a"],["Maria de Souza","sem-email"]])(
    "aceita o identificador %s sem uma lista pública", async (identificador,id) => {
      const resposta=await chamar({action:"load",identificador,pin:"123456"});
      expect(resposta.status).toBe(200);
      expect(resposta.corpo.usuario.id).toBe(id);
      expect(resposta.corpo.usuario).not.toHaveProperty("pin");
      expect(estado.consultas).toEqual({nucleo:1,separadas:1,pontoObra:1});
    },
  );

  it("preserva a autenticação das sessões PIN que já enviam userId", async () => {
    const resposta=await chamar({action:"load",userId:"admin-a",pin:"123456"});
    expect(resposta.status).toBe(200);
    expect(resposta.corpo.usuario.id).toBe("admin-a");
  });

  it("recusa nome ambíguo, parcial, inativo e PIN errado com a mesma resposta e sem ler dados auxiliares", async () => {
    const tentativas=[
      {identificador:"Paulo Lima",pin:"123456"},
      {identificador:"João",pin:"123456"},
      {identificador:"pedro@arcd.test",pin:"123456"},
      {identificador:"desconhecido",pin:"123456"},
      {identificador:"joao@arcd.test",pin:"000000"},
    ];
    const respostas=[];
    for(const tentativa of tentativas)respostas.push(await chamar({action:"load",...tentativa}));
    expect(respostas.every(r => r.status===401)).toBe(true);
    expect(new Set(respostas.map(r => JSON.stringify(r.corpo))).size).toBe(1);
    expect(estado.consultas.separadas).toBe(0);
    expect(estado.consultas.pontoObra).toBe(0);
  });

  it("não permite contornar o limite trocando IP, grafia, e-mail, nome ou ID", async () => {
    const entradas=[
      {identificador:"joao@arcd.test"},{identificador:" JOAO@ARCD.TEST "},
      {identificador:"João Silva"},{identificador:"joao  silva"},{userId:"admin-a"},
    ];
    for(let i=0;i<8;i++)expect((await chamar({action:"load",...entradas[i%entradas.length],pin:"000000"})).status).toBe(401);
    expect(estado.limites.get(sujeito("pin-usuario|admin-a"))).toBe(8);
    expect((await chamar({action:"load",identificador:"joao@arcd.test",pin:"123456"})).status).toBe(429);
    expect((await chamar({action:"load",userId:"admin-a",pin:"123456"})).status).toBe(429);
    expect(estado.consultas.separadas).toBe(0);
    expect(estado.chamadas.every(c => /^[a-f0-9]{64}$/.test(c.p_subject_hash))).toBe(true);
  });

  it("agrega as variações de um identificador desconhecido sem persistir o texto digitado", async () => {
    await chamar({action:"load",identificador:"  José   Ausente ",pin:"000000"});
    await chamar({action:"load",identificador:"jose ausente",pin:"000000"});
    expect(estado.limites.get(sujeito("pin-identificador|jose ausente"))).toBe(2);
    expect(JSON.stringify(estado.chamadas)).not.toContain("ausente");
  });

  it("uma autenticação aceita limpa o limite do IP e do usuário canônico", async () => {
    const ip=`192.0.2.${++sequencia}`;
    await chamar({action:"load",identificador:"João Silva",pin:"000000"},ip);
    expect(estado.limites.get(sujeito("pin-usuario|admin-a"))).toBe(1);
    expect((await chamar({action:"load",identificador:"joao@arcd.test",pin:"123456"},ip)).status).toBe(200);
    expect(estado.limites.has(sujeito("pin-usuario|admin-a"))).toBe(false);
    expect(estado.limites.has(sujeito(ip))).toBe(false);
  });

  it("o limite de PIN não interrompe uma sessão JWT válida", async () => {
    const ip=`192.0.2.${++sequencia}`;
    estado.limites.set(sujeito(ip),8);
    estado.limites.set(sujeito("pin-usuario|admin-a"),8);
    const resposta=await chamar({action:"load",accessToken:"jwt-valido"},ip);
    expect(resposta.status).toBe(200);
    expect(resposta.corpo.usuario.id).toBe("admin-a");
    expect(estado.chamadas).toEqual([]);
  });

  it("preserva o limite local por usuário se a RPC ficar indisponível", async () => {
    estado.rpcDisponivel=false;
    for(let i=0;i<8;i++){
      const identificador=i%2?"JOAO SILVA":"joao@arcd.test";
      expect((await chamar({action:"load",identificador,pin:"000000"})).status).toBe(401);
    }
    expect((await chamar({action:"load",userId:"admin-a",pin:"123456"})).status).toBe(429);
    expect(estado.consultas.separadas).toBe(0);
  });
});
