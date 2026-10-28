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
    await db.exec("create role service_role; create role anon; create role authenticated;");
    // O Supabase real sempre possui service_role/anon/authenticated. O PGlite
    // isolado nasce sem esses papéis, então o fixture os cria antes de aplicar
    // as migrations que fazem REVOKE/GRANT explícitos.
    // Algumas migrations financeiras de integração referenciam a tabela-base
    // do ERP. Este teste não precisa de dados nela, mas precisa do contrato
    // estrutural mínimo para que as migrations reais sejam carregadas.
    await db.exec(`
      create table company_app_data (
        company_id text not null,
        key text not null,
        value jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        updated_by text,
        primary key(company_id,key)
      );
    `);
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

  test("migration 022 mantém delimitadores PL/pgSQL completos",()=>{
    const sql=fs.readFileSync(path.resolve("migrations","022_closed_period_legacy_source_guard.up.sql"),"utf8");
    expect(sql).not.toMatch(/\n\$;\n/);
    const openings=(sql.match(/as \$\$/g)||[]).length+(sql.match(/do \$\$/g)||[]).length;
    const closings=(sql.match(/\n\$\$;/g)||[]).length;
    expect(openings).toBe(closings);
  });



  const fact=(id,date,amount=100,settlements=[])=>({
    legacyType:"despesa_obra",legacyId:id,category:"expenses",direction:"payable",
    obraId:"obra-1",titleAmount:amount,recognizedAmount:amount,
    recognitionType:"cost_recognized",date,dueDate:date,settlements,
    metadata:{descricao:"Despesa "+id},
  });
  const bank=(id,date,amount=100)=>({
    legacyId:id,amount,direction:"out",date,description:"Banco "+id,status:"pending",
    obraId:"obra-1",metadata:{extratoId:"ext-1"},
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

  test("obra e extrato de origem do movimento fechado também são imutáveis",async()=>{
    const company="closed-bank-metadata";
    const original=snapshot({bankTransactions:[bank("b1","2026-07-15",100)]});
    await sync(company,original);
    await close(company);

    const changed=bank("b1","2026-07-15",100);
    changed.obraId="obra-2";
    changed.metadata={extratoId:"ext-2"};
    await expect(sync(company,snapshot({bankTransactions:[changed]})))
      .rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("movimento bancário de julho também não pode ser removido do snapshot após fechamento",async()=>{
    const company="closed-bank-remove";
    const original=snapshot({bankTransactions:[bank("b1","2026-07-15",100)]});
    await sync(company,original);
    await close(company);

    await expect(sync(company,snapshot({bankTransactions:[]})))
      .rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("fato removido antes do fechamento não pode reaparecer depois com o mesmo hash",async()=>{
    const company="closed-reappear";
    const original=snapshot({facts:[fact("d1","2026-07-10",100)]});
    await sync(company,original);

    // Julho ainda está aberto: remover o fato é permitido e cancela a projeção.
    await sync(company,snapshot({facts:[]}));
    expect((await db.query(
      "select status from financial_titles where company_id=$1 and origin_id='d1'",
      [company],
    )).rows[0].status).toBe("cancelled");

    await close(company);
    await expect(sync(company,original)).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("obrigação de julho fechada pode ser liquidada em agosto aberto sem reabrir julho",async()=>{
    const company="closed-title-open-settlement";
    const july=snapshot({facts:[fact("d1","2026-07-10",100,[])]});
    await sync(company,july);
    await close(company);

    const paidInAugust=snapshot({facts:[fact("d1","2026-07-10",100,[{
      legacyType:"despesa_pagamento",legacyId:"pay-aug",amount:100,date:"2026-08-05",
      bankTransactionLegacyId:"",
    }])]});
    await expect(sync(company,paidInAugust)).resolves.toBeTruthy();

    const title=(await db.query(
      "select original_amount,status from financial_titles where company_id=$1 and origin_id='d1'",
      [company],
    )).rows[0];
    const settlement=(await db.query(
      "select amount,settlement_date,status from settlements where company_id=$1 and metadata->>'legacyId'='pay-aug'",
      [company],
    )).rows[0];
    expect(Number(title.original_amount)).toBe(100);
    expect(title.status).toBe("settled");
    expect(Number(settlement.amount)).toBe(100);
    expect(String(settlement.settlement_date)).toContain("2026-08-05");
    expect(settlement.status).toBe("active");

    // O título reconhecido em julho continua imutável.
    await expect(sync(company,snapshot({facts:[fact("d1","2026-07-10",110,[{
      legacyType:"despesa_pagamento",legacyId:"pay-aug",amount:100,date:"2026-08-05",
      bankTransactionLegacyId:"",
    }])]}))).rejects.toThrow(/Período contábil fechado/i);
  },30000);

  test("liquidação posterior pode ser corrigida enquanto agosto estiver aberto e congela quando agosto fechar",async()=>{
    const company="closed-title-settlement-lifecycle";
    await sync(company,snapshot({facts:[fact("d1","2026-07-10",100,[])]}));
    await close(company);

    const augustPayment=amount=>snapshot({facts:[fact("d1","2026-07-10",100,[{
      legacyType:"despesa_pagamento",legacyId:"pay-aug",amount,date:"2026-08-05",
      bankTransactionLegacyId:"",
    }])]});
    await sync(company,augustPayment(60));
    await expect(sync(company,augustPayment(70))).resolves.toBeTruthy();

    // Remover/estornar a liquidação de agosto ainda é permitido antes do
    // fechamento de agosto, mesmo com o título de julho já encerrado.
    await expect(sync(company,snapshot({facts:[fact("d1","2026-07-10",100,[])]})))
      .resolves.toBeTruthy();

    await sync(company,augustPayment(70));
    await close(company,"2026-08-01","2026-08-31");

    await expect(sync(company,augustPayment(80))).rejects.toThrow(/Período contábil fechado/i);
    await expect(sync(company,snapshot({facts:[fact("d1","2026-07-10",100,[])]})))
      .rejects.toThrow(/Período contábil fechado/i);
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
