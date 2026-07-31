import { describe, expect, it } from "vitest";
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_GROUPS,
  companyExpenseCategory,
  companyExpenseGroup,
  emptyCompanyExpenseGroupTotals,
} from "./expense-taxonomy.js";

describe("taxonomia de despesas operacionais", () => {
  it("mantém categorias únicas e todas vinculadas a um grupo válido", () => {
    const categoryIds=COMPANY_EXPENSE_CATEGORIES.map(item=>item.id);
    const groupIds=new Set(COMPANY_EXPENSE_GROUPS.map(item=>item.id));
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
    expect(COMPANY_EXPENSE_CATEGORIES.every(item=>groupIds.has(item.group))).toBe(true);
  });

  it("separa despesas solicitadas nos blocos corretos do DRE", () => {
    expect(companyExpenseGroup("pessoal_admin").id).toBe("pessoal");
    expect(companyExpenseGroup("material_adm").id).toBe("administrativo");
    expect(companyExpenseGroup("viagens").id).toBe("comercial");
    expect(companyExpenseGroup("aluguel").id).toBe("ocupacao");
    expect(companyExpenseGroup("internet").id).toBe("ocupacao");
    expect(companyExpenseGroup("taxas_cartao").id).toBe("financeiro");
  });

  it("classifica categoria legada desconhecida como outros sem perder o lançamento", () => {
    expect(companyExpenseCategory("categoria_antiga").id).toBe("outros");
    expect(companyExpenseGroup("categoria_antiga").id).toBe("outros");
    expect(emptyCompanyExpenseGroupTotals()).toEqual({
      pessoal:0,ocupacao:0,administrativo:0,comercial:0,financeiro:0,fiscal:0,outros:0,
    });
  });
});
