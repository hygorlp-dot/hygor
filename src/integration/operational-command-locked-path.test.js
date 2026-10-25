import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

// Achado de 21/08/2026: o caminho travado (executarMutacaoEmpresaBloqueada/
// gravarMutacaoNaTransacao, ativo em produção sempre que
// POSTGRES_URL_NON_POOLING está configurado) travava e gravava SEMPRE a
// linha core, ignorando o roteamento por domínio inteiramente - mesmo
// depois de Ponto/Lookahead/Config/Equipamentos/RDO ganharem linha própria.
// Esse caminho nunca tinha teste algum (nenhum arquivo mockava o pacote
// "postgres" antes deste) - é exatamente por isso que a regressão passou
// despercebida. Este arquivo mocka tanto @supabase/supabase-js (usado por
// lerLinha(), a leitura sem lock antes da transação) quanto o pacote
// "postgres" (usado só dentro de executarMutacaoEmpresaBloqueada), para
// exercitar de ponta a ponta o caminho que roda de verdade em produção.

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";
const LOOKAHEAD_KEY="arced_ponto_v1__lookahead";
const CONFIG_KEY="arced_ponto_v1__config";
const EQUIPAMENTOS_KEY="arced_ponto_v1__equipamentos";
const RDO_KEY="arced_ponto_v1__rdo";

const testState=vi.hoisted(()=>({
  rows:{},
  transactionCalls:[],
  transactionKeys:[],
  beforeTransaction:null,
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
    // lerLinha() usa .like("key", `${prefix}%`) para descobrir as linhas de
    // Ponto por obra (número dinâmico, ver server/attendance-obra-routing.js)
    // - o mock só precisa entender o padrão de prefixo simples usado ali.
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
  auth:{getUser:vi.fn(async()=>({data:{user:{id:"auth-admin"}},error:null}))},
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async name=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
}));

// Mock mínimo do pacote "postgres" - só o suficiente para
// executarMutacaoEmpresaBloqueada/gravarMutacaoNaTransacao funcionarem: um
// SELECT...FOR UPDATE, um UPDATE de company_app_data e um INSERT em
// audit_events (o branch financeiro não é exercitado aqui, já tem
// cobertura própria via a suíte de FINANCIAL_ENGINE_ENFORCE).
const bumpUpdatedAt=isoString=>new Date(new Date(isoString).getTime()+1000).toISOString();

// Fiel ao driver `postgres`: tx.json(x) grava o objeto; um texto interpolado
// num parâmetro jsonb seria gravado como TEXTO, e o teste precisa enxergar
// isso (era o que fazia a base ser regravada a cada leitura).
const PG_JSON=Symbol("pg-json");
const valorJsonb=value=>value&&typeof value==="object"&&PG_JSON in value?value[PG_JSON]:value;
const comJson=tx=>Object.assign(tx,{json:value=>({[PG_JSON]:value})});
const makeTransaction=()=>comJson(async(strings,...values)=>{
  const sql=strings.join("?");
  testState.transactionCalls.push(sql);
  if(sql.includes("set local lock_timeout"))return [];
  if(sql.includes("key like")&&sql.includes("for update")){
    const prefix=values[1].replace(/%$/,"");
    const rows=Object.values(testState.rows).filter(row=>row.key.startsWith(prefix)).sort((a,b)=>a.key.localeCompare(b.key));
    testState.transactionKeys.push(...rows.map(row=>row.key));return rows;
  }
  if(sql.includes("for update")||sql.includes("for share")){
    const [,key]=values;
    testState.transactionKeys.push(key);
    const row=testState.rows[key];
    if(!row)return[];
    return[{value:row.value,updated_at:row.updated_at}];
  }
  if(sql.includes("update company_app_data")&&sql.includes("returning updated_at")){
    const [value,companyId,key]=values;
    const row=testState.rows[key];
    const updatedAt=bumpUpdatedAt(row?.updated_at||new Date(0).toISOString());
    // `value` chega como JSON.stringify(encodeAppData(...)) - a mesma coisa
    // que o driver real manda para uma coluna jsonb. O Supabase client
    // devolve jsonb já desserializado num read normal, então o mock precisa
    // fazer o parse aqui para simular o mesmo formato no próximo lerLinha().
    testState.rows[key]={...row,company_id:companyId,key,value:valorJsonb(value),updated_at:updatedAt};
    return[{updated_at:updatedAt}];
  }
  if(sql.includes("insert into audit_events")){
    return[];
  }
  throw new Error(`Query inesperada no mock de postgres: ${sql.slice(0,80)}`);
});

