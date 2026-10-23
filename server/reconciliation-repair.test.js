import {describe,test,expect} from "vitest";
import {repairAuditedReconciliation,repairLockedReconciliation} from "./reconciliation-repair.js";
import {buildLegacyFinancialFacts} from "./financial-shadow.js";
import {desfazerConciliacao} from "../src/domains/conciliacao/mutations.js";

const fixture=()=>({transacoes:[
  {id:"2f9mi4zbxupv",valor:-108.77,status:"conciliado",gerados:["0kjw0yag16sh"]},
  {id:"budlh0lmxrta",valor:-1320,status:"conciliado",gerados:["r94yv49z1ltd"]},
  {id:"l4bigx6gxrta",valor:-2200,status:"conciliado",gerados:["h8uh6em62hkb"]},
  {id:"mt7l9lt5xrta",valor:7160,status:"conciliado",gerados:["e9qk6c3xh3a1"]},
],despesasEmpresa:[{id:"0kjw0yag16sh",valor:108.77,status:"ativo",data:"2026-07-06"},{id:"e9qk6c3xh3a1",valor:-7160,status:"cancelada"}],
outrasDesp:[{id:"r94yv49z1ltd",valor:1320,data:"2026-07-20"},{id:"h8uh6em62hkb",valor:2200,data:"2026-07-20"}],
notasFiscais:[],pedidos:[],payments:[]});

describe("reparo restrito das associações auditadas",()=>{
  test("desfazer uma associação histórica preserva a despesa paga e seu valor",()=>{
    const repaired=repairAuditedReconciliation(fixture(),"arcd").data;
    const result=desfazerConciliacao(repaired,"budlh0lmxrta",{id:"admin"},"Ajuste de vínculo");
    expect(result.resumo.ok).toBe(true);
    expect(result.data.outrasDesp[0]).toMatchObject({id:"r94yv49z1ltd",valor:1320,pago:true,transacaoId:null});
    expect(result.data.outrasDesp).toHaveLength(2);
    expect(result.data.transacoes[1].status).toBe("pendente");
  });
  test("restaura três vínculos, devolve o documento cancelado à pendência e é idempotente",()=>{
    const before=fixture(),copy=structuredClone(before);
    const result=repairAuditedReconciliation(before,"arcd");
    expect(result.changes).toHaveLength(4);
    expect(before).toEqual(copy);
    expect(result.data.outrasDesp.map(item=>item.transacaoId)).toEqual(["budlh0lmxrta","l4bigx6gxrta"]);
    expect(result.data.despesasEmpresa[0].transacaoId).toBe("2f9mi4zbxupv");
    expect(result.data.despesasEmpresa[1]).toEqual(before.despesasEmpresa[1]);
    expect(result.data.transacoes[3]).toMatchObject({status:"pendente",gerados:[],reconciliationRepair:{previous:{gerados:["e9qk6c3xh3a1"]}}});
    expect(result.data.notasFiscais).toBe(before.notasFiscais);
    expect(result.data.payments).toBe(before.payments);
    const recognition=snapshot=>snapshot.dreSnapshots.map(row=>({...row,payload:Object.fromEntries(Object.entries(row.payload).filter(([key])=>!["saidasCaixa","saldoCaixa"].includes(key)))}));
    expect(recognition(buildLegacyFinancialFacts(result.data))).toEqual(recognition(buildLegacyFinancialFacts(before)));
    for(const section of ["outrasDesp","despesasEmpresa"])expect(result.data[section].map(({transacaoId:_bank,...item})=>item)).toEqual(before[section]);
    expect(repairAuditedReconciliation(result.data,"arcd")).toEqual({data:result.data,changes:[]});
  });
  test("não altera outra empresa nem adivinha dados que mudaram",()=>{
    const before=fixture();expect(repairAuditedReconciliation(before,"other").data).toBe(before);
    before.outrasDesp[0].valor=1200;
    expect(()=>repairAuditedReconciliation(before,"arcd")).toThrow(/evidence changed/);
  });
  test("grava somente origem e auditoria sob a transação do chamador",async()=>{
    const statements=[];
    const tx=Object.assign(async(strings,...values)=>{statements.push({sql:strings.join("?"),values});return [];},{json:value=>value});
    const result=await repairLockedReconciliation(tx,{value:fixture()},"arcd");
    expect(result.changes).toHaveLength(4);
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain("update company_app_data");
    expect(statements[1].sql).toContain("insert into audit_events");
    expect(statements.some(item=>/insert into (settlements|financial_titles)/.test(item.sql))).toBe(false);
  });
});
