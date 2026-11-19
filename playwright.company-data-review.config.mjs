import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'company-data-review.spec.js',workers:1,timeout:120000,
  outputDir:'C:/dev/marcell-local-review/company-isolation-20261118/review',reporter:'list',
  use:{baseURL:'http://127.0.0.1:4205',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},{name:'mobile',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
});
