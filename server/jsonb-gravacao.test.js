// @vitest-environment node
//
// Regra: valor jsonb gravado pelo driver `postgres` vai por sql.json(...).
// `${JSON.stringify(x)}::jsonb` grava um TEXTO JSON (o driver codifica de
// novo), o que fazia toda leitura seguinte regravar a base inteira.
// A parte com Postgres real roda na CI (job rep-p-arp-postgres, PONTO_PG_URL).
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

const URL_PG = process.env.PONTO_PG_URL;

describe("gravação de jsonb", () => {
  it("api/data.js não interpola JSON.stringify(...) como jsonb", () => {
    const fonte = fs.readFileSync(path.resolve(process.cwd(), "api/data.js"), "utf8");
    expect(fonte).not.toMatch(/\$\{JSON\.stringify\([^`]*?\)\}::jsonb/);
  });

  it.skipIf(!URL_PG)("no Postgres real: sql.json grava objeto, JSON.stringify grava texto", async () => {
    const sql = postgres(URL_PG, { max: 1, onnotice: () => {} });
    try {
      const valor = { __arcdEncoding: "arcd-gzip-base64-v1", data: "abc" };
      const [errado] = await sql`select jsonb_typeof(${JSON.stringify(valor)}::jsonb) as tipo`;
      const [certo] = await sql`select jsonb_typeof(${sql.json(valor)}::jsonb) as tipo`;
      expect(errado.tipo).toBe("string");
      expect(certo.tipo).toBe("object");
    } finally { await sql.end({ timeout: 2 }); }
  });
});
