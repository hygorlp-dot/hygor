import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./e2e",testMatch:"ponto-review.spec.js",workers:1,
  use:{baseURL:"http://127.0.0.1:4174",browserName:"chromium",screenshot:"only-on-failure"},
  webServer:{command:"npx vite build --config vite.ponto-review.config.mjs && npx vite preview --config vite.ponto-review.config.mjs --host 127.0.0.1 --port 4174",url:"http://127.0.0.1:4174",reuseExistingServer:false,timeout:120000},
  projects:[{name:"desktop",use:{viewport:{width:1440,height:1000}}},{name:"mobile",use:{viewport:{width:390,height:844}}}]
});
