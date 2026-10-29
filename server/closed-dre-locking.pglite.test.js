// @vitest-environment node
import {PGlite} from "@electric-sql/pglite";
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {coreFieldsOnly,DOMAIN_ROW,pickDomainFields} from "./domain-row-routing.js";
import {applyAttendanceCommand,ATTENDANCE_COMMAND} from "./attendance-command.js";
import {decodeAppData} from "./data-codec.js";
import {
  cancelMaintenance,CORE_KEY,EQUIPMENT_KEY,openCompanySource,POINT_KEY,pointCommand,
  staleCompanyLine,TEST_ADMIN,TEST_NOW,withJulyClosing,
} from "./closed-dre-locking.test-helper.js";

const state=vi.hoisted(()=>({connection:null}));
vi.mock("./pg-conexao.js",()=>({comSql:callback=>callback(state.connection)}));
const {executarMutacaoEmpresaBloqueada,executarComandoPontoBloqueado}=await import("../api/data.js");

const COMPANY=process.env.COMPANY_ID||"arcd";
let db;
let statements=[];

const transactionTag=transaction=>{
  const tag=async(strings,...values)=>{
    const query=strings.reduce((text,part,index)=>text+(index?`$${index}`:"")+part,"");
    statements.push({query,values});
    return (await transaction.query(query,values)).rows;
  };
  tag.json=value=>JSON.stringify(value);
  return tag;
};

const seed=async data=>{
  const versions=staleCompanyLine(data).rowVersions;
  for(const [key,value] of [
    [CORE_KEY,coreFieldsOnly(data,versions)],
    [POINT_KEY,pickDomainFields(data,DOMAIN_ROW.PONTO)],
    [EQUIPMENT_KEY,pickDomainFields(data,DOMAIN_ROW.EQUIPAMENTOS)],
  ])await db.query(
    "insert into company_app_data(company_id,key,value) values($1,$2,$3::jsonb)",
    [COMPANY,key,JSON.stringify(value)],
  );
};

const lockedKeys=()=>statements.filter(statement=>/for update/i.test(statement.query))
  .map(statement=>statement.values[1]);
const readRow=async key=>decodeAppData((await db.query(
  "select value from company_app_data where company_id=$1 and key=$2",[COMPANY,key],
)).rows[0]?.value);

describe("competência fechada é relida pelos escritores sob lock (PGlite)",()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`
      create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz default now(),updated_by text,primary key(company_id,key));
      create table audit_events(company_id text,aggregate_type text,aggregate_id text,action text,actor_id text,actor_name text,correlation_id uuid,before_snapshot jsonb,after_snapshot jsonb,source text);
    `);
    state.connection={begin:callback=>db.transaction(transaction=>callback(transactionTag(transaction)))};
  },30000);
  afterAll(async()=>{await db?.close();});
  beforeEach(async()=>{
    await db.exec("delete from company_app_data; delete from audit_events;");
    statements=[];
  });

  it.each([
    {name:"equipamento audit-only",financial:false,protectClosedDre:true},
    {name:"mutação financeira",financial:true,protectClosedDre:false},
  ])("$name usa core recém-fechada antes de tocar o domínio",async flags=>{
    const stale=openCompanySource();
    await seed(withJulyClosing(stale));
    const result=await executarMutacaoEmpresaBloqueada({
      actor:TEST_ADMIN,action:"operational_equipment_maintenance_cancelled",
      financial:flags.financial,protectClosedDre:flags.protectClosedDre,
      domain:DOMAIN_ROW.EQUIPAMENTOS,linha:staleCompanyLine(stale),mutate:cancelMaintenance,
    });
    expect(result).toMatchObject({kind:"error",status:409,code:"CLOSED_DRE_IMMUTABLE"});
    expect(lockedKeys()).toEqual([CORE_KEY,EQUIPMENT_KEY]);
    expect((await readRow(EQUIPMENT_KEY)).manutencoesEquip[0].status).toBe("concluida");
    expect(statements.some(statement=>/update company_app_data/i.test(statement.query))).toBe(false);
  });

  it.each([ATTENDANCE_COMMAND.UPSERT,ATTENDANCE_COMMAND.BATCH_UPSERT])("%s rejeita o mês fechado depois da leitura inicial",async action=>{
    const stale=openCompanySource();
    await seed(withJulyClosing(stale));
    const command=pointCommand(action===ATTENDANCE_COMMAND.BATCH_UPSERT?{
      action,patches:[{employeeId:"e1",date:"2026-07-10",selectedObraId:"o1",record:{status:"P",obraId:"o1"}}],
    }:{});
    const result=await executarComandoPontoBloqueado({usuario:TEST_ADMIN,command,operationNow:TEST_NOW,linha:staleCompanyLine(stale)});
    expect(result).toMatchObject({kind:"error",status:409,code:"CLOSED_DRE_IMMUTABLE",closedCompetence:"2026-07"});
    expect(lockedKeys()).toEqual([CORE_KEY,POINT_KEY]);
    expect((await readRow(POINT_KEY)).attendanceOperationReceipts).toEqual([]);
    expect(statements.some(statement=>/update company_app_data/i.test(statement.query))).toBe(false);
  });

  it("replay de ponto já persistido continua idempotente depois do fechamento",async()=>{
    const stale=openCompanySource();
    const command=pointCommand();
    const applied=applyAttendanceCommand(stale,TEST_ADMIN,command,TEST_NOW);
    expect(applied.ok).toBe(true);
    await seed(withJulyClosing(applied.data));
    const result=await executarComandoPontoBloqueado({usuario:TEST_ADMIN,command,operationNow:TEST_NOW,linha:staleCompanyLine(stale)});
    expect(result.kind).toBe("idempotent");
    expect(lockedKeys()).toEqual([CORE_KEY,POINT_KEY]);
    expect(statements.some(statement=>/update company_app_data/i.test(statement.query))).toBe(false);
  });

  it("ponto de agosto permanece gravável com julho encerrado",async()=>{
    const stale=openCompanySource();
    await seed(withJulyClosing(stale));
    const result=await executarComandoPontoBloqueado({
      usuario:TEST_ADMIN,command:pointCommand({date:"2026-08-02"}),operationNow:TEST_NOW,linha:staleCompanyLine(stale),
    });
    expect(result.kind).toBe("save");
    expect(lockedKeys().slice(0,2)).toEqual([CORE_KEY,POINT_KEY]);
    expect((await readRow(`${POINT_KEY}__obra__o1`)).attendance.e1["2026-08-02"].status).toBe("P");
  });
});
