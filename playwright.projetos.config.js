import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", outputDir: "artifacts/projetos/e2e", testMatch: /engineering-projects\.spec\.js/, timeout: 60000, workers: 1,
  use: { baseURL: "http://127.0.0.1:4199", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js preview --outDir artifacts/projetos/build --host 127.0.0.1 --port 4199", url: "http://127.0.0.1:4199", reuseExistingServer: true, timeout: 120000 },
});