vi.mock("postgres",()=>({
  default:vi.fn(()=>({
    begin:async callback=>{testState.beforeTransaction?.();return callback(makeTransaction());},
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
  usuarios:[{id:"admin-a",nome:"Administradora A",role:"admin",authUserId:"auth-admin",active:true}],
  obras:[],employees:[],changeLog:[],
});

const opCommand=(type,payload,extra={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{type,payload,expectedVersion:0,idempotencyKey:`test-idem-key-${type.toLowerCase()}`,...extra},
});

describe("/api/data · caminho travado (executarMutacaoEmpresaBloqueada) roteia por domínio de verdade",()=>{
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://locked.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    process.env.POSTGRES_URL_NON_POOLING="postgres://user:pass@localhost:5432/app";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  afterAll(()=>{delete process.env.POSTGRES_URL_NON_POOLING;});

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    testState.transactionCalls.length=0;
    testState.transactionKeys.length=0;
    testState.beforeTransaction=null;
    testState.rows={
      [CORE_KEY]:{company_id:"arcd",key:CORE_KEY,value:initialData(),updated_at:"2026-08-21T10:00:00.000Z"},
      [PONTO_KEY]:{company_id:"arcd",key:PONTO_KEY,value:{attendance:{}},updated_at:"2026-08-21T10:00:00.000Z"},
      [LOOKAHEAD_KEY]:{company_id:"arcd",key:LOOKAHEAD_KEY,value:{lookaheadWindows:[]},updated_at:"2026-08-21T10:00:00.000Z"},
      [CONFIG_KEY]:{company_id:"arcd",key:CONFIG_KEY,value:{config:{}},updated_at:"2026-08-21T10:00:00.000Z"},
      [EQUIPAMENTOS_KEY]:{company_id:"arcd",key:EQUIPAMENTOS_KEY,value:{equipamentos:[]},updated_at:"2026-08-21T10:00:00.000Z"},
      [RDO_KEY]:{company_id:"arcd",key:RDO_KEY,value:{rdos:[]},updated_at:"2026-08-21T10:00:00.000Z"},
    };
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it('aprova parcela CLT na API com bloqueio transacional, sem pagamento e sem duplicar no retry',async()=>{
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    const {newCltDraft}=await import('../domains/ponto/clt-payslip.js');
    const {buildMixedPayroll}=await import('../domains/ponto/mixed-payroll.js');
    const employee={id:'emp-mixed',name:'Teste isolado',cpf:'000',startDate:'2026-01-01',active:true,remunerationMode:'clt',dailyRate:100,monthlySalary:2406.8,cltPayroll:{drafts:{'2026-09':{...newCltDraft('2026-09',{salary:2406.8}),paymentDate:'2026-09-30',workedDays:22,registration:'001',cbo:'715210',confirmed:true}}}};
    testState.rows[CORE_KEY].value={...initialData(),employees:[employee],financialSettlements:[{id:'preservado',amount:200}]};
    testState.rows[CONFIG_KEY].value={config:{companyName:'Teste isolado',cnpj:'00'}};
    const period={year:2026,month:8,cycle:'2',cltPlans:{'emp-mixed':{competence:'2026-09',amount:700,reference:'Parcela conferida pelo RH'}}};
    const data={...testState.rows[CORE_KEY].value,...testState.rows[CONFIG_KEY].value},row=buildMixedPayroll(data,period).rows[0];
    expect(row.issues).toEqual([]);
    const request=opCommand('QUINZENA_MISTA_APROVADA',{period,rowIds:[row.id],sources:{[row.id]:row.source},paymentDate:'2026-10-06'});
    const sourcesBefore=structuredClone({point:testState.rows[PONTO_KEY],config:testState.rows[CONFIG_KEY]});
    const first=await callApi(request);expect(first.status).toBe(200);expect(first.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.titulosFolha).toHaveLength(1);
    expect(testState.rows[CORE_KEY].value.financialSettlements).toEqual([{id:'preservado',amount:200}]);
    expect(testState.rows[CORE_KEY].value).not.toHaveProperty('attendance');
    expect(testState.rows[CORE_KEY].value).not.toHaveProperty('attendanceLocks');
    expect(testState.rows[CORE_KEY].value).not.toHaveProperty('config');
    expect({point:testState.rows[PONTO_KEY],config:testState.rows[CONFIG_KEY]}).toEqual(sourcesBefore);
    const second=await callApi(request);expect(second.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.titulosFolha).toHaveLength(1);
    expect(testState.rows[CORE_KEY].value.pagamentosFolha||[]).toEqual([]);
    expect(testState.transactionCalls.some(sql=>sql.includes('for update'))).toBe(true);
  });

  it.each(['work-record','unlock','cleared-locks','config'])('recusa aprovação mista quando %s muda após lerLinha e antes do lock',async changed=>{
    const {getQ,prIsWeekdayIso}=await import('../domains/ponto/attendance-engine.js');
    const {buildMixedPayroll}=await import('../domains/ponto/mixed-payroll.js');
    const dates=getQ(2026,7).q1.filter(prIsWeekdayIso),firstDay=dates[0];
    const employee={id:'daily-race',name:'Teste isolado',obra:'a',startDate:'2026-01-01',active:true,remunerationMode:'daily',dailyRate:100};
    const attendance={'daily-race':Object.fromEntries(dates.map(day=>[day,{status:'P',obraId:'a',ot:1}]))};
    const locks=Object.fromEntries(dates.map(day=>[`${day}__a`,{locked:true}]));
    const obraA=`${PONTO_KEY}__obra__a`,obraZ=`${PONTO_KEY}__obra__z`;
    testState.rows[CORE_KEY].value={...initialData(),employees:[employee],obras:[{id:'a',name:'Obra A'}],financialSettlements:[{id:'real',amount:200}]};
    testState.rows[PONTO_KEY].value={attendanceLocks:locks};
    // Insertion order deliberately reversed; the lock query must order keys.
    testState.rows[obraZ]={company_id:'arcd',key:obraZ,value:{attendance:{}},updated_at:'2026-08-21T10:00:00Z'};
    testState.rows[obraA]={company_id:'arcd',key:obraA,value:{attendance},updated_at:'2026-08-21T10:00:00Z'};
    testState.rows[CONFIG_KEY].value={config:{payrollOvertimeAdditionalPercent:50}};
    const period={year:2026,month:7,cycle:'1'},source={...testState.rows[CORE_KEY].value,...testState.rows[PONTO_KEY].value,...testState.rows[CONFIG_KEY].value,attendance};
    const row=buildMixedPayroll(source,period).rows[0];expect(row.issues).toEqual([]);
    testState.beforeTransaction=()=>{
      if(changed==='work-record')testState.rows[obraA].value={attendance:{'daily-race':{...attendance['daily-race'],[firstDay]:{status:'M',obraId:'a',ot:0}}}};
      if(changed==='unlock')testState.rows[PONTO_KEY].value={attendanceLocks:{...locks,[`${firstDay}__a`]:{locked:false}}};
      if(changed==='cleared-locks')testState.rows[PONTO_KEY].value={};
      if(changed==='config')testState.rows[CONFIG_KEY].value={config:{payrollOvertimeAdditionalPercent:100}};
    };
    const coreBefore=structuredClone(testState.rows[CORE_KEY]);
    const response=await callApi(opCommand('QUINZENA_MISTA_APROVADA',{period,rowIds:[row.id],sources:{[row.id]:row.source},paymentDate:'2026-08-21'}));
    expect(response.status).toBe(409);expect(response.body.error).toMatch(/origem mudaram|conferir e fechar/);
    expect(testState.rows[CORE_KEY]).toEqual(coreBefore);
    expect(testState.transactionKeys).toEqual([CORE_KEY,PONTO_KEY,obraA,obraZ,CONFIG_KEY]);
    expect(testState.transactionCalls.some(sql=>sql.includes('order by key for update'))).toBe(true);
    expect(testState.transactionCalls.some(sql=>sql.includes("lock_timeout = '2s'"))).toBe(true);
  });

  it("reaproveita a lerLinha() já feita no topo do handler - não relê pelo Supabase dentro de executarMutacaoEmpresaBloqueada",async()=>{
    await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-reuse",nome:"Compactador"}}));
    // lerLinha() faz 3 chamadas (linha core + linhas separadas via .in() +
    // linhas de Ponto por obra via .like(), Fase 1.5 - ver
    // server/attendance-obra-routing.js). Sem o reaproveitamento de `linha`,
    // executarMutacaoEmpresaBloqueada faria uma SEGUNDA lerLinha() antes de
    // travar - 6 chamadas ao todo.
    expect(fakeDb.from.mock.calls.filter(([table])=>table==="company_app_data")).toHaveLength(3);
  });

  it("grava EQUIPAMENTO_SALVO na linha de equipamentos, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-1",nome:"Betoneira"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[EQUIPAMENTOS_KEY].value.equipamentos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava LOOKAHEAD_CRIADO na linha de lookahead, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-1",obraId:"obra-x",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[LOOKAHEAD_KEY].value.lookaheadWindows).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava CONFIGURACAO_EMPRESA_SALVA na linha de config, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("CONFIGURACAO_EMPRESA_SALVA",{config:{companyName:"ARCD Obras"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CONFIG_KEY].value.config.companyName).toBe("ARCD Obras");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("grava RDO_CAMPO_ALTERADO na linha de RDO, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("RDO_CAMPO_ALTERADO",{report:{id:"rdo-1",obraId:"obra-x",data:"2026-08-20",status:"preparacao"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[RDO_KEY].value.rdos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-21T10:00:00.000Z");
  });

  it("mantém FUNCIONARIO_SALVO na linha core, comportamento inalterado",async()=>{
    const result=await callApi(opCommand("FUNCIONARIO_SALVO",{employee:{id:"emp-1",name:"João",dailyRate:150,startDate:"2026-08-20"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.employees).toHaveLength(1);
  });
  it('edita cadastro legado por diária sem exigir dados CLT e preserva ponto e pagamentos',async()=>{
    const core=testState.rows[CORE_KEY].value;
    const legacy={id:'e',name:'Legado QA',role:'SERVENTE',dailyRate:100,vtDaily:0,vrDaily:0,startDate:'2026-03-20',active:true,version:1};
    core.employees=[legacy];core.pagamentosFolha=[{id:'real',employeeId:'e',valor:600,data:'2026-08-20'}];
    const response=await callApi(opCommand('FUNCIONARIO_SALVO',{employee:{...legacy,phone:'81999999999',remunerationMode:'daily',monthlySalary:0,cltPayroll:null}},{expectedVersion:1}));
    expect(response).toMatchObject({status:200,body:{ok:true}});
    expect(testState.rows[CORE_KEY].value.employees[0]).toMatchObject({phone:'81999999999',dailyRate:100,vtDaily:0,vrDaily:0,version:2});
    expect(testState.rows[CORE_KEY].value.pagamentosFolha).toEqual([{id:'real',employeeId:'e',valor:600,data:'2026-08-20'}]);
    expect(testState.rows[PONTO_KEY].value).toEqual({attendance:{}});
  });

  it('define modalidade pelo ponto na API real, com autorização e pagamentos preservados',async()=>{
    const core=testState.rows[CORE_KEY].value;
    core.obras=[{id:'o',name:'Obra QA'}];
    core.employees=[{id:'e',name:'Operário QA',cpf:'529.982.247-25',phone:'81999999999',role:'Pedreiro',obra:'o',startDate:'2026-05-01',active:true,dailyRate:120,monthlySalary:2406.8,workdayHours:8,workStart:'07:00',pixType:'CPF',pixKey:'52998224725',pixHolder:'Operário QA',examExpiresAt:'2027-05-01',remunerationMode:'daily',version:1,cltPayroll:{profile:{registration:'001',cbo:'715210',category:'professional'}}}];
    core.pagamentosFolha=[{id:'preservar',employeeId:'e',data:'2026-08-20',valor:600}];
    const response=await callApi(opCommand('FUNCIONARIO_MODALIDADE_DEFINIDA',{employeeId:'e',mode:'clt',effectiveFrom:'2026-09-01',reason:'Contrato mensal formalizado'},{expectedVersion:1}));
    expect(response).toMatchObject({status:200,body:{ok:true}});
    expect(testState.rows[CORE_KEY].value.employees[0]).toMatchObject({remunerationMode:'clt',remunerationEffectiveFrom:'2026-09-01',version:2});
    expect(testState.rows[CORE_KEY].value.pagamentosFolha).toEqual([{id:'preservar',employeeId:'e',data:'2026-08-20',valor:600}]);
  });

  it("cai de volta a gravar a linha core quando a linha separada ainda não foi semeada",async()=>{
    delete testState.rows[EQUIPAMENTOS_KEY];
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-2",nome:"Guincho"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rows[CORE_KEY].value.equipamentos).toHaveLength(1);
  });
});
