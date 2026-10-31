// Local build audit. All API calls use synthetic data; external traffic is blocked.
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.env.APP_DEBUG_OUTPUT || 'artifacts/bug-audit');
const port = 4207;
const origin = `http://127.0.0.1:${port}`;
const profile = { id:'bug-audit', nome:'Auditoria local', email:'audit@arcd.test', role:'admin', active:true };
const data = {
  usuarios:[profile], obras:[{id:'audit-work',name:'Obra de auditoria',status:'active'}],
  employees:[],attendance:{},config:{paymentHolidays:[]},
  terceirizados:[{id:'audit-contract',obraId:'audit-work',name:'Terceirizado local',specialty:'pintor',tipoContrato:'medicao',active:true,situacao:'andamento',contractValue:10000,etapas:[{id:'audit-stage',nome:'Pintura',valor:10000}]}],
};
const report = { localOnly:true, screens:[], issues:[], apiActions:[], failureChecks:[] };
const server = await preview({build:{outDir:resolve(output,'build')},preview:{host:'127.0.0.1',port,strictPort:true}});
let browser;
await mkdir(output,{recursive:true});

async function setup(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if(url.origin !== origin && !['data:','blob:'].includes(url.protocol))return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const body = route.request().postDataJSON() || {};
    if(body.action && !report.apiActions.includes(body.action)) report.apiActions.push(body.action);
    if(body.action === 'profiles') return route.fulfill({json:{precisaSetup:false}});
    if(body.action === 'auth-refresh')return route.fulfill({json:{accessToken:'audit-token',refreshToken:'audit-refresh'}});
    if(body.action === 'ponto-equipe-obras')return route.fulfill({json:{ok:true,pessoas:[],obras:data.obras,limitacoes:[],fuso:'America/Recife',servidorMs:Date.now()}});
    return route.fulfill({json:{ok:true,accessToken:'audit-token',refreshToken:'audit-refresh',usuario:profile,data,updatedAt:'2026-10-31T00:00:00Z',items:[],bases:[],presencas:[],current:null,history:[]}});
  });
}
async function login(page) {
  await page.goto(origin);
  await page.locator('#login-email').fill(profile.email);
  await page.locator('#login-senha').fill('local-test-only');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await expect(page.locator('.app-breadcrumb')).toBeVisible();
}
async function openScreen(page, label) {
  await page.keyboard.press('Control+k');
  const search = page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill(label);
  const buttons = search.locator('xpath=../..').getByRole('button');
  const exact = buttons.filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)});
  if(await exact.count())await exact.first().click();
  else await buttons.filter({hasText:label}).first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.arcd-page-loading:visible')).toHaveCount(0);
  await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
  await expect(page.locator('main.arcd-main')).toBeVisible();
}

