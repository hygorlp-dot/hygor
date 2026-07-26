import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SHELL_CACHE_CONFIG } from "../../scripts/generate-shell-service-worker.mjs";

describe("POC de cache do shell", () => {
  it("só precacheia assets estáticos e não registra rotas de dados", () => {
    expect(SHELL_CACHE_CONFIG.globPatterns).toEqual(expect.arrayContaining([
      "index.html",
      "manifest.webmanifest",
      "logo-arcd.png",
      "assets/index-*.js",
      "assets/index-*.css",
      "assets/vendor-*.js",
    ]));
    expect(SHELL_CACHE_CONFIG.globPatterns.join(" ")).not.toMatch(/LegacyApp|spreadsheet|charts|login-/);
    expect(SHELL_CACHE_CONFIG.globIgnores).toEqual(expect.arrayContaining(["**/*.map", "sw.js", "workbox-*.js"]));
    expect(SHELL_CACHE_CONFIG.runtimeCaching).toEqual([]);
  });

  it("não ativa nem toma controle de clientes no piloto", () => {
    expect(SHELL_CACHE_CONFIG.clientsClaim).toBe(false);
    expect(SHELL_CACHE_CONFIG.skipWaiting).toBe(false);
    expect(SHELL_CACHE_CONFIG.swDest).toBe("dist/sw-shell-poc.js");
  });

  it("não registra service worker na aplicação durante a POC", async () => {
    const entry = await readFile(resolve(process.cwd(), "src/index.js"), "utf8");
    expect(entry).not.toMatch(/navigator\.serviceWorker/);
  });
});
