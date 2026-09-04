import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Fase 1.5 reduzida (22/08/2026, ver server/attendance-obra-routing.js e
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): attendance-upsert/attendance-batch-
// upsert passam a gravar `data.attendance` em uma linha própria POR OBRA
// (não mais na linha "meta" de Ponto), via executarComandoPontoBloqueado -
// travando a linha meta (locks/unlockRequests/dailyCheckDate/receipts) MAIS
// uma linha por obra distinta tocada pelo comando, tudo na mesma transação.
// Este arquivo mocka tanto @supabase/supabase-js (lerLinha(), sem lock)
// quanto o pacote "postgres" (a transação real), no mesmo padrão de
// src/integration/operational-command-locked-path.test.js.

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";
const pontoObraKey=obraId=>`${PONTO_KEY}__obra__${obraId||"sem_obra"}`;

const testState=vi.hoisted(()=>({
  rows:{},
  transactionCalls:[],
  clock:null,
}));

const queryFor=table=>{
  const filters={};
  let inFilter=null;
  let likeFilter=null;
  let orderFilter=null;
  const query={
    select(){return query;},
    eq(key,value){filters[key]=value;return query;},
    in(key,values){inFilter={key,values};return query;},
    like(key,pattern){likeFilter={key,prefix:String(pattern||"").replace(/%$/,"")};return query;},
    order(field,opts){orderFilter={field,ascending:opts?.ascending!==false};return query;},
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
        if(orderFilter){
          const direction=orderFilter.ascending?1:-1;
          matches.sort((a,b)=>direction*String(a[orderFilter.field]||"").localeCompare(String(b[orderFilter.field]||"")));
        }
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
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-eng"}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async name=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

// clock_timestamp() do Postgres é um relógio ÚNICO, global, que só avança -
// nunca "relativo à linha tocada". Um bump por-linha (baseado no updated_at
// ANTERIOR dessa mesma linha) deixava a ordem entre DUAS linhas diferentes
// tocadas na mesma transação dependente de quantas vezes cada uma já tinha
// sido gravada antes - o que não reflete o Postgres real e escondia a
// própria ordem de escrita que o achado de 02/09/2026 depende (tombstone da
// obra antiga precisa terminar de gravar ANTES da obra nova, dentro da
// MESMA transação - ver api/data.js).
const bumpUpdatedAt=()=>{
  const base=testState.clock?new Date(testState.clock).getTime():new Date("2026-08-22T12:00:00.000Z").getTime();
  testState.clock=new Date(base+1000).toISOString();
  return testState.clock;
};

// Mock mínimo do pacote "postgres" - entende as 5 formas de query que
// executarComandoPontoBloqueado emite: SELECT...FOR UPDATE (linha meta e
// linhas de obra), UPDATE...RETURNING (linha meta), INSERT...ON CONFLICT DO
// NOTHING (cria a linha de obra sob demanda) e UPDATE sem RETURNING (grava a
// linha de obra), além do INSERT em audit_events.
const makeTransaction=()=>async(strings,...values)=>{
  const sql=strings.join("?");
  testState.transactionCalls.push(sql.replace(/\s+/g," ").trim().slice(0,60));
  if(sql.includes("for update")){
    const [,key]=values;
    const row=testState.rows[key];
    if(!row)return[];
    return[{value:row.value,updated_at:row.updated_at}];
  }
  if(sql.includes("insert into company_app_data")&&sql.includes("on conflict")){
    const [companyId,key,value]=values;
    if(!testState.rows[key]){
      testState.rows[key]={company_id:companyId,key,value:JSON.parse(value),updated_at:new Date(0).toISOString()};
    }
    return[];
  }
  if(sql.includes("update company_app_data")&&sql.includes("returning updated_at")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt();
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[{updated_at:updatedAt}];
  }
  if(sql.includes("update company_app_data")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt();
    testState.rows[key]={...row,company_id:companyId,key,value:JSON.parse(value),updated_at:updatedAt};
    return[];
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
  // admin não é escopado por obra (ensureScopedObra,
  // server/attendance-command.js:61-66) - necessário para o teste de lote
  // com duas obras distintas no mesmo request continuar válido.
  usuarios:[{
    id:"admin-a",nome:"Administradora A",role:"admin",
    authUserId:"auth-eng",active:true,
  }],
  obras:[{id:"obra-a",name:"Obra A"},{id:"obra-b",name:"Obra B"}],
  employees:[
    {id:"e-a",name:"Equipe A",obra:"obra-a",active:true,startDate:"2020-01-01"},
    {id:"e-b",name:"Equipe B",obra:"obra-b",active:true,startDate:"2020-01-01"},
  ],
  changeLog:[],
});

const initialPontoData=()=>({
  attendanceLocks:{},unlockRequests:[],dailyCheckDate:"",attendanceOperationReceipts:[],
});

describe("/api/data · caminho travado do Ponto particiona attendance por obra",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://ponto-locked.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T15:00:00.000Z"));
    testState.transactionCalls.length=0;
    testState.clock=null;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-22T12:00:00.000Z"},
      [PONTO_KEY]:{company_id:"arcd",key:PONTO_KEY,value:initialPontoData(),updated_at:"2026-08-22T12:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it("upsert de uma obra grava só na linha própria dessa obra, sem tocar a linha meta de Ponto",async()=>{
    const result=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000001",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",ot:0,note:"Turno normal",obraId:"obra-a"},
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.result.attendance[0]).toMatchObject({employeeId:"e-a",date:"2026-08-22",obraId:"obra-a"});

    const obraRow=testState.rows[pontoObraKey("obra-a")];
    expect(obraRow).toBeDefined();
    expect(obraRow.value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",note:"Turno normal"});
    // A linha meta nunca ganha um campo `attendance` - só os 4 campos meta.
    expect(testState.rows[PONTO_KEY].value).not.toHaveProperty("attendance");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-22T12:00:00.000Z");

    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",note:"Turno normal"});
  });

  it("lote com duas obras grava as duas linhas de obra na MESMA transação",async()=>{
    const result=await callApi({
      action:"attendance-batch-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000002",
      patches:[
        {employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",record:{status:"P",obraId:"obra-a"}},
        {employeeId:"e-b",date:"2026-08-22",selectedObraId:"obra-b",record:{status:"F",obraId:"obra-b"}},
      ],
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P"});
    expect(testState.rows[pontoObraKey("obra-b")].value.attendance["e-b"]["2026-08-22"]).toMatchObject({status:"F"});
  });

  it("reenviar o mesmo operationId é idempotente - não grava de novo",async()=>{
    const command={
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000003",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    };
    await callApi(command);
    testState.transactionCalls.length=0;
    const repeated=await callApi(command);
    expect(repeated.body.idempotent).toBe(true);
    expect(testState.transactionCalls.some(sql=>sql.includes("update company_app_data"))).toBe(false);
  });

  it("sem a linha meta de Ponto ainda semeada, attendance grava mesmo assim na própria linha de obra - só o recibo de idempotência cai para a core",async()=>{
    delete testState.rows[PONTO_KEY];
    const result=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000004",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    // A linha de obra é autossuficiente (criada sob demanda) - não depende
    // de scripts/seed-split-domain-rows.mjs já ter rodado para a linha meta.
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P"});
    // Só o recibo de idempotência (campo "meta") cai de volta para a core,
    // exatamente como os outros domínios sem linha própria ainda -
    // ver linhaEfetivaParaEscrita.
    expect(testState.rows[CORE_KEY].value.attendanceOperationReceipts).toEqual(
      expect.arrayContaining([expect.objectContaining({operationId:"20000000-0000-4000-8000-000000000004"})]),
    );
  });

  // Achado de 02/09/2026: trocar a obra do dia de um funcionário (ex.:
  // "trocar obra" na tela Gestão do ponto) só gravava a linha da obra NOVA
  // - a cópia na linha da obra ANTIGA nunca era apagada, sobrando como um
  // fantasma que podia "vencer" a cópia nova ao recarregar a tela (a ordem
  // em que o banco devolve as linhas por obra não é garantida). Sintoma
  // real relatado: a troca de obra "não salvava" ou revertia sozinha.
  it("trocar a obra do dia apaga a cópia da obra ANTIGA - não sobra fantasma nem some ao recarregar",async()=>{
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000005",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P"});

    const troca=await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000006",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-b",
      record:{status:"P",obraId:"obra-b"},
    });
    expect(troca.status).toBe(200);
    expect(troca.body.ok).toBe(true);

    // A linha ANTIGA (obra-a) precisa apagar (tombstone) sua cópia deste
    // (funcionário,data) - não deixar a chave como estava, nem sumir sem
    // registro nenhum (isso reintroduziria o "ressuscita sozinho" já
    // corrigido em 25/08/2026 - ver mergeAttendanceObjects).
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toBeNull();
    // A linha NOVA (obra-b) tem a cópia real e correta.
    expect(testState.rows[pontoObraKey("obra-b")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",obraId:"obra-b"});

    // E a reconstrução de leitura (lerLinha/mergeAttendanceObjects) devolve
    // a obra NOVA, nunca a fantasma da obra antiga - independente da ordem
    // em que o banco devolveria as linhas.
    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",obraId:"obra-b"});
  });

  // Achado real de produção de 04/09/2026 (ver docs/BLUEPRINT_CONCORRENCIA_
  // TRAVA.md): o `updated_at` de uma linha por obra é da LINHA inteira,
  // compartilhado por todo funcionário/dia que mora nela - uma gravação
  // TOTALMENTE ALHEIA (outro funcionário) na obra ANTIGA "refrescava" esse
  // timestamp, fazendo o tombstone (já correto, já gravado) parecer mais
  // recente que o valor certo, que está numa obra diferente - a troca
  // "sumia" de novo, mesmo já tombstonada, sem nenhum clique novo do
  // usuário. Corrigido com um carimbo por CÉLULA (withAttendanceSyncedAt),
  // imune a gravações alheias na mesma linha física.
  it("uma gravação de OUTRO funcionário na obra antiga, depois da troca, não ressuscita o fantasma nem apaga a obra nova",async()=>{
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000020",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000021",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-b",
      record:{status:"P",obraId:"obra-b"},
    });
    // Confirma o estado logo após a troca, antes da gravação alheia.
    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toBeNull();

    // Gravação de um funcionário DIFERENTE, num dia DIFERENTE, mas na MESMA
    // linha física (obra-a) - no esquema antigo, isto bastava para
    // "refrescar" o updated_at físico da linha inteira.
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000022",
      employeeId:"e-b",date:"2026-08-23",selectedObraId:"obra-a",
      record:{status:"F",obraId:"obra-a"},
    });

    // A troca de e-a continua correta - nem ressuscitou o fantasma em
    // obra-a, nem sumiu por causa da gravação alheia.
    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",obraId:"obra-b"});
    expect(reloaded.body.data.attendance["e-b"]["2026-08-23"]).toMatchObject({status:"F",obraId:"obra-a"});
  });

  // Achado secundário de 02/09/2026, investigado a fundo (ver
  // docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): a linha
  // "meta" de Ponto pode ainda carregar uma cópia legada de `attendance`
  // (fallback de leitura para células que nunca migraram para uma linha por
  // obra - registros escritos antes de 22/08, quando `attendance` ainda
  // fazia parte de DOMAIN_FIELDS[PONTO]). Os comandos "meta"
  // (daily-check/lock/unlock) passam por executarMutacaoEmpresaBloqueada, que
  // gravava a linha só com `pickDomainFields(PONTO)` = os 4 campos meta,
  // APAGANDO esse `attendance` legado inteiro, sem tombstone. Sintoma real:
  // dias de um funcionário sumiram da base sem rastro nenhum nos recibos.
  it("attendance-daily-check NÃO apaga o `attendance` legado que ainda sobra na linha meta de Ponto",async()=>{
    // Simula uma linha meta que ainda carrega a cópia legada de attendance de
    // antes da partição por obra: dois dias de um funcionário que nunca
    // ganharam linha de obra própria.
    testState.rows[PONTO_KEY].value={
      ...initialPontoData(),
      attendance:{
        "e-a":{
          "2026-08-10":{status:"P",ot:0,note:"legado",obraId:"obra-a"},
          "2026-08-11":{status:"F",ot:0,note:"legado",obraId:"obra-a"},
        },
      },
    };

    const result=await callApi({
      action:"attendance-daily-check",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000010",
      date:"2026-08-22",
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    // O comando só deveria mexer no dailyCheckDate - o attendance legado
    // continua intacto na linha meta, célula por célula.
    expect(testState.rows[PONTO_KEY].value.dailyCheckDate).toBe("2026-08-22");
    expect(testState.rows[PONTO_KEY].value.attendance).toEqual({
      "e-a":{
        "2026-08-10":{status:"P",ot:0,note:"legado",obraId:"obra-a"},
        "2026-08-11":{status:"F",ot:0,note:"legado",obraId:"obra-a"},
      },
    });

    // E a leitura reconstruída continua enxergando os dois dias.
    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-10"]).toMatchObject({status:"P",note:"legado"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-11"]).toMatchObject({status:"F",note:"legado"});
  });

  it("trocar de volta para a obra original limpa a obra intermediária, sem deixar fantasma nela também",async()=>{
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000007",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000008",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-b",
      record:{status:"P",obraId:"obra-b"},
    });
    await callApi({
      action:"attendance-upsert",accessToken:"valid-token",
      operationId:"20000000-0000-4000-8000-000000000009",
      employeeId:"e-a",date:"2026-08-22",selectedObraId:"obra-a",
      record:{status:"P",obraId:"obra-a"},
    });

    expect(testState.rows[pontoObraKey("obra-a")].value.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",obraId:"obra-a"});
    expect(testState.rows[pontoObraKey("obra-b")].value.attendance["e-a"]["2026-08-22"]).toBeNull();

    const reloaded=await callApi({action:"load",accessToken:"valid-token"});
    expect(reloaded.body.data.attendance["e-a"]["2026-08-22"]).toMatchObject({status:"P",obraId:"obra-a"});
  });
});
