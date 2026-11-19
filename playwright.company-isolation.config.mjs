import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:'company-isolation.spec.js',workers:1,timeout:60000,
  outputDir:'artifacts/company-isolation/results',reporter:'list',
  use:{baseURL:'http://127.0.0.1:4199',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},{name:'mobile',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'npx vite preview --host 127.0.0.1 --port 4199 --strictPort',url:'http://127.0.0.1:4199',reuseExistingServer:true,timeout:60000},
});
