import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {openFinanceModule} from '../scripts/finance-browser-navigation.mjs';

test('fundação precisa mantém identidade, fonte, densidade e contexto da tarefa',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(id=>{sessionStorage.setItem(`arcd-section:${id}`,'cmp');},profile.id);
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));
 await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],usuario:profile,precisaSetup:false,data,accessToken:'local',refreshToken:'local'}}));
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','marcell');await expect(page.locator('.purchase-workspace')).toBeVisible();
 await page.evaluate(()=>Promise.all([400,500,600].map(w=>document.fonts.load(`${w} 14px "IBM Plex Sans"`))));
 const font=await page.locator('.purchase-workspace').evaluate(el=>getComputedStyle(el).fontFamily);expect(font).toContain('IBM Plex Sans');
 const search=page.getByLabel('Buscar na fila',{exact:true});await search.fill('cimento');const before=await page.locator('.purchase-queue-table tbody').innerText();
 const changeDensity=async value=>{await page.getByRole('button',{name:'Alterar aparência',exact:true}).click();await page.locator('.theme-menu').getByLabel('Densidade',{exact:true}).selectOption(value);await page.keyboard.press('Escape');};
 for(const density of ['compact','comfortable']){
  await changeDensity(density);await expect(search).toHaveValue('cimento');expect(await page.locator('.purchase-queue-table tbody').innerText()).toBe(before);
  const geometry=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth+1,font:getComputedStyle(document.querySelector('.purchase-queue-table')).fontSize,controls:[...document.querySelectorAll('.purchase-workspace .mrc-button')].filter(el=>el.getBoundingClientRect().height).map(el=>el.getBoundingClientRect().height)}));
  expect(geometry.fits).toBe(true);expect(geometry.font).toBe('14px');if(page.viewportSize().width<768)expect(Math.min(...geometry.controls)).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:info.outputPath(`compras-${density}.png`),animations:'disabled'});
 }
 const primary=page.getByRole('button',{name:'Nova solicitação',exact:true});await expect(primary).toHaveCSS('background-color','rgb(35, 91, 176)');
 if(page.viewportSize().width>=1100){await expect(page.locator('.arcd-sidebar')).toHaveCSS('background-color','rgb(13, 27, 46)');await expect(page.locator('.arcd-sidebar > div:last-of-type')).toHaveCSS('background-color','rgb(13, 27, 46)');await expect(page.locator('.arcd-sidebar img[alt=MRC]')).toBeVisible();}
 await openFinanceModule(page);await expect(page.locator('.finance-today')).toBeVisible();await expect(page.locator('.finance-today')).toHaveCSS('font-family',font);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('financeiro.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.finance-today')).toBeVisible();expect(errors).toEqual([]);
});
