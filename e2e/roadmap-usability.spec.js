import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

async function enter(page,area,theme='marcell'){
 const data=structuredClone(fixture),errors=[],writes=[];
 data.medicoes=[{id:'med-local',obraId:'a',numero:'MED-LOCAL',competencia:'2026-11',dataEmissao:'2026-11-01',dataVencimento:'2026-11-10',dataPagamento:'2026-11-12',valorPrevisto:100,valorRecebido:130,status:'pendente'}];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({id,area,theme})=>{sessionStorage.setItem(`arcd-section:${id}`,area);localStorage.setItem('arcd-theme',theme);},{id:profile.id,area,theme});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[],presencas:[],connected:false}}));
 await page.route('**/api/data',r=>{
  const body=r.request().postDataJSON()||{};
  if(['save','save-sections','operational-command','financial-command'].includes(body.action)){writes.push(body.action);return r.fulfill({status:409,json:{ok:false,error:'Gravação bloqueada no teste.'}});}
  return r.fulfill({json:{ok:true,usuarios:[profile],usuario:profile,data,precisaSetup:false,accessToken:'local-test',refreshToken:'local-test',updatedAt:'2026-11-15T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('local-test');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return ()=>{expect(errors).toEqual([]);expect(writes).toEqual([]);};
}

for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 for(const theme of ['marcell','operacional','saas','vidro'])test(`Novo lead mantém contraste em hover e abre o formulário: ${theme}`,async({page})=>{
  const check=await enter(page,'com_leads',theme);
  const button=page.getByRole('button',{name:'Novo lead',exact:true});await expect(button).toBeVisible();
  await button.hover();
  // Wait for the transition: the old rule faded to transparent after 150 ms.
  await page.waitForTimeout(250);
  const colors=await button.evaluate(el=>{
   const style=getComputedStyle(el);
   const luminance=rgb=>{const [r,g,b]=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
   const bg=style.backgroundColor,fg=style.color;
   return {bg,contrast:(Math.max(luminance(bg),luminance(fg))+.05)/(Math.min(luminance(bg),luminance(fg))+.05),height:el.getBoundingClientRect().height};
  });
  expect(colors.bg).not.toBe('rgba(0, 0, 0, 0)');expect(colors.contrast).toBeGreaterThanOrEqual(4.5);if(width<600)expect(colors.height).toBeGreaterThanOrEqual(44);
  await button.focus();await expect(button).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Novo lead',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();await expect(button).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa1/leads-${process.env.ROADMAP_MODE||'dev'}-${theme}-${width}.png`,animations:'disabled'});check();
 });
 test('fechamento explica o bloqueio, consulta a origem e preserva a competência sem gravar',async({page})=>{
  const check=await enter(page,'fin');
  await selectWorkspaceArea(page,'Áreas do financeiro','Fechamento');
  await page.getByRole('textbox',{name:'Competência',exact:true}).fill('2026-11');
  await expect(page.getByRole('heading',{name:'Recebimentos acima do valor a receber',exact:true})).toBeVisible();
  const pending=page.getByRole('region',{name:'Pendências para conferência do fechamento',exact:true});
  await expect(pending).toContainText('não some os valores');
  await expect(page.getByRole('button',{name:'Fechar competência',exact:true})).toBeDisabled();
  const diagnostic=pending.locator('summary').filter({hasText:'Diagnóstico para suporte'}).first();
  await expect(diagnostic.locator('..')).not.toHaveAttribute('open','');
  await diagnostic.focus();await page.keyboard.press('Enter');await expect(diagnostic.locator('..')).toHaveAttribute('open','');
  const origin=page.getByRole('button',{name:'Consultar origem do bloqueio',exact:true});await origin.click();
  const memorial=page.getByRole('dialog',{name:'Origem do bloqueio · Medição · MED-LOCAL',exact:true});await expect(memorial).toBeVisible();
  await expect(memorial).toContainText('100,00');await expect(memorial).toContainText('med-local');
  await memorial.getByRole('button',{name:'Fechar memorial',exact:true}).click();await expect(origin).toBeFocused();
  await expect(page.getByRole('textbox',{name:'Competência',exact:true})).toHaveValue('2026-11');
  await origin.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa1/fechamento-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);check();
 });
});
