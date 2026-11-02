import {defineConfig} from '@playwright/test';
import base from './playwright.design-study.config.mjs';
export default defineConfig({...base,testMatch:'sap-operational-theme.spec.js',outputDir:'artifacts/sap-theme-specific',use:{...base.use,baseURL:'http://127.0.0.1:4253'}});
