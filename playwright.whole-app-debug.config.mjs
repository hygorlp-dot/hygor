import {defineConfig} from '@playwright/test';
const recheck=process.env.APP_DEBUG_RECHECK==='1';
const port=recheck?4228:4226;
const report=recheck?'browser-recheck':'browser';
const build=recheck?'artifacts/whole-app-debug/storage/build':'artifacts/whole-app-debug/build';
export default defineConfig({
  testDir:'./e2e',outputDir:`artifacts/whole-app-debug/${report}-results`,
  timeout:60000,expect:{timeout:8000},workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:`artifacts/whole-app-debug/${report}.json`}]],
  use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',actionTimeout:12000,navigationTimeout:20000,screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'debug-desktop',testIgnore:/(work-files|spreadsheet-runtime|assisted-review)\.spec\.js/,grepInvert:/relatório A4 repete/,use:{viewport:{width:1440,height:1000}}},
    {name:'debug-mobile',testMatch:/(deep-audit-permissions|erp-navigation|equipe-obras(?:-tv)?|clt-payslips|payroll-closing|labor-projection|dre-reconciliation|reconciliation-categories|ponto|annual-dre|critical-actions|supplier-quote|wf-foundation)\.spec\.js/,use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:'debug-source',testMatch:/pdf-mrc\.spec\.js/,grep:/relatório A4 repete/,use:{baseURL:`http://127.0.0.1:${port+1}`,viewport:{width:1440,height:1000}}},
  ],
  webServer:[
    {command:`npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir ${build}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:60000},
    {command:`npx vite --host 127.0.0.1 --port ${port+1} --strictPort`,url:`http://127.0.0.1:${port+1}`,reuseExistingServer:false,timeout:60000},
  ],
});
