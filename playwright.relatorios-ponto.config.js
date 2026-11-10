import {defineConfig} from '@playwright/test';
const remoto=process.env.RELATORIOS_PONTO_BASE_URL;
export default defineConfig({testDir:'./e2e',testMatch:'relatorios-ponto-obras.spec.js',workers:1,timeout:90000,
 outputDir:'artifacts/repp-tecnico/relatorios-ponto',use:{baseURL:remoto||'http://127.0.0.1:42987',browserName:'chromium'},
 webServer:remoto?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 42987 --strictPort',url:'http://127.0.0.1:42987',reuseExistingServer:true,timeout:60000},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]});
