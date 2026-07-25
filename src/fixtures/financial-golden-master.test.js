import { createFinancialGoldenRules, financialGoldenExpected, financialReference } from "./financial-reference.js";

const resumir=dre=>Object.fromEntries(["faturamento","recebido","aReceber","totalCustos","lucroBruto","saldoCaixa","backlog"].filter(k=>k in dre).map(k=>[k,dre[k]]));

describe("FND-003 · golden master financeiro",()=>{
  test("preserva os totais conhecidos por obra e no consolidado",()=>{
    const regras=createFinancialGoldenRules(),{data,year,month}=financialReference;
    expect(resumir(regras.calcDREObra(data,"obra-a",year,month))).toEqual(financialGoldenExpected.obraA);
    expect(resumir(regras.calcDREObra(data,"obra-b",year,month))).toEqual(financialGoldenExpected.obraB);
    expect(resumir(regras.calcDREConsolidado(data,year,month))).toEqual(financialGoldenExpected.consolidado);
  });
});
