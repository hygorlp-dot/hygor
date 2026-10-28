import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /conciliacao-automatica\.spec\.js/,
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4188", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npx vite preview --outDir build/conciliacao-check --host 127.0.0.1 --port 4188", url: "http://127.0.0.1:4188", reuseExistingServer: true, timeout: 120_000 },
});
