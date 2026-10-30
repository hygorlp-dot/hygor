// Local-only browser regression with isolated data and upload responses.
import {createServer} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

const fixturePath=resolve('.measurement-mobile-fixture.jsx');
const output=resolve('artifacts/measurement-mobile');
const fixture=`import React from 'react';
import {createRoot} from 'react-dom/client';
import {MedicaoEvolucao} from '/src/LegacyApp.jsx';
import {abrirSessao} from '/src/api.js';
import '/src/index.css';
import '/src/design-system/themes/marcell-clean.css';
abrirSessao('qa-engineer','local-fixture');
const data={obras:[{id:'qa',name:'Obra local QA',status:'active',oneDriveDriveId:'local',oneDriveFolderId:'local'}],usuarios:[],employees:[],pagamentos:[],terceirizados:[{id:'electrical',obraId:'qa',name:'Instalações elétricas',specialty:'eletricista',tipoContrato:'medicao',situacao:'andamento',contractValue:10000,etapas:[{id:'infra',nome:'Infraestrutura elétrica do pavimento térreo',valor:6000},{id:'cables',nome:'Cabeamento e acabamento',valor:4000}]}],medicoesTerc:[{id:'old',tercId:'electrical',obraId:'qa',data:'2026-10-01',status:'aprovada',total:1200,itens:[{etapaId:'infra',pctAnterior:0,pctAcum:20,valor:1200}]}]};
const query=new URLSearchParams(location.search);
if(query.has('multiple'))data.terceirizados.push({...data.terceirizados[0],id:'painting',name:'Pintura e acabamento'});
if(query.has('planned'))data.planos=[{obraId:'qa',tarefas:[{id:'task',nome:'Instalações elétricas',progresso:25}]}];
window.qa={commands:[],toasts:[]};
createRoot(document.getElementById('root')).render(React.createElement(MedicaoEvolucao,{data,obraIdFixo:'qa',currentUser:{id:'qa-engineer',nome:'Engenheiro QA',role:'engenheiro',active:true},update:()=>{},showToast:(...args)=>window.qa.toasts.push(args),dispatchCommand:async build=>{window.qa.commands.push(typeof build==='function'?build(data):build);return {ok:true}}}));`;
await writeFile(fixturePath,fixture);
await mkdir(output,{recursive:true});
const html='<!doctype html><html lang="pt-BR" data-theme="marcell"><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><main id="root" class="arcd-main" style="max-width:1100px;margin:auto;padding:12px"></main><script type="module" src="/.measurement-mobile-fixture.jsx"></script></body></html>';
const server=await createServer({cacheDir:'node_modules/.vite-measurement-qa',server:{host:'127.0.0.1',port:4194,strictPort:true,watch:null,hmr:false},plugins:[{name:'measurement-mobile-qa',configureServer(s){
 s.middlewares.use('/api',async(req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,item:{id:'local-photo'},url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHSkAAAAASUVORK5CYII='}));});
 s.middlewares.use('/measurement-mobile-qa',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/measurement-mobile-qa',html));});
}}]});
let browser;
try{
 await server.listen();browser=await chromium.launch({headless:true});
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'||route.request().url().startsWith('data:')?route.continue():route.abort());
  const url='http://127.0.0.1:4194/measurement-mobile-qa';
  await page.goto(url);
  await page.getByRole('button',{name:'Confirmar medição',exact:true}).click({timeout:30000});
  const dialog=page.getByRole('dialog',{name:/Medição.*Instalações elétricas/});
  await expect(dialog).toBeVisible({timeout:30000});
  const number=dialog.getByRole('spinbutton',{name:'Percentual de Infraestrutura elétrica do pavimento térreo',exact:true});
  const slider=dialog.getByRole('slider',{name:'Ajustar Percentual de Infraestrutura elétrica do pavimento térreo',exact:true});
  await expect(number).toHaveValue('20');
  await slider.scrollIntoViewIfNeeded();
  if(width<768){
   const cdp=await context.newCDPSession(page);const b=await slider.boundingBox();
   const start=b.x+14+(b.width-28)*0.2,end=b.x+14+(b.width-28)*0.75,y=b.y+b.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
   for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*i/8,y}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   expect(Number(await number.inputValue())).toBeGreaterThan(65);
   // Vertical swipes on the slider must scroll the modal without changing it.
   const scrollArea=dialog.locator('.arcd-modal-body');
   const initial=await number.inputValue();const before=await scrollArea.evaluate(e=>e.scrollTop);
   const b2=await slider.boundingBox();const sx=b2.x+b2.width*0.4,sy=b2.y+22;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
   for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-i*12}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await expect.poll(()=>scrollArea.evaluate(e=>e.scrollTop)).toBeGreaterThan(before);
   expect(await number.inputValue()).toBe(initial);
  }else{
   await slider.focus();await page.keyboard.press('ArrowRight');await expect(number).toHaveValue('20.01');
  }
  await number.fill('62.25');await number.blur();
  await expect(slider).toHaveAttribute('aria-valuetext','62.25% acumulado');
  await expect(dialog.locator('[aria-label="Evolução percentual do contrato"]')).toContainText('12.0% → 37.4%');
  // Decreases still show the existing reversal warning.
  await number.fill('10');await expect(dialog).toContainText('Há etapa com percentual menor');
  await number.fill('62.25');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await dialog.locator('.arcd-modal-body').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:resolve(output,`third-party-${width}.png`),animations:'disabled'});
  await expect(dialog.getByRole('button',{name:'Confirmar e enviar para aprovação',exact:true})).toBeVisible();
  // An isolated upload exercises the real photo handler without a remote service.
  await dialog.locator('input[type="file"]').setInputFiles({name:'evidencia.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHSkAAAAASUVORK5CYII=','base64')});
  await expect(dialog.getByAltText('Evidência 1')).toBeVisible();
  await dialog.getByRole('button',{name:'Confirmar e enviar para aprovação',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const commands=await page.evaluate(()=>window.qa.commands);
  expect(commands).toHaveLength(1);
  expect(commands[0].payload.measurement.itens[0]).toMatchObject({etapaId:'infra',pctAnterior:20,pctAcum:62.25,valor:2535});
  expect(commands[0].payload.measurement.fotos).toHaveLength(1);
  await page.goto(url+'?multiple');
  await page.getByRole('button',{name:'Confirmar medição',exact:true}).click();
  await page.screenshot({path:resolve(output,`contract-picker-${width}.png`),animations:'disabled'});
  await page.getByRole('dialog',{name:'Medir terceirizado',exact:true}).getByRole('button',{name:/Pintura e acabamento/}).click();
  await expect(page.getByRole('dialog',{name:/Medição.*Pintura e acabamento/})).toBeVisible();
  await page.goto(url+'?planned');
  await page.getByRole('button',{name:'Confirmar medição',exact:true}).click();
  await expect(page.getByRole('slider',{name:'Ajustar Percentual de Instalações elétricas',exact:true})).toBeVisible();
  await page.screenshot({path:resolve(output,`technical-${width}.png`),animations:'disabled'});
  expect(errors).toEqual([]);
  console.log(`PASS ${width}px: no-plan measurement, contract picker, percentage slider, exact decimals, reversal warning, photo and command, technical measurement; ${width<768?'synthesized touch drag and vertical scroll':'keyboard adjustment'}.`);
  await context.close();
 }
}finally{await browser?.close();await server.close();await unlink(fixturePath);}
