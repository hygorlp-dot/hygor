import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";

const CORE_KEY="arced_ponto_v1";
const PONTO_KEY="arced_ponto_v1__ponto";

const testState=vi.hoisted(()=>({
  rows:{},
  rpcCalls:[],
  sourceEvents:[],
}));
vi.mock('../../server/pg-conexao.js',()=>({comSql:callback=>callback(async(parts)=>{
  const query=parts.join('?');
  if(query.includes('from ponto_eventos'))return testState.sourceEvents;
  if(query.includes('from ponto_marcacoes'))return [];
  throw new Error(`Consulta não prevista na prévia: ${query}`);
})}));

// O mock simula a tabela company_app_data de verdade: várias linhas por
// (company_id,key). Desde a separação de linhas por domínio (20/08/2026,
// ver server/domain-row-routing.js), o ponto grava numa linha própria
// (PONTO_KEY) em vez da linha core (CORE_KEY) - o mock precisa saber
// diferenciar as duas para os testes continuarem exercitando o caminho real.
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
    getUser:vi.fn(async()=>({data:{user:{id:"auth-eng"}},error:null})),
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
    id:"eng-a",nome:"Engenheira A",role:"engenheiro",obraId:"obra-a",
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
  attendance:{},attendanceLocks:{},unlockRequests:[],
  dailyCheckDate:"",attendanceOperationReceipts:[],
});



import {buildFinancialLedger,selectDRE} from '../../src/domains/financeiro/ledger.js';

const seed=()=>{
 const value={...initialData(),config:{},usuarios:[{...initialData().usuarios[0],role:'financeiro'}],
 terceirizados:[{id:'t',obraId:'obra-a',active:true,name:'Terceiro QA'}],
 medicoesTerc:[{id:'m',obraId:'obra-a',tercId:'t',total:1000,version:1,status:'aprovada',data:'2026-11-01'}],
 notasFiscais:[{id:'nf',obraId:'obra-b',version:1,numero:'123',valorBruto:1000,valorLiquido:1000,status:'aprovada',emissao:'2026-11-01'}]};
 testState.rows={[CORE_KEY]:{company_id:'arcd',key:CORE_KEY,value,updated_at:'2026-11-14T12:00:00Z'},[PONTO_KEY]:{company_id:'arcd',key:PONTO_KEY,value:initialPontoData(),updated_at:'2026-11-14T12:00:00Z'}};
 testState.rpcCalls=[];return value;
};
const command=(type,payload,expectedVersion=0)=>callApi({action:'operational-command',accessToken:'valid-token',command:{type,payload,expectedVersion,idempotencyKey:'audit-integral-'+Math.random().toString(36).slice(2)}});
beforeAll(async()=>{process.env.SUPABASE_URL='https://attendance.test';process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-test';delete process.env.POSTGRES_URL_NON_POOLING;vi.resetModules();({default:handler}=await import('../../api/data.js'));},30000);
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));seed();});
afterAll(()=>vi.useRealTimers());

const cost=()=>selectDRE(buildFinancialLedger(testState.rows[CORE_KEY].value),{competence:'2026-11'}).costCents;
it.each(['financeiro','admin'])('etapa 1: API bloqueia vínculo cruzado para %s sem gravação nem efeito no DRE',async role=>{
 testState.rows[CORE_KEY].value.usuarios[0].role=role;
 const before=structuredClone(testState.rows),dre=cost();
 const response=await command('NOTA_MEDICAO_TERCEIRO_VINCULADA',{measurementId:'m',invoiceId:'nf',expectedMeasurementVersion:1,expectedInvoiceVersion:1});
 expect(response.status).toBe(403);expect(response.body.error).toMatch(/mesma obra/);
 expect(testState.rpcCalls).toHaveLength(0);expect(testState.rows).toEqual(before);expect(cost()).toBe(dre);
});
it('etapa 2: API rejeita a mesma nota sem chave com outro ID sem duplicar custo',async()=>{
 const data=testState.rows[CORE_KEY].value;data.medicoesTerc=[];data.notasFiscais=[];
 const invoice={id:'one',obraId:'obra-a',numero:'123',fornecedorId:'f',fornecedorNome:'Fornecedor QA',emissao:'2026-11-01',valorBruto:1000};
 expect((await command('NOTA_FISCAL_SALVA',{invoice})).status).toBe(200);
 const repeated=await command('NOTA_FISCAL_SALVA',{invoice:{...invoice,id:'two'}});
 expect(repeated.status).toBe(409);expect(testState.rows[CORE_KEY].value.notasFiscais).toHaveLength(1);expect(cost()).toBe(100000);expect(testState.rpcCalls).toHaveLength(1);
});
it('etapa 3: API mantém custo quando cancelamento de medição com NF reconhecida é rejeitado',async()=>{
 const data=testState.rows[CORE_KEY].value;data.usuarios[0].role='admin';data.notasFiscais[0].obraId='obra-a';
 expect((await command('NOTA_MEDICAO_TERCEIRO_VINCULADA',{measurementId:'m',invoiceId:'nf',expectedMeasurementVersion:1,expectedInvoiceVersion:1})).status).toBe(200);
 expect(cost()).toBe(100000);const before=structuredClone(testState.rows);
 const cancelled=await command('MEDICAO_TERCEIRO_CANCELADA',{measurementId:'m',reason:'Cancelamento QA'},2);
 expect(cancelled.status).toBe(409);expect(cancelled.body.reason).toMatch(/nota fiscal/i);expect(testState.rows).toEqual(before);expect(cost()).toBe(100000);expect(testState.rpcCalls).toHaveLength(1);
});
it.each(['orcamentos','planos','terceirizados','licencas'])('etapa 4: API protege obra com vínculo em %s',async collection=>{
 const data=testState.rows[CORE_KEY].value;data.usuarios[0].role='admin';data.employees=[];data.medicoesTerc=[];data.notasFiscais=[];data.terceirizados=[];
 data[collection]=[{id:'child',obraId:'obra-b',nome:'Registro preservado'}];const before=structuredClone(testState.rows),dre=cost();
 expect((await command('OBRA_EXCLUIDA',{projectId:'obra-b'},0)).status).toBe(409);
 expect(testState.rows).toEqual(before);expect(testState.rpcCalls).toHaveLength(0);expect(cost()).toBe(dre);
});
it('etapa 4: API preserva a obra da lotação anterior',async()=>{
 const data=testState.rows[CORE_KEY].value;data.usuarios[0].role='admin';data.employees=[{id:'e',name:'Pessoa QA',obra:'obra-a',lastObra:'obra-b',active:true}];data.medicoesTerc=[];data.notasFiscais=[];data.terceirizados=[];
 const before=structuredClone(testState.rows);expect((await command('OBRA_EXCLUIDA',{projectId:'obra-b'},0)).status).toBe(409);
 expect(testState.rows).toEqual(before);expect(testState.rpcCalls).toHaveLength(0);
});
it('etapa 5: API rejeita datas inexistentes sem reconhecer custo',async()=>{
 const data=testState.rows[CORE_KEY].value;data.medicoesTerc=[];data.notasFiscais=[];
 const saved=await command('NOTA_FISCAL_SALVA',{invoice:{id:'invalid',obraId:'obra-a',numero:'456',emissao:'2026-02-31',vencimento:'2026-13-40',valorBruto:1000}});
 expect(saved.status).toBe(409);expect(testState.rows[CORE_KEY].value.notasFiscais).toEqual([]);expect(testState.rpcCalls).toHaveLength(0);expect(cost()).toBe(0);
});
