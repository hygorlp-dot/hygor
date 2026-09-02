import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Escrita ao vivo de cotação/pedido (31/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): QUOTATION_SAVED e
// PURCHASE_ORDER_SAVED, além de gravar o blob como sempre (o caminho
// existente, inalterado), também gravam ao vivo em core_quotations/
// core_purchase_orders (migration 014, CORE-003) como efeito colateral de
// melhor esforço. Mesmo padrão de mock de
// src/integration/purchase-request-live-write.test.js.

const CORE_KEY="arced_ponto_v1";

const testState=vi.hoisted(()=>({
  rows:{},
  upsertCalls:[],
  upsertShouldFail:false,
}));

const queryFor=table=>{
  const filters={};
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    in(){return query;},
    like(){return query;},
    order(){return query;},
    upsert(row,options){
      testState.upsertCalls.push({table,row,options});
      return Promise.resolve(
        testState.upsertShouldFail
          ? {error:{message:"upsert falhou (simulado)"}}
          : {error:null},
      );
    },
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
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-compras"}},error:null}))},
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
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-compras",active:true}],
  obras:[{id:"obra-1",name:"Obra 1"}],
  materiais:[{id:"mat-1",descricao:"Cimento",unidade:"SC"}],
  fornecedores:[
    {id:"forn-1",nome:"Fornecedor A",ativo:true},
    {id:"forn-2",nome:"Fornecedor B",ativo:true},
  ],
  cotacoes:[],pedidos:[],solicitacoesCompra:[],changeLog:[],
});

const quotationCommand=(overrides={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{
    type:"COTACAO_COMPRA_SALVA",
    payload:{
      quote:{
        id:"cot-1",obraId:"obra-1",materialId:"mat-1",qtd:10,
        unidadeRef:"SC",unidadeCompra:"SC",
        propostas:[
          {id:"prop-1",fornecedorId:"forn-1",precoUnit:25},
          {id:"prop-2",fornecedorId:"forn-2",precoUnit:27},
        ],
      },
    },
    expectedVersion:0,idempotencyKey:"test-idem-key-quotation-1",
    ...overrides,
  },
});

const orderCommand=(overrides={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{
    type:"PEDIDO_COMPRA_SALVO",
    payload:{
      order:{
        id:"ped-1",obraId:"obra-1",fornecedorId:"forn-1",data:"2026-08-31",
        numero:"PED-001",
        itens:[{id:"item-1",materialId:"mat-1",qtd:10,precoUnit:25,unidadeRef:"SC",unidadeCompra:"SC"}],
      },
    },
    expectedVersion:0,idempotencyKey:"test-idem-key-order-1",
    ...overrides,
  },
});

