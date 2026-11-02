import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./e2e',
 testMatch:/(purchase-workspace|conciliacao-automatica|wf-foundation)\.spec\.js/,
 workers:1,
 timeout:60000,
 reporter:'list',
 outputDir:'./artifacts/wf-foundation/browser-results',
 use:{baseURL:process.env.WF_BASE_URL||'http://127.0.0.1:4213',screenshot:'only-on-failure'},
 projects:[
  {name:'desktop',use:{viewport:{width:1440,height:1000}}},
  {name:'mobile',use:{viewport:{width:390,height:844}}},
 ],
});
