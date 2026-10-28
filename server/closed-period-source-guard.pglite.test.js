// @vitest-environment node
import {afterAll,beforeAll,describe,expect,test} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

describe("FIN 9.6 — fatos operacionais respeitam competência fechada",()=>{
  let db;

  beforeAll(async()=>{
    db=new PGlite({extensions:{pgcrypto}});
    await db.exec("create role service_role;");
    for(const name of [
      "20260725_financial_engine.sql",
      "001_sync_legacy_financial.up.sql",
      "003_accounting_period_enforcement.up.sql",
      "008_skip_dre_snapshot_sync_on_write.up.sql",
      "20261023154632_dre_cash_allocations.up.sql",
      "022_closed_period_legacy_source_guard.up.sql",
    ]){
      await db.exec(fs.readFileSync(path.resolve("migrations",name),"utf8"));
    }
  },30000);

  afterAll(async()=>{await db?.close();});

  const fact=(id,date,amount=100,settlements=[])=>({
    legacyType:"despesa_obra",legacyId:id,category:"expenses",direction:"payable",
    obraId:"obra-1",titleAmount:amount,recognizedAmount:amount,
    recognitionType:"cost_recognized",date,dueDate:date,settlements,
    metadata:{descricao:"Despesa "+id},
  });
  const bank=(id,date,amount=100)=>({
    legacyId:id,amount,direction:"out",date,description:"Banco "+id,status:"pending",metadata:{},
  });
  const snapshot=({facts=[],bankTransactions=[]}={})=>({
    facts,bankTransactions,cashEntries:[],cashAllocations:[],dreSnapshots:[],
  });
  const sync=(company,value)=>db.query(
    "select financial_sync_legacy_facts($1,'test-runner',$2::jsonb,false) result",
    [company,JSON.stringify(value)],
  );
  const close=async(company,start="2026-07-01",end="2026-07-31")=>{
    await db.query(
      "insert into accounting_periods(company_id,starts_on,ends_on,status,closed_by,closed_at) values($1,$2,$3,'closed','test',now())",
      [company,start,end],
    );
  };

  test("reprocessar fotografia idêntica de julho continua permitido",async()=>{
    const company="closed-replay";
    const july=snapshot({facts:[fact("d1","2026-07-10",100)]});
    await sync(company,july);
    await close(company);
    await expect(sync(company,july)).resolves.toBeTruthy();

    const row=(await db.query(
      "select status,original_amount from financial_titles where company_id=$1 and origin_id='d1'",
      [company],
    )).rows[0];
    expect(row.status).not.toBe("cancelled");
    expect(Number(row.original_amount)).toBe(100);
  },30000);

  test("alterar ou incluir fato dentro de julho fechado é recusado",async()=>{
    const company="closed-change";
    const july=snapshot({facts:[fact("d1","2026-07-10",100)]});
    await sync(company,july);
    await close(company);

    await expect(sync(company,snapshot({
      facts:[fact("d1","2026-07-10",110)],
    }))).rejects.toThrow(/Período contábil fechado/i);

    await expect(sync(company,snapshot({
      facts:[fact("d1","2026-07-10",100),fact("d2","2026-07-20",50)],
    }))).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("remover fato de julho é recusado, mas adicionar agosto é permitido",async()=>{
    const company="closed-remove";
    const july=snapshot({facts:[fact("d1","2026-07-10",100)]});
    await sync(company,july);
    await close(company);

    const august=snapshot({
      facts:[fact("d1","2026-07-10",100),fact("d2","2026-08-05",60)],
    });
    await expect(sync(company,august)).resolves.toBeTruthy();

    await expect(sync(company,snapshot({
      facts:[fact("d2","2026-08-05",60)],
    }))).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("liquidação datada em período fechado também congela o fato",async()=>{
    const company="closed-settlement";
    const original=snapshot({facts:[fact("d1","2026-06-25",100,[{
      legacyType:"despesa_pagamento",legacyId:"pay-1",amount:100,date:"2026-07-05",
      bankTransactionLegacyId:"",
    }])]});
    await sync(company,original);
    await close(company);

    await expect(sync(company,snapshot({facts:[fact("d1","2026-06-25",100,[{
      legacyType:"despesa_pagamento",legacyId:"pay-1",amount:90,date:"2026-07-05",
      bankTransactionLegacyId:"",
    }])]}))).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("extrato bancário de julho não pode ser incluído ou alterado após o fechamento",async()=>{
    const company="closed-bank";
    const original=snapshot({bankTransactions:[bank("b1","2026-07-15",100)]});
    await sync(company,original);
    await close(company);

    await expect(sync(company,original)).resolves.toBeTruthy();
    await expect(sync(company,snapshot({
      bankTransactions:[bank("b1","2026-07-15",101)],
    }))).rejects.toThrow(/Período contábil fechado/i);
    await expect(sync(company,snapshot({
      bankTransactions:[bank("b1","2026-07-15",100),bank("b2","2026-07-20",50)],
    }))).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("alterações fora da competência fechada continuam permitidas",async()=>{
    const company="closed-open-period";
    await sync(company,snapshot({facts:[fact("d1","2026-08-03",100)]}));
    await close(company);
    await expect(sync(company,snapshot({
      facts:[fact("d1","2026-08-03",125)],
    }))).resolves.toBeTruthy();

    const row=(await db.query(
      "select original_amount from financial_titles where company_id=$1 and origin_id='d1'",
      [company],
    )).rows[0];
    expect(Number(row.original_amount)).toBe(125);
  },30000);
});
