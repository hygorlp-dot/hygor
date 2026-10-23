import {beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({profile:null,canonicalReads:0}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({
  auth:{getUser:async()=>({data:{user:{id:"auth-finance"}},error:null})},
  from(table){
    const query={select(){return query;},eq(){return query;},in(){return query;},like(){return query;},order(){return query;},range(){return query;},update(){return query;},
      maybeSingle:async()=>({data:{value:{usuarios:[state.profile],obras:[],employees:[],attendance:{},config:{}},updated_at:"2026-10-23T12:00:00Z"},error:null}),
      then(resolve,reject){if(table!=="company_app_data")state.canonicalReads+=1;return Promise.resolve({data:[],error:null}).then(resolve,reject);}};
    return query;
  },rpc:async()=>({data:null,error:null}),
})}));
let handler;
async function call(action,fields={}){
  let status=200,json;
  const response={status(value){status=value;return response;},json(value){json=value;return value;}};
  await handler({method:"POST",body:{action,accessToken:"isolated-token",year:2026,...fields},query:{},headers:{}},response);
  return {status,json};
}
describe("API anual usa autenticação e o mesmo razão mensal",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://annual-dre.test";process.env.SUPABASE_SERVICE_ROLE_KEY="isolated-key";
    ({default:handler}=await import("../../api/data.js"));
  },30000);
  beforeEach(()=>{state.profile={id:"finance",authUserId:"auth-finance",nome:"Financeiro",role:"financeiro",active:true};state.canonicalReads=0;});
  it("entrega 12 competências sem criar lançamentos",async()=>{
    const result=await call("financial-annual-dre-report");
    expect(result.status).toBe(200);expect(result.json.months).toHaveLength(12);
    expect(result.json.months[0].ym).toBe("2026-01");expect(result.json.months[11].ym).toBe("2026-12");
    expect(result.json.months.every(month=>month.lucroLiquido===0)).toBe(true);
    expect(result.json.layout.version).toBe(0);expect(result.json.source).toBe("canonical_ledger");
  });
  it.each(["financial-annual-dre-report","financial-annual-dre-layout"])("bloqueia perfil restrito, papel sem permissão e aba removida: %s",async action=>{
    for(const changes of [{obraId:"only-work"},{role:"engenheiro"},{accessTabs:["fin"]}]){
      state.profile={id:"finance",authUserId:"auth-finance",role:"financeiro",active:true,...changes};
      expect((await call(action)).status).toBe(403);
    }
    expect(state.canonicalReads).toBe(0);
  });
  it("rejeita ano inválido antes de consultar o razão",async()=>{
    expect((await call("financial-annual-dre-report",{year:1999})).status).toBe(400);
    expect(state.canonicalReads).toBe(0);
  });
});
