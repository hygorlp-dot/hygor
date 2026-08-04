import { describe,expect,it } from "vitest";
import { isValidIsoDate,isoPeriodsOverlap } from "./date.js";

describe("datas de locação",()=>{
  it("valida o calendário gregoriano real",()=>{
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("04/08/2026")).toBe(false);
  });

  it("considera as extremidades inclusivas e períodos em aberto",()=>{
    expect(isoPeriodsOverlap("2026-07-01","2026-07-10","2026-07-10","2026-07-20")).toBe(true);
    expect(isoPeriodsOverlap("2026-07-01","2026-07-09","2026-07-10","2026-07-20")).toBe(false);
    expect(isoPeriodsOverlap("2026-07-01","","2027-01-01","2027-01-02")).toBe(true);
  });
});
