import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'rh-readiness.spec.js',workers:1,timeout:90000,
  use:{baseURL:'http://127.0.0.1:42871',browserName:'chromium',screenshot:'only-on-failure'},
  webServer:{command:'npx vite --host 127.0.0.1 --port 42871 --strictPort',url:'http://127.0.0.1:42871',reuseExistingServer:false,timeout:60000},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]
});
