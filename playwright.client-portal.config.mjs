import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir:"tests/client-portal",workers:1,timeout:30000,
  use:{baseURL:"http://127.0.0.1:4197",headless:true,trace:"retain-on-failure"},
  outputDir:"artifacts/client-portal-browser",
  webServer:{command:"node scripts/client-portal-local-server.mjs",url:"http://127.0.0.1:4197/cliente",reuseExistingServer:true,timeout:60000},
});
