import { financialReference } from "./financial-reference.js";

describe("FND-002 · massa financeira de referência",()=>{
  test("cobre duas obras, recebimento parcial, receita avulsa e custos por origem",()=>{
    expect(financialReference.data.obras).toHaveLength(2);
    expect(financialReference.data.medicoes[0]).toMatchObject({valorPrevisto:4000,valorRecebido:2500,recebido:true});
    expect(financialReference.data.payments[0].amount).toBe(500);
    expect(financialReference.labor["obra-a"].benefitCost).toBe(100);
  });
});
