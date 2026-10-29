import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({profile:null,writes:0,reads:0}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:"auth-projection"}},error:null})},
 from(table){const query={select(){return query;},eq(){return query;},in(){return query;},like(){return query;},order(){return query;},range(){return query;},update(){state.writes++;return query;},insert(){state.writes++;return query;},upsert(){state.writes++;return query;},
 maybeSingle:async()=>({data:{value:{usuarios:state.profile?[state.profile]:[],employees:[{id:"e",name:"Pessoa reservada",dailyRate:150,cpf:"DOCUMENTO-SECRETO",pixKey:"PIX-SECRETO",startDate:"2025-01-01",obra:"o"}],obras:[{id:"o",name:"Obra A"}],attendance:{},config:{}},updated_at:"2026-10-29T12:00:00Z"},error:null}),
 then(resolve,reject){state.reads++;return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return query;},rpc:async()=>({data:null,error:null})
})}));
let handler;
async function call(fields={}){let status=200,json;const response={setHeader(){},status(value){status=value;return response;},json(value){json=value;return value;}};await handler({method:"POST",body:{action:"labor-fortnight-projection",accessToken:"synthetic-token",...fields},query:{},headers:{}},response);return {status,json};}
describe("consulta autenticada da projeção",()=>{
 beforeAll(async()=>{process.env.SUPABASE_URL="https://projection.test";process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-service";({default:handler}=await import("../../api/data.js"));},30000);
 beforeEach(()=>{state.profile={id:"u",authUserId:"auth-projection",role:"rh",active:true};state.writes=0;state.reads=0;});
 afterEach(()=>vi.useRealTimers());
 it("não aceita data, salário, empresa ou taxa do cliente e não muta dados",async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-01T01:00:00Z"));
  const result=await call({instant:"2030-01-01",date:"2030-01-01",dailyRate:1,company:"outra",rate:0});
  expect(result.status).toBe(200);expect(result.json.period.key).toBe("2026-10-Q2");expect(result.json.cutoff).toBe("2026-10-31");expect(state.writes).toBe(0);
  expect(JSON.stringify(result.json)).not.toMatch(/DOCUMENTO-SECRETO|PIX-SECRETO/);
 });
 it("401 sem sessão e 403 para papel, abas personalizadas e obra incompatíveis",async()=>{
  state.profile=null;expect((await call()).status).toBe(401);
  for(const profile of [{role:"engenheiro"},{role:"rh",accessTabs:["ponto"]},{role:"financeiro",accessTabs:["fin"]}]){state.profile={id:"u",authUserId:"auth-projection",active:true,...profile};expect((await call()).status).toBe(403);}
  state.profile={id:"u",authUserId:"auth-projection",role:"rh",obraId:"o",active:true};expect((await call({filters:{obraId:"outra"}})).status).toBe(403);
 });
 it("Financeiro recebe agregados e exportação sem abrir acesso à Folha",async()=>{
  state.profile={id:"u",authUserId:"auth-projection",role:"financeiro",accessTabs:["relat"],active:true};
  const result=await call();expect(result.status).toBe(200);expect(result.json.canSeePeople).toBe(false);expect(result.json.people).toBeUndefined();expect(JSON.stringify(result.json)).not.toContain("Pessoa reservada");
  expect((await call({filters:{employeeId:"e"}})).status).toBe(403);
 });
});
