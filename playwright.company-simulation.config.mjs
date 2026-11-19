import {defineConfig} from '@playwright/test';
const base='C:/dev/marcell-local-review/company-isolation-20261118';
const command=(kind,port)=>`node scripts/company-simulation-test-server.mjs --kind ${kind} --port ${port}`;
export default defineConfig({testDir:'./e2e',testMatch:'company-application-simulation.spec.js',workers:1,timeout:120000,
  outputDir:`${base}/simulation-review`,reporter:'list',use:{trace:'retain-on-failure'},
  webServer:[{command:command('desktop',4206),url:'http://127.0.0.1:4206',timeout:120000},{command:command('mobile',4207),url:'http://127.0.0.1:4207',timeout:120000}],
  projects:[{name:'desktop',use:{browserName:'chromium',baseURL:'http://127.0.0.1:4206',viewport:{width:1440,height:1000}}},{name:'mobile',use:{browserName:'chromium',baseURL:'http://127.0.0.1:4207',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
});
