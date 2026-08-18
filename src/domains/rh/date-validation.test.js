import { describe, expect, it } from "vitest";
import { validDate } from "./date-validation.js";

describe("validDate", () => {
  it("aceita datas reais no formato YYYY-MM-DD", () => {
    expect(validDate("2026-02-28")).toBe(true);
    expect(validDate("2024-02-29")).toBe(true); // ano bissexto
    expect(validDate("2026-01-01")).toBe(true);
    expect(validDate("2026-12-31")).toBe(true);
  });

  it("rejeita datas com formato correto mas inexistentes no calendário", () => {
    // Achado de auditoria de 18/08/2026: a validação antiga (só regex) não
    // pegava isso - o Date nativo do JS rolava "2026-02-31" para 2026-03-03
    // em silêncio em vez de rejeitar.
    expect(validDate("2026-02-31")).toBe(false);
    expect(validDate("2026-13-01")).toBe(false);
    expect(validDate("2026-04-31")).toBe(false); // abril tem 30 dias
    expect(validDate("2026-02-29")).toBe(false); // 2026 não é bissexto
    expect(validDate("2026-00-10")).toBe(false);
    expect(validDate("2026-01-00")).toBe(false);
  });

  it("rejeita formatos inválidos e valores vazios", () => {
    expect(validDate("")).toBe(false);
    expect(validDate(undefined)).toBe(false);
    expect(validDate(null)).toBe(false);
    expect(validDate("2026-2-1")).toBe(false);
    expect(validDate("28/02/2026")).toBe(false);
    expect(validDate("not-a-date")).toBe(false);
  });
});
