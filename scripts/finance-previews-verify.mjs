import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {applyExpenseCommand} from '../src/domains/financeiro/expense-commands.js';
import {applyBankTransactionCommand} from '../src/domains/conciliacao/transaction-commands.js';

const user={id:'preview-qa',nome:'Prévia QA',email:'preview@local.test',role:'admin',active:true};
const source={competencia:'2026-09',categoria:'software',fornecedor:'Loja QA',valor:120,recorrente:true,vencimento:'2026-09-30',status:'ativo',version:1};
const key='26261012345678000190550010000045671000045675';
const xml=await readFile('src/domains/compras/__fixtures__/nfe-teste.xml','utf8');
const freshXml=xml.replaceAll(key,'26261012345678000190550010000045681000045680').replace('<nNF>4567</nNF>','<nNF>4568</nNF>');
const invoice={obraId:'a',tipo:'nfe',status:'recebida',emissao:'2026-10-30',valorBruto:200,valorLiquido:200,documentos:[],pagamentos:[]};
const fixture={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'a',name:'Obra Alfa QA',status:'active'}],employees:[],attendance:{},fornecedores:[{id:'supplier',nome:'Casa dos Materiais',cnpj:'12.345.678/0001-90'}],
 despesasEmpresa:[{...source,id:'a',descricao:'Software existente'},{...source,id:'target',descricao:'Software existente',competencia:'2026-10'},{...source,id:'b',descricao:'Internet QA',pago:true,dataPagamento:'2026-09-30',documentos:[{id:'old'}]},{...source,id:'c',descricao:'Internet QA'},{...source,id:'d',descricao:'Aluguel QA',valor:500}],
 notasFiscais:[{...invoice,id:'draft',numero:'RASC',fornecedorNome:'Digitado'},{...invoice,id:'existing',numero:'4567',serie:'1',chave:key,documentoFornecedor:'12345678000190'}],
 transacoes:[{id:'stored',data:'2026-10-30',descricao:'Existente',valor:-100,chave:'fit:existing',status:'pendente'}],extratos:[],historicoConc:[]};
