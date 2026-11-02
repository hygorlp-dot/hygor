import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

// Read the app's real tab catalogue so the sweep cannot quietly omit a new area.
const source=readFileSync(new URL('../src/domains/administracao/LegacySettings.jsx',import.meta.url),'utf8').split('export const TAB_META_BASE = {')[1].split('\n};')[0];
const tabs=[...source.matchAll(/\b(\w+)\s*:\s*\{\s*label:\s*"([^"]+)"/g)].map(([,id,label])=>({id,label}));

async function enter(page,id){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(({id,user,theme})=>{sessionStorage.setItem(`arcd-section:${user}`,id);localStorage.setItem('arcd-theme',theme);},{id,user:profile.id,theme:process.env.MARCELL_TEST_THEME||'saas'});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'layout-local-only',refreshToken:'layout-local-only',updatedAt:'2026-11-01T15:00:00Z'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('layout-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  return errors;
}

for(const tab of tabs)test(`${tab.id} · ${tab.label}`,async({page},info)=>{
  const errors=await enter(page,tab.id);
  await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Alterar aparência',exact:true})).toBeVisible();
  const geometry=await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth,header:document.querySelector('.arcd-topbar')?.scrollWidth,headerWidth:document.querySelector('.arcd-topbar')?.clientWidth,actualTab:document.querySelector('.arcd-app-shell')?.dataset.tab,
    screenHeaders:[...document.querySelectorAll('main .mrc-screen-header')].map(el=>({title:el.querySelector('h1,h2,h3')?.textContent,background:getComputedStyle(el).backgroundColor,padding:getComputedStyle(el).padding,fontSize:el.querySelector('h1,h2,h3')?getComputedStyle(el.querySelector('h1,h2,h3')).fontSize:null})),
    overflow:[...document.querySelectorAll('main button,main input,main select')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&r.right>innerWidth+1;}).slice(0,8).map(el=>({text:el.textContent?.slice(0,60)||el.getAttribute('aria-label'),class:el.className}))}));
  await info.attach('geometry',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
  await writeFile(info.outputPath('geometry.json'),JSON.stringify(geometry,null,2));
  await page.screenshot({path:info.outputPath('view.png'),animations:'disabled'});
  expect.soft(geometry.page,JSON.stringify(geometry.overflow)).toBeLessThanOrEqual(geometry.width+1);
  expect.soft(geometry.header).toBeLessThanOrEqual(geometry.headerWidth+1);
  expect.soft(geometry.actualTab).toBe(tab.id);
  if(process.env.MARCELL_TEST_THEME==='operacional'&&tab.id!=='tv'){
    expect.soft(geometry.screenHeaders.length,`Cabeçalho padronizado ausente em ${tab.id}`).toBeGreaterThan(0);
    if(geometry.screenHeaders.length){expect.soft(geometry.screenHeaders[0].fontSize).toBe('24px');expect.soft(geometry.screenHeaders[0].background).toBe('rgb(255, 255, 255)');}
  }
  expect(errors).toEqual([]);
});

test('Compras: alinhamento, seleção, foco, menus e ação principal',async({page},info)=>{
  const errors=await enter(page,'cmp');await expect(page.getByRole('group',{name:'Comandos de Compras',exact:true})).toBeVisible();
  const header=page.getByRole('group',{name:'Comandos de Compras',exact:true});
  const create=header.getByRole('button',{name:'Nova solicitação',exact:true});
  if(page.viewportSize().width>=1100){
    const field=await header.getByLabel('Obra',{exact:true}).boundingBox(),action=await create.boundingBox();
    expect(Math.abs(field.y+field.height-action.y-action.height)).toBeLessThanOrEqual(2);
    const controls=await header.locator('input,select,button').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {top:r.top,height:r.height};}));
    expect(Math.max(...controls.map(r=>r.height))-Math.min(...controls.map(r=>r.height))).toBeLessThanOrEqual(1);
    expect(Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))).toBeLessThanOrEqual(1);
    const labels=await header.locator('.arcd-field__label').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().top));
    expect(Math.max(...labels)-Math.min(...labels)).toBeLessThanOrEqual(1);
    const nav=page.getByRole('navigation',{name:'Fluxo de compras',exact:true});
    const current=nav.getByRole('button',{name:'Fila de trabalho',exact:true});
    await expect(current).toHaveAttribute('aria-current','page');
    const other=nav.getByRole('button',{name:'Pedidos',exact:true});
    const currentStyle=await current.evaluate(el=>({background:getComputedStyle(el).backgroundColor,indicator:getComputedStyle(el).boxShadow}));
    const otherBackground=await other.evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(currentStyle.background!==otherBackground||currentStyle.indicator!=='none').toBe(true);
    await expect(other).toHaveCSS('cursor','pointer');
    const beforeHover=await other.evaluate(el=>getComputedStyle(el).backgroundColor);await other.hover();await expect.poll(()=>other.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(beforeHover);
    await page.keyboard.press('Tab');await other.focus();await expect(other).toBeFocused();await expect(other).toHaveCSS('outline-style','solid');await other.press('Enter');await expect(other).toHaveAttribute('aria-current','page');
    await nav.getByRole('button',{name:'Fila de trabalho',exact:true}).click();
    const tools=page.locator('.purchase-tools');await tools.locator('summary').click();await expect(tools.getByRole('navigation')).toBeVisible();await tools.locator('summary').press('Escape');await expect(tools).not.toHaveAttribute('open');
  }
  await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();await expect(page.locator('.theme-menu')).toBeVisible();await page.locator('.theme-menu').getByLabel('Tema',{exact:true}).press('Escape');
  await create.click();await expect(page.getByRole('dialog',{name:'Solicitar materiais para Compras',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  await page.screenshot({path:info.outputPath('interactive-purchases.png'),animations:'disabled'});expect(errors).toEqual([]);
});

test('Planejamento: escala selecionada e opções respondem pelo padrão comum',async({page})=>{
  const errors=await enter(page,'plan');const controls=page.getByRole('group',{name:'Escala e opções do cronograma',exact:true});
  const month=controls.getByRole('button',{name:'Mês',exact:true});await month.click();await expect(month).toHaveAttribute('aria-pressed','true');
  await expect(controls.getByRole('button',{name:'Semana',exact:true})).toHaveAttribute('aria-pressed','false');
  const columns=controls.getByRole('button',{name:'Colunas',exact:true});await columns.click();await expect(columns).toHaveAttribute('aria-expanded','true');
  await expect(page.getByText('Colunas do cronograma',{exact:true})).toBeVisible();await columns.click();await expect(columns).toHaveAttribute('aria-expanded','false');
  expect(errors).toEqual([]);
});

test('cabeçalho mantém alturas alinhadas nas densidades e no celular estreito',async({page})=>{
  await enter(page,'cmp');
  for(const density of ['compact','comfortable']){
    await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
    await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(density);
    await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-density',density);
    if(page.viewportSize().width<1100)await page.setViewportSize({width:320,height:740});
    const heights=await page.locator('.app-header-actions :is(.mrc-button,.app-save-status)').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>r.height));
    expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
});
