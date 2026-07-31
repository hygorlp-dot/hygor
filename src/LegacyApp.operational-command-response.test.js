import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

describe("resposta enxuta dos comandos operacionais", () => {
  it("adota patches confirmados sem baixar novamente o cadastro inteiro", () => {
    const start = source.indexOf("const dispatchOperationalCommand=");
    const end = source.indexOf("const executeAttendanceCommand=", start);
    const implementation = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(implementation).toContain("__adotarServidorPatch:true");
    expect(implementation).toContain("sections:resposta.sections");
    expect(implementation).toContain("dataAtualRef.current||resposta.data||DEFAULT()");
  });
});
