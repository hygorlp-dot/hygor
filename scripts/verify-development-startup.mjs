// Verifica o servidor DEV utilizado na revisão, com contextos novos e sem
// gravações de negócio. A leitura antecipada da paleta é feita apenas na
// resposta HTTP interceptada no navegador: nenhum arquivo-fonte é revertido.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {profile} from './fixtures/workflow-priorities-data.mjs';

const target=new URL(process.argv[2]||'http://127.0.0.1:4198/');
if(target.protocol!=='http:'||!['127.0.0.1','localhost'].includes(target.hostname))throw new Error('Somente servidor local de revisão.');
const output='artifacts/initialization-debug';await mkdir(output,{recursive:true});
const browser=await chromium.launch();const report={target:target.href,scenarios:[]};
async function open(page,label){
 await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
 await search.fill(label);await search.locator('xpath=../..').getByRole('button',{name:`Tela ${label} abrir tela`,exact:true}).click();
 await expect(page.locator('main.arcd-main')).toBeVisible();await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
}
try{
 // Regressão: mesmo antecipando a tabela para o escopo do módulo, a paleta
 // independente deve estar inicializada, sem depender da ordem de LegacyApp.
 const baseline=await browser.newContext();let injected=0;
 await baseline.route('**/src/domains/obras/components/AditivosContrato.jsx*',async route=>{
  const response=await route.fetch();let code=await response.text();
  const declaration=code.match(/const COR\s*=\s*\{[^;]+;/)?.[0];
  if(!declaration)throw new Error('Tabela de cores não encontrada na transformação DEV.');
  code=declaration+'\n'+code.replace(declaration,'');injected++;
  await route.fulfill({response,body:code});
 });
 const broken=await baseline.newPage();await broken.goto(target.href,{waitUntil:'domcontentloaded'});
 await expect(broken.locator('#login-email')).toBeVisible({timeout:45000});
 await expect(broken.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
 expect(injected).toBeGreaterThan(0);await broken.screenshot({path:`${output}/eager-palette-safe.png`,fullPage:true});
 report.scenarios.push({eagerPalette:true,login:true,referenceNotReproduced:'ARCD-1KN9DO7'});await baseline.close();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
  const errors=[],writes=[];await context.route('https://**/*',route=>route.abort());
  await context.route('**/api/**',route=>{
   const action=route.request().postDataJSON()?.action;
   if(['save','save-sections','operational-command','financial-command','reconciliation-command'].includes(action)){
    writes.push(action);return route.fulfill({status:403,json:{ok:false,error:'Verificação de leitura.'}});
   }
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(target.href,{waitUntil:'domcontentloaded'});await expect(page.locator('#login-email')).toBeVisible({timeout:45000});
  await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('piloto-local');
  await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
  await expect(page.locator('main.arcd-main')).toBeVisible();
  await open(page,'Obras');
  await page.locator('main .works-card').first().getByRole('heading').click();
  await expect(page.getByRole('region',{name:'Mudanças e aditivos',exact:true})).toBeVisible();
  for(const screen of ['Gestão financeira','Central do administrador','Terceirizados'])await open(page,screen);
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('main.arcd-main')).toBeVisible();
  await expect(page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);expect(writes).toEqual([]);
  await page.screenshot({path:`${output}/verified-${width}.png`,fullPage:true});
  report.scenarios.push({width,login:true,amendmentsRendered:true,navigation:true,reload:true,errors,writes});await context.close();
 }
 await writeFile(`${output}/verified.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
