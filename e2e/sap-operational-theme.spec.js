import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

async function appearance(page,theme,density='comfortable'){
 await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();
 await page.locator('.theme-menu').getByLabel('Tema',{exact:true}).selectOption(theme);
 await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(density);
 await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).press('Escape');
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
}
for(const tab of ['cmp','fin','ponto_geral','folha'])test(`${tab}: tema operacional, densidade e contexto`,async({page},info)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
 await page.addInitScript(({tab,user})=>{sessionStorage.setItem(`arcd-section:${user}`,tab);localStorage.setItem('arcd-theme','operacional');},{tab,user:profile.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
 await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'local-sap-only',refreshToken:'local-sap-only'}}));
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-sap-only');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 const main=page.locator('.arcd-main');await expect(main).toBeVisible();await expect(main.locator('.arcd-page-loading')).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('data-theme','operacional');
 await expect(main).toHaveCSS('font-family',/72/);
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>[...document.fonts].filter(f=>f.family.replaceAll('"','').replaceAll("'",'')==='72'&&f.status==='loaded').length)).toBeGreaterThan(0);
 expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath(`${tab}.png`),animations:'disabled',fullPage:false});
 if(tab==='cmp'){
  for(const metric of await main.locator('.purchase-queue-metrics button').all())await expect(metric).toBeVisible();
  if(page.viewportSize().width>=1100)expect(await main.getByRole('navigation',{name:'Fluxo de compras',exact:true}).getByRole('button',{name:'Fila de trabalho',exact:true}).evaluate(el=>getComputedStyle(el).boxShadow)).not.toBe('none');
  const search=main.getByLabel('Buscar na fila',{exact:true});await search.fill('cimento');const rows=await main.locator('.purchase-queue-table tbody').innerText();
  for(const theme of ['saas','marcell','operacional']){await appearance(page,theme);await expect(search).toHaveValue('cimento');expect(await main.locator('.purchase-queue-table tbody').innerText()).toBe(rows);}
  await expect(main.getByRole('button',{name:'Nova solicitação',exact:true})).toHaveCSS('background-color','rgb(0, 87, 210)');
  for(const density of ['compact','comfortable','spacious']){
   await appearance(page,'operacional',density);expect(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1)).toBe(true);
   const button=main.getByRole('button',{name:'Nova solicitação',exact:true});await button.focus();await expect(button).toBeFocused();
   if(page.viewportSize().width<768)expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await main.getByRole('button',{name:'Nova solicitação',exact:true}).click();await expect(page.getByRole('dialog',{name:'Solicitar materiais para Compras',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
 }
 if(tab==='folha'||tab==='ponto_geral'){
  await main.locator('.labor-area-tabs').getByRole('button',{name:'Administrativo',exact:true}).click();await expect(main.locator('.labor-area-tabs').getByRole('button',{name:'Administrativo',exact:true})).toHaveAttribute('aria-current','page');
 }
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.locator('.app-help-panel')).toBeVisible();await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 await appearance(page,'operacional');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','operacional');
 expect(errors).toEqual([]);
});
