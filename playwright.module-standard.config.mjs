import {defineConfig} from '@playwright/test';
import base from './playwright.sap-theme.config.mjs';
export default defineConfig({...base,testMatch:'module-standard.spec.js',outputDir:'artifacts/module-standard/flows'});
