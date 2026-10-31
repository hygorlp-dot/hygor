import {beforeAll,beforeEach,afterAll,it,expect,vi} from "vitest";
import {quoteLinkKey,issueQuoteLink} from "../../server/supplier-quote-link.js";
import {OPERATIONAL_COMMAND} from "../domains/sync/operational-commands.js";
const state=vi.hoisted(()=>({data:null,reads:0,blocked:false}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:"auth-buyer"}},error:null})},
 from(table){const query={select(){return query},eq(){return query},in(){return query},like(){return query},order(){return query},update(){return query},maybeSingle:async()=>{state.reads++;return {data:{value:state.data,updated_at:"2026-10-30T10:00:00Z"},error:null}},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return query},rpc:async()=>({data:{blocked:state.blocked},error:null})})}));
let handler;const buyer={id:"buyer",authUserId:"auth-buyer",role:"compras",nome:"Compras",active:true};
async function call(body){let status=200,json;const res={setHeader(){},status(s){status=s;return res},json(j){json=j;return j}};await handler({method:"POST",body,headers:{"x-forwarded-for":"127.0.0.5"},query:{}},res);return {status,json}}
beforeAll(async()=>{vi.stubEnv("SUPABASE_URL","https://portal.test");vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","fixture-service");vi.stubEnv("PEDIDO_ACEITE_SECRET","s".repeat(40));vi.stubEnv("POSTGRES_URL_NON_POOLING","");vi.stubEnv("COMPANY_ID","arcd");({default:handler}=await import("../../api/data.js"));},60000);
afterAll(()=>vi.unstubAllEnvs());
beforeEach(()=>{state.blocked=false;state.reads=0;state.data={usuarios:[buyer],obras:[{id:"o"}],fornecedores:[{id:"f",nome:"Fornecedor"}],materiais:[{id:"m",descricao:"Material"}],cotacoes:[{id:"q",obraId:"o",status:"aberta",materialId:"m",qtd:2,propostas:[{id:"p",fornecedorId:"f",precoUnit:555}]}]}});
const token=()=>issueQuoteLink({key:quoteLinkKey(),quote:state.data.cotacoes[0],proposalId:"p",company:"arcd"}).token;
it("recusa token inválido antes de consultar os dados da empresa",async()=>{expect((await call({action:"cotacao-fornecedor-ver",token:"forjado"})).status).toBe(404);expect(state.reads).toBe(0)});
it("entrega apenas itens e fornecedor pela rota pública sem login",async()=>{const r=await call({action:"cotacao-fornecedor-ver",token:token()});expect(r.status).toBe(200);expect(r.json.cotacao.itens[0].qtd).toBe(2);expect(JSON.stringify(r.json)).not.toMatch(/555|usuarios|propostas/)});
it("não confirma recebimento sem persistência transacional",async()=>{const r=await call({action:"cotacao-fornecedor-responder",token:token()});expect(r.status).toBe(503);expect(state.data.cotacoes[0].respostasFornecedor).toBeUndefined()});
it("aplica limite de tentativas antes da consulta",async()=>{state.blocked=true;expect((await call({action:"cotacao-fornecedor-ver",token:token()})).status).toBe(429);expect(state.reads).toBe(0)});
it("gera link só para Compras e bloqueia obra fora do escopo",async()=>{const r=await call({action:"cotacao-fornecedor-link",accessToken:"qa",quoteId:"q",proposalId:"p"});expect(r.status).toBe(200);state.data.usuarios=[{...buyer,obraId:"other"}];expect((await call({action:"cotacao-fornecedor-link",accessToken:"qa",quoteId:"q",proposalId:"p"})).status).toBe(404);state.data.usuarios=[{...buyer,role:"financeiro"}];expect((await call({action:"cotacao-fornecedor-link",accessToken:"qa",quoteId:"q",proposalId:"p"})).status).toBe(403)});
it.each([OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED,OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_UPDATED])("API protege perfil e obra no registro de envio %s",async type=>{
 const body={action:"operational-command",accessToken:"qa",command:{type,actorRole:"admin",idempotencyKey:"dispatch-api-0001",expectedVersion:0,payload:{quoteId:"q",obraId:"forjada"}}};
 state.data.usuarios=[{...buyer,role:"financeiro"}];expect((await call(body)).status).toBe(403);
 state.data.usuarios=[{...buyer,obraId:"other"}];expect((await call(body)).status).toBe(403);
 expect(state.data.cotacoes[0].enviosFornecedor).toBeUndefined();
});
