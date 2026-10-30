// @vitest-environment node
import { it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
const state=vi.hoisted(()=>({db:null}));
vi.mock("./pg-conexao.js",()=>({comSql:callback=>callback({begin:fn=>state.db.transaction(tx=>{const tag=async(parts,...values)=>(await tx.query(parts.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,""),values)).rows;tag.json=value=>JSON.stringify(value);return fn(tag);})})}));
const { executarComandoPontoBloqueado } = await import("../api/data.js");
const COMPANY=process.env.COMPANY_ID||"arcd",KEY="arced_ponto_v1",PONTO_KEY=`${KEY}__ponto`,PONTO_OBRA_KEY_PREFIX=`${PONTO_KEY}__obra__`;
import { openCompanySource, withJulyClosing } from "./closed-dre-locking.test-helper.js";
import { DOMAIN_ROW } from "./domain-row-routing.js";
import { inspectDay, sourceSignature, recordSignature, EVENT_TYPES } from "../src/domains/ponto-eletronico/conferencia.js";

it("conferência grava lançamento e auditoria atomicamente; snapshot concorrente não sobrescreve",async()=>{
  state.db=new PGlite();const db=state.db;
  try {
    await db.exec(`create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz,updated_by text,primary key(company_id,key));
      create table audit_events(company_id text,aggregate_type text,aggregate_id text,action text,actor_id text,actor_name text,correlation_id text,before_snapshot jsonb,after_snapshot jsonb,source text);
      create table ponto_eventos(company_id text,event_id text,employee_id text,obra_id text,marcado_em timestamptz,tipo_registro text,hora_confiavel boolean,relogio_alterado boolean,metodo text,payload jsonb);
      create table ponto_marcacoes(company_id text,id text,employee_id text,obra_id text,marcado_em timestamptz,tipo_registro text,hora_confiavel boolean,relogio_alterado boolean,metodo text);`);
    const date="2026-07-10",now="2026-08-02T21:00:00Z";
    const employee={id:"e",name:"Ana",active:true,startDate:"2026-01-01",obra:"o",workSchedules:[{code:"44h-seg-sex",effectiveFrom:"2026-07-01"}]};
    const payload={...openCompanySource(),employees:[employee],obras:[{id:"o",name:"Obra"}],attendance:{}};
    await db.query("insert into company_app_data values ($1,$2,$3,now(),null),($1,$4,'{}',now(),null)",[COMPANY,KEY,JSON.stringify(payload),PONTO_KEY]);
    const events=[];
    for(const [i,h] of ["07:00","12:00","13:00","17:00"].entries()){
      const marcadoEm=new Date(`${date}T${h}:00-03:00`).toISOString();
      events.push({id:`e${i}`,obraId:"o",marcadoEm,tipoEvento:EVENT_TYPES[i],tipoRegistro:"ponto",horaConfiavel:true});
      await db.query("insert into ponto_eventos values ($1,$2,'e','o',$3,'ponto',true,false,'facial',$4)",[COMPANY,`e${i}`,marcadoEm,JSON.stringify({versaoJornada:1,tipoEvento:EVENT_TYPES[i]})]);
    }
    const day=inspectDay(events,employee,date);
    const command={action:"attendance-review-punches",operationId:"10000000-0000-4000-8000-000000000001",employeeId:"e",date,selectedObraId:"o",status:"P",clocks:day.clocks,sourceSignature:sourceSignature(events),scheduleSignature:JSON.stringify(day.schedule),expectedRecord:recordSignature(null)};
    const repo={executarComandoPontoBloqueado};
    const args={usuario:{id:"rh",role:"rh",nome:"RH"},command,operationNow:now,linha:{payload,rowVersions:{[DOMAIN_ROW.PONTO]:now}}};
    await db.query("update company_app_data set value=$1 where key=$2",[JSON.stringify(withJulyClosing(payload)),KEY]);
    const closed=await repo.executarComandoPontoBloqueado(args);
    expect(closed).toMatchObject({kind:"error",status:409,code:"CLOSED_DRE_IMMUTABLE"});
    expect((await db.query("select * from audit_events")).rows).toHaveLength(0);
    await db.query("update company_app_data set value=$1 where key=$2",[JSON.stringify(payload),KEY]);
    const first=await repo.executarComandoPontoBloqueado(args);
    expect(first.kind).toBe("save");
    expect(first.result.attendance[0].record.workedMinutes).toBe(540);
    const manual=await repo.executarComandoPontoBloqueado({...args,command:{action:"attendance-upsert",operationId:"10000000-0000-4000-8000-000000000003",employeeId:"e",date,selectedObraId:"o",record:{status:"F",obraId:"o"}}});
    expect(manual).toMatchObject({kind:"error",status:409});
    expect(manual.error).toMatch(/conferido pelo RH/);
    const second=await repo.executarComandoPontoBloqueado({...args,command:{...command,operationId:"10000000-0000-4000-8000-000000000002"}});
    expect(second.kind).toBe("error");expect(second.error).toMatch(/alterado por outra pessoa/);
    expect((await repo.executarComandoPontoBloqueado(args)).kind).toBe("idempotent");
    const audit=await db.query("select * from audit_events");expect(audit.rows).toHaveLength(1);
    const stored=await db.query("select value from company_app_data where key=$1",[`${PONTO_OBRA_KEY_PREFIX}o`]);
    expect(stored.rows[0].value.attendance.e[date].pontoReview.reviewedBy).toBe("rh");
    expect((await db.query("select * from ponto_eventos")).rows).toHaveLength(4);
  } finally {await db.close();}
},30000);
