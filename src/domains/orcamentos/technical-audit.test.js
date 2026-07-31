import { describe, expect, it } from "vitest";
import { auditBudgetTechnicalScope } from "./technical-audit";

describe("auditoria técnica do orçamento", () => {
  it("prioriza erros objetivos e mantém identificadores estáveis", () => {
    const budget = { dataBase:"2026-06", itens:[
      { codigo:"1", descricao:"Instalação elétrica", quantidade:0, precoUnit:10 },
      { codigo:"2", descricao:"Piso porcelanato", quantidade:10, precoUnit:0 },
    ] };
    const first = auditBudgetTechnicalScope(budget, 100);
    const second = auditBudgetTechnicalScope(budget, 100);
    expect(first.resumo.criticos).toBeGreaterThanOrEqual(2);
    expect(first.achados.slice(0, 2).every(item => item.nivel === "critico")).toBe(true);
    expect(first.achados.map(item => item.id)).toEqual(second.achados.map(item => item.id));
  });

  it("separa validação por cotação da confirmação de escopo", () => {
    const result = auditBudgetTechnicalScope({ dataBase:"2026-06", itens:[
      { codigo:"10", fonte:"SINAPI", descricao:"Bancada de granito", quantidade:1, precoUnit:100 },
    ] }, 50);
    expect(result.achados).toEqual(expect.arrayContaining([
      expect.objectContaining({ nivel:"cotacao", titulo:expect.stringContaining("Bancadas") }),
      expect.objectContaining({ nivel:"escopo" }),
    ]));
  });

  it("não usa títulos vazios como evidência de serviço executável", () => {
    const result = auditBudgetTechnicalScope({ itens:[
      { tipo:"titulo", descricao:"AR-CONDICIONADO", quantidade:0, precoUnit:0 },
    ] }, 0);
    expect(result.achados.some(item => item.titulo === "Ar-condicionado: confirmar escopo")).toBe(true);
    expect(result.resumo.criticos).toBe(0);
  });
});
