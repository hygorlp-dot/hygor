import {defineConfig} from '@playwright/test';
const verified=process.env.APP_DEBUG_CRITICAL_FINAL==='1';
const port=verified?4240:4236;
const report=verified?'critical-verified':'critical-final';
export default defineConfig({
 testDir:'./e2e',testMatch:/(critical-actions|annual-dre|erp-navigation)\.spec\.js/,outputDir:`artifacts/whole-app-debug/${report}-results`,workers:1,timeout:90000,
 reporter:[['list'],['json',{outputFile:`artifacts/whole-app-debug/browser-${report}.json`}]],
 expect:{timeout:8000},
 use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',actionTimeout:10000,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'debug-desktop',use:{viewport:{width:1440,height:1000}}},{name:'debug-mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
 webServer:{command:`npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir artifacts/whole-app-debug/storage/build`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:60000},
});
