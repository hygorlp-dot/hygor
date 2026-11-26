import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("TypeScript progressivo", () => {
  it("mantém o typecheck estrito limitado ao módulo novo", async () => {
    const source = await readFile(resolve(process.cwd(), "tsconfig.quality.json"), "utf8");
    const config = JSON.parse(source);

    expect(config.compilerOptions).toMatchObject({ allowJs: true, checkJs: false, noEmit: true, strict: true });
    expect(config.include).toEqual([
      "src/domains/administracao/components/Obsoletos.jsx",
      "src/domains/documentos/upload-retry.ts",
      "src/observability/local-error-diagnostic.ts",
    ]);
  });
});
