import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';

for(const width of [390,1440])for(const theme of ['marcell','noite'])test.describe(`${width} px · ${theme}`,()=>{
 test.use({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
 test('mostra detalhes estruturados no histórico e mantém a busca',async({page,baseURL},info)=>{
  const data={...structuredClone(fixture),usuarios:[profile],transacoes:[],historicoConc:[
   {id:'history-1',acao:'lancamento_criado',descricao:'Aporte de teste',valor:50,detalhes:[{tipo:'caixaObra',id:'caixa-qa',entidadeId:'origem-qa'}]},
   {id:'history-2',acao:'conciliacao_confirmada',descricao:'Conciliação de teste',detalhes:{conciliacaoId:'vinculo-qa'}},
   {id:'history-3',acao:'extrato_arquivado',descricao:'Extrato de teste',detalhes:'Documento original preservado.'},
  ].map(item=>({...item,operador:'Operador de teste',criadoEm:'2026-11-19T12:00:00-03:00'}))};
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({id,theme})=>{sessionStorage.setItem(`arcd-section:${id}`,'conc');localStorage.setItem('arcd-theme',theme);},{id:profile.id,theme});
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(baseURL).origin&&['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],presencas:[],bases:[],obras:{}}}));
  await page.route('**/api/data',route=>{
   const {action}=route.request().postDataJSON()||{};
   if(!['auth-login','auth-refresh','profiles','load','obras-custo-acumulado'].includes(action)){writes.push(action);return route.fulfill({status:403,json:{ok:false}});}
   return route.fulfill({json:{ok:true,usuario:profile,usuarios:[profile],data,accessToken:'local-test',refreshToken:'local-test',updatedAt:'2026-11-19T15:00:00Z'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill(profile.email);
  await page.locator('#login-senha').fill('somente-teste');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await page.getByText('Mais opções · extratos, regras e histórico',{exact:true}).click();
  const support=page.locator('details.reconciliation-support');
  if(width===390)await support.getByRole('combobox',{name:'Selecionar visão'}).selectOption({label:'Histórico'});
  else await support.getByRole('button',{name:'Histórico',exact:true}).click();
  await expect(page.getByRole('cell',{name:/Caixa da obra.*caixa-qa.*origem-qa/})).toBeVisible();
  await expect(page.getByRole('cell',{name:/Conciliação.*vinculo-qa/})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Documento original preservado.'})).toBeVisible();
  await page.getByRole('textbox',{name:'Buscar na conciliação'}).fill('origem-qa');
  await expect(page.getByRole('cell',{name:'Aporte de teste'})).toBeVisible();
  await expect(page.getByRole('cell',{name:'Conciliação de teste'})).toHaveCount(0);
  const details=page.getByRole('cell',{name:/Caixa da obra.*caixa-qa.*origem-qa/});
  await details.scrollIntoViewIfNeeded();
  await expect(details).toBeInViewport();
  await page.screenshot({path:info.outputPath('historico.png'),animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
 });
});
