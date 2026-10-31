import {chromium,expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea} from './finance-browser-navigation.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const user={id:'document-link-qa',nome:'Documentos QA',email:'document-links@local.test',role:'admin',active:true};
const stored='/api/microsoft/onedrive?action=file&driveId=drive&itemId=original&sig=expired';
const fresh=stored.replace('expired','fresh');
const data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'work',name:'Obra QA',oneDriveDriveId:'drive'}],employees:[],attendance:{},notasFiscais:[{id:'nf',obraId:'work',numero:'123',status:'recebida',emissao:'2026-10-30',valorBruto:100,documentos:[{nome:'Original QA',url:stored}]}]};
const browser=await chromium.launch({headless:true}),passed=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  let missing=false,renewals=0,writes=0;
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());let body={};try{body=req.postDataJSON()||{};}catch{}
   if(url.pathname==='/api/microsoft/onedrive'){
    if(body.action==='file-link'){renewals++;expect(body.driveId).toBe('drive');expect(body.itemId).toBe('original');return route.fulfill(missing?{status:404,json:{error:'Original ausente'}}:{json:{ok:true,url:fresh}});}
    if(req.method()==='GET')return route.fulfill({status:url.searchParams.get('sig')==='fresh'?200:403,contentType:'text/plain',body:'ORIGINAL QA - leitura local'});
   }
   if(['save','save-sections','financial-command','operational-command','upload'].includes(body.action))writes++;
   return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(data),updatedAt:'2026-10-30T15:00:00Z'}});
  });
  await page.goto(process.argv[2]||'http://127.0.0.1:4192');
  await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await openFinanceModule(page);await selectFinanceArea(page,'Documentos');
  await page.getByLabel('Competência ou mês de emissão',{exact:true}).fill('');
  await page.getByRole('button',{name:'Conferir documentos',exact:true}).click();
  const central=page.getByRole('complementary',{name:'Documento e dados para conferência'});
  const openOriginal=async locator=>{
   const popupPromise=page.waitForEvent('popup');await locator.click();const popup=await popupPromise;
   await expect(popup.locator('body')).toContainText('ORIGINAL QA');expect(popup.url()).toContain('sig=fresh');await popup.close();
  };
  await openOriginal(central.getByRole('link',{name:/Original QA/}));
  passed.push(`${width}: central renova link vencido e abre original`);
  await page.getByRole('button',{name:'Ver memorial',exact:true}).click();
  const memorial=page.getByRole('dialog');
  const entry=memorial.locator('details.dre-memorial__entry').first();
  if(!await entry.getAttribute('open')&&await entry.getAttribute('open')!== '')await entry.locator('summary').first().click();
  await openOriginal(memorial.getByRole('link',{name:/Original QA/}).first());
  passed.push(`${width}: memorial usa a mesma autorização do original`);
  missing=true;
  await memorial.getByRole('link',{name:/Original QA/}).first().click();
  await expect(memorial.getByRole('alert')).toContainText('Original não encontrado no OneDrive');
  await expect(memorial).toBeVisible();expect(writes).toBe(0);expect(renewals).toBe(3);
  await mkdir('artifacts/financeiro',{recursive:true});
  await memorial.screenshot({path:`artifacts/financeiro/onedrive-original-ausente-${width}.png`,animations:'disabled'});
  passed.push(`${width}: original ausente mantém memorial e não altera dados`);
  await context.close();
 }
 await writeFile('artifacts/financeiro/onedrive-links-browser.json',JSON.stringify({passed},null,2));console.log(JSON.stringify({passed},null,2));
}finally{await browser.close();}