const ofx='<OFX><BANKID>001</BANKID><ACCTID>123</ACCTID>'+[['existing','Existente'],['new','Movimento novo'],['new','Movimento novo']].map(([fitid,description])=>`<STMTTRN><DTPOSTED>20261030120000</DTPOSTED><TRNAMT>-100</TRNAMT><FITID>${fitid}</FITID><MEMO>${description}</MEMO></STMTTRN>`).join('')+'</OFX>';
const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Extrato');
sheet.addRows([['Data','Descrição','Valor'],['30/10/2026','Válida','10,00'],['31/02/2026','Inválida','20,00']]);
const invalidSheet=Buffer.from(await book.xlsx.writeBuffer());
const browser=await chromium.launch({headless:true}),passed=[],errors=[];
await mkdir('artifacts/financeiro',{recursive:true});
try{for(const width of [1440,390]){
 let data=structuredClone(fixture),expenseWrites=0,bankWrites=0;
 const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
 await page.route('**/api/**',route=>{
  let body={};try{body=route.request().postDataJSON()||{}}catch{}
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==='financial-company-dre-report')return route.fulfill({json:{ok:true,current:null,history:[]}});
  if(body.action==='operational-command'){
   const expense=applyExpenseCommand(data,body.command,'2026-10-30T15:00:00Z');
   const result=expense||applyBankTransactionCommand(data,{...body.command,actorId:user.id,actorName:user.nome},'2026-10-30T15:00:00Z');
   if(expense)expenseWrites++;else bankWrites++;
   if(result?.ok)data=result.data;
   return route.fulfill({json:{...result,updatedAt:new Date().toISOString()}});
  }
  return route.fulfill({json:{ok:true,items:[],bases:[],accessToken:'isolated',refreshToken:'isolated',usuario:user,data:structuredClone(data),updatedAt:'2026-10-30T15:00:00Z'}});
 });
 await page.goto(process.argv[2]||'http://127.0.0.1:4185');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 if(width<1100){await page.getByRole('button',{name:'Abrir Visão gerencial',exact:true}).click();await page.locator('.mobile-subnav').getByRole('button',{name:'DRE empresa',exact:true}).click();}
 else{const group=page.locator('.arcd-sidebar .nav-grp-hd').filter({hasText:/^Visão gerencial/}),body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");await expect(group).toBeVisible();if(!await body.isVisible())await group.click();await body.locator('.nav-item').filter({hasText:/^DRE empresa$/}).click();}
 await page.getByRole('button',{name:'Despesas operacionais',exact:true}).click();
 await page.getByRole('button',{name:'Replicar',exact:true}).click();
 let preview=page.getByRole('dialog',{name:'Prévia de despesas recorrentes',exact:true});
 await expect(preview.getByRole('checkbox',{name:'Copiar Software existente',exact:true})).toBeDisabled();
 await expect(preview.getByRole('checkbox',{name:'Copiar Internet QA',exact:true}).nth(1)).toBeDisabled();
 await preview.getByRole('checkbox',{name:'Copiar Aluguel QA',exact:true}).uncheck();
 expect(expenseWrites).toBe(0);
 await page.screenshot({animations:'disabled',path:`artifacts/financeiro/previa-recorrencias-${width}.png`});
 await preview.getByRole('button',{name:'Cancelar prévia',exact:true}).click();expect(expenseWrites).toBe(0);
 await page.getByRole('button',{name:'Replicar',exact:true}).click();
 await preview.getByRole('checkbox',{name:'Copiar Aluguel QA',exact:true}).uncheck();
 await preview.getByRole('button',{name:'Confirmar 1 recorrência(s)',exact:true}).click();
 await expect(preview).toHaveCount(0);expect(expenseWrites).toBe(1);
 expect(data.despesasEmpresa.at(-1)).toMatchObject({descricao:'Internet QA',competencia:'2026-10',pago:false,vencimento:'2026-10-30',documentos:[]});
 console.log(`${width}: recorrência validada`);passed.push(`${width}: recorrência selecionada, duplicidades bloqueadas, cancelamento e confirmação`);
 if(width<1100){await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();await page.locator('.mobile-subnav').getByRole('button',{name:'Conciliação',exact:true}).click();}
 else{await page.getByRole('button',{name:'Financeiro ›',exact:true}).click();await page.getByRole('button',{name:'Conciliação',exact:true}).click();}
 const bankFile=page.locator('input[type=file][accept=".ofx,.qfx,.csv,.xlsx,.xls"]');
 const statement={name:'extrato.ofx',mimeType:'application/x-ofx',buffer:Buffer.from(ofx)};
 await bankFile.setInputFiles(statement);
 preview=page.getByRole('dialog',{name:'Prévia da importação do extrato',exact:true});
 await expect(preview).toContainText('1 novo(s) · 2 duplicado(s)');expect(bankWrites).toBe(0);
 await page.screenshot({animations:'disabled',path:`artifacts/financeiro/previa-extrato-${width}.png`});
 await preview.getByRole('button',{name:'Cancelar prévia',exact:true}).click();expect(bankWrites).toBe(0);
 await bankFile.setInputFiles(statement);await preview.getByRole('button',{name:'Importar 1 novo(s) movimento(s)',exact:true}).click();
 await expect(preview).toHaveCount(0);expect(bankWrites).toBe(1);expect(data.transacoes).toHaveLength(2);
 await bankFile.setInputFiles(statement);await expect(preview.getByRole('button',{name:'Importar 0 novo(s) movimento(s)',exact:true})).toBeDisabled();await preview.getByRole('button',{name:'Cancelar prévia',exact:true}).click();
 await bankFile.setInputFiles({name:'invalido.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:invalidSheet});
 await expect(preview).toContainText('1 linha(s) inválida(s)');await expect(preview.getByRole('button',{name:/Importar .*novo/})).toBeDisabled();expect(bankWrites).toBe(1);await preview.getByRole('button',{name:'Cancelar prévia',exact:true}).click();
 console.log(`${width}: extrato validado`);passed.push(`${width}: extrato não grava antes de confirmar, reimportação e linha inválida`);
 if(width<1100){await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();await page.locator('.mobile-subnav').getByRole('button',{name:'Gestão financeira',exact:true}).click();}else await page.getByRole('button',{name:'Gestão financeira',exact:true}).click();
 await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:'Documentos',exact:true}).click();
 await page.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill('RASC');await page.getByRole('button',{name:'Abrir ficha fiscal',exact:true}).click();
 const fiscal=page.getByRole('dialog',{name:'Conferir nota RASC',exact:true});
 const xmlFile=fiscal.locator('input[type=file][accept=".xml,text/xml,application/xml"]');
 await xmlFile.setInputFiles({name:'duplicado.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 preview=page.getByRole('dialog',{name:'Prévia da importação XML',exact:true});await expect(preview).toContainText('Já existe uma nota ativa com esta chave');await expect(preview.getByRole('button',{name:'Aplicar XML à ficha',exact:true})).toBeDisabled();await preview.getByRole('button',{name:'Cancelar prévia',exact:true}).click();
 await expect(fiscal.getByLabel('Número *',{exact:true})).toHaveValue('RASC');
 await xmlFile.setInputFiles({name:'nova.xml',mimeType:'application/xml',buffer:Buffer.from(freshXml)});await expect(preview.getByRole('button',{name:'Aplicar XML à ficha',exact:true})).toBeEnabled();
 await page.screenshot({animations:'disabled',path:`artifacts/financeiro/previa-xml-${width}.png`});
 await preview.getByRole('button',{name:'Aplicar XML à ficha',exact:true}).click();
 await expect(page.getByRole('dialog').getByLabel('Número *',{exact:true})).toHaveValue('4568');
 expect(data.notasFiscais).toHaveLength(2);expect(expenseWrites).toBe(1);expect(bankWrites).toBe(1);
 passed.push(`${width}: XML duplicado bloqueado, cancelar preserva ficha, aplicar não cria nota`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.close();
}expect(errors).toEqual([]);await writeFile('artifacts/financeiro/previas-browser.json',JSON.stringify({passed,errors},null,2));console.log(JSON.stringify({passed,errors},null,2));}finally{await browser.close();}
