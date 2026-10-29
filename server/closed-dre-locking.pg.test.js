// @vitest-environment node
// Banco descartável do job rep-p-arp-postgres. Prova concorrência real:
// PGlite verifica releitura, mas não oferece duas sessões concorrentes.
import postgres from "postgres";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {coreFieldsOnly,DOMAIN_ROW,pickDomainFields} from "./domain-row-routing.js";
import {decodeAppData} from "./data-codec.js";
import {
  cancelMaintenance,CORE_KEY,EQUIPMENT_KEY,openCompanySource,POINT_KEY,pointCommand,
  staleCompanyLine,TEST_ADMIN,TEST_NOW,withJulyClosing,
} from "./closed-dre-locking.test-helper.js";

const state=vi.hoisted(()=>({connection:null}));
vi.mock("./pg-conexao.js",()=>({comSql:callback=>callback(state.connection)}));
const {executarMutacaoEmpresaBloqueada,executarComandoPontoBloqueado}=await import("../api/data.js");

const URL_PG=process.env.PONTO_PG_URL;
const COMPANY=process.env.COMPANY_ID||"arcd";
let sql;
const deferred=()=>{
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
};

describe.skipIf(!URL_PG)("fechamento serializa com escritores financeiros (PostgreSQL real)",()=>{
  beforeAll(async()=>{
    sql=postgres(URL_PG,{ssl:false,max:4,onnotice:()=>{}});
    await sql.unsafe(`
      create table if not exists company_app_data(company_id text,key text,value jsonb,updated_at timestamptz default now(),updated_by uuid,primary key(company_id,key));
      create table if not exists audit_events(id bigserial primary key,company_id text,aggregate_type text,aggregate_id text,action text,actor_id text,actor_name text,correlation_id uuid,before_snapshot jsonb,after_snapshot jsonb,source text,created_at timestamptz default now());
    `);
  },30000);
  afterAll(async()=>{await sql?.end({timeout:5});});
  beforeEach(async()=>{
    await sql`delete from company_app_data where company_id=${COMPANY}`;
    await sql`delete from audit_events where company_id=${COMPANY}`;
  });

  it.each(["equipamento","ponto"])("%s espera o fechamento, relê a core e recusa escrita retroativa",async writer=>{
    const stale=openCompanySource();
    const versions=staleCompanyLine(stale).rowVersions;
    for(const [key,value] of [
      [CORE_KEY,coreFieldsOnly(stale,versions)],
      [POINT_KEY,pickDomainFields(stale,DOMAIN_ROW.PONTO)],
      [EQUIPMENT_KEY,pickDomainFields(stale,DOMAIN_ROW.EQUIPAMENTOS)],
    ])await sql`insert into company_app_data(company_id,key,value) values(${COMPANY},${key},${sql.json(value)})`;

    const closingReady=deferred(),allowCommit=deferred(),writerStarted=deferred();
    const closing=sql.begin(async transaction=>{
      const [{pid}]=await transaction`select pg_backend_pid() as pid`;
      await transaction`select value from company_app_data where company_id=${COMPANY} and key=${CORE_KEY} for update`;
      await transaction`update company_app_data set value=${transaction.json(coreFieldsOnly(withJulyClosing(stale),versions))}::jsonb where company_id=${COMPANY} and key=${CORE_KEY}`;
      closingReady.resolve(pid);
      await allowCommit.promise;
      // Se o escritor adquirisse domínio antes de core, esta ordem real do
      // fechamento causaria deadlock. Ele deve esperar sem segurar domínio.
      await transaction`select value from company_app_data where company_id=${COMPANY} and key=${POINT_KEY} for update`;
      await transaction`select value from company_app_data where company_id=${COMPANY} and key=${EQUIPMENT_KEY} for update`;
    });
    const closerPid=await closingReady.promise;
    state.connection={begin:callback=>sql.begin(async transaction=>{
      const [{pid}]=await transaction`select pg_backend_pid() as pid`;
      writerStarted.resolve(pid);
      return callback(transaction);
    })};
    const writing=(writer==="equipamento"
      ?executarMutacaoEmpresaBloqueada({
        actor:TEST_ADMIN,action:"operational_equipment_maintenance_cancelled",
        financial:false,protectClosedDre:true,domain:DOMAIN_ROW.EQUIPAMENTOS,
        linha:staleCompanyLine(stale),mutate:cancelMaintenance,
      })
      :executarComandoPontoBloqueado({
        usuario:TEST_ADMIN,command:pointCommand(),operationNow:TEST_NOW,linha:staleCompanyLine(stale),
      })
    ).then(result=>({result}),error=>({error}));

    let outcome;
    try{
      const writerPid=await writerStarted.promise;
      await vi.waitFor(async()=>{
        const [activity]=await sql`
          select wait_event_type,pg_blocking_pids(pid) as blockers
            from pg_stat_activity where pid=${writerPid}
        `;
        expect(activity?.wait_event_type).toBe("Lock");
        expect(activity?.blockers).toContain(closerPid);
      },{timeout:5000,interval:20});
    }finally{
      allowCommit.resolve();
      await closing;
      outcome=await writing;
    }
    if(outcome.error)throw outcome.error;
    expect(outcome.result).toMatchObject({kind:"error",status:409,code:"CLOSED_DRE_IMMUTABLE"});
    const rows=await sql`select key,value from company_app_data where company_id=${COMPANY}`;
    const values=new Map(rows.map(row=>[row.key,decodeAppData(row.value)]));
    expect(values.get(CORE_KEY).fechamentosFinanceiros).toHaveLength(1);
    expect(values.get(EQUIPMENT_KEY).manutencoesEquip[0].status).toBe("concluida");
    expect(values.get(POINT_KEY).attendanceOperationReceipts).toEqual([]);
    expect((await sql`select count(*)::int as count from audit_events where company_id=${COMPANY}`)[0].count).toBe(0);
  },15000);
});
