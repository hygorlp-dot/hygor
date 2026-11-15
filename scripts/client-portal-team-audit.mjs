import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {portalMoney} from '../src/client-portal/format.js';
const base='http://127.0.0.1:4199',directory='C:/dev/marcell-local-review/portal-real';
const capture=JSON.parse(await readFile(`${directory}/capture.json`,'utf8'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));await page.route('https://**/*',route=>route.abort());
const report={views:[],months:[]};
try{
 await page.goto(`${base}/cliente`,{waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'E-mail'}).fill('revisao-real@example.test');await page.getByLabel('Senha',{exact:false}).fill('RevisaoRealLocal2026');await page.getByRole('button',{name:'Entrar no portal',exact:true}).click();
 await expect(page.getByRole('heading',{name:capture.projectName,exact:true})).toBeVisible();
 const current=await (await page.request.get(`${base}/api/client/projects/${capture.projectId}/dashboard`)).json();
 expect(current.portal.administrationTeam).toHaveLength(1);
 const asOf=current.portal.administrationTeam[0].asOf;
 for(const month of [...new Set([asOf.slice(0,7),'2026-07'])]){
  const response=await page.request.get(`${base}/api/client/projects/${capture.projectId}/dashboard?month=${month}`);expect(response.status()).toBe(200);
  const team=(await response.json()).portal.administrationTeam[0];expect(team.month).toBe(month);expect(team.administration.rate).toBe(12);
  if(month===asOf.slice(0,7)){
   expect(team.members.length).toBeGreaterThan(0);expect(team.workforce.pendingReserves).toBe(0);
   expect(team.workforce.additionalReserve).toBeGreaterThan(0);expect(team.workforce.passThrough).not.toBeNull();
   expect(team.members.every(member=>member.provisions.source==='referencia')).toBe(true);
  }
  if(team.workforce.passThrough!==null)expect(Math.round(team.workforce.passThrough*100)).toBe(Math.round(team.workforce.recognized*100)+Math.round(team.workforce.additionalReserve*100)+Math.round(team.workforce.additionalCharges*100));
  if(team.administration.calculated!==null)expect(team.administration.calculated).toBe(Math.round(team.administration.base*12)/100);
  for(const member of team.members)for(const day of member.attendance){expect(day.date.slice(0,7)).toBe(month);expect(day.date<=team.asOf).toBe(true);}
  for(const forbidden of ['cpf','pixKey','monthlySalary','note','notes','documentoFuncionario'])expect(JSON.stringify(team)).not.toContain(`"${forbidden}":`);
  report.months.push({month,asOf:team.asOf,members:team.members.length,administration:team.administration,workforce:team.workforce});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});await page.goto(`${base}/cliente/obra/${capture.projectId}/administracao-equipe`);
   await expect(page.getByRole('heading',{name:'Administração e equipe',exact:true})).toBeVisible();
   await page.getByLabel('Mês da consulta',{exact:true}).fill(month);await expect(page.getByText('Administração a emitir · estimativa',{exact:true})).toBeVisible();
   if(team.administration.toIssue!==null)await expect(page.getByRole('region',{name:'Taxa de administração',exact:true}).getByText(portalMoney(team.administration.toIssue),{exact:true})).toBeVisible();
   for(const [id,label] of [['payroll','Folha detalhada'],['provisions','Provisionamentos'],['attendance','Folha de ponto']]){
    if(width===390)await page.getByRole('combobox',{name:'Detalhes da equipe',exact:true}).selectOption(id);else await page.getByRole('button',{name:label,exact:true}).click();
    const disclosure=page.locator('details.arcd-client-disclosure').filter({has:page.getByText('Ver detalhes',{exact:true})}).first();
    if(await disclosure.count())await disclosure.locator('summary').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`${directory}/equipe-${month}-${id}-${width}.png`,fullPage:true});report.views.push({month,width,view:id,passed:true});
   }
  }
 }
 const status=await (await page.request.get(`${base}/api/client/__review/status`)).json();expect(status.currentFingerprint).toBe(status.baselineFingerprint);expect(status.remoteWritesBlocked).toBe(true);expect(errors).toEqual([]);
 const statementResponse=await page.request.get(`${base}/api/client/projects/${capture.projectId}/statement?month=${asOf.slice(0,7)}&format=json`);expect(statementResponse.status()).toBe(200);
 const statement=(await statementResponse.json()).statement;
 expect(statement.workforce).toEqual(report.months[0].workforce);expect(statement.simulation).toBe(false);expect(statement.invoices).toHaveLength(0);
 const pdfResponse=await page.request.get(`${base}/api/client/projects/${capture.projectId}/statement?month=${asOf.slice(0,7)}`);expect(pdfResponse.status()).toBe(200);const pdf=await pdfResponse.body();expect(pdf.subarray(0,5).toString()).toBe('%PDF-');await writeFile(`${directory}/prestacao-B2-04.pdf`,pdf);
 report.statement={month:statement.month,recognized:statement.recognized,passThrough:statement.passThrough,administration:statement.administration,invoiceCount:statement.invoices.length,pdfBytes:pdf.length};
 report.sourceUnchanged=true;report.errors=errors;await writeFile(`${directory}/team-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({viewCount:report.views.length,months:report.months,sourceUnchanged:report.sourceUnchanged,errors},null,2));
}catch(error){await page.screenshot({path:`directory/failure.png`.replace('directory',directory),fullPage:true});throw error;}finally{await browser.close();}
