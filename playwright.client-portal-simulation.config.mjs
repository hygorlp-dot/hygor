import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir:"tests/client-portal-simulation",workers:1,timeout:45000,
  use:{baseURL:"http://127.0.0.1:4198",headless:true,trace:"retain-on-failure"},
  outputDir:"artifacts/client-portal-simulation-browser",
  webServer:{command:"node scripts/client-portal-local-server.mjs --simulation",url:"http://127.0.0.1:4198/cliente",reuseExistingServer:true,timeout:60000},
});