try {
  browser = await chromium.launch({headless:true});
  let labels;
  for(const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
    await setup(context);
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    let current = 'Acesso';
    page.on('pageerror', error=>report.issues.push({width,screen:current,type:'javascript',message:error.message}));
    page.on('console', message=>{if(message.type()==='error')report.issues.push({width,screen:current,type:'console',message:message.text()});});
    page.on('response', response=>{if(response.status()>=400)report.issues.push({width,screen:current,type:'http',status:response.status(),url:response.url()});});
    page.on('requestfailed', request=>{if(request.url().startsWith(origin)&&!request.url().includes('/api/'))report.issues.push({width,screen:current,type:'network',url:request.url(),message:request.failure()?.errorText});});
    console.log(`Checking local build ${width}px: login`);
    try { await login(page); } catch(error) {
      report.issues.push({width,screen:current,type:'login',message:error.message,body:(await page.locator('body').innerText()).slice(0,600)});
      await context.close();
      break;
    }
    if(!labels) {
      const headers = page.locator('.arcd-sidebar .nav-grp-hd');
      for(const header of await headers.all())if(await header.getAttribute('aria-expanded')!=='true')await header.click();
      labels = [...new Set((await page.locator('.arcd-sidebar .nav-item').allTextContents()).map(text=>text.trim()))];
    }
    for(const label of labels) {
      current = label;
      try {
        await openScreen(page,label);
        const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1);
        report.screens.push({width,label,opened:true,overflow});
        console.log(`Opened ${width}px: ${label}${overflow?' (horizontal overflow)':''}`);
        if(overflow)await page.screenshot({path:resolve(output,`overflow-${width}-${report.screens.length}.png`),fullPage:true});
      } catch(error) {
        report.issues.push({width,screen:label,type:'screen',message:error.message});
        await page.screenshot({path:resolve(output,`failure-${width}-${report.screens.length}.png`),fullPage:true});
        // A broken boundary must be investigated before continuing this context.
        break;
      }
    }
    await page.screenshot({path:resolve(output,`app-${width}.png`),fullPage:true});
    await context.close();
  }
  // Fault injection: malformed API response must stay in the feature's error UI.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await setup(context);
    await context.addInitScript(()=>{
      for(const method of ['getItem','setItem','removeItem'])Storage.prototype[method]=()=>{throw new DOMException('Storage blocked','SecurityError');};
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);
    await login(page);
    for(const screen of ['Obras','Equipes','Diario de obra','Conferência','Gestão do ponto','Folha'])await openScreen(page,screen);
    report.failureChecks.push('blocked browser storage: core work and payroll screens still open');
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await setup(context);
    let malformed=true;
    await context.route('**/api/data',route=>{
      if(route.request().postDataJSON()?.action!=='ponto-equipe-obras')return route.fallback();
      return malformed ? route.fulfill({json:{ok:true}}) : route.fallback();
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);
    await login(page);
    await openScreen(page,'Equipe nas Obras');
    await expect(page.locator('.equipe-obras__erro')).toContainText('resposta inválida');
    malformed=false;
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await expect(page.locator('.equipe-obras__erro')).toHaveCount(0);
    await expect(page.getByText('Nenhum funcionário disponível para seu acesso.',{exact:true})).toBeVisible();
    report.failureChecks.push('malformed team response: contained error and successful retry');
    await context.close();
  }
  // Fault injection: a transient lazy CSS failure must recover without reload.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await setup(context);
    let blocked=0;
    await context.route('**/assets/EquipeView-*.css*',route=>++blocked===1 ? route.abort() : route.continue());
    const page=await context.newPage();page.setDefaultTimeout(12000);
    await login(page);
    await openScreen(page,'Equipes');
    await expect(page.locator('header').getByRole('button',{name:'Cadastrar funcionário',exact:true})).toBeVisible();
    expect(blocked).toBeGreaterThanOrEqual(2);
    expect(new URL(page.url()).searchParams.has('_arcd_refresh')).toBe(false);
    await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
    report.failureChecks.push('lazy CSS load failure: stylesheet recovered, no reload, screen opens');
    await context.close();
  }
  // A remoção de um chunk após deploy não pode deixar a aba antiga sem saída.
  {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await setup(context);let requests=0;
    await context.route('**/assets/ProjetosView-*.js',route=>++requests===1?route.fulfill({status:404,body:'Chunk removido'}):route.continue());
    const page=await context.newPage();page.setDefaultTimeout(12000);await login(page);
    const refreshed=page.waitForURL(url=>url.searchParams.has('_arcd_refresh'));
    await openScreen(page,'Projetos').catch(()=>{});await refreshed;
    await expect(page.locator('.app-breadcrumb')).toBeVisible();await openScreen(page,'Projetos');
    expect(requests).toBeGreaterThanOrEqual(2);
    report.failureChecks.push('stale JS chunk 404: bounded refresh, restored session, module opens');
    await context.close();
  }
} catch(error) {
  report.issues.push({type:'failure-check',message:error.message});
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await browser?.close();
  await new Promise(done=>server.httpServer.close(done));
}
console.log(JSON.stringify({screens:report.screens.length,issues:report.issues,failureChecks:report.failureChecks,apiActions:report.apiActions},null,2));
if(report.issues.length)process.exitCode=1;
