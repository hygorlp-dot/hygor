import {describe,expect,it} from "vitest";
import {auditCanonicalFinancialIntegrity} from "./financial-integrity.js";

const base=()=>({
  titles:[
    {id:"t1",direction:"payable",original_amount:100,status:"settled"},
    {id:"t2",direction:"receivable",original_amount:200,status:"open"},
  ],
  settlements:[
    {id:"s1",title_id:"t1",bank_transaction_id:"b1",amount:100,status:"active"},
  ],
  banks:[
    {id:"b1",direction:"out",amount:100,status:"reconciled"},
  ],
  reconciliationLinks:[
    {id:"l1",bank_transaction_id:"b1",title_id:"t1",settlement_id:"s1",amount:100,status:"active"},
  ],
  legacyLinks:[
    {legacy_type:"pedido",legacy_id:"p1",canonical_type:"financial_title",canonical_id:"t1"},
  ],
  accountingPeriods:[
    {id:"p1",starts_on:"2026-10-01",ends_on:"2026-10-31",status:"closed"},
  ],
});

describe("integridade estrutural do razão canônico",()=>{
  it("aprova uma estrutura consistente",()=>{
    const result=auditCanonicalFinancialIntegrity(base());
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({errors:0,warnings:0,total:0});
  });

  it("detecta liquidação órfã e superliquidação",()=>{
    const data=base();
    data.settlements.push(
      {id:"orphan",title_id:"missing",amount:10,status:"active"},
      {id:"s2",title_id:"t1",amount:1,status:"active"},
    );
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.ok).toBe(false);
    expect(result.errors.map(item=>item.code)).toEqual(expect.arrayContaining([
      "orphan_settlement",
      "title_over_settled",
    ]));
  });

  it("detecta direção bancária incompatível e banco superalocado",()=>{
    const data=base();
    data.banks[0].direction="in";
    data.reconciliationLinks.push({
      id:"l2",bank_transaction_id:"b1",title_id:"t2",settlement_id:"s1",amount:1,status:"active",
    });
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.errors.map(item=>item.code)).toEqual(expect.arrayContaining([
      "bank_direction_mismatch",
      "reconciliation_title_mismatch",
      "bank_over_allocated",
    ]));
  });

  it("detecta vínculo de conciliação órfão e vínculo legado quebrado",()=>{
    const data=base();
    data.reconciliationLinks.push({
      id:"bad-link",bank_transaction_id:"missing-bank",title_id:"t1",settlement_id:"missing-settlement",amount:10,status:"active",
    });
    data.legacyLinks.push({
      legacy_type:"despesa_obra",legacy_id:"d1",canonical_type:"financial_title",canonical_id:"missing-title",
    });
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.errors.map(item=>item.code)).toEqual(expect.arrayContaining([
      "orphan_reconciliation_settlement",
      "orphan_legacy_link",
    ]));
  });

  it("detecta título quitado sem baixa suficiente",()=>{
    const data=base();
    data.settlements[0].amount=90;
    data.reconciliationLinks[0].amount=90;
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.errors.map(item=>item.code)).toContain("settled_title_underpaid");
  });

  it("detecta períodos fechados sobrepostos",()=>{
    const data=base();
    data.accountingPeriods.push({
      id:"p2",starts_on:"2026-10-20",ends_on:"2026-11-20",status:"closed",
    });
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.errors.map(item=>item.code)).toContain("overlapping_closed_periods");
  });

  it("mantém inconsistência de status parcial como aviso, sem reprovar integridade",()=>{
    const data=base();
    data.titles[1].status="partial";
    const result=auditCanonicalFinancialIntegrity(data);
    expect(result.ok).toBe(true);
    expect(result.warnings.map(item=>item.code)).toContain("partial_title_inconsistent");
  });
});
