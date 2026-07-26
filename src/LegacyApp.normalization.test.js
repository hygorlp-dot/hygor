import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("contrato do normalizador legado", () => {
  it("não substitui uma data histórica ausente pela data atual", () => {
    expect(source).toContain('data:   m.dataMedicao || m.data || "",');
    expect(source).toContain('data:   m.dataMedicao || m.data || "",');
    expect(source).toContain('data:        x.data        || "",');
    expect(source).not.toContain('data:   m.data   || today()');
    expect(source).not.toContain('data:        x.data        || today()');
  });

  it("finaliza o snapshot pelo schema versionado e pela fila de qualidade", () => {
    expect(source).toContain('return finalizeNormalizedData(d, normalized);');
    expect(source).toContain('qualidadeDados: Array.isArray(d.qualidadeDados) ? d.qualidadeDados : [],');
  });
});
