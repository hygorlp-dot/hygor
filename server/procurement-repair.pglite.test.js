// @vitest-environment node
import fs from "node:fs";
import {describe, expect, it} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import {backfillPurchaseRequests} from "./purchase-request-backfill.js";
import {buildLegacyFinancialFacts} from "./financial-shadow.js";
import {compareProcurementDreRecognition} from "./procurement-financial-facts.js";

const migration = name => fs.readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
describe("reparo idempotente sem alterar pagamentos ou a fonte operacional",()=>{
  it("backfill atualiza inclusive canceladas, preserva extras e datas de criação",async()=>{
    const db=new PGlite();
    try {
      await db.exec(`create role anon; create role authenticated; create role service_role;
        create table core_projects(company_id text,id text,primary key(company_id,id));
        insert into core_projects values('arcd','o1');
        create table company_app_data(company_id text,key text,value jsonb);
        `);
      await db.exec(migration("010_create_purchase_requests_live.up.sql"));
      const source={solicitacoesCompra:[{id:"r1",obraId:"o1",version:3,status:"cancelada",itens:[{qtd:12}]}],pedidos:[{id:"p1",pagamentos:[{id:"pg1",valor:123}]}]};
      await db.query("insert into company_app_data values('arcd','arced_ponto_v1',$1)",[JSON.stringify(source)]);
      await db.query("insert into purchase_requests(company_id,id,project_id,payload,created_at) values('arcd','r1','o1','{}','2026-01-01'),('arcd','extra','o1','{}','2026-01-01')");
      const tx=Object.assign(async(strings,...values)=>(await db.query(strings.reduce((sql,part,i)=>sql+(i?`$${i}`:"")+part,""),values)).rows,{json:JSON.stringify});
      expect(await backfillPurchaseRequests(tx,"arcd")).toEqual({requests:1,preservedExtras:1});
      expect(await backfillPurchaseRequests(tx,"arcd")).toEqual({requests:1,preservedExtras:1});
      const {rows}=await db.query("select payload,source_version,created_at from purchase_requests where id='r1'");
      expect(rows[0]).toMatchObject({payload:source.solicitacoesCompra[0],source_version:3});
      expect(new Date(rows[0].created_at).toISOString().slice(0,10)).toBe("2026-01-01");
      expect((await db.query("select value from company_app_data")).rows[0].value).toEqual(source);
    } finally { await db.close(); }
  },30000);

  it("reprocessa a sombra retirando só o custo indevido e preservando a identidade da liquidação",async()=>{
    const db=new PGlite({extensions:{pgcrypto}});
    try {
      await db.exec("create role service_role;");
      await db.exec(migration("20260725_financial_engine.sql"));
      await db.exec(migration("001_sync_legacy_financial.up.sql"));
      const data={pedidos:[{id:"p1",obraId:"o1",data:"2026-06-26",status:"enviado",itens:[{qtd:10,precoUnit:25}],
        pagamentos:[{id:"pg1",valor:250,data:"2026-07-01"}]}]};
      const snapshot=buildLegacyFinancialFacts(data,{includeDreSnapshots:false});
      const old=structuredClone(snapshot);old.facts[0].recognizedAmount=250;
      await db.query("select financial_sync_legacy_facts('arcd','test',$1)",[JSON.stringify(old)]);
      const before=(await db.query("select id,title_id,amount,settlement_date,status from settlements")).rows;
      expect(compareProcurementDreRecognition(data,(await db.query("select * from financial_events")).rows)).toHaveLength(1);
      for(let run=0;run<2;run++) await db.query("select financial_sync_legacy_facts('arcd','test',$1)",[JSON.stringify(snapshot)]);
      expect((await db.query("select id,title_id,amount,settlement_date,status from settlements")).rows).toEqual(before);
      const events=(await db.query("select * from financial_events")).rows;
      expect(events.find(e=>e.event_type==="cost_recognized").payload.active).toBe(false);
      expect(compareProcurementDreRecognition(data,events)).toEqual([]);
      expect((await db.query("select original_amount,status from financial_titles")).rows[0]).toMatchObject({original_amount:"250.00",status:"settled"});
    } finally { await db.close(); }
  },30000);
});
