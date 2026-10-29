import { describe, expect, it } from "vitest";
import { rememberSection, restoreSection } from "./section-session.js";

describe("seção da sessão", () => {
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  };
  it("restaura a seção sem misturar usuários", () => {
    const store = storage();
    rememberSection("a", "conc", ["home", "conc"], store);
    expect(restoreSection("a", ["home", "conc"], store)).toBe("conc");
    expect(restoreSection("b", ["home", "conc"], store)).toBe("home");
  });
  it("revalida permissões e ignora seções inválidas", () => {
    const store = storage();
    rememberSection("a", "conc", ["home", "conc"], store);
    expect(restoreSection("a", ["ponto"], store)).toBe("ponto");
    rememberSection("a", "invalida", ["home", "conc"], store);
    expect(restoreSection("a", ["home", "conc"], store)).toBe("conc");
  });
  it("continua funcionando se o navegador bloquear storage", () => {
    const store = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
    expect(restoreSection("a", ["ponto"], store)).toBe("ponto");
    expect(() => rememberSection("a", "ponto", ["ponto"], store)).not.toThrow();
  });
});
