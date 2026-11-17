import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
const areas=[['home','gestao'],['com_leads','comercial'],['obras','obras'],['cmp','compras'],['fin','financeiro'],['equip_fin','equipamentos'],['terc','pessoas'],['admin_central','administracao']];
for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 for(const [tab,area] of areas)test(`avaliação em sessão nova: ${area}`,async({page})=>{
  const data=structuredClone(fixture),errors=[],writes=[];data.usuarios=[profile];data.obras=data.obras.map(w=>({...w,oneDriveStructureVersion:2}));const before=JSON.stringify(data);
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00-03:00'));await page.addInitScript(({id,tab})=>{sessionStorage.setItem('arcd-section:'+id,tab);localStorage.setItem('arcd-theme','marcell');},{id:profile.id,tab});
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
  await page.route('**/api/**',r=>{const b=r.request().postDataJSON()||{};if(['save','save-sections','operational-command','financial-command','attendance-upsert','attendance-batch-upsert'].includes(b.action)){writes.push(b.action);return r.fulfill({status:409,json:{ok:false,error:'Consulta local sem gravação.'}});}return r.fulfill({json:{ok:true,data,usuario:profile,usuarios:[profile],precisaSetup:false,accessToken:'qa-local',refreshToken:'qa-local',updatedAt:'2026-11-17T15:00:00Z',current:null,history:[],items:[],bases:[],presencas:[],ajustes:[],connected:false,obras:{}}});});
  await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('qa-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();const main=page.locator('main.arcd-main');await expect(main).toBeVisible();await expect(main.getByRole('heading').first()).toBeVisible();await expect(page.getByRole('heading',{name:'Algo quebrou nesta tela',exact:true})).toHaveCount(0);
  // Include the complete rendered page in the inspection record; no task is submitted.
  const observations=await main.evaluate(el=>({headings:[...el.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()).filter(Boolean),actions:[...el.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim(),disabled:e.disabled})),text:el.innerText,overflow:document.documentElement.scrollWidth>innerWidth}));
  expect(observations.overflow).toBe(false);await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa6/${area}-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Ajuda',exact:true}).click();const panel=page.getByRole('complementary',{name:'Central de ajuda'});await expect(panel).toBeVisible();await expect(panel).toContainText('Cuidados, permissões e recuperação');await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);expect(writes).toEqual([]);expect(JSON.stringify(data)).toBe(before);writeFileSync(`artifacts/roadmap-usabilidade-etapa6/${area}-${process.env.ROADMAP_MODE||'dev'}-${width}.json`,JSON.stringify(observations,null,2));
 });
});
