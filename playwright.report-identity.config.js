import {defineConfig} from '@playwright/test';

const port=4269;
const existingUrl=process.env.ERP_QA_URL;
const baseURL=existingUrl||`http://127.0.0.1:${port}`;
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
 testDir:'./e2e',
 testMatch:/report-identity\.spec\.js/,
 outputDir:'artifacts/report-identity/e2e',
 workers:1,
 timeout:60000,
 use:{baseURL,screenshot:'only-on-failure',actionTimeout:10000,serviceWorkers:'block',
  ...(executablePath?{launchOptions:{executablePath}}:{})},
 webServer:existingUrl?undefined:{command:`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,url:baseURL,timeout:120000},
});
