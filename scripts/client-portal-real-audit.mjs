import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {portalMoney} from '../src/client-portal/format.js';
const directory='C:/dev/marcell-local-review/portal-real',base='http://127.0.0.1:4199';
const capture=JSON.parse(await readFile(`${directory}/capture.json`,'utf8')),expected=JSON.parse(await readFile(`${directory}/expected.json`,'utf8'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],unexpectedWrites=[];
const report={projectName:capture.projectName,capturedAt:capture.capturedAt,views:[],checks:[],photoChecks:[]};
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!['GET','HEAD'].includes(request.method())&&!request.url().endsWith('/api/client/auth/login'))unexpectedWrites.push({method:request.method(),path:new URL(request.url()).pathname});});
await page.route('https://**/*',route=>route.abort());
try{
 await page.goto(`${base}/cliente`);await page.getByRole('textbox',{name:'E-mail'}).fill('revisao-real@example.test');await page.getByLabel('Senha',{exact:false}).fill('RevisaoRealLocal2026');await page.getByRole('button',{name:'Entrar no portal',exact:true}).click();
 await expect(page.getByRole('heading',{name:capture.projectName,exact:true})).toBeVisible();
 const response=await page.request.get(`${base}/api/client/projects/${encodeURIComponent(capture.projectId)}/dashboard`);expect(response.status()).toBe(200);
 const {portal}=await response.json(),summary=expected.costs.find(row=>row.domain==='cost_summary').payload;
 expect(portal.costSummaries[0]).toEqual(summary);
 expect(portal.stageBudgets[0]).toEqual(expected.costs.find(row=>row.domain==='stage_budget').payload);
 expect(portal.contractPositions[0]).toEqual(expected.contract);
 expect(portal.projectCashMovements).toHaveLength(expected.cash.count);
 expect(portal.projectCashSummary[0]).toMatchObject({totalContributions:expected.cash.contributions,totalExpenses:expected.cash.expenses,balance:expected.cash.contributions-expected.cash.expenses});
 expect(portal.purchaseOrders).toHaveLength(expected.purchases);expect(portal.invoices).toHaveLength(capture.sourceCounts.invoices);
 expect(portal.dailyReports).toHaveLength(capture.sourceCounts.completedDiaries);if(!capture.sourceCounts.completedDiaries)expect(portal.publishedMedia).toHaveLength(0);
 for(const forbidden of ['employees','usuarios','password_hash','pin','reference','bankAccount'])expect(JSON.stringify(portal)).not.toContain(`"${forbidden}":`);
 report.checks.push('Custos, etapas, contrato, caixa e compras conferidos contra as origens do ERP.','Diários em preparação e fotos correspondentes permanecem fora da publicação.','Campos privados não atravessam a projeção do cliente.');
 report.values={recognized:summary.recognized,paid:summary.paid,labor:summary.laborToDate,benefits:summary.laborBenefitsToDate,cash:portal.projectCashSummary[0],contract:portal.contractPositions[0],financialSummary:portal.financialSummary[0],orders:portal.purchaseOrders.length,invoices:portal.invoices.length,completedDiaries:portal.dailyReports.length,publishedPhotos:portal.publishedMedia.length,diaryStatuses:expected.diaryStatuses,stageBudgetAvailable:portal.stageBudgets[0].hasBudget};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  const visit=async(id,label)=>{if(width===390)await page.getByRole('combobox',{name:'Abas do portal do cliente',exact:true}).selectOption(id);else{const button=page.getByRole('button',{name:label,exact:true});if(!await button.isVisible())await page.locator('.workspace-navigation__tools>summary').click();await button.click();}};
  for(const [id,label,file] of [['home','Início','inicio'],['photos','Diário da obra','diarios'],['costs','Gastos por categoria','custos'],['cash','Caixa da obra','extrato'],['budget','Previsto e realizado','etapas'],['purchases','Compras e notas fiscais','compras'],['administration','Administração e equipe','administracao'],['financial','Financeiro','cobrancas']]){
   await visit(id,label);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(id==='costs')await expect(page.getByText(portalMoney(summary.recognized),{exact:true}).first()).toBeVisible();
   if(id==='photos'&&!portal.dailyReports.length)await expect(page.getByRole('heading',{name:'Nenhum diário neste recorte',exact:true})).toBeVisible();
   if(id==='cash'){
    await expect(page.getByRole('region',{name:'Resumo do caixa da obra',exact:true}).getByText(portalMoney(expected.cash.contributions-expected.cash.expenses),{exact:true})).toBeVisible();
    await page.getByLabel('Tipo de movimentação',{exact:true}).selectOption('out');
    expect(await page.getByText('+',{exact:true}).count()).toBe(0);
    await page.getByRole('button',{name:'Limpar filtros do extrato',exact:true}).click();
   }
   if(id==='purchases')for(const disclosure of await page.locator('details.arcd-client-disclosure').all())await disclosure.locator('summary').click();
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${directory}/${file}-${width}.png`,fullPage:true});report.views.push({page:id,width,passed:true});
  }
 }
 for(const [index,path] of expected.photoAuditPaths.entries()){
  const response=await page.request.get(`${base}${path}`,{timeout:90000}),mime=response.headers()['content-type']||'';
  const result={sourceDiaryStatus:expected.diaryStatuses[index],status:response.status(),mime,publishedInPortal:false};
  if(response.ok()&&mime.startsWith('image/')){const bytes=await response.body(),extension=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';const {width,height,format}=await sharp(bytes).metadata();result.dimensions={width,height,format};result.bytes=bytes.length;result.sha256=createHash('sha256').update(bytes).digest('hex');result.localFile=`${directory}/foto-cadastrada-${index+1}.${extension}`;await writeFile(result.localFile,bytes);}
  else result.error=(await response.json().catch(()=>({}))).error||'O original não pôde ser confirmado.';
  report.photoChecks.push(result);
 }
 if(process.argv.includes('--require-originals')){
  expect(report.photoChecks.length).toBeGreaterThan(0);
  for(const photo of report.photoChecks){expect(photo.status).toBe(200);expect(photo.dimensions.width).toBeGreaterThan(0);expect(photo.dimensions.height).toBeGreaterThan(0);expect(photo.bytes).toBeGreaterThan(0);}
 }
 const unchangedResponse=await page.request.get(`${base}/api/client/__review/status`);expect(unchangedResponse.status()).toBe(200);
 const unchanged=await unchangedResponse.json();expect(unchanged.remoteWritesBlocked).toBe(true);expect(unchanged.baselineFingerprint).toMatch(/^[a-f0-9]{64}$/);expect(unchanged.currentFingerprint).toBe(unchanged.baselineFingerprint);
 expect(unexpectedWrites).toEqual([]);expect(errors).toEqual([]);
 report.sourceUnchanged=true;report.remoteWritesBlocked=unchanged.remoteWritesBlocked;report.errors=errors;report.unexpectedWrites=unexpectedWrites;
 await writeFile(`${directory}/verification.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({project:report.projectName,views:report.views.length,sourceUnchanged:report.sourceUnchanged,remoteWritesBlocked:report.remoteWritesBlocked,values:report.values,photoChecks:report.photoChecks.map(({status,mime,bytes,error})=>({status,mime,bytes,error})),errors},null,2));
}catch(error){await page.screenshot({path:`${directory}/failure.png`,fullPage:true});await writeFile(`${directory}/failure.txt`,String(error));throw error;}finally{await browser.close();}
