import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareStatementDelivery,dispatchStatementDelivery} from '../server/client-statement-delivery.js';
const base='http://127.0.0.1:4200',directory='C:/dev/marcell-local-review/accountability',output='C:/dev/repositorio-mrc/output/pdf';
await mkdir(directory,{recursive:true});await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
await page.route('https://**/*',route=>route.abort());
try{
 await page.goto(`${base}/cliente`);await page.getByRole('textbox',{name:'E-mail'}).fill('cliente@example.test');await page.getByLabel('Senha',{exact:false}).fill('ClienteLocal1234');await page.getByRole('button',{name:'Entrar no portal',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Casa Aurora · prestação de contas simulada',exact:true})).toBeVisible();
 const response=await page.request.get(`${base}/api/client/projects/obra-local/statement?month=2026-11&format=json`);expect(response.status()).toBe(200);
 const report=(await response.json()).statement;
 expect(report.simulation).toBe(true);expect(report.recognized).toBe(10140);expect(report.cash).toMatchObject({opening:0,entries:12000,exits:3380,closing:8620});
 expect(report.charges.reduce((sum,row)=>sum+row.balance,0)).toBe(8000);expect(report.options).toMatchObject({equipment:false,fieldEngineering:false});
 expect(report.categories.find(row=>row.category==='terceirizado').recognized).toBe(3000);expect(report.categories.find(row=>row.category==='material').recognized).toBe(3680);
 const pdfResponse=await page.request.get(`${base}/api/client/projects/obra-local/statement?month=2026-11`);expect(pdfResponse.status()).toBe(200);const pdf=await pdfResponse.body();expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 await writeFile(`${output}/MARCELL-prestacao-contas-simulacao.pdf`,pdf);
 const email=await page.request.get(`${base}/api/client/projects/obra-local/statement?month=2026-11&format=email`);expect(email.status()).toBe(200);const eml=await email.text();expect(eml).toContain('X-Unsent: 1');expect(eml).toContain('From: financeiro@marcelleng.com.br');expect(eml).toContain('To: cliente@example.test');await writeFile(`${directory}/prestacao-contas-simulacao.eml`,eml);
 for(const invoice of report.invoices){expect(invoice.documents.length).toBeGreaterThan(0);const file=await page.request.get(`${base}${invoice.documents[0].url}`);expect(file.status()).toBe(200);expect((await file.body()).subarray(0,5).toString()).toBe('%PDF-');}
 const viewports=[];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const [route,title]of [['administracao-equipe','Administração e equipe'],['caixa','Caixa da obra'],['financeiro','Contrato e recebimentos'],['compras','Compras e notas fiscais']]){
   await page.goto(`${base}/cliente/obra/obra-local/${route}`);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(route==='caixa'){
    await page.getByRole('combobox',{name:'Tipo de movimentação'}).selectOption('out');await expect(page.getByText('Movimentos exibidos: 4',{exact:false})).toBeVisible();
    await expect(page.getByText('Abrir nota fiscal 3001',{exact:false})).toBeVisible();
    expect(await page.locator('[data-kind="out"]').count()).toBeGreaterThan(0);
   }
   if(route==='administracao-equipe'){
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar prestação de contas',exact:true}).click();await download;
    await expect(page.getByRole('status').filter({hasText:'PDF preparado'})).toBeVisible();
   }
   await page.screenshot({path:`${directory}/${route}-${width}.png`,fullPage:true});
   if(route==='administracao-equipe'&&width===1440)await page.screenshot({path:`${directory}/portal-preview.png`,fullPage:false});
   viewports.push({width,route,passed:true});
  }
 }
 const delivery=prepareStatementDelivery({report,recipient:{id:'cliente-ficticio',email:'cliente@example.test',whatsapp:'81999990000'},pdf});
 const journal={reserve:async(key,value)=>{try{await writeFile(`${directory}/delivery-${key}.json`,JSON.stringify(value),{flag:'wx'});return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},finish:async(key,value)=>writeFile(`${directory}/delivery-${key}.json`,JSON.stringify(value))};
 const first=await dispatchStatementDelivery({delivery,journal});const second=await dispatchStatementDelivery({delivery,journal});expect(second.every(row=>row.state==='already_attempted')).toBe(true);
 expect(errors).toEqual([]);expect(requests.filter(row=>row.method==='POST'&&!row.url.endsWith('/api/client/auth/login'))).toEqual([]);
 const result={viewports,recognized:report.recognized,categories:report.categories,workforce:report.workforce,administration:report.administration,passThrough:report.passThrough,cash:{...report.cash,movements:report.cash.movements.length},openCharges:delivery.outstanding,invoices:report.invoices.length,delivery:{first,second},pdfSha256:createHash('sha256').update(pdf).digest('hex'),realMessagesSent:0,realERPChanges:0,errors};
 await writeFile(`${directory}/verification.json`,JSON.stringify(result,null,2));await writeFile(`${directory}/statement.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
