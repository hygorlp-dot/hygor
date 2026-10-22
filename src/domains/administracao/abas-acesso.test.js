import { describe, expect, it } from "vitest";
import { allowedTabsForUser, podeAcessarAba } from "./abas-acesso.js";

describe("abas de acesso (tela e servidor)", () => {
  it("sem usuário não libera nada no servidor", () => {
    expect(podeAcessarAba(null, "dre_emp")).toBe(false);
    expect(podeAcessarAba(undefined, "dre")).toBe(false);
  });

  it("DRE: admin e financeiro sim; engenheiro, compras e visualizador não", () => {
    expect(podeAcessarAba({ role: "admin" }, "dre_emp")).toBe(true);
    expect(podeAcessarAba({ role: "financeiro" }, "dre")).toBe(true);
    ["engenheiro", "engenheiro_auditor", "compras", "rh", "comercial", "visualizador"].forEach(role => {
      expect(podeAcessarAba({ role }, "dre")).toBe(false);
      expect(podeAcessarAba({ role }, "dre_emp")).toBe(false);
    });
  });

  it("abas personalizadas valem: liberar ou tirar a DRE de um usuário", () => {
    expect(podeAcessarAba({ role: "engenheiro", accessTabs: ["obras", "dre"] }, "dre")).toBe(true);
    expect(podeAcessarAba({ role: "financeiro", accessTabs: ["fin"] }, "dre_emp")).toBe(false);
  });

  it("config nunca entra pela lista personalizada", () => {
    expect(allowedTabsForUser({ role: "rh", accessTabs: ["config"] })).not.toContain("config");
  });
});
