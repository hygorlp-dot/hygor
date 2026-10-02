import { describe, expect, it } from "vitest";
import { periodSelectOptions, periodSelectValue, periodStateFromSelect, resolveRentalPeriod, shiftMonth } from "./rental-period.js";
import { buildRentalData, HOJE } from "./rental-operations.fixture.js";

const SETEMBRO = { preset: "mes", ym: "2026-09" };

describe("período", () => {
  it("resolve os atalhos a partir de 'hoje' fixo (terça 15/09/2026)", () => {
    expect(resolveRentalPeriod({ preset: "hoje" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-15", fim: "2026-09-15" });
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20" });
    expect(resolveRentalPeriod({ preset: "30d" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-08-17", fim: "2026-09-15" });
    expect(resolveRentalPeriod(SETEMBRO, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", label: "Setembro 2026", mensal: true });
  });

  it("semana que começa no domingo recua até a segunda anterior", () => {
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: "2026-09-20" })).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20" });
    expect(resolveRentalPeriod({ preset: "semana" }, { hoje: "2026-09-21" })).toMatchObject({ inicio: "2026-09-21", fim: "2026-09-27" });
  });

  it("navegação mensal atravessa o ano e 'mês anterior' é o mesmo preset com outro mês", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(periodStateFromSelect("mes_anterior", HOJE)).toEqual({ preset: "mes", ym: "2026-08" });
    expect(periodSelectValue({ preset: "mes", ym: "2026-09" }, HOJE)).toBe("mes");
    expect(periodSelectValue({ preset: "mes", ym: "2026-08" }, HOJE)).toBe("mes_anterior");
    expect(periodSelectValue({ preset: "mes", ym: "2026-03" }, HOJE)).toBe("mes:2026-03");
    expect(periodSelectOptions({ preset: "mes", ym: "2026-03" }, HOJE).some(opt => opt.value === "mes:2026-03" && opt.label === "Março 2026")).toBe(true);
    expect(periodSelectOptions(SETEMBRO, HOJE).some(opt => opt.value.startsWith("mes:"))).toBe(false);
  });

  it("período personalizado inverte datas trocadas e cai no mês atual quando incompleto", () => {
    expect(resolveRentalPeriod({ preset: "personalizado", inicio: "2026-09-10", fim: "2026-09-01" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-10" });
    expect(resolveRentalPeriod({ preset: "personalizado", inicio: "", fim: "" }, { hoje: HOJE })).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", incompleto: true });
  });

  it("'todo o período' cobre da locação mais antiga até hoje", () => {
    const data = buildRentalData();
    expect(resolveRentalPeriod({ preset: "tudo" }, { hoje: HOJE, rentals: data.locacoesEquip })).toMatchObject({ inicio: "2026-07-01", fim: "2026-09-15" });
  });
});
