import { defineConfig } from '@playwright/test';

const port=Number(process.env.DEEP_AUDIT_PORT||4210);
const reportName=process.env.DEEP_AUDIT_REPORT||'playwright-final';
export default defineConfig({
  testDir:'./e2e',
  outputDir:`artifacts/deep-audit/${reportName}-results`,
  timeout:45000,
  expect:{timeout:8000},
  fullyParallel:false,
  workers:1,
  retries:0,
  reporter:[['list'],['json',{outputFile:`artifacts/deep-audit/${reportName}.json`}]],
  use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',actionTimeout:10000,navigationTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'audit-desktop',grepInvert:/relatório A4 repete/,use:{viewport:{width:1440,height:1000}}},
    {name:'audit-mobile',testMatch:/(deep-audit-permissions|erp-navigation|equipe-obras(?:-tv)?|clt-payslips|payroll-closing|labor-projection|dre-reconciliation|reconciliation-categories|ponto)\.spec\.js/,
      use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    // Este teste importa deliberadamente um módulo-fonte no navegador.
    {name:'audit-source-probe',testMatch:/pdf-mrc\.spec\.js/,grep:/relatório A4 repete/,use:{baseURL:`http://127.0.0.1:${port+1}`,viewport:{width:1440,height:1000}}},
  ],
  webServer:[
    {command:`npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir artifacts/deep-audit/build`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:60000},
    {command:`npx vite --host 127.0.0.1 --port ${port+1} --strictPort`,url:`http://127.0.0.1:${port+1}`,reuseExistingServer:false,timeout:60000},
  ],
});
