import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {decodeAppData} from '../../server/data-codec.js';
import {serviceLinkSources} from '../domains/financeiro/service-forecast.js';

const CORE_KEY="arced_ponto_v1";
const LOOKAHEAD_KEY="arced_ponto_v1__lookahead";
const CONFIG_KEY="arced_ponto_v1__config";
const EQUIPAMENTOS_KEY="arced_ponto_v1__equipamentos";
const RDO_KEY="arced_ponto_v1__rdo";

const testState=vi.hoisted(()=>({
  rows:{},
  rpcCalls:[],
}));

// Mesmo mock multi-linha de src/integration/attendance-api-handler.test.js -
// simula a tabela company_app_data de verdade (várias linhas por
// company_id+key), agora exercitando o roteamento de OPERATIONAL_COMMAND
// para Lookahead/Config/Equipamentos (achado de 20/08/2026, ver
// server/domain-row-routing.js).
const queryFor=table=>{
  const filters={};
  let mode="select";
  let values=null;
  let inFilter=null;
  let likeFilter=null;
  let orderFilter=null;
  const query={
    select(){return query;},
    update(next){mode="update";values=next;return query;},
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
      if(mode==="update"){
        testState.rows[filters.key]={...row,...values};
        return{data:testState.rows[filters.key],error:null};
      }
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
  auth:{
    getUser:vi.fn(async()=>({data:{user:{id:"auth-admin"}},error:null})),
  },
  from:vi.fn(table=>queryFor(table)),
  rpc:vi.fn(async(name,args)=>{
    if(name.startsWith("auth_rate_limit_"))return{data:null,error:null};
    if(name==="company_save_with_audit"){
      testState.rpcCalls.push(args);
      const row=testState.rows[args.p_key];
      if(!row||row.updated_at!==args.p_expected_updated_at){
        return{data:[{updated_at:row?.updated_at||null,applied:false}],error:null};
      }
      const updatedAt=new Date(new Date(row.updated_at).getTime()+1000).toISOString();
      testState.rows[args.p_key]={...row,value:args.p_value,updated_at:updatedAt};
      return{data:[{updated_at:updatedAt,applied:true}],error:null};
    }
    return{data:null,error:{code:"PGRST202",message:`Unexpected RPC ${name}`}};
  }),
}));

