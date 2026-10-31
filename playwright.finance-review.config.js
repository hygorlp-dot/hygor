import {defineConfig} from '@playwright/test';
const localUrl=process.env.FINANCE_REVIEW_BASE_URL||'http://127.0.0.1:4185';
const parsedUrl=new URL(localUrl);
if(parsedUrl.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(parsedUrl.hostname)||parsedUrl.username||parsedUrl.password)throw new Error('A revisão financeira aceita somente servidor HTTP local.');
export default defineConfig({
 testDir:'./e2e',testMatch:/dre-memorial\.spec\.js|reconciliation-categories\.spec\.js/,
 workers:1,timeout:60000,reporter:'list',
 use:{baseURL:localUrl,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[{name:'finance-desktop',use:{viewport:{width:1440,height:1000}}},{name:'finance-mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
 webServer:process.env.FINANCE_REVIEW_BASE_URL?undefined:{command:'node scripts/finance-workspace-preview.mjs',url:localUrl,reuseExistingServer:true,timeout:60000},
});