describe("/api/data · QUOTATION_SAVED e PURCHASE_ORDER_SAVED gravam ao vivo em core_quotations/core_purchase_orders",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://purchase-live.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    testState.upsertCalls.length=0;
    testState.upsertShouldFail=false;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-31T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("grava a cotação em core_quotations depois do comando ser aplicado com sucesso",async()=>{
    const result=await callApi(quotationCommand());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    const [{table,row,options}]=testState.upsertCalls;
    expect(table).toBe("core_quotations");
    expect(options).toEqual({onConflict:"company_id,id"});
    expect(row).toMatchObject({
      company_id:"arcd",id:"cot-1",project_id:"obra-1",material_id:"mat-1",
      status:"aberta",active:true,quantity:10,source_version:1,request_id:null,
    });
    expect(row.source_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.payload.propostas).toHaveLength(2);
  });

  it("grava o pedido em core_purchase_orders depois do comando ser aplicado com sucesso",async()=>{
    const result=await callApi(orderCommand());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    const [{table,row,options}]=testState.upsertCalls;
    expect(table).toBe("core_purchase_orders");
    expect(options).toEqual({onConflict:"company_id,id"});
    expect(row).toMatchObject({
      company_id:"arcd",id:"ped-1",project_id:"obra-1",supplier_id:"forn-1",
      numero:"PED-001",status:"enviado",active:true,source_version:1,
      quote_id:null,request_id:null,
    });
    expect(row.source_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.payload.itens).toHaveLength(1);
  });

  it("reenviar o mesmo idempotencyKey não grava de novo",async()=>{
    const command=quotationCommand();
    await callApi(command);
    testState.upsertCalls.length=0;
    const repeated=await callApi(command);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.upsertCalls).toHaveLength(0);
  });

  it("se a escrita em core_quotations falhar, a resposta ao usuário continua ok",async()=>{
    testState.upsertShouldFail=true;
    const result=await callApi(quotationCommand());
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.upsertCalls).toHaveLength(1);
    // O blob foi gravado normalmente, mesmo com a escrita ao vivo falhando.
    expect(testState.rows[CORE_KEY].value.cotacoes).toHaveLength(1);
  });

  it("não grava em core_quotations/core_purchase_orders para comandos de outros domínios",async()=>{
    await callApi({
      action:"operational-command",accessToken:"valid-token",
      command:{
        type:"EMPLOYEE_SAVED",payload:{employee:{id:"emp-1",name:"Funcionário Teste"}},
        expectedVersion:0,idempotencyKey:"test-idem-key-employee-1",
      },
    });
    expect(testState.upsertCalls).toHaveLength(0);
  });

  // Ampliação (01/09/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md):
  // decidir cotação, os dois cancelamentos e anexação de documento - a
  // parte que tinha ficado de fora por decisão de escopo na primeira
  // rodada. Mesmas duas funções de sincronização reaproveitadas, só muda
  // qual linha cada comando precisa ressincronizar.
  describe("comandos ampliados nesta rodada",()=>{
    it("PEDIDO_COMPRA_GERADO_COTACAO (decidir cotação) grava o pedido novo E a cotação (agora 'decidida')",async()=>{
      await callApi(quotationCommand());
      testState.upsertCalls.length=0;
      const result=await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"PEDIDO_COMPRA_GERADO_COTACAO",
          payload:{quoteId:"cot-1",proposalId:"prop-1",orderId:"ped-from-quote-1",number:"PED-002",itemId:"item-2"},
          expectedVersion:0,idempotencyKey:"test-idem-key-from-quote-1",
        },
      });
      expect(result.body.ok).toBe(true);
      const tables=testState.upsertCalls.map(c=>c.table).sort();
      expect(tables).toEqual(["core_purchase_orders","core_quotations"]);
      const pedido=testState.upsertCalls.find(c=>c.table==="core_purchase_orders").row;
      expect(pedido).toMatchObject({id:"ped-from-quote-1",project_id:"obra-1",supplier_id:"forn-1",quote_id:"cot-1"});
      const cotacao=testState.upsertCalls.find(c=>c.table==="core_quotations").row;
      expect(cotacao).toMatchObject({id:"cot-1",status:"decidida"});
    });

    it("COTACAO_COMPRA_CANCELADA grava a cotação cancelada E o pedido que ela desvinculou",async()=>{
      await callApi(quotationCommand());
      await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"PEDIDO_COMPRA_GERADO_COTACAO",
          payload:{quoteId:"cot-1",proposalId:"prop-1",orderId:"ped-from-quote-1",number:"PED-002",itemId:"item-2"},
          expectedVersion:0,idempotencyKey:"test-idem-key-from-quote-2",
        },
      });
      testState.upsertCalls.length=0;
      const result=await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"COTACAO_COMPRA_CANCELADA",
          payload:{quoteId:"cot-1",reason:"Cadastro duplicado"},
          expectedVersion:2,idempotencyKey:"test-idem-key-cancel-quote-1",
        },
      });
      expect(result.body.ok).toBe(true);
      const tables=testState.upsertCalls.map(c=>c.table).sort();
      expect(tables).toEqual(["core_purchase_orders","core_quotations"]);
      const cotacao=testState.upsertCalls.find(c=>c.table==="core_quotations").row;
      expect(cotacao).toMatchObject({id:"cot-1",status:"cancelada",active:false});
      const pedido=testState.upsertCalls.find(c=>c.table==="core_purchase_orders").row;
      expect(pedido).toMatchObject({id:"ped-from-quote-1",quote_id:null});
    });

    it("COMPRA_CANCELADA grava o pedido cancelado",async()=>{
      await callApi(orderCommand());
      testState.upsertCalls.length=0;
      const result=await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"COMPRA_CANCELADA",
          payload:{orderId:"ped-1",reason:"Cadastro duplicado"},
          expectedVersion:1,idempotencyKey:"test-idem-key-cancel-order-1",
        },
      });
      expect(result.body.ok).toBe(true);
      expect(testState.upsertCalls).toHaveLength(1);
      const [{table,row}]=testState.upsertCalls;
      expect(table).toBe("core_purchase_orders");
      expect(row).toMatchObject({id:"ped-1",status:"cancelado",active:false});
    });

    it("DOCUMENTO_COTACAO_COMPRA_ANEXADO grava a cotação (payload atualizado)",async()=>{
      await callApi(quotationCommand());
      testState.upsertCalls.length=0;
      const result=await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"DOCUMENTO_COTACAO_COMPRA_ANEXADO",
          payload:{quoteId:"cot-1",proposalId:"prop-1",document:{id:"doc-1",nome:"Proposta.pdf",url:"https://exemplo.test/doc-1"}},
          expectedVersion:1,idempotencyKey:"test-idem-key-quote-doc-1",
        },
      });
      expect(result.body.ok).toBe(true);
      expect(testState.upsertCalls).toHaveLength(1);
      const [{table,row}]=testState.upsertCalls;
      expect(table).toBe("core_quotations");
      expect(row.id).toBe("cot-1");
      expect(row.payload.propostas.find(p=>p.id==="prop-1").documentos).toHaveLength(1);
    });

    it("DOCUMENTO_PEDIDO_COMPRA_ANEXADO grava o pedido (payload atualizado)",async()=>{
      await callApi(orderCommand());
      testState.upsertCalls.length=0;
      const result=await callApi({
        action:"operational-command",accessToken:"valid-token",
        command:{
          type:"DOCUMENTO_PEDIDO_COMPRA_ANEXADO",
          payload:{orderId:"ped-1",document:{id:"doc-2",nome:"NF.pdf",url:"https://exemplo.test/doc-2"}},
          expectedVersion:1,idempotencyKey:"test-idem-key-order-doc-1",
        },
      });
      expect(result.body.ok).toBe(true);
      expect(testState.upsertCalls).toHaveLength(1);
      const [{table,row}]=testState.upsertCalls;
      expect(table).toBe("core_purchase_orders");
      expect(row.id).toBe("ped-1");
      expect(row.payload.documentos).toHaveLength(1);
    });
  });
});
