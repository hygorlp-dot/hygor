import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {data as initial,profile} from './fixtures/workflow-priorities-data.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
const dir='artifacts/workflow-priorities';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try{for(const width of (process.env.WORKFLOW_WIDTH?[Number(process.env.WORKFLOW_WIDTH)]:[1440,390,320])){
 let data=structuredClone(initial);const commands=[],errors=[],metrics=[];
 const page=await browser.newPage({viewport:{width,height:width>767?1000:844}});page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
 await page.route('https://**/*',r=>r.abort());
 await page.route('**/api/**',r=>r.fulfill({json:{ok:true,items:[],bases:[]}}));
 await page.route('**/api/microsoft/**',r=>r.fulfill({json:{ok:false,connected:false}}));
 await page.route('**/api/data',r=>{const body=r.request().postDataJSON()||{};let result={ok:true};if(body.action==='profiles')return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});if(body.action==='ponto-equipe-obras')result={ok:true,pessoas:[],limitacoes:[],obras:data.obras,dia:'2026-10-30',fuso:'America/Bahia',servidorMs:Date.parse('2026-10-30T15:00:00Z')};if(['financial-dre-report','financial-company-dre-report'].includes(body.action))result={ok:true,current:null,history:[]};if(body.action==='operational-command'){commands.push(body.command);result=applyOperationalCommand(data,body.command,'2026-10-30T15:00:00Z');if(result.ok)data=result.data;}return r.fulfill({json:{...result,usuario:profile,accessToken:'isolated-review',refreshToken:'isolated-review',data,updatedAt:'2026-10-30T15:00:00Z'}})});
 async function open(label){await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(label);await search.locator('xpath=../..').getByRole('button').filter({hasText:label}).first().click();await page.waitForFunction(()=>{const main=document.querySelector('main');return main&&main.textContent.trim()&&!/^Carregando/.test(main.textContent.trim())});}
 async function capture(name){await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:`${dir}/${name}-${width}.png`});metrics.push(await page.evaluate(name=>({name,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1}),name));}
 async function area(label,value,text){if(width<768)await page.getByRole('combobox',{name:label,exact:true}).selectOption(value);else await page.getByRole('navigation',{name:label,exact:true}).getByRole('button',{name:text,exact:true}).click();}
 await page.goto('http://127.0.0.1:4198');await page.locator('#login-email').fill(profile.email);await page.locator('#login-senha').fill('isolated-review');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();await page.getByRole('heading',{name:'Visão gerencial',exact:true}).waitFor();
 await open('Planejamento');await page.getByRole('button',{name:'mes',exact:true}).click();
 await page.getByRole('button',{name:'Materiais e compras',exact:true}).click();
 const panel=page.getByRole('region',{name:'Materiais e compras da etapa'});
 await panel.getByLabel('Etapa do planejamento').selectOption('task-b');
 await panel.getByText('Aço CA-50 para armação de pilares e vigas',{exact:true}).waitFor();
 await capture('planning-needs');assert.equal(commands.length,0);
 await panel.getByRole('button',{name:'Preparar solicitação em Compras'}).click();
 const modal=page.locator('.purchase-request-modal');await modal.getByRole('heading',{name:'Solicitar materiais para Compras'}).waitFor();
 assert.equal(await modal.getByLabel('Obra *',{exact:true}).inputValue(),'a');
 assert.equal(await modal.getByLabel('Data necessária na obra *',{exact:true}).inputValue(),'2026-10-26');
 await capture('planning-request');assert.equal(commands.length,0);
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Voltar a Planejamento',exact:true}).click();await panel.waitFor();
 assert.equal(await panel.getByLabel('Etapa do planejamento').inputValue(),'task-b');
 assert.equal(await page.getByRole('button',{name:'mes',exact:true}).getAttribute('aria-pressed'),'true');
 await capture('planning-return');
 // Switching through the normal module menu must also retain filters and work.
 await open('Compras');
 if(width<768)await page.getByRole('combobox',{name:'Fluxo de compras'}).selectOption('cotacoes');
 else await page.getByRole('navigation',{name:'Fluxo de compras',exact:true}).getByRole('button',{name:'Cotar',exact:true}).click();
 await page.getByLabel('Buscar',{exact:true}).fill('COT-001');
 await open('Planejamento');await open('Compras');
 assert.equal(await page.getByLabel('Buscar',{exact:true}).inputValue(),'COT-001');
 await page.locator('#purchase-record-quote').getByRole('button').first().click();
 const comparison=page.getByRole('region',{name:'Análise da cotação COT-001'});
 await comparison.locator('.quote-workspace-heading').getByRole('button',{name:'Decidir e gerar pedidos'}).waitFor();
 await comparison.locator('.quote-workspace-heading').scrollIntoViewIfNeeded();
 const actionBounds=await comparison.locator('.quote-workspace-heading__actions').boundingBox();assert.ok(actionBounds.x+actionBounds.width<=width+1,'A próxima ação deve caber na largura da tela');
 await capture('quote-next-action');assert.equal(commands.length,0);
 await comparison.locator('.quote-workspace-heading').getByRole('button',{name:'Decidir e gerar pedidos'}).click();
 await page.getByRole('heading',{name:'Decisão do mapa de cotação',exact:true}).waitFor();assert.equal(commands.length,0);
 await page.locator('.arcd-modal-panel').getByRole('button',{name:'Cancelar',exact:true}).click();
 // Finance keeps its own area while receiving the current work scope.
 await open('Gestão financeira');await page.getByRole('heading',{name:'Financeiro',exact:true}).waitFor();await capture('finance-scope');
 assert.equal(await page.locator('.workspace-header__scope select').inputValue(),'a');
 await area('Áreas do financeiro','documentos','Documentos');await page.getByLabel('Pesquisar documento ou fornecedor').fill('Depósito');
 await open('Planejamento');await open('Gestão financeira');assert.equal(await page.getByLabel('Pesquisar documento ou fornecedor').inputValue(),'Depósito');await capture('finance-return');
 await open('Orçamento');await page.locator('.budget-bar__name').waitFor();await area('Áreas do orçamento','memoria','Memória de cálculo');
 await open('Planejamento');await open('Orçamento');
 if(width<768)assert.equal(await page.getByRole('combobox',{name:'Áreas do orçamento'}).inputValue(),'memoria');
 else assert.equal(await page.getByRole('navigation',{name:'Áreas do orçamento'}).getByRole('button',{name:'Memória de cálculo',exact:true}).getAttribute('aria-current'),'page');
 await capture('budget-return');
 await open('Planejamento');
 await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('b');
 assert.equal(await panel.count(),0);
 await page.getByRole('button',{name:'Materiais e compras',exact:true}).click();await panel.getByLabel('Etapa do planejamento').selectOption('task-b');
 await capture('planning-scope-b');await open('Compras');
 assert.equal(await page.getByRole('combobox',{name:'Obra',exact:true}).inputValue(),'b');
 await open('Planejamento');await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption('a');
 await panel.waitFor();assert.equal(await panel.getByLabel('Etapa do planejamento').inputValue(),'task-b');
 // The list position is restored independently from its filters and zoom.
 const scroll=()=>page.evaluate(()=>{const main=document.querySelector('main');return main&&main.scrollHeight>main.clientHeight?main.scrollTop:window.scrollY});
 await page.evaluate(()=>{const main=document.querySelector('main');if(main&&main.scrollHeight>main.clientHeight)main.scrollTop=400;else window.scrollTo(0,400);});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const position=await scroll();
 assert.ok(position>10,'O cenário precisa ter rolagem real para validar o retorno');
 await open('Compras');await open('Planejamento');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.ok(Math.abs((await scroll())-position)<5,'Posição do planejamento deve ser restaurada');
 await open('Planejamento');await page.getByRole('button',{name:'Materiais e compras',exact:true}).click();
 await panel.getByLabel('Etapa do planejamento').selectOption('task-b');await panel.getByRole('button',{name:'Preparar solicitação em Compras'}).click();await modal.waitFor();
 await modal.getByRole('button',{name:'Formalizar e enviar para Compras'}).click();assert.equal(commands.length,0);
 await modal.getByRole('spinbutton',{name:/^Quantidade de compra/}).fill('100');
 await modal.getByRole('button',{name:'Formalizar e enviar para Compras'}).click();
 await modal.waitFor({state:'hidden'});
 assert.equal(commands.length,1);assert.equal(data.solicitacoesCompra.at(-1).planningOrigin.stageId,'structure');
 assert.equal(data.solicitacoesCompra.at(-1).itens[0].quantidade,100);
 await page.getByRole('button',{name:'Voltar a Planejamento',exact:true}).click();await panel.waitFor();
 await panel.getByRole('button',{name:/Abrir solicitação/}).waitFor();assert.equal(await panel.getByRole('button',{name:'Preparar solicitação em Compras'}).count(),0);
 await capture('planning-request-linked');
 // Returning from a work's embedded planning keeps that work and inner screen.
 await open('Residencial Alameda');await page.getByRole('heading',{name:'Residencial Alameda',level:1,exact:true}).waitFor();
 if(width<768)await page.getByRole('combobox',{name:'Telas da obra',exact:true}).selectOption('plan');
 else {await page.locator('.work-detail-navigation__desktop').getByRole('button',{name:'Obra',exact:true}).click();await page.locator('.work-detail-navigation__desktop').getByRole('button',{name:'Planejamento',exact:true}).click();}
 await page.getByRole('button',{name:'Materiais e compras',exact:true}).click();await panel.getByLabel('Etapa do planejamento').selectOption('task-b');
 await panel.getByRole('button',{name:/Abrir solicitação/}).click();await page.getByRole('button',{name:'Voltar a Residencial Alameda',exact:true}).click();
 await page.getByRole('heading',{name:'Residencial Alameda',level:1,exact:true}).waitFor();await panel.waitFor();await capture('work-planning-return');
 if(width<768){await page.getByRole('button',{name:'Abrir Compras e suprimentos',exact:true}).click();await page.getByRole('heading',{name:'Compras',level:1,exact:true}).waitFor();await page.getByRole('button',{name:'Abrir Obras e projetos',exact:true}).click();await page.getByRole('heading',{name:'Residencial Alameda',level:1,exact:true}).waitFor();await panel.waitFor();await capture('mobile-module-return');}
 results.push({width,commands:commands.length,errors,metrics});await writeFile(`${dir}/verification.json`,JSON.stringify(results,null,2));assert.deepEqual(errors,[]);assert.ok(metrics.every(m=>!m.overflow));await page.close();
}console.log(JSON.stringify({viewports:results.length,captures:results.reduce((n,r)=>n+r.metrics.length,0),errors:results.flatMap(r=>r.errors)},null,2));}finally{await browser.close();}
