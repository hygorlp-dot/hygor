import { describe, expect, it } from "vitest";
import { buildFinancialLedger } from "../financeiro/ledger.js";
import { applyCashAllocation, buildDreCashManagement } from "./cash-allocations.js";

const fixture=()=>({obras:[{id:"work",name:"Obra de teste"}],
  transacoes:[{id:"in",valor:100,data:"2026-10-20",status:"pendente"},{id:"in2",valor:100,data:"2026-10-21",status:"pendente"},{id:"out",valor:-80,data:"2026-10-20",status:"pendente"}],
  caixaObra:[{id:"fund",tipo:"aporte",valor:150,data:"2026-10-20",obraId:"work"}],
  outrasDesp:[{id:"expense",pago:true,valor:80,data:"2026-10-20",obraId:"work",dataPagamento:"2026-10-20"}],
  reconciliationLinks:[],payments:[],notasFiscais:[],pagamentosFolha:[],
});
const actor={id:"test-finance"};
const link=(data,amount,transactionId="in",eventId="caixa_obra:fund:cash_in",key="first")=>applyCashAllocation(data,{amount,transactionId,eventId,idempotencyKey:key},actor);

describe("vínculos parciais entre caixa existente e banco",()=>{
  it("preserva documentos, pagamentos e todos os efeitos monetários do DRE em vínculos N:N",()=>{
    const source=fixture(),before=buildFinancialLedger(source).events;
    const first=link(source,60);
    expect(first.resumo).toMatchObject({ok:true,status:"parcial",remainingCents:4000});
    const second=link(first.data,90,"in2",undefined,"second");
    expect(second.resumo.ok).toBe(true);
    expect(buildDreCashManagement(second.data).entries.find(item=>item.sourceId==="fund").remainingCents).toBe(0);
    expect(buildFinancialLedger(second.data).events).toEqual(before);
    for(const key of ["caixaObra","outrasDesp","payments","notasFiscais","pagamentosFolha"])expect(second.data[key]).toBe(source[key]);
    expect(link(second.data,1,"in2",undefined,"third").resumo.ok).toBe(false);
  });
  it("completa o banco, desfaz só o vínculo e conserva histórico",()=>{
    const first=link(fixture(),100);
    expect(first.resumo.status).toBe("conciliado");
    const undone=applyCashAllocation(first.data,{transactionId:"in",allocationId:first.data.reconciliationLinks[0].id,reason:"Origem incorreta"},actor,true);
    expect(undone.resumo).toMatchObject({ok:true,status:"pendente",remainingCents:10000});
    expect(undone.data.reconciliationLinks[0].status).toBe("reversed");
    expect(undone.data.caixaObra).toBe(first.data.caixaObra);
  });
  it("não duplica uma retentativa antiga depois de expirar o log de comandos",()=>{
    const first=link(fixture(),100);
    const retry=link(first.data,100);
    expect(retry.data).toBe(first.data);expect(retry.resumo.idempotent).toBe(true);
    expect(link(first.data,10).resumo.ok).toBe(false);
  });
  it.each([0,-1,100.001,Infinity,"abc",101])("rejeita valor inválido/excedente %s",value=>{
    const source=fixture(),result=link(source,value);
    expect(result.resumo.ok).toBe(false);expect(result.data).toBe(source);
  });
  it("impede sinal invertido, documento cancelado e associação direta existente",()=>{
    expect(link(fixture(),10,"out").resumo.ok).toBe(false);
    const canceled=fixture();canceled.caixaObra[0].status="cancelado";
    expect(link(canceled,10).resumo.ok).toBe(false);
    const direct=fixture();direct.caixaObra[0].transacaoId="in2";
    expect(link(direct,10).resumo.ok).toBe(false);
  });
  it("bloqueia o movimento real de 7160 mesmo com aporte compatível",()=>{
    const data=fixture();data.transacoes.push({id:"mt7l9lt5xrta",valor:7160,status:"pendente",data:"2026-07-21"});
    const result=link(data,10,"mt7l9lt5xrta");
    expect(result.data).toBe(data);expect(result.resumo.motivo).toMatch(/composição|Composição/);
  });
});
