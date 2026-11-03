import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:/user-directory\.spec\.js/,workers:1,timeout:45000,outputDir:'artifacts/usuarios/test-results',use:{baseURL:'http://127.0.0.1:4197',serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure'}});
