import {expect,it} from "vitest";
import {portalPercent,portalPeriod} from "../format.js";
it("formata percentuais de 0 a 100 sem alterar seu valor de origem",()=>{
  expect(portalPercent(40.9091)).toBe("40,91%");
  expect(portalPercent(50)).toBe("50%");expect(portalPercent(0)).toBe("0%");
  expect(portalPercent(null)).toBe("Não disponível");expect(portalPercent("inválido")).toBe("Não disponível");
});
it("apresenta a competência em português e preserva outros períodos publicados",()=>{
  expect(portalPeriod("2026-11")).toBe("novembro de 2026");
  expect(portalPeriod("2026-01")).toBe("janeiro de 2026");
  expect(portalPeriod("14–20 jul")).toBe("14–20 jul");expect(portalPeriod("")).toBe("Período não informado");
  expect(portalPeriod("2026-13")).toBe("2026-13");
});
