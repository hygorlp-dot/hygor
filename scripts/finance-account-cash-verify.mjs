import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {openFinanceModule,selectFinanceArea} from './finance-browser-navigation.mjs';
const user={id:'cash-qa',nome:'Caixa QA',email:'cash@local.test',role:'admin',active:true};
const data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'work',name:'Obra QA',status:'active'}],employees:[],attendance:{},
 contasBancarias:[{id:'a',nome:'Banco Alfa QA',saldoInicial:100},{id:'b',nome:'Banco Beta QA'}],
 transacoes:[{id:'partial',contaBancariaId:'a',data:'2026-10-15',valor:-20,status:'parcial',descricao:'PIX parcial QA',obraId:'work'},
 {id:'ignored',contaBancariaId:'a',data:'2026-10-20',valor:-5,status:'ignorado',descricao:'Tarifa QA'},
 {id:'future',contaBancariaId:'a',data:'2026-11-01',valor:999,status:'pendente',descricao:'Futuro QA'},
 {id:'other',contaBancariaId:'b',data:'2026-10-20',valor:999,status:'pendente',descricao:'Outra conta QA'}]};
const browser=await chromium.launch({headless:true}),passed=[],errors=[];
const output='artifacts/financeiro/caixa-por-conta';await mkdir(output,{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});let writes=0;
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-31T12:00:00-03:00'));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',route=>{let body={};try{body=route.request().postDataJSON()||{};}catch{}
  if(['financial-command','operational-command','save','save-sections'].includes(body.action))writes++;
  return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated-cash',refreshToken:'isolated-cash',usuario:user,data:structuredClone(data),updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto(process.argv[2]||'http://127.0.0.1:4192');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await openFinanceModule(page);await selectFinanceArea(page,'Caixa por conta');
 const forecast=page.locator('.cash-workspace'),selector=forecast.getByRole('combobox',{name:'Conta bancária do caixa'});
 await selector.selectOption('a');const panel=forecast.locator('.account-cash');
 await expect(panel.getByText('Posição ainda não calculada',{exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Usar valor cadastrado como abertura'}).click();await panel.getByLabel('Data de abertura',{exact:true}).fill('2026-10-01');
 await expect(panel.getByText(/Posição calculada: R\$\s75,00/)).toBeVisible();
 await expect(panel.getByRole('button',{name:'Pendentes de conciliação: 1',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Pendentes de conciliação: 1',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('PIX parcial QA');await expect(dialog).not.toContainText('Outra conta QA');await expect(dialog).not.toContainText('Futuro QA');await expect(dialog).toContainText('31/10/2026');await page.keyboard.press('Escape');
 await expect(panel.getByLabel('Saldo de abertura da conta (R$)')).toHaveValue('100');
 await panel.getByLabel('Data de referência do caixa').fill('2026-10-10');await expect(panel.getByText(/Posição calculada: R\$\s100,00/)).toBeVisible();await expect(panel.getByRole('button',{name:'Pendentes de conciliação: 0',exact:true})).toBeVisible();
 await selector.selectOption('b');await expect(panel.getByLabel('Saldo de abertura da conta (R$)')).toHaveValue('');
 await selector.selectOption('a');await expect(panel.getByLabel('Data de referência do caixa')).toHaveValue('2026-10-10');
 await panel.getByLabel('Data de referência do caixa').fill('2026-10-31');
 await panel.getByRole('button',{name:'Ignorados: 1',exact:true}).click();await expect(dialog).toContainText('Tarifa QA');await page.keyboard.press('Escape');
 await selectFinanceArea(page,'Hoje');await selectFinanceArea(page,'Caixa por conta');await expect(panel.getByLabel('Saldo de abertura da conta (R$)')).toHaveValue('100');
 await expect(forecast.getByText(/Menor saldo previsto:/)).toHaveCount(0);
 await panel.scrollIntoViewIfNeeded();await panel.screenshot({path:`${output}/caixa-${width}.png`,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(writes).toBe(0);
 passed.push(`${width}: abertura explícita, corte por data, conta isolada, parcial/ignorado no memorial, retorno preservado e nenhuma gravação`);
 await page.close();
}expect(errors).toEqual([]);await writeFile(`${output}/verificacao.json`,JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors},null,2));}finally{await browser.close();}
