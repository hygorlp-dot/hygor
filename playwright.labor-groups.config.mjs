import {defineConfig} from '@playwright/test';
import base from './playwright.design-study.config.mjs';
export default defineConfig({...base,testMatch:'labor-groups.spec.js',outputDir:'artifacts/labor-groups'});
