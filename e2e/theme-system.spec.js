import {test,expect} from '@playwright/test';
import {DEFAULT_THEME} from '../src/design-system/themes/themeRegistry.js';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {openFinanceModule,selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';

async function enter(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,accessToken:'local-theme-test',refreshToken:'local-theme-test'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-theme-test');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  return errors;
}
async function purchases(page){
  if(page.viewportSize().width<1100) await page.getByRole('button',{name:'Abrir Compras e suprimentos',exact:true}).click();
  else {
    const sidebar=page.locator('.arcd-sidebar');const group=sidebar.locator('.nav-grp-hd').filter({hasText:/^Compras/});
    const body=group.locator('xpath=following-sibling::*[contains(@class,"nav-body")][1]');
    if(!await body.isVisible())await group.click();await body.locator('.nav-item').filter({hasText:/^Compras$/}).click();
  }
  await expect(page.locator('.purchase-workspace')).toBeVisible();
}
async function appearance(page,theme,density='comfortable'){
  await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
  await page.locator('.theme-menu').getByLabel('Tema',{exact:true}).selectOption(theme);
  await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(density);
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}

test('troca tema na tarefa, conserva busca e preferência após recarga',async({page},info)=>{
  const errors=await enter(page);await purchases(page);await fits(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme',DEFAULT_THEME);
  const search=page.getByLabel('Buscar na fila',{exact:true});await search.fill('cimento');
  const before=await page.locator('.purchase-queue-table tbody').innerText();
  for(const theme of ['marcell','saas']){
    await appearance(page,theme,'compact');await expect(search).toHaveValue('cimento');
    expect(await page.locator('.purchase-queue-table tbody').innerText()).toBe(before);await fits(page);
    const colors=await page.evaluate(()=>{const button=document.querySelector('.mrc-button[data-mrc-role="primary"]');return {nav:document.querySelector('.arcd-sidebar')?getComputedStyle(document.querySelector('.arcd-sidebar')).backgroundColor:null,button:button?getComputedStyle(button).backgroundColor:null};});
    if(page.viewportSize().width>=1100)expect(colors.nav).toBe(theme==='saas'?'rgb(255, 255, 255)':'rgb(13, 27, 46)');
    await expect(page.locator('.mrc-button[data-mrc-role="primary"]').first()).toHaveCSS('background-color','rgb(35, 91, 176)');
    await page.screenshot({path:info.outputPath(`compras-${theme}.png`),fullPage:true});
  }
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','saas');await expect(page.locator('html')).toHaveAttribute('data-density','compact');
  const filters=page.locator('.purchase-queue-filters');await expect(filters.getByLabel('Prazo',{exact:true})).not.toBeVisible();
  await filters.getByRole('button',{name:/Filtros/}).click();await expect(filters.getByLabel('Prazo',{exact:true})).toBeVisible();
  await filters.getByLabel('Prazo',{exact:true}).selectOption('overdue');
  await filters.getByRole('button',{name:/Filtros/}).click();await filters.getByRole('button',{name:/Filtros/}).click();
  await expect(filters.getByLabel('Prazo',{exact:true})).toHaveValue('overdue');expect(errors).toEqual([]);
});

test('financeiro prioriza rotina e conserva acesso às análises nos dois temas',async({page},info)=>{
  const errors=await enter(page);await openFinanceModule(page);
  for(const theme of ['saas','marcell']){
    await appearance(page,theme);
    if(page.viewportSize().width>=1100)await expect(page.getByRole('navigation',{name:'Áreas do financeiro',exact:true}).getByRole('button')).toHaveCount(4);
    await selectFinanceArea(page,'Hoje');await expect(page.locator('.finance-today')).toBeVisible();await fits(page);
    await page.screenshot({path:info.outputPath(`financeiro-${theme}.png`),fullPage:true});
    await selectFinanceArea(page,'Custos por etapa');await expect(page.locator('.financial-overview')).toBeVisible();await fits(page);
    await selectFinanceArea(page,'Documentos');await expect(page.locator('.document-center')).toBeVisible();await fits(page);
  }
  expect(errors).toEqual([]);
});
