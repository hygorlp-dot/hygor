// @vitest-environment node
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readReviewEvents, readFreshAttendance } from "./attendance-review-source.js";
const KEY="arced_ponto_v1",PONTO_KEY=`${KEY}__ponto`,PONTO_OBRA_KEY_PREFIX=`${PONTO_KEY}__obra__`;
import { encodeAppData } from "./data-codec.js";

it("consulta real inclui legados e eventos de todas as obras, isolando empresa e dia; relê ponto atual",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz);
      create table ponto_eventos(company_id text,event_id text,employee_id text,obra_id text,marcado_em timestamptz,tipo_registro text,hora_confiavel boolean,relogio_alterado boolean,metodo text,payload jsonb);
      create table ponto_marcacoes(company_id text,id text,employee_id text,obra_id text,marcado_em timestamptz,tipo_registro text,hora_confiavel boolean,relogio_alterado boolean,metodo text);`);
    const sql=async(parts,...values)=>(await db.query(parts.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,""),values)).rows;
    await db.query("insert into company_app_data values ($1,$2,$3,now()),($1,$4,$5,now()),($1,$6,$7,now())",[
      "c",KEY,JSON.stringify(encodeAppData({employees:[{id:"e",name:"Atual"}],attendance:{e:{"2026-10-29":{status:"F"}}}})),
      PONTO_KEY,JSON.stringify({}),`${PONTO_OBRA_KEY_PREFIX}o`,JSON.stringify({attendance:{e:{"2026-10-29":{status:"P"}}},attendanceSyncedAt:{e:{"2026-10-29":"2026-10-29T20:00:00Z"}}})]);
    await db.exec(`insert into ponto_eventos values
      ('c','one','e','o1','2026-10-29T10:00:00Z','ponto',true,false,'facial','{"versaoJornada":1,"tipoEvento":"entrada"}'),
      ('other','two','e','o1','2026-10-29T10:00:00Z','ponto',true,false,'facial','{}'),
      ('c','three','e','o1','2026-10-30T10:00:00Z','ponto',true,false,'facial','{}');
      insert into ponto_marcacoes values ('c','four','e','o2','2026-10-29T20:00:00Z','ponto',true,false,'facial');`);
    const events=await readReviewEvents(sql,"c",{date:"2026-10-29",employeeId:"e"});
    expect(events.map(e=>e.id)).toEqual(["one","four"]);
    expect(events[0]).toMatchObject({tipoEvento:"entrada",marcadoEm:"2026-10-29T10:00:00.000Z"});
    const fresh=await readFreshAttendance(sql,"c",{employees:[{id:"e",name:"Antigo"}]});
    expect(fresh.employees[0].name).toBe("Atual");
    expect(fresh.attendance.e["2026-10-29"].status).toBe("P");
  } finally {await db.close();}
},30000);
