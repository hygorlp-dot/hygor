import { describe, expect, it } from "vitest";
import { buildLegacyFinancialFacts, compareFinancialScopes, summarizeLegacyFinancialFacts } from "./financial-shadow";

describe("homologação financeira em sombra", () => {
  it("normaliza fatos sem duplicar recebimento de medição", () => {
    const snapshot = buildLegacyFinancialFacts({
      medicoes:[{ id:"m1", obraId:"o1", competencia:"2026-07", valorPrevisto:1000, valorRecebido:400,
        recebimentos:[{ id:"r1", valor:250, data:"2026-07-10" }, { id:"r2", valor:150, data:"2026-07-20" }] }],
      payments:[{ id:"p1", obraId:"o1", amount:100, date:"2026-07-21" }],
      pagsTerceiros:[{ id:"t1", obraId:"o1", amount:200, date:"2026-07-11" }],
      outrasDesp:[{ id:"d1", obraId:"o1", valor:50, competencia:"2026-07" }],
      pedidos:[], despesasEmpresa:[], transacoes:[],
    });
    expect(snapshot.facts).toHaveLength(4);
    expect(summarizeLegacyFinancialFacts(snapshot).o1).toMatchObject({
      billed:1000, received:500, thirdParty:200, expenses:50,
    });
  });

  it("só libera quando todos os escopos e métricas coincidem", () => {
    const base = { o1:{ billed:1000, received:500, thirdParty:200, expenses:50, companyExpenses:0, purchases:0 } };
    expect(compareFinancialScopes(base, structuredClone(base))).toEqual([]);
    expect(compareFinancialScopes(base, { o1:{ ...base.o1, received:499 } })).toEqual([
      { scope:"o1", metric:"received", legacyAmount:500, canonicalAmount:499, difference:-1 },
    ]);
  });

  it("preserva a obra de um terceiro mesmo quando a empresa faz o pagamento", () => {
    const snapshot = buildLegacyFinancialFacts({
      pagsTerceiros:[{
        id:"t-empresa", obraId:"obra-42", pagador:"empresa", amount:1250,
        date:"2026-07-22",
      }],
    });

    expect(snapshot.facts).toHaveLength(1);
    expect(snapshot.facts[0]).toMatchObject({
      obraId:"obra-42",
      metadata:{ pagador:"empresa" },
    });
    expect(summarizeLegacyFinancialFacts(snapshot)).toMatchObject({
      "obra-42":{ thirdParty:1250 },
    });
  });
});
