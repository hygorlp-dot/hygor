import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
async function enter(page){
 const data=structuredClone(fixture),writes=[],errors=[];data.usuarios=[profile];
 data.materiais=[{id:'steel-qa',codigo:'QA-1',descricao:'ACO CA-50 10 MM',unidade:'KG',ativo:true}];
 await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));
 await page.addInitScript(id=>{sessionStorage.setItem('arcd-section:'+id,'cmp');localStorage.setItem('arcd-theme','marcell');},profile.id);
 await page.route('https://**/*',r=>r.abort());page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};
  if(['save','save-sections','operational-command','financial-command'].includes(body.action)){writes.push(body);return r.fulfill({status:409,json:{ok:false,error:'Sem gravação nesta revisão.'}});}
  return r.fulfill({json:{ok:true,data,usuario:profile,usuarios:[profile],precisaSetup:false,accessToken:'qa-local',refreshToken:'qa-local',updatedAt:'2026-11-17T15:00:00Z',items:[],bases:[],connected:false,obras:{}}});
 });
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('qa-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 await page.getByRole('button',{name:'Nova solicitação',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Pesquisar no catálogo',{exact:true}).fill('ACO');await dialog.getByRole('button',{name:/QA-1.*Adicionar/}).click();
 return {dialog,check:()=>{expect(writes).toEqual([]);expect(errors).toEqual([]);}};
}
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 test('embalagem e comprimento exigem fator confirmado, sem conversão pelo nome do aço',async({page})=>{
  const app=await enter(page),d=app.dialog;
  await d.getByLabel('Unidade de compra',{exact:true}).selectOption('BR');
  const factor=d.getByLabel('Conteúdo de 1 BR em KG *',{exact:true});await expect(factor).toHaveValue('');await expect(d).toContainText('Informe quanto contém cada BR');
  await d.getByLabel('Quantidade de compra *',{exact:true}).fill('2');await factor.fill('7.5');await expect(d).toContainText('2 BR = 15 KG');
  await d.getByLabel('Comprimento informado da barra (m)',{exact:true}).fill('6');await expect(factor).toHaveValue('');
  await factor.fill('3.75');await d.getByLabel('Unidade de compra',{exact:true}).selectOption('SC');await expect(d.getByLabel('Conteúdo de 1 SC em KG *',{exact:true})).toHaveValue('');
  await d.getByLabel('Unidade de compra',{exact:true}).selectOption('KG');await expect(d).toContainText('2 KG = 2 KG');
  await d.getByLabel('Unidade de compra',{exact:true}).selectOption('BR');await expect(factor).toHaveValue('');await expect(d).toContainText('Descrição, bitola e comprimento não definem a conversão automaticamente.');
  await factor.scrollIntoViewIfNeeded();await expect(factor).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa5/conversao-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});await d.getByRole('button',{name:'Cancelar',exact:true}).click();app.check();
 });
});
