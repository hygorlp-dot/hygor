import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./e2e",testMatch:/purchase-workspace\.spec\.js/,timeout:60000,workers:1,
use:{baseURL:"http://127.0.0.1:4192",viewport:{width:1440,height:1000},screenshot:"only-on-failure",trace:"retain-on-failure"},
webServer:{command:"npx vite --host 127.0.0.1 --port 4192",url:"http://127.0.0.1:4192",reuseExistingServer:true,timeout:120000}});
