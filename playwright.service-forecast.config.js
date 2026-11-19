import {defineConfig} from '@playwright/test';
import base from './playwright.vobi.config.js';
export default defineConfig({...base,outputDir:'artifacts/service-forecast/browser-results'});
