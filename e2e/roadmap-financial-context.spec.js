import {test,expect} from '@playwright/test';
import {data as fixture,profile} from '../scripts/fixtures/workflow-priorities-data.mjs';
import {buildFinancialLedger,selectDRE,selectCashFlow} from '../src/domains/financeiro/ledger.js';

const stamp=page=>page.getByTestId('work-context-stamp').locator('select');
async function enter(page,tab,{noFinance=false,noRevenue=false}={}){
 const data=structuredClone(fixture),user=noFinance?{...profile,role:'visualizador',accessTabs:['home']}:profile,errors=[],writes=[];
 data.usuarios=[user];
 data.obras=data.obras.slice(0,2).map(o=>({...o,hasCaixa:true}));
 data.obras.push({...data.obras[0],id:'without-cash',name:'Obra sem caixa',hasCaixa:false});
 data.caixaObra=[{id:'ca',obraId:'a',tipo:'aporte',valor:1000,data:'2026-11-01'},{id:'cb',obraId:'b',tipo:'aporte',valor:500,data:'2026-11-01'}];
 data.medicoes=noRevenue?[]:[...['a','b'].map((obraId,index)=>({id:`billing-${obraId}`,obraId,numero:`MED-${obraId}`,descricao:`Cobrança ${obraId}`,competencia:'2026-11',dataEmissao:'2026-11-01',dataVencimento:'2026-11-10',valorPrevisto:100*(index+1),recebido:false,...(!index?{valorRecebido:25,dataPagamento:'2026-11-12'}:{})})),{id:'settled',obraId:'a',descricao:'Cobrança já quitada',competencia:'2026-11',dataEmissao:'2026-11-01',dataVencimento:'2026-11-10',dataPagamento:'2026-11-12',valorPrevisto:90,valorRecebido:90,recebido:false},{id:'canceled',obraId:'a',descricao:'Cobrança cancelada',competencia:'2026-11',dataEmissao:'2026-11-01',dataVencimento:'2026-11-10',valorPrevisto:500,status:'cancelada'}];
 const before={dre:selectDRE(buildFinancialLedger(data),{competence:'2026-11'}),cash:selectCashFlow(buildFinancialLedger(data),{startDate:'2026-11-01',endDate:'2026-11-30'})};
 const fingerprint=JSON.stringify(data);
 await page.clock.setFixedTime(new Date('2026-11-16T12:00:00-03:00'));
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({tab,id})=>{sessionStorage.setItem(`arcd-section:${id}`,tab);localStorage.setItem('arcd-theme','marcell');},{tab,id:user.id});
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],presencas:[],bases:[],connected:false,obras:{},custoAte:'2026-10'}}));
 await page.route('**/api/data',r=>{
  const body=r.request().postDataJSON()||{};
  if(['save','save-sections','operational-command','financial-command'].includes(body.action)){writes.push(body.action);return r.fulfill({status:409,json:{ok:false,error:'Gravação bloqueada no teste local.'}});}
  return r.fulfill({json:{ok:true,usuarios:[user],usuario:user,precisaSetup:false,data,current:null,history:[],accessToken:'stage-two-local',refreshToken:'stage-two-local',updatedAt:'2026-11-16T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('stage-two-local');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
 return {data,before,check:()=>{expect(errors).toEqual([]);expect(writes).toEqual([]);expect(JSON.stringify(data)).toBe(fingerprint);expect({dre:selectDRE(buildFinancialLedger(data),{competence:'2026-11'}),cash:selectCashFlow(buildFinancialLedger(data),{startDate:'2026-11-01',endDate:'2026-11-30'})}).toEqual(before);}};
}
async function openScreen(page,label){
 await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(label);
 await search.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();
}
const fit=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

for(const width of [390,1440])test.describe(`${width}px`,()=>{
 test.use({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
 test('caixa segue a obra nos dois sentidos e não substitui obra sem caixa',async({page})=>{
  const app=await enter(page,'caixa');const cash=page.getByRole('combobox',{name:'Obra do caixa',exact:true});
  await expect(cash).toBeVisible();await stamp(page).selectOption('b');await expect(cash).toHaveValue('b');
  await expect(page.getByText('Saldo em caixa - '+app.data.obras[1].name,{exact:true})).toBeVisible();
  await cash.selectOption('a');await expect(stamp(page)).toHaveValue('a');
  await page.getByRole('button',{name:/Registrar aporte/,exact:false}).click();const modal=page.getByRole('dialog',{name:'Registrar aporte do cliente',exact:true});
  await expect(modal).toContainText(app.data.obras[0].name);await expect(modal).toContainText('somente neste caixa');
  await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  await stamp(page).selectOption('without-cash');await expect(cash).toHaveValue('without-cash');
  await expect(page.getByRole('heading',{name:'A obra em foco não possui caixa ativado',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Registrar aporte|Registrar gasto/})).toHaveCount(0);
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa2/caixa-sem-ativacao-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await cash.selectOption('b');await expect(stamp(page)).toHaveValue('b');
  await openScreen(page,'Gestão financeira');await expect(page.getByRole('heading',{name:'Financeiro',exact:true})).toBeVisible();
  await expect(page.locator('main').getByRole('combobox',{name:'Obra',exact:true})).toHaveValue('b');
  await page.locator('main').getByRole('combobox',{name:'Obra',exact:true}).selectOption('a');await expect(stamp(page)).toHaveValue('a');
  await page.getByRole('combobox',{name:'Movimentação',exact:true}).selectOption({label:'A receber'});
  await openScreen(page,'Caixa da obra');await expect(cash).toHaveValue('a');
  await openScreen(page,'Gestão financeira');await expect(page.getByRole('combobox',{name:'Movimentação',exact:true}).locator('option:checked')).toHaveText('A receber');
  await fit(page);app.check();
 });
 test('indicadores distinguem caixa de competência e levam o mês correto ao demonstrativo',async({page})=>{
  const app=await enter(page,'home');await expect(page.getByRole('heading',{name:'Visão gerencial',exact:true})).toBeVisible();
  await stamp(page).selectOption('b');await expect(page.getByRole('note').filter({hasText:'Escopo dos indicadores'})).toContainText('não filtra este painel');
  const cards=page.locator('#dashboard-indicators');const initial=await cards.locator('.dashboard-kpi__value').allTextContents();
  await stamp(page).selectOption('a');await expect(cards.locator('.dashboard-kpi__value')).toHaveText(initial);
  await expect(cards).toContainText('Entradas de caixa');await expect(cards).toContainText('Custos reconhecidos');await expect(cards).toContainText('Movimento líquido de caixa');
  await page.getByText('Como ler os indicadores',{exact:true}).click();await expect(page.getByRole('note').filter({hasText:'Movimento de caixa:'})).toContainText('não é o saldo acumulado');
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa2/dashboard-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Mês anterior',exact:true}).click();await cards.getByRole('button',{name:/^Custos reconhecidos/}).click();
  await expect(page.getByRole('heading',{name:'DRE Gerencial',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Mês',exact:true})).toHaveValue('9');await expect(page.getByRole('combobox',{name:'Ano',exact:true})).toHaveValue('2026');
  await expect(stamp(page)).toHaveValue('a');await expect(page.getByRole('note').filter({hasText:'Escopo do demonstrativo'})).toContainText('Obra em foco não filtra');
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa2/dre-mes-vinculado-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button').click();
  await expect(page.getByRole('heading',{name:'Visão gerencial',exact:true})).toBeVisible();await expect(page.getByRole('group',{name:'Competência dos indicadores'})).toContainText('Outubro 2026');
  await fit(page);app.check();
 });
 test('fila de cobranças e ranking identificam seu escopo geral',async({page})=>{
  const app=await enter(page,'medicoes');await expect(page.getByRole('combobox',{name:'Obra das medições',exact:true})).toBeVisible();await stamp(page).selectOption('b');
  const queue=page.locator('summary').filter({hasText:'Cobranças próximas e vencidas'});await expect(queue).toContainText('Todas as obras disponíveis');await queue.click();
  const expanded=queue.locator('..');await expect(expanded).toContainText('Cobrança a');await expect(expanded).toContainText('Cobrança b');await expect(expanded).not.toContainText('Cobrança já quitada');await expect(expanded).not.toContainText('Cobrança cancelada');await expect(queue).toContainText('275,00');
  await queue.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa2/cobrancas-saldos-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await expanded.getByRole('button',{name:'Registrar recebimento',exact:true}).first().click();const modal=page.getByRole('dialog',{name:'Confirmar recebimento',exact:true});await expect(modal).toContainText(app.data.obras[0].name);await expect(modal).toContainText('75,00');await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  await openScreen(page,'Conferência');await expect(page.getByRole('note').filter({hasText:'Escopo do ranking'})).toContainText('não filtra este ranking');
  await expect(page.locator('main').getByRole('combobox',{name:'Obra',exact:true})).toHaveValue('b');
  await page.screenshot({path:`artifacts/roadmap-usabilidade-etapa2/ranking-${process.env.ROADMAP_MODE||'dev'}-${width}.png`,animations:'disabled'});
  await fit(page);app.check();
 });
 test('sem faturamento não há percentual enganoso e sem acesso financeiro não há explicação monetária',async({page})=>{
  const app=await enter(page,'home',{noRevenue:true});await expect(page.getByRole('heading',{name:'Visão gerencial',exact:true})).toBeVisible();
  await expect(page.locator('#dashboard-indicators')).toContainText('Sem faturamento positivo; percentual não se aplica');app.check();await fit(page);
 });
 test('o perfil sem DRE não ganha acesso aos dados pela explicação dos indicadores',async({page})=>{
  const app=await enter(page,'home',{noFinance:true});await expect(page.getByRole('heading',{name:'Visão gerencial',exact:true})).toBeVisible();
  await expect(page.getByText('Como ler os indicadores',{exact:true})).toHaveCount(0);await expect(page.getByText('Custos reconhecidos',{exact:true})).toHaveCount(0);app.check();await fit(page);
 });
});
