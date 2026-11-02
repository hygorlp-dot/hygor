import {defineConfig} from '@playwright/test';
process.env.MARCELL_FILES_PREVIEW_PORT='4232';
process.env.MARCELL_FILES_PREVIEW_ROOT='artifacts/whole-app-debug/files-state';
process.env.MARCELL_FILES_PREVIEW_FRESH='1';
process.env.MARCELL_FILES_PREVIEW_BUILD='artifacts/whole-app-debug/storage/build';
process.env.SPREADSHEET_RUNTIME_BUILD_ROOT='artifacts/whole-app-debug/integrations-build';
export default defineConfig({
 testDir:'./e2e',outputDir:'artifacts/whole-app-debug/integrations-results',workers:1,timeout:60000,
 reporter:[['list'],['json',{outputFile:'artifacts/whole-app-debug/integrations.json'}]],
 use:{browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure',viewport:{width:1440,height:1000}},
 projects:[
  {name:'files',testMatch:/work-files\.spec\.js/,use:{baseURL:'http://127.0.0.1:4232'}},
  {name:'spreadsheet',testMatch:/spreadsheet-runtime\.spec\.js/,use:{baseURL:'http://127.0.0.1:4233'}},
  {name:'assisted',testMatch:/assisted-review\.spec\.js/,use:{baseURL:'http://127.0.0.1:4234'}},
 ],
 webServer:[
  {command:'node scripts/work-files-preview.mjs',url:'http://127.0.0.1:4232',reuseExistingServer:false,timeout:60000},
  {command:'npx vite preview --host 127.0.0.1 --port 4233 --strictPort --outDir artifacts/whole-app-debug/integrations-build',url:'http://127.0.0.1:4233',reuseExistingServer:false,timeout:60000},
  {command:'npx vite preview --host 127.0.0.1 --port 4234 --strictPort --outDir artifacts/whole-app-debug/storage/build',url:'http://127.0.0.1:4234',reuseExistingServer:false,timeout:60000},
 ],
});
