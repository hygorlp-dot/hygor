import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {data,profile} from './fixtures/rebranding-refinement-data.mjs';

// Visual verification with synthetic local data; no production API calls.
const phase=process.env.REFINEMENT_PHASE||'after';
const dir=`artifacts/rebranding-refinement/${phase}`;
await mkdir(dir,{recursive:true});
const fixture=structuredClone(data);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(30000);
const errors=[],metrics=[];
page.on('pageerror',error=>errors.push(error.message));
await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
await page.route('https://**/*',route=>route.abort());
await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[]}}));
await page.route('**/api/microsoft/**',route=>route.fulfill({json:{ok:false,connected:false}}));
await page.route('**/api/data',route=>{const b=route.request().postDataJSON()||{};return route.fulfill({json:b.action==='profiles'?{usuarios:[profile],precisaSetup:false}:['financial-dre-report','financial-company-dre-report'].includes(b.action)?{ok:true,current:null,history:[]}:{ok:true,usuario:profile,accessToken:'isolated-review',refreshToken:'isolated-review',data:fixture,updatedAt:'2026-10-30T15:00:00Z'}})});
async function open(label){await page.keyboard.press('Control+k');const input=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await input.fill(label);await input.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();await page.waitForFunction(()=>{const main=document.querySelector('main');return main&&main.textContent.trim()&&!/^Carregando/.test(main.textContent.trim())});}
async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:`${dir}/${name}.png`});metrics.push(await page.evaluate(name=>({name,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,titles:[...document.querySelectorAll('main h1')].map(e=>e.textContent),firstRowY:document.querySelector('.stock-balance-row,.equipment-fleet-card,.supplier-table tbody tr,.patrimonio-lista__linha')?.getBoundingClientRect().y}),name));}
try {
 await page.goto('http://127.0.0.1:4198');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('isolated-review');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await page.getByRole('heading',{name:'Visão gerencial',exact:true}).waitFor();
 for(const [label,id] of [['Estoque','est'],['Equipamentos','equip'],['Fornecedores','fornecedores'],['Patrimônio da empresa','patrimonio']]){await page.setViewportSize({width:1440,height:1000});await open(label);for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width>767?1000:844});await capture(`${id}-${width}`);}}
 if(phase!=='before') {
  await open('Estoque');
  await page.getByRole('button',{name:'Movimento avulso',exact:true}).click();
  await page.getByText('Movimento de estoque',{exact:true}).waitFor();await capture('stock-movement-320');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('combobox',{name:'Áreas do estoque'}).selectOption('movs');await capture('stock-movements-320');
  await page.getByRole('combobox',{name:'Áreas do estoque'}).selectOption('abc');await capture('stock-abc-320');
  await page.getByRole('combobox',{name:'Áreas do estoque'}).selectOption('saldo');
  await page.locator('.stock-accounting-note > summary').click();await capture('stock-accounting-320');
  await page.getByLabel('Obra',{exact:true}).selectOption('b');await capture('stock-low-balance-320');
  await page.getByLabel('Buscar insumo',{exact:true}).fill('inexistente');await page.getByText('Nenhum material com saldo nesta obra. Registre uma entrada.',{exact:true}).waitFor();await capture('stock-empty-320');
  await open('Equipamentos');
  if(await page.getByRole('combobox',{name:'Período de referência',exact:true}).count()!==1)throw new Error('Período de equipamentos duplicado');
  await page.getByRole('textbox',{name:'Pesquisar na frota'}).fill('inexistente');await page.getByText('Nenhum equipamento encontrado',{exact:true}).waitFor();await capture('equipment-empty-320');
  await open('Patrimônio da empresa');await page.getByRole('button',{name:'Mais ações de Notebook para engenharia e planejamento de obras',exact:true}).click();await page.getByRole('menuitem',{name:'Histórico',exact:true}).waitFor();await capture('patrimony-menu-320');await page.keyboard.press('Escape');
  await page.getByLabel('Buscar',{exact:true}).fill('inexistente');await page.getByText('Nenhum patrimônio encontrado.',{exact:true}).waitFor();await capture('patrimony-empty-320');
  await open('Fornecedores');await page.getByRole('button',{name:'Ver detalhes de Depósito Central',exact:true}).click();await capture('supplier-details-320');
  await page.getByRole('button',{name:'Fechar',exact:true}).click();await open('Compras');
  await page.getByRole('combobox',{name:'Fluxo de compras'}).selectOption('cotacoes');
  const quoteFilters=page.locator('.purchase-quote-filters');
  if(await quoteFilters.getByLabel('Data inicial',{exact:true}).isVisible())throw new Error('Datas devem iniciar recolhidas no celular');
  await capture('quote-filters-collapsed-320');
  await quoteFilters.getByRole('button',{name:'Filtros',exact:true}).click();
  await quoteFilters.getByLabel('Data inicial',{exact:true}).fill('2026-10-01');
  await quoteFilters.getByLabel('Data final',{exact:true}).fill('2026-10-31');await capture('quote-filters-expanded-320');
  await quoteFilters.getByRole('button',{name:'Filtros (2)',exact:true}).click();await capture('quote-filters-active-320');
  if(await quoteFilters.getByLabel('Data inicial',{exact:true}).inputValue()!=='2026-10-01')throw new Error('Data perdida ao recolher filtros');
  await quoteFilters.getByRole('button',{name:'Filtros (2)',exact:true}).click();await quoteFilters.getByRole('button',{name:'Limpar filtros',exact:true}).click();
  if(await quoteFilters.getByLabel('Data inicial',{exact:true}).inputValue()!=='')throw new Error('Limpar filtros não limpou datas');
  await page.setViewportSize({width:1440,height:1000});await capture('quote-filters-desktop');
  await page.setViewportSize({width:1100,height:1000});await capture('quote-list-1100');
 }
 await writeFile(`${dir}/verification.json`,JSON.stringify({metrics,errors},null,2));console.log(JSON.stringify({captures:metrics.length,overflow:metrics.filter(m=>m.overflow),missingTitles:metrics.filter(m=>m.titles.length!==1),errors},null,2));if(errors.length||metrics.some(m=>m.overflow||m.titles.length!==1))process.exitCode=1;
} finally {await browser.close();}
