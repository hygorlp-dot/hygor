import {defineConfig} from '@playwright/test';
process.env.SPREADSHEET_RUNTIME_BUILD_ROOT='artifacts/import-audit/spreadsheet-runtime';
export default defineConfig({
 testDir:'./e2e',outputDir:'artifacts/import-audit/integration-results',workers:1,timeout:90000,expect:{timeout:8000},
 reporter:[['list'],['json',{outputFile:'artifacts/import-audit/integrations.json'}]],
 use:{baseURL:'http://127.0.0.1:4280',browserName:'chromium',actionTimeout:12000,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'imports-desktop',testMatch:/critical-actions\.spec\.js/,use:{viewport:{width:1440,height:1000}}},
  {name:'imports-mobile',testMatch:/critical-actions\.spec\.js/,use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  {name:'imports-spreadsheet',testMatch:/spreadsheet-runtime\.spec\.js/,use:{baseURL:'http://127.0.0.1:4281',viewport:{width:1440,height:1000}}},
 ],
 webServer:[
  {command:'npx vite preview --outDir artifacts/import-audit/build --host 127.0.0.1 --port 4280 --strictPort',url:'http://127.0.0.1:4280',reuseExistingServer:false,timeout:60000},
  {command:'npx vite preview --outDir artifacts/import-audit/spreadsheet-runtime --host 127.0.0.1 --port 4281 --strictPort',url:'http://127.0.0.1:4281',reuseExistingServer:false,timeout:60000},
 ],
});
