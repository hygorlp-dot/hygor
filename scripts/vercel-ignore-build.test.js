import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { shouldBuild } from "./vercel-ignore-build.mjs";

it("constrói produção e branches com PR; pula branches sem PR", () => {
  expect(shouldBuild({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }).build).toBe(true);
  expect(shouldBuild({ VERCEL_ENV: "preview", VERCEL_GIT_PULL_REQUEST_ID: "224" }).build).toBe(true);
  expect(shouldBuild({ VERCEL_ENV: "preview", VERCEL_GIT_PULL_REQUEST_ID: "", VERCEL_GIT_COMMIT_REF: "codex/backup" }).build).toBe(false);
  expect(shouldBuild({ VERCEL_ENV: "preview" }).build).toBe(false);
});

it("devolve os códigos de saída que a Vercel espera (1 constrói, 0 pula)", () => {
  const run = env => spawnSync(process.execPath, ["scripts/vercel-ignore-build.mjs"], { env: { PATH: process.env.PATH, ...env } }).status;
  expect(run({ VERCEL_ENV: "production" })).toBe(1);
  expect(run({ VERCEL_ENV: "preview", VERCEL_GIT_PULL_REQUEST_ID: "7" })).toBe(1);
  expect(run({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/x" })).toBe(0);
});

it("vercel.json usa o script como Ignored Build Step", () => {
  expect(JSON.parse(readFileSync("vercel.json", "utf8")).ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
});
