import { describe, expect, it } from "vitest";
import { canOperateTechnicalMeasurement } from "./permissions.js";

describe("permissão de medição técnica",()=>{
  it("limita engenheiro vinculado à própria obra e mantém administração global",()=>{
    expect(canOperateTechnicalMeasurement({role:"engenheiro",obraId:"obra-a"},"obra-a")).toBe(true);
    expect(canOperateTechnicalMeasurement({role:"engenheiro",obraId:"obra-a"},"obra-b")).toBe(false);
    expect(canOperateTechnicalMeasurement({role:"admin",obraId:"obra-a"},"obra-b")).toBe(true);
    expect(canOperateTechnicalMeasurement({role:"compras"},"obra-a")).toBe(false);
  });
});
