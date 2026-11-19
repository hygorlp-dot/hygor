import {test,expect} from '@playwright/test';
import {profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {buildRequestedDreProjectionRows} from '../server/dre-projection.js';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

const expenses={despesasEmpresa:[{id:'qa-expense',categoria:'outros',descricao:'Despesa de teste',data:'2026-11-18',valor:25}]};
const current=buildRequestedDreProjectionRows(expenses,[{year:2026,month:10,period:'mes',scope:'company_dre',includeMemorial:true}])[0].payload;
const report={
 ok:true,engineEnforced:true,activationGate:{ready:false,checks:[{code:'dre_divergence',ok:false}]},
 divergenciasDRE:[
  {sourceId:'2026-11:q1:a',kind:'not_materialized',expected:'Projeção ativa',canonical:'Ausente'},
  {sourceId:'2026-11:mes:a',kind:'value',path:'totalCSP',expected:100,canonical:120,difference:20},
 ],
};
const views=[[390,'marcell'],[390,'noite'],[1440,'marcell'],[1440,'noite']];
for(const [width,theme] of views){
 test(`DRE e Homologação · ${width} · ${theme}`,async({page},info)=>{
  const errors=[],writes=[],origin=new URL(info.project.use.baseURL).origin;
  page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:00-03:00'));
  await page.addInitScript(({id,theme})=>{
   sessionStorage.setItem(`arcd-section:${id}`,'dre_emp');
   localStorage.setItem('arcd-theme',theme);
  },{id:profile.id,theme});
  await page.route('https://**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[]}}));
  await page.route('**/api/data',route=>{
   const {action}=route.request().postDataJSON()||{};
   if(action==='financial-company-dre-report')return route.fulfill({json:{ok:true,source:'canonical_ledger',current}});
   if(action==='financial-shadow-report')return route.fulfill({json:report});
   if(!['auth-login','auth-refresh','load','profiles'].includes(action)){
    writes.push(action);
    return route.fulfill({status:403,json:{ok:false}});
   }
   const data={...expenses,obras:[{id:'a',name:'Obra de teste'}],usuarios:[profile]};
   return route.fulfill({json:{ok:true,data,usuario:profile,usuarios:[profile],accessToken:'local-only',refreshToken:'local-only',updatedAt:'2026-11-21T12:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(profile.email);
  await page.locator('#login-senha').fill('somente-local');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  if(width===390)await page.getByRole('combobox',{name:'Selecionar visão',exact:true}).selectOption({label:'Demonstrativo'});
  else await page.getByRole('button',{name:'Demonstrativo',exact:true}).click();
  await expect(page.getByText('Não aplicável',{exact:true})).toHaveCount(3);
  expect(current.lucroLiquido).toBe(-25);
  await page.getByRole('button',{name:/Consultar memorial: .*Outr/i}).last().click();
  const memorial=page.getByRole('dialog');
  await expect(memorial).toContainText('25,00');
  await memorial.getByRole('button',{name:'Fechar memorial',exact:true}).click();
  await page.screenshot({path:info.outputPath('dre-margem.png')});
  await page.getByRole('button',{name:'Exportar PDF',exact:true}).click();
  const [preview]=await Promise.all([
   page.waitForEvent('popup'),
   page.getByRole('button',{name:'Gerar relatório',exact:true}).click(),
  ]);
  await expect(preview.locator('tr.result.liq')).toContainText('25,00');
  await expect(preview.locator('tr.result.liq')).toContainText('Não aplicável');
  await preview.close();
  if(width===390){
   await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();
   await page.getByRole('combobox',{name:'Telas de Financeiro',exact:true}).selectOption({label:'Gestão financeira'});
  }else{
   const financial=page.getByRole('button',{name:'Gestão financeira',exact:true});
   if(!await financial.isVisible())await page.getByRole('button',{name:/^Financeiro/}).click();
   await financial.click();
  }
  await selectWorkspaceArea(page,'Áreas do financeiro','Homologação');
  const results=page.getByRole('region',{name:'Resultado da homologação financeira'});
  await results.getByRole('combobox',{name:'Grupo da conferência'}).selectOption('dre');
  const diagnosis=results.getByRole('combobox',{name:'Diagnóstico da projeção'});
  await diagnosis.selectOption('not_materialized');
  await expect(results.getByRole('heading',{name:/Projeção não materializada/})).toBeVisible();
  await expect(results.getByRole('heading',{name:/Valor divergente/})).toHaveCount(0);
  await diagnosis.selectOption('value');
  await expect(results.getByRole('heading',{name:/Valor divergente/})).toBeVisible();
  await expect(results.getByText('Conferir:',{exact:true}).locator('..')).toContainText('totalCSP');
  await results.getByText(/Diagnóstico do DRE · 2 escopos/).click();
  await expect(results.getByText('Projeção não materializada',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('homologacao-dre.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
 });
}
