import { describe, expect, it } from "vitest";
import { auditBudgetDimensions } from "./dimensional-audit";

describe("auditoria dimensional do orçamento", () => {
  it("não confunde metro linear com metro quadrado", () => {
    const result = auditBudgetDimensions({ itens:[
      { descricao:"Piso em porcelanato", unidade:"M2", quantidade:100 },
      { descricao:"Rodapé de piso", unidade:"M", quantidade:100 },
    ] }, 100);
    expect(result.linhas).toHaveLength(1);
    expect(result.linhas[0]).toMatchObject({ chave:"piso", qtd:100, status:"ok" });
  });

  it("sinaliza quantitativo fora da tolerância e ignora títulos", () => {
    const result = auditBudgetDimensions({ itens:[
      { descricao:"Pintura de teto", unidade:"m²", quantidade:160 },
      { tipo:"titulo", descricao:"Pintura", unidade:"M2", quantidade:500 },
    ] }, 100);
    expect(result.alertas).toHaveLength(1);
    expect(result.alertas[0]).toMatchObject({ chave:"pintura_teto", status:"alto", dif:60 });
  });

  it("preserva a conferência mesmo sem área cadastrada", () => {
    const result = auditBudgetDimensions({ itens:[{ descricao:"Forro de gesso", unidade:"M2", quantidade:20 }] }, 0);
    expect(result).toMatchObject({ temArea:false, area:0 });
    expect(result.linhas[0].status).toBe("sem_area");
  });
});

