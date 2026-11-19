import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/daily-production-data.mjs';
import {data,accountingCsv} from '../scripts/fixtures/accounting-data.mjs';
import {ACCOUNTING_COMMAND,accountingErpComparison,applyAccountingCommand} from '../src/domains/financeiro/accounting-indicators.js';

const actor={actorId:profile.id,actorName:profile.nome,actorRole:'admin'};
const start='2026-10-01',end='2026-10-31',id='accounting-example-v1';
const draft=applyAccountingCommand(data,{...actor,type:ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED,expectedVersion:0,payload:{
 id,csv:accountingCsv,filename:'balancete-ficticio-outubro.csv',entity:data.config.companyName,
 document:'Balancete fictício de outubro/2026',note:'Base fictícia para conferência dos indicadores.',start,end,
}},'2026-11-02T15:00:00Z');
if(!draft.ok)throw new Error(draft.reason);
const reviewed=applyAccountingCommand(draft.data,{...actor,type:ACCOUNTING_COMMAND.ACCOUNTING_BASE_REVIEWED,expectedVersion:1,payload:{
 id,completeCoverage:true,erpFingerprint:accountingErpComparison(draft.data,start,end).fingerprint,
 reconciliationNote:'Exemplo fictício com receitas e despesas de toda a empresa.',
}},'2026-11-02T15:01:00Z');
if(!reviewed.ok)throw new Error(reviewed.reason);

async function prepare(page,width,mutations){
 await page.route('**/api/**',route=>{
  const request=route.request();
  const action=request.postData()?request.postDataJSON()?.action:undefined;
  if(/save|command|upsert|upload|delete/.test(action||'')){
   mutations.push(action);
   return route.fulfill({status:403,json:{ok:false}});
  }
  return route.fulfill({json:{ok:true,user:profile,usuario:profile,usuarios:[profile],data:reviewed.data,
   precisaSetup:false,accessToken:'report-test',refreshToken:'report-test',updatedAt:'2026-11-02T15:01:00Z',
   items:[],bases:[],presencas:[]}});
 });
 await page.clock.setFixedTime(new Date('2026-11-02T15:00:00Z'));await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:1000});await page.addInitScript(id=>sessionStorage.setItem(`arcd-section:${id}`,'fin'),profile.id);
 await page.goto('/');
 await page.locator('#login-email').fill(profile.email);
 const password=page.locator('#login-senha');
 await password.fill('piloto-local');
 await password.press('Enter');
 if(width<768)await page.getByRole('combobox',{name:'Áreas do financeiro',exact:true}).selectOption('previsoes');else{await page.getByText('Mais áreas',{exact:true}).click();await page.getByRole('button',{name:'Previsões gerenciais',exact:true}).click();}
 await page.getByLabel('Obra da previsão',{exact:true}).selectOption('all');await page.getByLabel('Data de referência da previsão',{exact:true}).fill('2026-11-02');
 if(width<768)await page.getByRole('combobox',{name:'Consulta de previsões',exact:true}).selectOption('accounting');else await page.getByRole('button',{name:'Indicadores contábeis',exact:true}).click();
}
for(const width of [1440,390])test(`prévia, cancelamento e PDF somente com MARCELL em ${width}px`,async({page},testInfo)=>{
 const errors=[],mutations=[];
 page.on('pageerror',error=>errors.push(error.message));
 await prepare(page,width,mutations);
 let popups=0;
 page.on('popup',()=>popups++);
 const docButton=page.getByRole('button',{name:'Preparar apresentação contábil / PDF',exact:true});
 const modal=page.getByRole('dialog',{name:'Identidade do relatório',exact:true});
 const generate=modal.getByRole('button',{name:'Gerar relatório',exact:true});

 await docButton.click();
 await expect(modal.getByRole('combobox')).toHaveCount(0);
 await expect(modal.getByRole('img',{name:'Logomarca MARCELL',exact:true})).toBeVisible();
 await expect(generate).toBeEnabled();
 await page.screenshot({path:testInfo.outputPath('previa-marcell.png')});
 await modal.getByRole('button',{name:'Ajuda',exact:true}).click();
 await expect(page.locator('.app-help-panel article')).toContainText('Relatórios · Identidade do documento');
 await page.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(modal).toBeHidden();
 expect(popups).toBe(0);
 await expect(page.getByLabel('Obra da previsão',{exact:true})).toHaveValue('all');

 await docButton.click();
 await expect(generate).toBeEnabled();
 const pending=page.waitForEvent('popup');
 await generate.click();
 const preview=await pending;
 await preview.waitForLoadState();
 await expect(preview.locator('body')).toHaveAttribute('data-report-identity','marcell');
 const logo=preview.locator('.mrc-report-logo');
 await expect(logo).toHaveAttribute('alt','MARCELL - Engenharia e construção');
 expect((await logo.boundingBox()).height).toBeLessThan(37);
 await expect(preview.locator('body')).toContainText('22,22%');
 await expect(preview.locator('body')).toContainText('120.000,00');
 const watermark=preview.locator('.mrc-report-watermark img');
 const logoSource=await logo.getAttribute('src');
 expect(logoSource).toMatch(/^data:image\//);
 await expect(watermark).toHaveAttribute('src',logoSource);
 await preview.pdf({path:testInfo.outputPath('contabil-marcell.pdf'),preferCSSPageSize:true,printBackground:true});
 await preview.close();
 expect(errors).toEqual([]);
 expect(mutations).toEqual([]);
 expect(popups).toBe(1);
});
