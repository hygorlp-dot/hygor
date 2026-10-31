import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {data as fixture,profile as baseProfile} from './fixtures/workflow-priorities-data.mjs';

// Isolated local UX review. Every API is intercepted; mutations fail the run.
const base=process.env.ROADMAP_BASE_URL||'http://127.0.0.1:4198';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const dir='artifacts/roadmap-wave-one';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const width of [1440,1024,768,610,390,320]) {
  const errors=[],commands=[],metrics=[];
  const page=await browser.newPage({viewport:{width,height:width===610?1244:width>=768?900:844}});
  page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[]}}));
  await page.route('**/api/microsoft/**',r=>r.fulfill({json:{ok:false,connected:false}}));
  await page.route('**/api/data',r=>{
   const body=r.request().postDataJSON()||{};
   if(body.action==='operational-command'){commands.push(body.command);return r.fulfill({status:403,json:{ok:false,error:'Review is read-only'}});}
   if(body.action==='profiles')return r.fulfill({json:{usuarios:[baseProfile],precisaSetup:false}});
   if(['financial-dre-report','financial-company-dre-report'].includes(body.action))return r.fulfill({json:{ok:true,current:null,history:[]}});
   return r.fulfill({json:{ok:true,usuario:baseProfile,accessToken:'isolated-review',refreshToken:'isolated-review',data:fixture,updatedAt:'2026-10-31T15:00:00Z'}});
  });
  async function open(label){
   await page.keyboard.press('Control+k');
   const input=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
   await input.fill(label);
   await input.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();
   await page.waitForFunction(()=>{const main=document.querySelector('main');return main&&main.textContent.trim()&&!/^Carregando/.test(main.textContent.trim());});
  }
  async function settle(){
   await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  async function capture(name,{record=false,top=false}={}){
   if(top)await page.evaluate(()=>{document.querySelector('main')?.scrollTo(0,0);window.scrollTo(0,0);});
   await settle();
   const metric=await page.evaluate(({name,record})=>({name,width:innerWidth,height:innerHeight,
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    headings:document.querySelectorAll('main h1').length,
    firstRecordY:record?document.querySelector('[id^="purchase-record-"]')?.getBoundingClientRect().top:null,
   }),{name,record});
   assert.equal(metric.overflow,false,`${name} overflows at ${width}`);
   assert.equal(metric.headings,1,`${name} main title at ${width}`);
   for(const action of await page.locator('.purchase-header-actions > button, .purchase-header-actions > .purchase-order-menu > button').all()){
    const box=await action.boundingBox();
    assert.ok(box&&box.x>=0&&box.x+box.width<=width+1,`${name}: header action must fit at ${width}`);
   }
   if(record)assert.ok(metric.firstRecordY>0&&metric.firstRecordY<600,`${width}: first purchase record starts at ${metric.firstRecordY}`);
   metrics.push(metric);
   await page.screenshot({path:`${dir}/${name}-${width}.png`});
  }
  async function area(label,id,text){
   if(width<768)await page.getByRole('combobox',{name:label,exact:true}).selectOption(id);
   else await page.getByRole('navigation',{name:label,exact:true}).getByRole('button',{name:text,exact:true}).click();
  }
  await page.goto(base);
  await page.locator('#login-email').fill(baseProfile.email);
  await page.locator('#login-senha').fill('isolated-review');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.getByRole('heading',{name:'Visão gerencial',exact:true}).waitFor();
  await open('Compras');
  await area('Fluxo de compras','cotacoes','Cotar');
  await page.locator('[id^="purchase-record-"]').first().waitFor();
  await capture('quotes',{record:true,top:true});
  assert.equal(await page.getByRole('button',{name:'Adicionar cotação',exact:true}).count(),1);
  const main=page.locator('main');
  assert.ok(await main.locator('.dre-integration').evaluate(el=>el.compareDocumentPosition(document.querySelector('[id^="purchase-record-"]')) & Node.DOCUMENT_POSITION_PRECEDING));
  await page.getByRole('button',{name:'Adicionar cotação',exact:true}).click();
  await page.getByRole('heading',{name:'Nova cotação',exact:true}).waitFor();
  await page.locator('.arcd-modal-panel').getByRole('button',{name:'Cancelar',exact:true}).click();
  const menu=page.getByRole('button',{name:'Mais ações de Compras',exact:true});
  await menu.focus();await page.keyboard.press('ArrowDown');
  await page.getByRole('menuitem',{name:'Analisar documento',exact:true}).waitFor();
  await capture('purchase-actions');
  await page.keyboard.press('Escape');
  assert.equal(await menu.evaluate(el=>document.activeElement===el),true);
  await page.getByLabel('Buscar',{exact:true}).fill('inexistente');
  await page.getByText('Nenhuma cotação encontrada',{exact:true}).waitFor();await capture('quotes-empty');
  await page.getByLabel('Buscar',{exact:true}).fill('COT-001');
  const filters=page.locator('.purchase-quote-filters');
  if(width<768)await filters.getByRole('button',{name:'Filtros',exact:true}).click();
  await filters.getByLabel('Data inicial',{exact:true}).fill('2026-10-01');
  if(width<768){await filters.getByRole('button',{name:'Filtros (1)',exact:true}).click();assert.equal(await filters.getByLabel('Data inicial',{exact:true}).isVisible(),false);}
  await capture('quotes-filtered',{top:true});
  await open('Gestão financeira');
  await page.getByRole('heading',{name:'Financeiro',exact:true}).waitFor();
  const nav=page.locator('.financial-navigation');
  assert.deepEqual(await nav.locator('select optgroup').evaluateAll(groups=>groups.map(group=>group.label)),['Rotina','Análises','Ferramentas']);
  await capture('finance-today',{top:true});
  await area('Áreas do financeiro','documentos','Documentos');
  await page.getByLabel('Pesquisar documento ou fornecedor').fill('Depósito');
  await open('Compras');
  assert.equal(await page.getByLabel('Buscar',{exact:true}).inputValue(),'COT-001');
  assert.equal(await filters.getByLabel('Data inicial',{exact:true}).inputValue(),'2026-10-01');
  await open('Gestão financeira');
  assert.equal(await page.getByLabel('Pesquisar documento ou fornecedor').inputValue(),'Depósito');
  await area('Áreas do financeiro','visao','Visão financeira');
  await page.getByRole('heading',{name:'Financeiro por obra',exact:true}).waitFor();
  await capture('finance-analysis',{top:true});
  if(width===1440){
   // 200% browser zoom equivalent: half the CSS viewport in both dimensions.
   await page.setViewportSize({width:720,height:450});
   await capture('finance-zoom-equivalent',{top:true});
   await page.setViewportSize({width:1440,height:900});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(commands,[]);
  results.push({width,metrics,errors,commands:commands.length});
  await writeFile(`${dir}/verification.json`,JSON.stringify(results,null,2));
  await page.close();
 }
 console.log(JSON.stringify({viewports:results.length,captures:results.reduce((n,r)=>n+r.metrics.length,0),recordPositions:results.map(r=>({width:r.width,y:r.metrics[0].firstRecordY})),errors:results.flatMap(r=>r.errors)},null,2));
}finally{await browser.close();}
