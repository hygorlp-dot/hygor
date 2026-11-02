import {defineConfig} from '@playwright/test';
import existing from './playwright.import-integrations.config.mjs';

export default defineConfig({...existing,
 outputDir:'artifacts/bundle-reduction/integration-results',
 reporter:[['list'],['json',{outputFile:'artifacts/bundle-reduction/integrations.json'}]],
 projects:[...existing.projects,{name:'bundle-spreadsheet-dev',testMatch:/spreadsheet-runtime\.spec\.js/,use:{baseURL:'http://127.0.0.1:4282',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
 webServer:[...existing.webServer,{command:'node scripts/serve-spreadsheet-dev-check.mjs',url:'http://127.0.0.1:4282',reuseExistingServer:false,timeout:90000}],
});