vi.mock("@supabase/supabase-js",()=>({
  createClient:()=>fakeDb,
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
  usuarios:[{
    id:"admin-a",nome:"Administradora A",role:"admin",
    authUserId:"auth-admin",active:true,
  }],
  obras:[],employees:[],changeLog:[],
});

const opCommand=(type,payload,extra={})=>({
  action:"operational-command",accessToken:"valid-token",
  command:{
    type,payload,expectedVersion:0,
    idempotencyKey:`test-idem-key-${type.toLowerCase()}`,
    ...extra,
  },
});

describe("/api/data · roteamento de OPERATIONAL_COMMAND por linha separada",()=>{
  it('reverte lote bancário pelo handler autenticado, persiste original e autoria, rejeita snapshot e versão antiga',async()=>{
    const originalFile={size:1,dataUrl:'data:application/octet-stream;base64,YQ=='};
    const imported=await callApi(opCommand('TRANSACOES_BANCARIAS_IMPORTADAS',{statement:{id:'bank-batch',arquivo:'original.ofx',originalFile},transactions:[{id:'bank-tx',data:'2026-08-19',descricao:'Movimento sem uso',valor:-321,chave:'bank-key'}]}));
    expect(imported.status,JSON.stringify(imported.body)).toBe(200);
    const request=opCommand('IMPORTACAO_BANCARIA_REVERTIDA',{statementId:'bank-batch',expectedVersion:1,reason:'Arquivo incorreto conferido',targets:[{id:'bank-tx',expectedVersion:1}]},{actorId:'forged',actorRole:'admin',actorName:'Forjado',now:'2000-01-01T00:00:00Z'});
    const stale=structuredClone(request);stale.command.idempotencyKey='bank-stale-attempt-0001';stale.command.payload.expectedVersion=0;
    expect((await callApi(stale)).status).toBe(409);
    const result=await callApi(request);expect(result.status,JSON.stringify(result.body)).toBe(200);
    const saved=decodeAppData(testState.rows[CORE_KEY].value);
    expect(saved.transacoes[0]).toMatchObject({status:'cancelado',version:2});expect(saved.extratos[0].originalFile).toEqual(originalFile);
    expect(saved.extratos[0].importReversals[0]).toMatchObject({actorId:'admin-a',actor:'Administradora A',at:'2026-08-20T12:00:00.000Z'});
    expect((await callApi(request)).status).toBe(200);
    const tampered=structuredClone(saved);tampered.extratos[0].originalFile.dataUrl='changed';
    const blocked=await callApi({action:'save-sections',accessToken:'valid-token',sections:{extratos:tampered.extratos}});
    expect([403,409]).toContain(blocked.status);expect(decodeAppData(testState.rows[CORE_KEY].value).extratos[0].originalFile).toEqual(originalFile);
  });
  it('recusa reversão bancária por perfil financeiro, restrição de obra ou referência utilizada após prévia',async()=>{
    const d=testState.rows[CORE_KEY].value;
    await callApi(opCommand('TRANSACOES_BANCARIAS_IMPORTADAS',{statement:{id:'batch',arquivo:'a.ofx',originalFile:{size:1,dataUrl:'data:application/octet-stream;base64,YQ=='}},transactions:[{id:'tx',data:'2026-08-19',descricao:'Pendente',valor:-100,chave:'key'}]}));
    const request=opCommand('IMPORTACAO_BANCARIA_REVERTIDA',{statementId:'batch',expectedVersion:1,reason:'Conferência necessária',targets:[{id:'tx',expectedVersion:1}]});
    for(const fields of [{role:'financeiro',obraId:''},{role:'admin',obraId:'work'}]){
      const current=decodeAppData(testState.rows[CORE_KEY].value);Object.assign(current.usuarios[0],fields);testState.rows[CORE_KEY].value=current;
      expect((await callApi(request)).status).toBe(403);
    }
    const current=decodeAppData(testState.rows[CORE_KEY].value);Object.assign(current.usuarios[0],{role:'admin',obraId:''});current.payments=[{id:'paid',transacaoId:'tx',valor:100}];testState.rows[CORE_KEY].value=current;
    expect((await callApi(request)).status).toBe(409);expect(decodeAppData(testState.rows[CORE_KEY].value).transacoes[0].status).toBe('pendente');
  });
  it('consulta o modelo protegido sem emitir documentos e recusa Comercial',async()=>{
    const allowed=await callApi({action:'commercial-contract-model',accessToken:'valid-token'});
    expect(allowed.status).toBe(200);expect(allowed.body.model.nodes.filter(n=>n.kind==='heading'&&n.text.startsWith('C L Á U S U L A'))).toHaveLength(22);
    testState.rows[CORE_KEY].value.usuarios[0].role='comercial';
    const denied=await callApi({action:'commercial-contract-model',accessToken:'valid-token'});
    expect(denied.status).toBe(403);
  });
  it('persiste e reabre instrumento comercial na linha principal com auditoria e recibo',async()=>{
    const body=opCommand('COMERCIAL_INSTRUMENTO_SALVO',{id:'contract-handler-test',record:{titulo:'Contrato de teste local',dados:{},partes:[]}});
    const result=await callApi(body);
    expect(result.status).toBe(200);
    expect(result.body.sections.commercialContractRecords[0]).toMatchObject({id:'contract-handler-test',number:'CONT-00001',version:1,status:'rascunho'});
    const persisted=decodeAppData(testState.rows[CORE_KEY].value);
    expect(persisted.commercialContractRecords[0].titulo).toBe('Contrato de teste local');
    expect(persisted.operationalCommandReceipts.some(r=>r.idempotencyKey===body.command.idempotencyKey)).toBe(true);
    expect(testState.rpcCalls[0].p_actor_id).toBe('admin-a');
    const repeat=await callApi(body);expect(repeat.status).toBe(200);expect(repeat.body.idempotent).toBe(true);
    const reread=decodeAppData(testState.rows[CORE_KEY].value);expect(reread.commercialContractRecords).toHaveLength(1);
  });
  it('recusa atualização comercial com versão antiga sem sobrescrever a linha persistida',async()=>{
    await callApi(opCommand('COMERCIAL_INSTRUMENTO_SALVO',{id:'contract-conflict',record:{titulo:'Original',dados:{}}}));
    const result=await callApi(opCommand('COMERCIAL_INSTRUMENTO_SALVO',{id:'contract-conflict',record:{titulo:'Edição antiga',dados:{}}},{idempotencyKey:'stale-contract-key'}));
    expect(result.status).toBe(409);expect(decodeAppData(testState.rows[CORE_KEY].value).commercialContractRecords[0].titulo).toBe('Original');
  });
  it('gravação completa sem os campos comerciais preserva contratos; tentativa explícita de mudar é recusada',async()=>{
    await callApi(opCommand('COMERCIAL_INSTRUMENTO_SALVO',{id:'preserved-contract',record:{titulo:'Preservado',dados:{}}}));
    const loaded=await callApi({action:'load',accessToken:'valid-token'});
    const data=loaded.body.data;
    const omitted={...data};delete omitted.commercialContractRecords;
    const response=await callApi({action:'save',accessToken:'valid-token',payload:omitted});
    expect(response.status,JSON.stringify(response.body)).toBe(200);
    expect(decodeAppData(testState.rows[CORE_KEY].value).commercialContractRecords[0].titulo).toBe('Preservado');
    const rejected=await callApi({action:'save',accessToken:'valid-token',payload:{...data,commercialContractRecords:[]}});
    expect(rejected.status).toBe(409);
  });
  beforeAll(async()=>{
    process.env.SUPABASE_URL="https://opcmd.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY="service-role-test";
    vi.resetModules();
    ({default:handler}=await import("../../api/data.js"));
  },30000);

  beforeEach(()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));
    testState.rows={
      [CORE_KEY]:{
        company_id:"arcd",key:CORE_KEY,value:initialData(),
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [LOOKAHEAD_KEY]:{
        company_id:"arcd",key:LOOKAHEAD_KEY,value:{lookaheadWindows:[]},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [CONFIG_KEY]:{
        company_id:"arcd",key:CONFIG_KEY,value:{config:{}},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [EQUIPAMENTOS_KEY]:{
        company_id:"arcd",key:EQUIPAMENTOS_KEY,value:{equipamentos:[]},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
      [RDO_KEY]:{
        company_id:"arcd",key:RDO_KEY,value:{rdos:[]},
        updated_at:"2026-08-20T10:00:00.000Z",
      },
    };
    testState.rpcCalls.length=0;
    fakeDb.rpc.mockClear();
    fakeDb.from.mockClear();
  });
  afterAll(()=>vi.useRealTimers());

  it('persiste vínculo da previsão no core com autoria autenticada, replay e reabertura',async()=>{
    const d=testState.rows[CORE_KEY].value;
    d.obras=[{id:'work',name:'Obra'}];d.orcamentos=[{id:'b',obraId:'work',etapas:[{id:'s',nome:'Estrutura'}],itens:[]}];
    d.budgetBaselines=[{obraId:'work',tipo:'controle',ativo:true,budgetId:'b'}];
    d.terceirizados=[{id:'t',obraId:'work',tipoContrato:'medicao',contractValue:1000,active:true}];
    const request=opCommand('VINCULO_PREVISAO_TERCEIRO_SALVO',{obraId:'work',contractId:'t',budgetId:'b',stageId:'s',orderIds:[],sources:serviceLinkSources(d,'t',[]),note:'Conferência da contratação'}, {actorId:'forged',actorRole:'engenheiro'});
    const first=await callApi(request);expect(first.status,JSON.stringify(first.body)).toBe(200);
    const saved=decodeAppData(testState.rows[CORE_KEY].value).obras[0].costPlanning;
    expect(saved.serviceLinks.t).toMatchObject({stageId:'s',byId:'admin-a',version:1});expect(saved.serviceLinkHistory).toHaveLength(1);
    const repeated=await callApi(request);expect(repeated.body.idempotent).toBe(true);
    expect(decodeAppData(testState.rows[CORE_KEY].value).obras[0].costPlanning).toEqual(saved);
  });

  it('persiste garantia com autor autenticado, conserva o bruto e recusa regravação por snapshot',async()=>{
    const d=testState.rows[CORE_KEY].value;
    d.obras=[{id:'work',name:'Casa'}];d.terceirizados=[{id:'t',obraId:'work',name:'Execução',active:true}];
    d.medicoesTerc=[{id:'m',tercId:'t',obraId:'work',status:'aprovada',data:'2026-08-01',total:1000,version:1}];
    const request=opCommand('GARANTIA_TERCEIRO_DEFINIDA',{measurementId:'m',amountCents:10000,condition:'Aceite técnico conferido',reason:'Garantia prevista no documento de origem'},{expectedVersion:1,actorId:'forged',actorRole:'engenheiro'});
    const result=await callApi(request);expect(result.status,JSON.stringify(result.body)).toBe(200);
    const persisted=decodeAppData(testState.rows[CORE_KEY].value);
    expect(persisted.medicoesTerc[0]).toMatchObject({total:1000,version:2,technicalRetention:{amountCents:10000,byId:'admin-a',beneficiaryId:'t'}});
    expect((await callApi(request)).body.idempotent).toBe(true);
    const loaded=await callApi({action:'load',accessToken:'valid-token'}),modified=structuredClone(loaded.body.data);
    modified.medicoesTerc[0].technicalRetention.amountCents=1;
    const blocked=await callApi({action:'save-sections',accessToken:'valid-token',sections:{medicoesTerc:modified.medicoesTerc}});
    expect(blocked.status,JSON.stringify(blocked.body)).toBe(403);
    const stale=structuredClone(request);stale.command.idempotencyKey='retention-stale-attempt-0001';expect((await callApi(stale)).status).toBe(409);
    expect(decodeAppData(testState.rows[CORE_KEY].value).medicoesTerc[0].technicalRetention.amountCents).toBe(10000);
    const release=await callApi(opCommand('GARANTIA_TERCEIRO_LIBERADA',{measurementId:'m',date:'2026-08-20',dueDate:'2026-08-21',evidence:'Termo de aceite conferido',conditionConfirmed:true,reason:'Condição de garantia cumprida'},{expectedVersion:2}));
    expect(release.status,JSON.stringify(release.body)).toBe(200);
    const payment=await callApi(opCommand('GARANTIA_TERCEIRO_PAGA',{measurementId:'m',payment:{id:'guarantee-api-payment',date:'2026-08-20',pagador:'empresa'},reason:'Transferência da garantia confirmada'},{expectedVersion:3}));
    expect(payment.status,JSON.stringify(payment.body)).toBe(200);
    const reopened=decodeAppData(testState.rows[CORE_KEY].value);
    expect(reopened.pagsTerceiros[0]).toMatchObject({id:'guarantee-api-payment',amount:100,liquido:100,guaranteePayment:true,medicaoTercId:'m',createdById:'admin-a'});
    expect(reopened.medicoesTerc[0].technicalRetentionHistory.map(entry=>entry.kind)).toEqual(['defined','released','paid']);
  });

  it('garantia exige perfil, aba e obra no handler, desconsiderando papel forjado no comando',async()=>{
    const d=testState.rows[CORE_KEY].value;d.obras=[{id:'work'}];d.terceirizados=[{id:'t',obraId:'work',active:true}];d.medicoesTerc=[{id:'m',tercId:'t',obraId:'work',status:'aprovada',data:'2026-08-01',total:1000,version:1}];
    const request=opCommand('GARANTIA_TERCEIRO_DEFINIDA',{measurementId:'m',amountCents:10000,condition:'Aceite técnico conferido',reason:'Condições contratuais conferidas'},{expectedVersion:1,actorRole:'admin'});
    for(const fields of [{role:'engenheiro'},{role:'financeiro',obraId:'other'},{role:'financeiro',obraId:'work',accessTabs:['home']}]){
      Object.assign(d.usuarios[0],fields);expect((await callApi(request)).status).toBe(403);expect(testState.rpcCalls).toHaveLength(0);
    }
    Object.assign(d.usuarios[0],{role:'financeiro',obraId:'work',accessTabs:['fin']});expect((await callApi(request)).status).toBe(200);
  });

  it('nega vínculo sem perfil, aba ou escopo e permite financeiro da obra com conflito de versão protegido',async()=>{
    const d=testState.rows[CORE_KEY].value;
    d.obras=[{id:'work',name:'Obra'}];d.orcamentos=[{id:'b',obraId:'work',etapas:[{id:'s',nome:'Estrutura'}],itens:[]}];
    d.budgetBaselines=[{obraId:'work',tipo:'controle',ativo:true,budgetId:'b'}];d.terceirizados=[{id:'t',obraId:'work',tipoContrato:'medicao',contractValue:1000,active:true}];
    const request=opCommand('VINCULO_PREVISAO_TERCEIRO_SALVO',{obraId:'work',contractId:'t',budgetId:'b',stageId:'s',orderIds:[],sources:serviceLinkSources(d,'t',[]),note:'Conferência da contratação'},{actorRole:'admin'});
    for(const fields of [{role:'engenheiro'},{role:'financeiro',obraId:'other'},{role:'financeiro',obraId:'work',accessTabs:['home']}]){
      Object.assign(d.usuarios[0],fields);const denied=await callApi(request);expect(denied.status,JSON.stringify(denied.body)).toBe(403);expect(testState.rpcCalls).toHaveLength(0);
    }
    Object.assign(d.usuarios[0],{role:'financeiro',obraId:'work',accessTabs:['fin']});
    expect((await callApi(request)).status).toBe(200);
    const stale=structuredClone(request);stale.command.idempotencyKey='another-version-attempt';
    expect((await callApi(stale)).status).toBe(409);
    expect(decodeAppData(testState.rows[CORE_KEY].value).obras[0].costPlanning.serviceLinkHistory).toHaveLength(1);
  });

  it("grava EQUIPMENT_SAVED na linha de equipamentos, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-1",nome:"Betoneira"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
    expect(testState.rpcCalls[0].p_key).toBe(EQUIPAMENTOS_KEY);
    expect(testState.rows[EQUIPAMENTOS_KEY].value.equipamentos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("grava LOOKAHEAD_CRIADO na linha de lookahead, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-1",obraId:"obra-x",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(LOOKAHEAD_KEY);
    expect(testState.rows[LOOKAHEAD_KEY].value.lookaheadWindows).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("grava CONFIGURACAO_EMPRESA_SALVA na linha de config, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("CONFIGURACAO_EMPRESA_SALVA",{config:{companyName:"ARCD Obras"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(CONFIG_KEY);
    expect(testState.rows[CONFIG_KEY].value.config.companyName).toBe("ARCD Obras");
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("grava RDO_CAMPO_ALTERADO na linha de RDO, sem tocar a linha core",async()=>{
    const result=await callApi(opCommand("RDO_CAMPO_ALTERADO",{report:{id:"rdo-1",obraId:"obra-x",data:"2026-08-20",status:"preparacao"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(RDO_KEY);
    expect(testState.rows[RDO_KEY].value.rdos).toHaveLength(1);
    expect(testState.rows[CORE_KEY].updated_at).toBe("2026-08-20T10:00:00.000Z");
  });

  it("cai de volta a gravar a linha core para RDO quando a linha separada ainda não foi semeada",async()=>{
    delete testState.rows[RDO_KEY];
    const result=await callApi(opCommand("RDO_CAMPO_ALTERADO",{report:{id:"rdo-2",obraId:"obra-x",data:"2026-08-20",status:"preparacao"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(CORE_KEY);
    expect(testState.rows[CORE_KEY].value.rdos).toHaveLength(1);
  });

  it("mantém EMPLOYEE_SAVED na linha core, comportamento inalterado",async()=>{
    const result=await callApi(opCommand("FUNCIONARIO_SALVO",{employee:{id:"emp-1",name:"João",dailyRate:150,startDate:"2026-08-20"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls[0].p_key).toBe(CORE_KEY);
    expect(testState.rows[CORE_KEY].value.employees).toHaveLength(1);
  });

  it("cai de volta a gravar a linha core quando a linha separada ainda não foi semeada (sem exigir ordem de deploy)",async()=>{
    delete testState.rows[EQUIPAMENTOS_KEY];
    const result=await callApi(opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-2",nome:"Guincho"}}));
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);
    expect(testState.rpcCalls[0].p_key).toBe(CORE_KEY);
    expect(testState.rows[CORE_KEY].value.equipamentos).toHaveLength(1);
  });

  it("une o razão de idempotência entre Equipamentos e Lookahead - a repetição de qualquer um dos dois é detectada",async()=>{
    const equip=opCommand("EQUIPAMENTO_SALVO",{equipment:{id:"eq-3",nome:"Compactador"}});
    const first=await callApi(equip);
    expect(first.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(1);

    const lookahead=opCommand("LOOKAHEAD_CRIADO",{lookahead:{id:"la-2",obraId:"obra-y",horizonteSemanas:3,semanaInicio:"2026-08-24",semanaFim:"2026-09-13"}});
    const second=await callApi(lookahead);
    expect(second.body.ok).toBe(true);
    expect(testState.rpcCalls).toHaveLength(2);

    // Reenvia o comando de equipamento com a MESMA idempotencyKey - precisa
    // ser detectado como duplicado mesmo depois de Lookahead ter gravado sua
    // própria linha por último (a mesclagem por sobrescrita simples faria
    // isso falhar, escondendo o recibo do equipamento).
    const repeatEquip=await callApi(equip);
    expect(repeatEquip.body.idempotent).toBe(true);
    expect(testState.rpcCalls).toHaveLength(2);
  });
});
