import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
const user={id:'local-nav-qa',nome:'QA',email:'qa@local.test',role:'admin',active:true};
const fixture={usuarios:[user],config:{},obras:[],employees:[],attendance:{},contasBancarias:[{id:'qa',nome:'Conta QA'}]};
const browser=await chromium.launch({headless:true}),checks=[];
const output=new URL('../artifacts/financeiro/css-local/',import.meta.url);
await mkdir(output,{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let final=null,writes=0;
 await page.route('https://**/*',route=>route.abort());
 await page.route('http://127.0.0.1:4203/**',route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.phase==='account-cash-open')final=body;}
  return route.fulfill({json:{},headers:{'access-control-allow-origin':'http://127.0.0.1:4192','access-control-allow-headers':'content-type'}});
 });
 await page.route('**/api/**',route=>{
  const body=route.request().postDataJSON()||{};
  if(['save','save-sections','financial-command','operational-command'].includes(body.action))writes++;
  return route.fulfill({json:body.action==='status'?{ok:true,connected:true,localReview:true,readOnly:true}:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(fixture),updatedAt:new Date().toISOString()}});
 });
 await page.goto('http://127.0.0.1:4192/?local-review=account-cash');
 await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 try{await expect(page.getByLabel('Saldo de abertura da conta (R$)',{exact:true})).toBeVisible({timeout:15000});}catch(error){console.log(JSON.stringify({width,final,selects:await page.locator('.cash-forecast select').evaluateAll(elements=>elements.map(element=>({label:element.getAttribute('aria-label'),value:element.value,options:[...element.options].map(option=>({value:option.value,label:option.textContent}))})))}));throw error;}
 await expect.poll(()=>final,{timeout:5000}).not.toBeNull();expect(final.oneDriveConnected).toBe(true);expect(writes).toBe(0);
 await expect(page.getByLabel('Saldo de abertura da conta (R$)',{exact:true})).toHaveValue('');
 let reloads=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())reloads++;});
 const sentinel=new URL(`watch-sentinel-${width}.html`,output);
 try{await writeFile(sentinel,'<div class="z-[9876]">Artefato de verificação local</div>');await new Promise(resolve=>setTimeout(resolve,750));expect(reloads).toBe(0);}finally{await unlink(sentinel);}
 checks.push({width,autoNavigation:true,noArtifactReload:true,writes});await page.close();
}await writeFile(new URL('verification.json',output),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));}finally{await browser.close();}
