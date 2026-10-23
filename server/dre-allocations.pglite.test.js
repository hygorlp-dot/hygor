// @vitest-environment node
import fs from "node:fs";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {pgcrypto} from "@electric-sql/pglite/contrib/pgcrypto";
import {buildLegacyFinancialFacts} from "./financial-shadow.js";
import {applyCashAllocation} from "../src/domains/conciliacao/cash-allocations.js";
const migration=name=>fs.readFileSync(new URL(`../migrations/${name}`,import.meta.url),"utf8");
describe("vínculos parciais transacionais no PostgreSQL",()=>{
  let db;
  beforeAll(async()=>{
    db=new PGlite({extensions:{pgcrypto}});
    await db.exec("create role service_role; create role anon; create role authenticated; create table company_app_data(company_id text,key text,value jsonb,updated_at timestamptz,updated_by text);");
    for(const name of ["20260725_financial_engine.sql","001_sync_legacy_financial.up.sql","008_skip_dre_snapshot_sync_on_write.up.sql","20261023154632_dre_cash_allocations.up.sql"])
      await db.exec(migration(name));
  },30000);
  afterAll(async()=>{await db?.close();});
  const source=()=>({transacoes:[{id:"bank",valor:100,data:"2026-10-20",status:"pendente"}],
    caixaObra:[{id:"fund",tipo:"aporte",valor:150,data:"2026-10-20",obraId:"work"}],
    outrasDesp:[{id:"real-paid",pago:true,valor:30,data:"2026-10-19",dataPagamento:"2026-10-20"}],
  });
  const snapshot=data=>buildLegacyFinancialFacts(data,{includeDreSnapshots:false});
  const sync=async(company,data)=>(await db.query("select financial_sync_legacy_facts($1,'tester',$2,false) result",[company,JSON.stringify(snapshot(data))])).rows[0].result;
  const associate=data=>applyCashAllocation(data,{transactionId:"bank",eventId:"caixa_obra:fund:cash_in",amount:60,idempotencyKey:"partial"},{id:"tester"}).data;
  it("projeta/reprocessa/estorna associações preservando a liquidação real",async()=>{
    const data=source();await sync("preserve",data);
    const before=(await db.query("select id,title_id,amount,settlement_date,status from settlements where company_id='preserve'")).rows;
    const linked=associate(data);await sync("preserve",linked);await sync("preserve",linked);
    await db.exec(migration("20261023154632_dre_cash_allocations.up.sql"));
    await sync("preserve",linked);
    expect((await db.query("select status from bank_transactions where company_id='preserve'")).rows[0].status).toBe("partial");
    expect((await db.query("select count(*)::int n from financial_dre_allocations where company_id='preserve'")).rows[0].n).toBe(1);
    const reversed=applyCashAllocation(linked,{transactionId:"bank",allocationId:linked.reconciliationLinks[0].id,reason:"Correção"},{id:"tester"},true).data;
    await sync("preserve",reversed);
    expect((await db.query("select status from bank_transactions where company_id='preserve'")).rows[0].status).toBe("pending");
    expect((await db.query("select id,title_id,amount,settlement_date,status from settlements where company_id='preserve'")).rows).toEqual(before);
  });
  it("rejeita payload adulterado, excesso no banco, exclusão do histórico e alteração do valor pago",async()=>{
    const linked=associate(source());await sync("capacity",linked);
    const duplicate=structuredClone(linked);duplicate.reconciliationLinks.push({...duplicate.reconciliationLinks[0]});
    await expect(sync("capacity",duplicate)).rejects.toThrow(/repetidas/);
    const over=structuredClone(linked);over.reconciliationLinks.push({...over.reconciliationLinks[0],id:"second",amountCents:5000});
    await expect(sync("capacity",over)).rejects.toThrow(/saldo bancário/);
    const changed=structuredClone(linked);changed.reconciliationLinks[0].amountCents=1;
    await expect(sync("capacity",changed)).rejects.toThrow(/imutável/);
    await expect(sync("capacity",source())).rejects.toThrow(/histórico/);
    const smaller=structuredClone(linked);smaller.caixaObra[0].valor=20;
    await expect(sync("capacity",smaller)).rejects.toThrow(/saldo do registro/);
    expect((await db.query("select amount_cents::int amount from financial_dre_allocations where company_id='capacity'")).rows).toEqual([{amount:6000}]);
  });
  it("bloqueia período fechado e não deixa uma RPC nativa consumir o banco já associado",async()=>{
    const linked=associate(source());await sync("closed",linked);
    await db.query("insert into accounting_periods(company_id,starts_on,ends_on,status) values('closed','2026-10-01','2026-10-31','closed')");
    const reversed=applyCashAllocation(linked,{transactionId:"bank",allocationId:linked.reconciliationLinks[0].id,reason:"Teste"},{id:"tester"},true).data;
    await expect(sync("closed",reversed)).rejects.toThrow(/fechado/);
    const bank=(await db.query("select id from bank_transactions where company_id='closed'")).rows[0].id;
    const title=(await db.query("select financial_execute_command('closed','tester',$1) r",[JSON.stringify({type:"CREATE_FINANCIAL_TITLE",idempotencyKey:"native-title",payload:{originType:"real-source-test",originId:"native",direction:"receivable",amount:40,competence:"2026-10-01"}})])).rows[0].r;
    await expect(db.query("select financial_execute_command('closed','tester',$1)",[JSON.stringify({type:"REGISTER_SETTLEMENT",idempotencyKey:"native-settlement",payload:{titleId:title.titleId,bankTransactionId:bank,amount:40,date:"2026-10-20"}})])).rejects.toThrow(/fechado|parciais/);
  });
  it("protege a pendência de 7160 também no SQL e restringe acesso público",async()=>{
    const held=source();held.transacoes[0].id="mt7l9lt5xrta";held.transacoes[0].valor=7160;await sync("held",held);
    const bad=snapshot(held);bad.cashAllocations=[{id:"forged",transactionId:"mt7l9lt5xrta",eventId:"caixa_obra:fund:cash_in",amountCents:100,status:"active"}];
    await expect(db.query("select financial_sync_dre_allocations('held',$1)",[JSON.stringify(bad)])).rejects.toThrow(/7.160/);
    expect((await db.query("select status from bank_transactions where company_id='held'")).rows[0].status).toBe("pending");
    expect((await db.query("select has_table_privilege('anon','financial_dre_allocations','select') allowed")).rows[0].allowed).toBe(false);
  });
  it("vincula extrato recém-importado sem criar uma liquidação",async()=>{
    const linked=associate(source());
    await db.query("select financial_sync_dre_allocations('new-import',$1)",[JSON.stringify(snapshot(linked))]);
    expect((await db.query("select status,amount from bank_transactions where company_id='new-import'")).rows).toEqual([{status:"partial",amount:"100.00"}]);
    expect((await db.query("select count(*)::int n from settlements where company_id='new-import'")).rows[0].n).toBe(0);
  });
  it("aceita liquidação nativa parcial e idempotente, sem liberar a pendência de 7160",async()=>{
    const command=async(key,payload,type="REGISTER_SETTLEMENT")=>(await db.query("select financial_execute_command('native','tester',$1) r",[JSON.stringify({type,idempotencyKey:key,payload})])).rows[0].r;
    const title=await command("title",{originType:"isolated",originId:"native",direction:"payable",amount:100,financialKind:"cost",competence:"2026-10-01"},"CREATE_FINANCIAL_TITLE");
    const bank=(await db.query("insert into bank_transactions(company_id,booking_date,direction,amount) values('native','2026-10-20','out',100) returning id")).rows[0].id;
    const payload={titleId:title.titleId,bankTransactionId:bank,amount:30,date:"2026-10-20"};
    const paid=await command("partial-payment",payload);
    expect(await command("partial-payment",payload)).toMatchObject({idempotent:true,settlementId:paid.settlementId});
    expect((await db.query("select status from financial_titles where id=$1",[title.titleId])).rows[0].status).toBe("partial");
    expect((await db.query("select status from bank_transactions where id=$1",[bank])).rows[0].status).toBe("partial");
    await command("rest",{...payload,amount:70});
    expect((await db.query("select count(*)::int n,sum(amount) total from settlements where company_id='native'")).rows[0]).toEqual({n:2,total:"100.00"});
    await db.query("update bank_transactions set metadata=metadata||'{\"legacyId\":\"native-import\"}' where id=$1",[bank]);
    await expect(db.query("select financial_guard_source_reconciliation('native','[{\"id\":\"native-import\",\"status\":\"conciliado\"}]',false)")).rejects.toThrow(/gerido/);
    const held=(await db.query("select id from bank_transactions where company_id='held'")).rows[0].id;
    const heldTitle=(await db.query("select financial_execute_command('held','tester',$1) r",[JSON.stringify({type:"CREATE_FINANCIAL_TITLE",idempotencyKey:"held-title",payload:{originType:"isolated",originId:"held",direction:"receivable",amount:7160}})])).rows[0].r;
    await expect(db.query("select financial_execute_command('held','tester',$1)",[JSON.stringify({type:"REGISTER_SETTLEMENT",idempotencyKey:"held-payment",payload:{titleId:heldTitle.titleId,bankTransactionId:held,amount:7160,date:"2026-07-21"}})])).rejects.toThrow(/7.160/);
    expect((await db.query("select count(*)::int n from settlements where company_id='held'")).rows[0].n).toBe(1); // somente a despesa pré-existente da fixture
  });
  it("reserva o banco já conciliado pela operação sem alterar seus pagamentos",async()=>{
    const data=source();await sync("source-reserved",data);
    await db.query("select financial_guard_source_reconciliation('source-reserved','[{\"id\":\"bank\",\"status\":\"conciliado\"}]',false)");
    const bank=(await db.query("select id from bank_transactions where company_id='source-reserved'")).rows[0].id;
    const title=(await db.query("select financial_execute_command('source-reserved','tester',$1) r",[JSON.stringify({type:"CREATE_FINANCIAL_TITLE",idempotencyKey:"t",payload:{originType:"isolated",originId:"reserved",direction:"receivable",amount:100}})])).rows[0].r;
    await expect(db.query("select financial_execute_command('source-reserved','tester',$1)",[JSON.stringify({type:"REGISTER_SETTLEMENT",idempotencyKey:"double",payload:{titleId:title.titleId,bankTransactionId:bank,amount:100}})])).rejects.toThrow(/reservado/);
    expect((await db.query("select count(*)::int n from settlements where company_id='source-reserved'")).rows[0].n).toBe(1);
  });
});
