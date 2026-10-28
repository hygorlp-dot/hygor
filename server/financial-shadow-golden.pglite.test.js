// @vitest-environment node
import {beforeAll,afterAll,describe,expect,test} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";
import {financialReference} from "../src/fixtures/financial-reference.js";
import {
  buildLegacyFinancialFacts,
  compareDreProjectionRows,
  compareFinancialScopes,
  summarizeCanonicalFinancialRows,
  summarizeLegacyFinancialFacts,
} from "./financial-shadow.js";

describe("FIN 9.6 — Golden Master canônico PostgreSQL",()=>{
  let db;
  beforeAll(async()=>{
    db=new PGlite({extensions:{pgcrypto}});
    await db.exec("create role service_role;");
    for(const name of [
      "20260725_financial_engine.sql",
      "001_sync_legacy_financial.up.sql",
    ]){
      await db.exec(fs.readFileSync(path.resolve("migrations",name),"utf8"));
    }
  },30000);

  afterAll(async()=>{await db?.close();});

  test("legado → PostgreSQL → canônico fecha em R$ 0,00 e cobre todos os vínculos",async()=>{
    const data=structuredClone(financialReference.data);
    // Liga o recebimento parcial da medição a uma transação bancária real
    // para exercitar também a conciliação dentro da carga em sombra.
    data.medicoes[0].transacaoId="bank-med-a";
    data.transacoes=[{
      id:"bank-med-a",obraId:"obra-a",valor:2500,data:"2026-07-10",
      descricao:"Recebimento medição A",status:"conciliado",
    }];

    const snapshot=buildLegacyFinancialFacts(data);
    expect(snapshot.facts.length).toBeGreaterThan(0);
    expect(snapshot.bankTransactions).toHaveLength(1);
    expect(snapshot.dreSnapshots.length).toBeGreaterThan(0);

    const sync=(await db.query(
      "select financial_sync_legacy_facts('golden-master','test-runner',$1::jsonb) as result",
      [JSON.stringify(snapshot)],
    )).rows[0].result;

    expect(sync).toMatchObject({
      facts:snapshot.facts.length,
      bankTransactions:snapshot.bankTransactions.length,
      dreSnapshots:snapshot.dreSnapshots.length,
    });

    const titles=(await db.query(
      "select id,obra_id,direction,status,metadata from financial_titles where company_id='golden-master'"
    )).rows;
    const settlements=(await db.query(
      "select id,title_id,amount,status,metadata from settlements where company_id='golden-master'"
    )).rows;
    const events=(await db.query(
      "select id,event_type,source_id,effective_date,payload from financial_events where company_id='golden-master'"
    )).rows;
    const legacyLinks=(await db.query(
      "select legacy_type,legacy_id,canonical_type,canonical_id from legacy_record_links where company_id='golden-master'"
    )).rows;
    const reconciliationLinks=(await db.query(
      "select id,status,amount from reconciliation_links where company_id='golden-master'"
    )).rows;

    const legacySummary=summarizeLegacyFinancialFacts(snapshot);
    const canonicalSummary=summarizeCanonicalFinancialRows({titles,settlements,events});

    expect(compareFinancialScopes(legacySummary,canonicalSummary)).toEqual([]);
    expect(compareDreProjectionRows(snapshot.dreSnapshots,events)).toEqual([]);
    expect(legacyLinks).toHaveLength(snapshot.facts.length);
    expect(new Set(legacyLinks.map(link=>link.legacy_type+":"+link.legacy_id)).size).toBe(snapshot.facts.length);
    expect(reconciliationLinks.filter(link=>link.status==="active")).toHaveLength(1);

    expect(legacySummary).toMatchObject({
      "obra-a":{
        billed:4000,
        received:3000,
        expenses:300,
      },
      "obra-b":{
        billed:2000,
        received:0,
        expenses:200,
      },
    });
  },30000);

  test("reexecutar a mesma fotografia é idempotente e continua sem divergência",async()=>{
    const data=structuredClone(financialReference.data);
    data.medicoes[0].transacaoId="bank-med-a";
    data.transacoes=[{
      id:"bank-med-a",obraId:"obra-a",valor:2500,data:"2026-07-10",
      descricao:"Recebimento medição A",status:"conciliado",
    }];
    const snapshot=buildLegacyFinancialFacts(data);

    await db.query(
      "select financial_sync_legacy_facts('golden-master','test-runner',$1::jsonb)",
      [JSON.stringify(snapshot)],
    );

    const [titleCount,settlementCount,linkCount]=await Promise.all([
      db.query("select count(*)::int n from financial_titles where company_id='golden-master'"),
      db.query("select count(*)::int n from settlements where company_id='golden-master' and status='active'"),
      db.query("select count(*)::int n from legacy_record_links where company_id='golden-master'"),
    ]);

    expect(titleCount.rows[0].n).toBe(snapshot.facts.length);
    expect(linkCount.rows[0].n).toBe(snapshot.facts.length);
    expect(settlementCount.rows[0].n).toBe(
      snapshot.facts.reduce((sum,fact)=>sum+(fact.settlements||[]).length,0)
    );
  },30000);
});
