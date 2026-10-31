import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:/deep-audit-permissions\.spec\.js/,
  outputDir:'artifacts/release/browser',workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'artifacts/release/browser.json'}]],
  use:{baseURL:'http://127.0.0.1:4218',browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'npx vite preview --host 127.0.0.1 --port 4218 --strictPort',url:'http://127.0.0.1:4218',reuseExistingServer:false,timeout:60000},
});
