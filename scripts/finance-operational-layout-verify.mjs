import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {openFinanceModule,selectFinanceArea} from './finance-browser-navigation.mjs';
const user={id:'layout-qa',nome:'Financeiro QA',email:'layout@local.test',role:'admin',active:true};
const data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'a',name:'Obra Alfa QA',status:'active'},{id:'b',name:'Obra Beta QA',status:'active'}],employees:[],attendance:{},
 contasBancarias:[{id:'bank-a',nome:'Conta Alfa QA'},{id:'bank-b',nome:'Conta Beta QA'}],
 notasFiscais:[{id:'nf',obraId:'a',numero:'123',status:'aprovada',emissao:'2026-10-01',vencimento:'2026-10-30',valorBruto:50,valorLiquido:50,contaBancariaId:'bank-b'}],
 medicoes:[...['bank-a','bank-b',''].map((account,index)=>({id:`m-${index}`,obraId:'a',descricao:`Medição QA ${index}`,competencia:'2026-10',dataEmissao:'2026-10-01',dataVencimento:`2026-11-0${index+1}`,valorPrevisto:(index+1)*100,contaBancariaId:account,recebimentos:[]}))]};
const browser=await chromium.launch({headless:true}),passed=[],errors=[];
const output='artifacts/financeiro/layout-operacional';await mkdir(output,{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let writes=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-31T12:00:00-03:00'));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',route=>{let body={};try{body=route.request().postDataJSON()||{};}catch{}
  if(['financial-command','operational-command','save','save-sections'].includes(body.action))writes++;
  return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated-layout',refreshToken:'isolated-layout',usuario:user,data:structuredClone(data),updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto(process.argv[2]||'http://127.0.0.1:4192');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await openFinanceModule(page);
 await expect(page.getByText('Nenhum título em pagar hoje para esta obra.')).toBeVisible();
 await page.getByRole('button',{name:'Conferir vencidos',exact:true}).click();await expect(page.getByRole('heading',{name:'Vencidos',exact:true})).toBeVisible();
 passed.push(`${width}: Hoje vazio oferece vencidos sem mudar a fila automaticamente`);
 await selectFinanceArea(page,'Visão financeira');const forecast=page.locator('.cash-forecast');
 await expect(forecast.getByText('Saldo inicial não confirmado para este recorte',{exact:true})).toBeVisible();
 await expect(forecast.getByText(/Menor saldo previsto:/)).toHaveCount(0);
 await forecast.screenshot({path:`${output}/saldo-nao-informado-${width}.png`,animations:'disabled'});
 await forecast.getByRole('button',{name:'Simular com saldo inicial zero',exact:true}).click();
 await expect(forecast.getByText(/Saldo inicial hipotético:/)).toBeVisible();
 await forecast.getByRole('combobox',{name:'Conta prevista dos títulos'}).selectOption('bank-a');
 await expect(forecast.getByText(/Menor saldo previsto:/)).toHaveCount(0);
 await expect(forecast.getByLabel('Saldo inicial da simulação (R$)')).toHaveValue('0');
 await forecast.getByRole('button',{name:'Confirmar saldo informado neste recorte'}).click();
 await expect(forecast.getByText(/Menor saldo previsto:/)).toBeVisible();
 await expect(forecast.getByRole('button',{name:/Ver \d+ título/})).toHaveCount(1);
 await forecast.getByRole('button',{name:'Ver 1 título(s)',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Medição QA 0');await expect(page.getByRole('dialog')).not.toContainText('Medição QA 1');await page.keyboard.press('Escape');
 await forecast.getByRole('button',{name:'Sem conta prevista: 1',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Medição QA 2');await expect(page.getByRole('dialog')).toContainText('saldo inicial não aplicado a esta consulta');await page.keyboard.press('Escape');
 passed.push(`${width}: saldo ausente, zero explícito, nova confirmação por conta e memorial sem inferência bancária`);
 await selectFinanceArea(page,'Relatórios financeiros');const reports=page.locator('.financial-reports');
 await expect(reports.locator('.financial-reports__options')).not.toHaveAttribute('open');
 const totalBox=await reports.locator('.financial-reports__totals').boundingBox();expect(totalBox.y).toBeLessThan(1000);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/relatorios-${width}.png`,animations:'disabled'});
 await reports.locator('.financial-reports__options summary').click();
 await reports.getByLabel('Pesquisar lançamento, contraparte ou documento',{exact:true}).fill('Medição QA 0');
 await reports.locator('.financial-reports__options summary').click();
 await expect(reports.getByRole('button',{name:'Remover filtro Busca: Medição QA 0',exact:true})).toBeVisible();
 await reports.getByRole('button',{name:'Remover filtro Busca: Medição QA 0',exact:true}).click();
 await expect(reports.getByLabel('Pesquisar lançamento, contraparte ou documento',{exact:true})).toHaveValue('');
 passed.push(`${width}: filtros recolhidos, resultado cedo e remoção individual sem perder o recorte`);
 await selectFinanceArea(page,'Fechamento');
 const pending=page.getByRole('heading',{name:'Pendências para conferência do fechamento',exact:true}),close=page.getByRole('button',{name:'Fechar competência',exact:true});
 const follows=await close.evaluate((button)=>Boolean(document.querySelector('#closing-pending-heading').compareDocumentPosition(button)&Node.DOCUMENT_POSITION_FOLLOWING));expect(follows).toBe(true);
 await expect(page.getByText('Competência a fechar:',{exact:false})).toContainText('2026-10');
 await page.screenshot({path:`${output}/fechamento-${width}.png`,animations:'disabled'});
 expect(await pending.count()).toBe(1);expect(writes).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 passed.push(`${width}: competência e conferência precedem fechamento; nenhuma gravação`);
 await page.close();
}expect(errors).toEqual([]);await writeFile(`${output}/verificacao.json`,JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors},null,2));}finally{await browser.close();}
