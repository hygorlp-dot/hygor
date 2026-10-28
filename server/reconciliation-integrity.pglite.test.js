// @vitest-environment node
import {beforeAll,afterAll,describe,test,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

describe("RPC financeira: direção bancária e fechamento",()=>{
  let db;
  beforeAll(async()=>{
    db=new PGlite({extensions:{pgcrypto}});
    await db.exec("create role service_role;");
    for(const name of ["20260725_financial_engine.sql","003_accounting_period_enforcement.up.sql","20261023144434_api_reconciliation_integrity.up.sql","021_financial_reversal_status_integrity.up.sql"]){
      await db.exec(fs.readFileSync(path.resolve("migrations",name),"utf8"));
    }
  },30000);
  afterAll(async()=>{await db?.close();});
  const command=async(type,key,payload)=>{
    const result=await db.query("select financial_execute_command('isolated-test','tester',$1) as result",[JSON.stringify({type,idempotencyKey:key,payload})]);
    return result.rows[0].result;
  };
  test.each(["payable","receivable"])("bloqueia sinal invertido de %s e confirma a direção correta uma única vez",async direction=>{
    const {titleId}=await command("CREATE_FINANCIAL_TITLE",`title-${direction}`,{originType:"local-test",originId:direction,direction,amount:100,competence:"2026-10-23"});
    const bank=async bankDirection=>(await db.query("insert into bank_transactions(company_id,booking_date,direction,amount) values('isolated-test','2026-10-23',$1,100) returning id",[bankDirection])).rows[0].id;
    const wrongId=await bank(direction==="payable"?"in":"out");
    await expect(command("REGISTER_SETTLEMENT",`wrong-${direction}`,{titleId,bankTransactionId:wrongId,amount:100,date:"2026-10-23"})).rejects.toThrow(/incompatível/);
    expect((await db.query("select count(*)::int n from settlements where title_id=$1",[titleId])).rows[0].n).toBe(0);
    const bankTransactionId=await bank(direction==="payable"?"out":"in");
    const payload={titleId,bankTransactionId,amount:100,date:"2026-10-23"};
    const paid=await command("REGISTER_SETTLEMENT",`valid-${direction}`,payload);
    const retry=await command("REGISTER_SETTLEMENT",`valid-${direction}`,payload);
    expect(retry).toMatchObject({ok:true,idempotent:true,settlementId:paid.settlementId});
    expect((await db.query("select count(*)::int n from settlements where title_id=$1",[titleId])).rows[0].n).toBe(1);
  });
  test("estorno reabre o título e libera a transação bancária quando não resta baixa ativa",async()=>{
    const {titleId}=await command("CREATE_FINANCIAL_TITLE","reversal-title",{
      originType:"local-test",originId:"reversal",direction:"payable",amount:250,competence:"2026-09-15",
    });
    const bankTransactionId=(await db.query(
      "insert into bank_transactions(company_id,booking_date,direction,amount) values('isolated-test','2026-09-15','out',250) returning id"
    )).rows[0].id;
    const paid=await command("REGISTER_SETTLEMENT","reversal-pay",{
      titleId,bankTransactionId,amount:250,date:"2026-09-15",
    });

    expect((await db.query("select status from financial_titles where id=$1",[titleId])).rows[0].status).toBe("settled");
    expect((await db.query("select status from bank_transactions where id=$1",[bankTransactionId])).rows[0].status).toBe("reconciled");

    const reversed=await command("REVERSE_SETTLEMENT","reversal-reverse",{settlementId:paid.settlementId});

    expect((await db.query("select status from financial_titles where id=$1",[titleId])).rows[0].status).toBe("open");
    const bankAfter=(await db.query("select status,version from bank_transactions where id=$1",[bankTransactionId])).rows[0];
    expect(bankAfter.status).toBe("pending");
    expect((await db.query("select status from settlements where id=$1",[paid.settlementId])).rows[0].status).toBe("reversed");
    expect((await db.query("select status from reconciliation_links where settlement_id=$1",[paid.settlementId])).rows[0].status).toBe("reversed");

    const replay=await command("REVERSE_SETTLEMENT","reversal-reverse",{settlementId:paid.settlementId});
    expect(replay).toMatchObject({ok:true,idempotent:true,reversedSettlementId:reversed.reversedSettlementId});
    expect((await db.query("select version from bank_transactions where id=$1",[bankTransactionId])).rows[0].version).toBe(bankAfter.version);
  });

  test("estorno parcial preserva título e banco como parciais quando resta baixa ativa",async()=>{
    const {titleId}=await command("CREATE_FINANCIAL_TITLE","partial-reversal-title",{
      originType:"local-test",originId:"partial-reversal",direction:"payable",amount:300,competence:"2026-09-20",
    });
    const bankTransactionId=(await db.query(
      "insert into bank_transactions(company_id,booking_date,direction,amount) values('isolated-test','2026-09-20','out',300) returning id"
    )).rows[0].id;
    await command("REGISTER_SETTLEMENT","partial-pay-1",{titleId,bankTransactionId,amount:100,date:"2026-09-20"});
    const second=await command("REGISTER_SETTLEMENT","partial-pay-2",{titleId,bankTransactionId,amount:200,date:"2026-09-20"});
    expect((await db.query("select status from financial_titles where id=$1",[titleId])).rows[0].status).toBe("settled");
    expect((await db.query("select status from bank_transactions where id=$1",[bankTransactionId])).rows[0].status).toBe("reconciled");

    await command("REVERSE_SETTLEMENT","partial-reverse",{settlementId:second.settlementId});

    expect((await db.query("select status from financial_titles where id=$1",[titleId])).rows[0].status).toBe("partial");
    expect((await db.query("select status from bank_transactions where id=$1",[bankTransactionId])).rows[0].status).toBe("partial");
  });

  test("mantém o bloqueio de período e os pagamentos já registrados",async()=>{
    await command("CLOSE_ACCOUNTING_PERIOD","close-october",{startsOn:"2026-10-01",endsOn:"2026-10-31"});
    await expect(command("CREATE_FINANCIAL_TITLE","closed-title",{direction:"payable",amount:1,competence:"2026-10-23"})).rejects.toThrow(/fechado/);
    expect((await db.query("select count(*)::int n from settlements")).rows[0].n).toBe(2);
  });
});
