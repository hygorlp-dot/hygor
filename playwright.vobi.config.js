import {defineConfig} from '@playwright/test';
import base from './playwright.contracts.config.js';

export default defineConfig({...base,testMatch:/(cost-forecast|commercial-contracts)\.spec\.js/,
 outputDir:'artifacts/vobi-roadmap/browser-results',projects:[
  {name:'vobi-desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
  {name:'vobi-mobile',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
 ]});
