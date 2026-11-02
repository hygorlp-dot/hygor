import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('piloto separa proposta, execução e dúvida, consulta evidências e não dispara automação',async({page})=>{
 const user={id:'pilot-simulation',nome:'Operador QA',email:'pilot-simulation@local.test',role:'admin',active:true};
 const state={usuarios:[user],config:{paymentHolidays:[]},obras:[],employees:[],attendance:{},pedidos:[],
  fornecedores:[{id:'f',nome:'Fornecedor fictício',chavePix:'qa@pix'}],
  notasFiscais:[{id:'n',numero:'NF-SIMULADA',fornecedorId:'f',status:'aprovada',valorLiquido:300,vencimento:'2026-10-20',pagamentos:[],documentos:[{nome:'Original fictício.png',url:'https://pilot.test/original.png'}]}],
  transacoes:[{id:'safe',descricao:'Proposta segura QA',status:'pendente',data:'2026-10-20',valor:-300,chavePix:'qa@pix',fitid:'safe-fit'},
   {id:'unknown',descricao:'Dúvida QA',status:'pendente',data:'2026-10-21',valor:123,fitid:'unknown-fit'},
   {id:'executed',descricao:'Execução anterior QA',status:'conciliado',data:'2026-10-19',valor:20,vinculo:{tipo:'medicao',id:'m'},automacaoConciliacao:{evidencias:['Auditoria fictícia'],contraparte:{nome:'Cliente fictício'}}}]};
 const before=JSON.stringify(state),writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.route('https://pilot.test/original.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=','base64')}));
 await page.route('**/api/**',r=>{const body=r.request().postDataJSON()||{};
  if(['save','save-sections','reconciliation-command','operational-command','financial-command'].includes(body.action)){writes.push(body.action);return r.fulfill({status:403,json:{error:'Simulação sem gravações'}});}
  return r.fulfill({json:body.action==='profiles'?{usuarios:[user],precisaSetup:false}:{ok:true,usuario:user,data:structuredClone(state),accessToken:'isolated',refreshToken:'isolated',presencas:[],items:[],bases:[],updatedAt:'2026-10-31T12:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:/Acessar central/}).click();
 const sidebar=page.locator('.arcd-sidebar');await expect(sidebar).toBeVisible();
 await page.clock.install();await page.clock.pauseAt(new Date());
 await sidebar.locator('.nav-grp-hd').filter({hasText:/^Financeiro/}).click();await sidebar.locator('.nav-item').filter({hasText:/^Conciliação$/}).click();
 await page.getByRole('button',{name:'Abrir piloto de conferência',exact:true}).click();
 const pilot=page.getByRole('region',{name:'Piloto de Conciliação',exact:true});await expect(pilot).toBeVisible();
 await page.clock.runFor(1500);expect(writes).toEqual([]);
 await expect(pilot).toContainText('1 proposta(s) segura(s)');await expect(pilot).toContainText('1 caso(s) disponível(is)');
 const open=async title=>{await pilot.getByLabel('Buscar casos do piloto').fill(title);await pilot.getByRole('button',{name:'Conferir caso',exact:true}).click();};
 await open('Proposta segura QA');await expect(pilot.getByRole('table')).toContainText('NF-SIMULADA');await expect(pilot.getByRole('table')).toContainText('Coincide');
 await pilot.getByRole('button',{name:'Consultar ficha e documentos'}).click();await expect(pilot.getByRole('region',{name:'Documentos da revisão'})).toContainText('Original fictício.png');
 await expect(pilot.getByRole('img',{name:'Original fictício.png',exact:true})).toBeVisible();
 expect(await pilot.getByRole('img',{name:'Original fictício.png',exact:true}).evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await pilot.getByLabel('Conferido sem ajuste',{exact:true}).check();await pilot.getByRole('button',{name:'Registrar avaliação do piloto'}).click();
 await open('Execução anterior QA');await pilot.getByLabel('Ajuste necessário',{exact:true}).check();await pilot.getByLabel('Motivo ou observação').fill('Auditoria fictícia exige correção');await pilot.getByRole('button',{name:'Registrar avaliação do piloto'}).click();
 await open('Dúvida QA');await pilot.getByLabel('Não foi possível concluir',{exact:true}).check();await pilot.getByRole('button',{name:'Registrar avaliação do piloto'}).click();await expect(pilot.getByRole('alert')).toContainText('motivo');
 await pilot.getByLabel('Motivo ou observação').fill('Sem documento suficiente');await pilot.getByRole('button',{name:'Registrar avaliação do piloto'}).click();
 const pending=page.waitForEvent('download');await pilot.getByRole('button',{name:'Exportar indicadores do piloto'}).click();const report=JSON.parse(await readFile(await(await pending).path(),'utf8'));
 expect(report).toMatchObject({financialWrites:0,metrics:{total:3,reviewed:3,conclusive:2,corrections:1,inconclusive:1,proposedAgreement:{sample:1,rate:1},executedAccuracy:{sample:1,rate:0}}});
 expect(JSON.stringify(report)).not.toContain(user.email);expect(JSON.stringify(report)).not.toContain('qa@pix');
 await pilot.getByLabel('Buscar casos do piloto').fill('');await page.screenshot({path:'artifacts/pilot-simulation/indicadores-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'artifacts/pilot-simulation/indicadores-mobile.png',fullPage:true});
 await pilot.getByRole('button',{name:'Voltar ao módulo'}).click();await page.getByRole('button',{name:'Abrir piloto de conferência',exact:true}).click();await expect(pilot.locator('dl')).toContainText('3');
 expect(writes).toEqual([]);expect(JSON.stringify(state)).toBe(before);expect(errors).toEqual([]);
});
