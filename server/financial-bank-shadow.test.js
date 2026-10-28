import {describe,expect,it} from "vitest";
import {compareLegacyBankTransactions} from "./financial-bank-shadow.js";

describe("FIN 9.6 — paridade do extrato bancário legado",()=>{
  const legacy=[{
    legacyId:"b1",date:"2026-07-10",direction:"out",amount:123.45,
    description:"Fornecedor XPTO",obraId:"obra-1",metadata:{extratoId:"ext-1"},
  }];
  const canonical=[{
    id:"bank-1",booking_date:"2026-07-10",direction:"out",amount:123.45,
    raw_description:"Fornecedor XPTO",
    metadata:{legacyId:"b1",obraId:"obra-1",extratoId:"ext-1"},
  }];

  it("aprova movimento idêntico",()=>{
    expect(compareLegacyBankTransactions(legacy,canonical)).toEqual([]);
  });

  it("detecta movimento legado sem correspondente canônico",()=>{
    expect(compareLegacyBankTransactions(legacy,[])).toEqual([
      {code:"legacy_bank_missing_canonical",legacyId:"b1"},
    ]);
  });

  it("detecta alteração de data, direção, valor, descrição ou obra",()=>{
    const changed=[{
      ...canonical[0],
      booking_date:"2026-07-11",
      direction:"in",
      amount:123.46,
      raw_description:"Outro texto",
      metadata:{legacyId:"b1",obraId:"obra-2",extratoId:"ext-2"},
    }];
    const result=compareLegacyBankTransactions(legacy,changed);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code:"legacy_bank_stale",
      legacyId:"b1",
      fields:["date","direction","amountCents","description","obraId","statementId"],
      expected:{amountCents:12345},
      actual:{amountCents:12346},
    });
  });

  it("detecta banco canônico legado que não existe mais no snapshot atual",()=>{
    const result=compareLegacyBankTransactions([],canonical);
    expect(result).toEqual([{
      code:"canonical_legacy_bank_not_in_snapshot",
      legacyId:"b1",
      actual:{
        date:"2026-07-10",direction:"out",amountCents:12345,
        description:"Fornecedor XPTO",obraId:"obra-1",statementId:"ext-1",
      },
    }]);
  });

  it("normaliza centavos e datas antes da comparação",()=>{
    expect(compareLegacyBankTransactions([{
      ...legacy[0],amount:"123.450",date:"2026-07-10T12:00:00Z",
    }],[{
      ...canonical[0],amount:"123.45",booking_date:"2026-07-10T00:00:00Z",
    }])).toEqual([]);
  });
});
