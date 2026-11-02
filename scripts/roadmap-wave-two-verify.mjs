import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {data as initial,profile} from './fixtures/workflow-priorities-data.mjs';
const base=process.env.ROADMAP_BASE_URL||'http://127.0.0.1:4199';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const dir='artifacts/roadmap-wave-two';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];let currentPage;
try{for(const width of [1440,768,390,320]){
 const data=structuredClone(initial),errors=[],commands=[],captures=[];
 const order=data.pedidos[0];order.cotacaoId=data.cotacoes[0].id;
 order.itens=order.itens.map(item=>({...item,qtd:10,qtdRecebida:4,precoUnit:20}));
 data.notasFiscais=[{id:'review-invoice',tipo:'nfe',numero:'QA-203',pedidoId:order.id,obraId:order.obraId,fornecedorId:order.fornecedorId,fornecedorNome:'Fornecedor de demonstração',status:'aprovada',emissao:'2026-10-20',competencia:'2026-10',vencimento:'2026-10-31',valorBruto:160,valorLiquido:160,retencoes:{},rateios:[],divergencias:[],documentos:[{id:'xml-review',nome:'Nota de demonstração.xml',url:'https://example.test/qa-invoice.xml',tipo:'application/xml'}],pagamentos:[{id:'partial-qa',valor:60,data:'2026-10-21'}],itensNota:[{nItem:1,descricao:'Material fiscal de demonstração',qtd:400,unidade:'KG',valorTotal:160}]}];
 const page=await browser.newPage({viewport:{width,height:width>=768?1000:844}});page.setDefaultTimeout(20000);
 currentPage=page;
 page.on('pageerror',error=>errors.push(error.message));await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
 await page.route('https://**/*',r=>r.abort());
 await page.route('https://example.test/qa-invoice.xml',r=>r.fulfill({contentType:'application/xml',body:'<?xml version="1.0"?><nfeProc><NFe><infNFe><ide><nNF>QA-203</nNF></ide><det><prod><xProd>Material fiscal de demonstração</xProd><uCom>KG</uCom><qCom>400</qCom></prod></det></infNFe></NFe></nfeProc>'}));
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[]}}));
 await page.route('**/api/microsoft/**',r=>r.fulfill({json:{ok:false,connected:false}}));
 await page.route('**/api/data',r=>{const body=r.request().postDataJSON()||{};
  if(body.action==='operational-command'){commands.push(body.command);return r.fulfill({status:403,json:{ok:false,error:'Read-only review'}});}
  if(body.action==='profiles')return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});
  if(['financial-dre-report','financial-company-dre-report'].includes(body.action))return r.fulfill({json:{ok:true,current:null,history:[]}});
  return r.fulfill({json:{ok:true,usuario:profile,accessToken:'isolated-review',refreshToken:'isolated-review',data,updatedAt:'2026-10-31T15:00:00Z'}});
 });
 async function open(label){await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(label);await search.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();await page.waitForFunction(()=>{const main=document.querySelector('main');return main&&main.textContent.trim()&&!/^Carregando/.test(main.textContent.trim());});}
 async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name}: page overflow at ${width}`);
  for(const dialog of await page.getByRole('dialog').all())assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,`${name}: dialog overflow at ${width}`);
  await page.screenshot({path:`${dir}/${name}-${width}.png`});captures.push(name);
 }
 await page.goto(base);await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('isolated-review');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await page.getByRole('heading',{name:'Visão gerencial',exact:true}).waitFor();
 await open('Compras');if(width<768)await page.getByRole('combobox',{name:'Fluxo de compras'}).selectOption('cotacoes');else await page.getByRole('navigation',{name:'Fluxo de compras'}).getByRole('button',{name:'Cotar',exact:true}).click();
 await page.locator(`#purchase-record-${data.cotacoes[0].id}`).getByRole('button',{name:/^Comparar propostas/}).click();await page.getByRole('button',{name:'Ficha da compra conjunta · notas e anexos',exact:true}).click();
 const conference=page.getByRole('region',{name:'Conferência conectada da compra'});await conference.waitFor();
 assert.match(await conference.textContent(),/Nota acima do recebido físico/);
 await conference.getByRole('button',{name:'Consultar título',exact:true}).click();await page.getByRole('dialog',{name:'Título da compra',exact:true}).waitFor();assert.match(await page.getByRole('dialog',{name:'Título da compra',exact:true}).textContent(),/100,00/);await page.keyboard.press('Escape');await conference.waitFor();
 await conference.scrollIntoViewIfNeeded();await capture('purchase-conference');
 if(width<=900){await conference.getByRole('tab',{name:'Documento',exact:true}).click();await conference.getByLabel('XML original').waitFor();assert.match(await conference.getByLabel('XML original').textContent(),/QA-203/);await capture('purchase-original');await conference.getByRole('tab',{name:'Dados da nota',exact:true}).click();}
 await conference.getByRole('button',{name:'Abrir ficha fiscal',exact:true}).click();
 await page.getByRole('heading',{name:'Conferir nota QA-203',exact:true}).waitFor();await capture('purchase-invoice');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Voltar a Compras',exact:true}).click();await conference.waitFor();
 assert.equal(await conference.getByLabel('Nota fiscal para conferência').inputValue(),'review-invoice');await capture('purchase-return');
 await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
 await open('Gestão financeira');
 // Returning to Financeiro keeps its prior area. Explicitly choose Hoje.
 if(width<768)await page.getByRole('combobox',{name:'Áreas do financeiro'}).selectOption('hoje');else await page.getByRole('navigation',{name:'Áreas do financeiro'}).getByRole('button',{name:'Hoje',exact:true}).click();
 const today=page.locator('.finance-today');
 if(width<768)await today.getByRole('combobox',{name:'Fila de vencimentos'}).selectOption('payToday');else await today.getByRole('button',{name:/^Pagar hoje/}).click();
 await today.getByRole('button',{name:'Conferir documento',exact:true}).waitFor();await capture('today-next-action');
 await today.getByRole('button',{name:'Conferir documento',exact:true}).click();await page.getByRole('heading',{name:'Conferir nota QA-203',exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Voltar à fila financeira',exact:true}).click();await today.getByRole('button',{name:'Conferir documento',exact:true}).waitFor();
 await today.getByRole('button',{name:'Ver memorial',exact:true}).click();await page.getByRole('button',{name:'Fechar memorial',exact:true}).waitFor();await capture('today-memorial');await page.getByRole('button',{name:'Fechar memorial',exact:true}).click();
 assert.deepEqual(commands,[]);assert.deepEqual(errors,[]);results.push({width,captures,commands:commands.length,errors});await writeFile(`${dir}/verification.json`,JSON.stringify(results,null,2));await page.close();
}console.log(JSON.stringify({widths:results.map(r=>r.width),captures:results.reduce((sum,r)=>sum+r.captures.length,0),commands:results.reduce((sum,r)=>sum+r.commands,0),errors:results.flatMap(r=>r.errors)},null,2));}catch(error){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:`${dir}/failure.png`});console.log(await currentPage.locator('main h1,main h2,[role="dialog"] h3,[role="dialog"] h2').allTextContents());console.log((await currentPage.locator('body').innerText()).slice(-1400));}throw error;}finally{await browser.close();}
