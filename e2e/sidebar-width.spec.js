import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page){
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],connected:false}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],usuario:profile,precisaSetup:false,data,accessToken:'local',refreshToken:'local'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
}
test('menu ajusta por arraste e teclado, conserva largura e funciona no celular',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await enter(page);
  const handle=page.getByRole('separator',{name:'Largura do menu lateral'}),sidebar=page.locator('.arcd-sidebar');
  await expect(handle).toHaveAttribute('aria-valuenow','224');const box=await handle.boundingBox();await page.mouse.move(box.x+5,box.y+150);await page.mouse.down();await page.mouse.move(box.x+81,box.y+150,{steps:8});await page.mouse.up();await expect(sidebar).toHaveCSS('width','300px');await expect(page.locator('.arcd-app-shell')).toHaveCSS('padding-left','300px');
  await handle.press('End');await expect(sidebar).toHaveCSS('width','360px');await handle.press('ArrowRight');await expect(handle).toHaveAttribute('aria-valuenow','360');
  await handle.press('Home');await expect(sidebar).toHaveCSS('width','208px');await handle.press('ArrowLeft');await expect(handle).toHaveAttribute('aria-valuenow','208');await handle.press('ArrowRight');await expect(handle).toHaveAttribute('aria-valuenow','224');
  await handle.press('Shift+ArrowRight');await expect(sidebar).toHaveCSS('width','256px');await page.getByRole('button',{name:'Minimizar menu lateral',exact:true}).click();await expect(sidebar).toHaveCSS('width','68px');await expect(handle).toHaveCount(0);await page.getByRole('button',{name:'Expandir menu lateral',exact:true}).click();await expect(sidebar).toHaveCSS('width','256px');
  await page.reload();await expect(sidebar).toHaveCSS('width','256px');await handle.press('End');await page.screenshot({path:info.outputPath('menu-expandido.png')});
  await page.setViewportSize({width:1100,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.setViewportSize({width:390,height:844});await expect(sidebar).toHaveCount(0);await expect(handle).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('menu-celular.png')});
  await page.setViewportSize({width:1440,height:1000});await expect(sidebar).toHaveCSS('width','360px');await handle.press('Enter');await expect(sidebar).toHaveCSS('width','224px');await handle.press('End');await handle.dblclick({position:{x:5,y:200}});await expect(sidebar).toHaveCSS('width','224px');expect(errors).toEqual([]);
});
