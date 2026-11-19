import {test,expect} from '@playwright/test';
import {data,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

test('administrador alterna a empresa, obras e navegação sem gravar dados',async({page},testInfo)=>{
  const errors=[],writes=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(user=>{
    for(const company of ['arcd','mrc'])sessionStorage.setItem(`marcell:${company}:arcd-section:${user}`,'obras');
    localStorage.setItem('arcd-theme','marcell');
  },profile.id);
  await page.route('https://**/*',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
  await page.route('**/api/data',route=>{
    const body=route.request().postDataJSON(),company=body.companyId||'arcd';calls.push({action:body.action,company});
    if(['save','save-sections','operational-command','financial-command'].includes(body.action))writes.push(body);
    const state=structuredClone(data);
    for(const [key,value] of Object.entries(state))if(Array.isArray(value))state[key]=[];
    state.usuarios=[profile];state.config={...state.config,companyId:company,companyName:company.toUpperCase()};state.condominios=[];
    state.obras=(company==='mrc'?[['k','K1-10'],['i','I1-08']]:[['a','ARCD · Obra A']]).map(([id,name])=>({...data.obras[0],id,name}));
    return route.fulfill({json:{ok:true,precisaSetup:false,usuario:profile,companyId:company,companyIsolationEnabled:true,data:state,accessToken:'company-local-only',refreshToken:'company-local-only',updatedAt:`2026-11-18T12:00:0${company==='mrc'?1:0}Z`}});
  });
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('company-local-only');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  const select=page.getByRole('combobox',{name:'Empresa',exact:true});
  await expect(select).toHaveValue('arcd');await expect(page.locator('main')).toContainText('ARCD · Obra A');await expect(page.locator('main')).not.toContainText('K1-10');
  await page.screenshot({path:testInfo.outputPath('arcd.png'),fullPage:true});
  await select.selectOption('mrc');await expect(select).toHaveValue('mrc');
  await expect(page.locator('main')).toContainText('K1-10');await expect(page.locator('main')).toContainText('I1-08');await expect(page.locator('main')).not.toContainText('ARCD · Obra A');
  await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByText('Aparência e navegação',{exact:true}).click();await expect(page.getByText('Escolher a empresa de trabalho',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(select).toHaveValue('mrc');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('mrc.png'),fullPage:true});
  await select.selectOption('arcd');await expect(page.locator('main')).toContainText('ARCD · Obra A');
  expect(writes).toEqual([]);expect(errors).toEqual([]);expect(calls.some(call=>call.action==='load'&&call.company==='mrc')).toBe(true);
});
