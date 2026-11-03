import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

// Carimbo de contexto (Etapa 1): a obra escolhida no topo vale para as telas
// que o seguem, e trocar a obra nessas telas atualiza o carimbo.
async function enter(page,tab){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00-03:00'));
  await page.addInitScript(({tab,user})=>{sessionStorage.setItem(`arcd-section:${user}`,tab);localStorage.setItem('arcd-theme','marcell');},{tab,user:profile.id});
  await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false,reply:''}}));
  await page.route('**/api/data',r=>r.fulfill({json:{ok:true,usuarios:[profile],precisaSetup:false,usuario:profile,data,current:null,history:[],accessToken:'stamp-local-only',refreshToken:'stamp-local-only',updatedAt:'2026-11-01T15:00:00Z'}}));
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('stamp-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await expect(page.locator('.arcd-main')).toBeVisible();
  await expect(page.locator('.arcd-main .arcd-page-loading')).toHaveCount(0);
  return errors;
}
const stamp=page=>page.getByTestId('work-context-stamp').locator('select');
const screenObra=page=>page.locator('main').getByLabel('Obra',{exact:true});

test('a obra do carimbo vale para Planejamento e Avanço físico, nos dois sentidos',async({page})=>{
  const errors=await enter(page,'plan');
  await expect(stamp(page)).toBeVisible();
  await stamp(page).selectOption('b');
  await expect(screenObra(page)).toHaveValue('b');
  // Outra tela que segue o carimbo abre já na obra escolhida.
  await page.evaluate(()=>{sessionStorage.setItem('arcd_med_obra','');});
  await page.keyboard.press('Control+k');
  const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Avanço físico');
  await search.locator('xpath=../..').getByRole('button').filter({hasText:'Avanço físico'}).first().click();
  await expect(page.getByRole('heading',{name:'Avanço físico',exact:true})).toBeVisible();
  await expect(screenObra(page)).toHaveValue('b');
  // Trocar a obra na tela muda o carimbo.
  await screenObra(page).selectOption('a');
  await expect(stamp(page)).toHaveValue('a');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
