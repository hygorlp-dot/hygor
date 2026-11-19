import {defineConfig} from '@playwright/test';
import base from './playwright.vobi.config.js';
export default defineConfig({...base,outputDir:'artifacts/technical-retention/browser-results'});
