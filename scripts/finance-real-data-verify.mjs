import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readRealFinanceData} from './finance-real-data-source.mjs';
import {active} from '../src/domains/financeiro/ledger.js';
import {financialSearchText} from '../src/domains/financeiro/search.js';

const url=process.argv[2]||'http://127.0.0.1:4192';
if(new URL(url).origin!=='http://127.0.0.1:4192')throw new Error('A revisão real usa somente o servidor local protegido.');
const {data,missingArchives}=await readRealFinanceData();
const digest=()=>createHash('sha256').update(JSON.stringify(data)).digest('hex'),before=digest();
const user={id:'real-data-review',nome:'Revisão local',email:'review@local.test',role:'admin',active:true};
const fixture={...data,usuarios:[user]};
const source=(data.medicoes||[]).filter(active).find(m=>String(m.competencia||'')==='2026-10'&&m.numeroParcela&&data.obras.some(w=>w.id===m.obraId&&w.cliente))||(data.medicoes||[]).filter(active).find(m=>m.numeroParcela&&data.obras.some(w=>w.id===m.obraId&&w.cliente));
if(!source)throw new Error('Não há medição com os vínculos necessários para esta jornada.');
const work=data.obras.find(w=>w.id===source.obraId),month=String(source.competencia||source.dataEmissao).slice(0,7);
const report={ok:false,mode:'real-company-data-read-only',dataChanged:false,missingArchives,checks:[],blockedRequests:0,blockedActions:{},pageErrors:0};
const browser=await chromium.launch({headless:true});let stage='início';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
await mkdir('artifacts/financeiro',{recursive:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 page.on('pageerror',()=>{report.pageErrors++;});
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
 await page.route('**/api/**',route=>{
  let body={};try{body=route.request().postDataJSON()||{};}catch{}
  const read=['profiles','auth-login','auth-refresh','load','financial-management-report','financial-closing-preview','list','chat-list','ranking-list','status','heartbeat','offline'];
  if(body.action&&!read.includes(body.action)){report.blockedRequests++;report.blockedActions[body.action]=(report.blockedActions[body.action]||0)+1;return route.fulfill({status:403,json:{error:'Revisão: gravação bloqueada.'}});}
  return route.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,items:[],bases:[],accessToken:'isolated-review',refreshToken:'isolated-review',usuario:user,data:fixture,updatedAt:'2026-10-30T15:00:00Z'}});
 });
 stage=`${width}: entrar na cópia em memória`;
 await page.clock.setFixedTime(new Date('2026-10-30T15:00:00Z'));
 await page.goto(url);await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated-review');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 stage=`${width}: abrir gestão`;
 if(width<1100){
  await page.getByRole('button',{name:'Abrir Financeiro',exact:true}).click();
  const moduleSelect=page.getByRole('combobox',{name:'Telas de Financeiro',exact:true});
  if(await moduleSelect.isVisible())await moduleSelect.selectOption({label:'Gestão financeira'});
  else await page.locator('.mobile-subnav').getByRole('button',{name:'Gestão financeira',exact:true}).click();
 }
 else{await page.getByRole('button',{name:'Financeiro ›',exact:true}).click();await page.getByRole('button',{name:'Gestão financeira',exact:true}).click();}
 const nav=page.getByRole('navigation',{name:'Áreas do financeiro'}),area=async name=>{
  const select=page.getByRole('combobox',{name:'Áreas do financeiro',exact:true});
  if(await select.isVisible())await select.selectOption({label:name});
  else await nav.getByRole('button',{name,exact:true}).click();
 };
 stage=`${width}: contexto e memória dos indicadores`;
 await page.getByRole('combobox',{name:'Obra',exact:true}).selectOption(work.id);await area('Visão financeira');
 for(const label of ['Resultado','Receita reconhecida','Custos incorridos','Entradas de caixa','Saídas de caixa','Contas a receber','Contas a pagar']){
  await page.getByRole('button',{name:`Consultar memorial: ${label}`,exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  check(!await dialog.getByText(/Parcela sem detalhamento individual/).count(),`Indicador sem composição completa: ${label}`);await page.keyboard.press('Escape');
 }
 report.checks.push(`${width}: sete indicadores com memória completa no recorte da obra`);
 stage=`${width}: filtros da previsão`;
 await area('Caixa por conta');await page.getByText('Previsão por vencimentos',{exact:true}).click();
 const horizon=page.getByRole('combobox',{name:'Horizonte',exact:true});
 check(await horizon.isVisible(),'Os filtros da previsão de caixa estão ocultos.');
 await horizon.selectOption('7');await page.getByLabel('Saldo inicial da simulação (R$)',{exact:true}).fill('1500');
 report.checks.push(`${width}: horizonte e saldo inicial da previsão acessíveis`);
 stage=`${width}: busca documental por cliente e parcela`;
 await area('Documentos');const center=page.locator('.document-center');
 await center.getByLabel('Competência ou mês de emissão',{exact:true}).fill(month);
 await center.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill(financialSearchText(work.cliente));
 check(await center.locator('article').count()>0,'Busca documental não encontrou o cliente da obra.');
 await center.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).fill(String(source.numeroParcela));
 check(await center.locator('article').count()>0,'Busca documental não encontrou a parcela.');
 const first=center.locator('article').first();check((await first.innerText()).includes(work.cliente),'Cliente não identificado no registro documental.');
 await first.getByRole('button',{name:'Conferir documentos',exact:true}).click();
 check((await center.locator('aside').innerText()).includes(work.cliente),'Cliente ausente na conferência documental.');
 await first.getByRole('button',{name:'Ver memorial',exact:true}).click();
 const memorial=page.getByRole('dialog');await memorial.waitFor();
 await memorial.getByLabel('Pesquisar lançamento, obra ou documento',{exact:true}).fill(financialSearchText(work.cliente));
 check(await memorial.locator('.dre-memorial__entry').count()>0,'Busca do memorial não coincide com a central.');
 await page.getByRole('button',{name:'Consultar na central de documentos',exact:true}).first().click();
 await page.getByRole('button',{name:'Voltar ao memorial de origem',exact:true}).click();await page.keyboard.press('Escape');
 check(await center.getByLabel('Pesquisar documento ou fornecedor',{exact:true}).inputValue()===String(source.numeroParcela),'Retorno perdeu o filtro documental.');
 report.checks.push(`${width}: cliente, parcela e busca sem acentos na central e no memorial, com retorno preservado`);
 stage=`${width}: relatório e exportação no recorte`;
 await area('Relatórios financeiros');const reports=page.getByRole('region',{name:'Central de relatórios financeiros'});
 await reports.locator('.financial-reports__options summary').click();
 await reports.getByLabel('Competência inicial',{exact:true}).fill(month);await reports.getByLabel('Competência final',{exact:true}).fill(month);
 await reports.getByLabel('Pesquisar lançamento, contraparte ou documento',{exact:true}).fill(financialSearchText(work.cliente));
 check(await reports.getByRole('button',{name:/Ver \d+ lançamento/}).count()>0,'Relatório não encontrou o cliente do recorte.');
 const downloaded=page.waitForEvent('download');await reports.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 const stream=await(await downloaded).createReadStream();let csv='';for await(const chunk of stream)csv+=chunk;
 check(csv.includes(work.name)&&csv.includes('Lançamentos'),'Exportação não preservou a obra e os detalhes.');
 const outside=data.obras.find(w=>w.id!==work.id&&w.name&&!work.name.includes(w.name));
 if(outside)check(!csv.includes(`"${outside.name}"`),'Exportação incluiu obra fora do filtro.');
 report.checks.push(`${width}: relatório e CSV com o cliente e a obra selecionados`);
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Página ultrapassa a largura disponível.');
 await page.close();
}report.dataChanged=before!==digest();check(!report.dataChanged,'A cópia da base foi alterada.');check(!report.pageErrors,'Erro de página na revisão.');report.ok=true;
}catch(error){report.failedStage=stage;report.failure=stage.includes('abrir gestão')||stage.includes('entrar na cópia')||stage.includes('contexto e memória')?error.message.replaceAll(String(work.id),'[obra]').slice(0,700):error.message.length<180&&!/locator\.|waiting for/.test(error.message)?error.message:error.name;process.exitCode=1;}
finally{await browser.close();await writeFile('artifacts/financeiro/revisao-dados-reais.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
