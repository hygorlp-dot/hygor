import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Leitura de NF patrimonial por IA (29/10/2026): PDF sem tipo vindo do
// WhatsApp/e-mail, resposta cortada pelo limite de saída e sobrecarga
// momentânea do Gemini. Mesmo padrão de mock de ai-agent-budget-match.test.js.

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
  usuarios:[{id:"adm-0",nome:"Administração",role:"admin",authUserId:"auth-token-a",active:true}],
  obras:[],employees:[],changeLog:[],
});
const extracted={invoice:{numero:"1234",serie:"1",chave:"",emissao:"2026-10-20",fornecedorNome:"Loja",documentoFornecedor:"12345678000195",valorBruto:3500},
  items:[{nItem:1,descricao:"NOTEBOOK X",categoria:"Informática",marca:"",modelo:"",numeroSerie:"",imei:"",quantidade:1,valorUnitario:3500,valorTotal:3500,patrimonial:true,confianca:0.9,justificativa:"Bem durável."}]};
const reply=(text,finishReason="STOP")=>({ok:true,status:200,json:async()=>({candidates:[{finishReason,content:{parts:[{text}]}}]})});
const failure=status=>({ok:false,status,json:async()=>({error:{message:`erro ${status}`}})});
const pdf="data:application/octet-stream;base64,JVBERi0xLjQK";

describe("/api/ai-agent · leitura de NF patrimonial",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://ai-agent-asset-invoice.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.GEMINI_API_KEY="test-gemini-key-1234567890";
    vi.resetModules();
    ({default:handler}=await import("../../api/ai-agent.js"));
  },30000);
  beforeEach(()=>{testState.rows={[CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-10-29T10:00:00.000Z"}};});
  afterEach(()=>vi.unstubAllGlobals());
  const call=(dataUrl=pdf,fileName="NF 1234.pdf")=>callApi({accessToken:"token-a",action:"asset-invoice-extract",dataUrl,fileName});

  it("aceita PDF sem tipo pelo nome do arquivo e limita o raciocínio do modelo",async()=>{
    const fetchMock=vi.fn(async()=>reply(JSON.stringify(extracted)));vi.stubGlobal("fetch",fetchMock);
    const result=await call();
    expect(result.status).toBe(200);
    expect(result.body.items[0]).toMatchObject({descricao:"NOTEBOOK X",patrimonial:true});
    const sent=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.contents[0].parts[1].inlineData.mimeType).toBe("application/pdf");
    expect(sent.generationConfig.thinkingConfig.thinkingBudget).toBeGreaterThan(0);
    expect((await call(pdf,"planilha.xlsx")).status).toBe(400);
  });

  it("explica a resposta cortada em vez de acusar JSON inválido",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>reply('{"invoice":{"numero":"12',"MAX_TOKENS")));
    const result=await call();
    expect(result.status).toBe(422);expect(result.body.code).toBe("AI_OUTPUT_TRUNCATED");
  });

  it("tenta de novo quando o Gemini está sobrecarregado e aceita JSON entre crases",async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(reply("```json"+String.fromCharCode(10)+JSON.stringify(extracted)+String.fromCharCode(10)+"```"));
    vi.stubGlobal("fetch",fetchMock);
    const result=await call();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(200);
  });

  it("diferencia arquivo recusado e sobrecarga persistente",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>failure(400)));
    expect((await call()).body.code).toBe("AI_DOCUMENT_REJECTED");
    vi.stubGlobal("fetch",vi.fn(async()=>failure(503)));
    expect((await call()).body.code).toBe("AI_PROVIDER_BUSY");
  });
});
