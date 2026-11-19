import {expect,test} from '@playwright/test';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';
import {readFile} from 'node:fs/promises';
import {STOCK_COMMAND} from '../src/domains/estoque/commands.js';
import {buildFinancialLedger,selectDRE,selectAccountsPayable,selectCashFlow} from '../src/domains/financeiro/ledger.js';

async function enter(page,{withoutBudget=false,withCommitments=false,withStock=false,withRetention=false,withColumns=false,withBank=false,role='admin'}={}){
 const user={id:'flow-demo',nome:'Operador de teste',email:'flow@local.test',role,active:true};
 let state={usuarios:[user],config:{},employees:[],attendance:{},obras:[{id:'work',name:'Casa de teste',status:'active',startDate:'2026-10-01',contractType:'fixed_labor',contractValue:200000}],
 budgetBaselines:[{obraId:'work',tipo:'controle',ativo:true,budgetId:'b'}],orcamentos:[{id:'b',obraId:'work',nome:'Controle de teste',etapas:[{id:'s',nome:'Estrutura'}],itens:[{id:'i',etapaId:'s',descricao:'Estrutura',quantidade:1,precoUnit:100000}]}],
 pedidos:[{id:'o',obraId:'work',status:'enviado',data:'2026-10-31',itens:[{id:'l',qtd:1,precoUnit:50000,orcNivel1Id:'s'}]}],notasFiscais:[],outrasDesp:[{id:'labor',obraId:'work',data:'2026-10-31',valor:80000,etapaId:'s',descricao:'Mão de obra'}]};
 if(withoutBudget){state.budgetBaselines=[];state.orcamentos=[];}
 if(withRetention){
  state.outrasDesp=[];
  state.terceirizados=[{id:'t',obraId:'work',name:'Execução da estrutura',tipoContrato:'medicao',active:true,contractValue:2000,retISS:5,retISSQuem:'fonte',retINSS:11,retINSSQuem:'fonte',etapas:[{id:'e',nome:'Execução',valor:2000}]}];
  state.medicoesTerc=[{id:'m',numero:1,tercId:'t',obraId:'work',status:'aprovada',version:1,data:'2026-10-31',total:1000,itens:[{etapaId:'e',pctAnterior:0,pctAcum:50,valor:1000}],fotos:[{id:'photo'}]}];
  state.pagsTerceiros=[];
 }
 if(withStock){
  state.outrasDesp=[];
  Object.assign(state.orcamentos[0].itens[0],{quantidade:100,precoUnit:1000,materialId:'material',unidade:'UN'});
  state.materiais=[{id:'material',descricao:'Bloco de concreto',unidade:'UN',precoMedio:1000}];
  Object.assign(state.pedidos[0].itens[0],{qtd:60,qtdRecebida:60,precoUnit:1000,materialId:'material',unidadeRef:'UN',orcItemId:'i'});
  state.movEstoque=[{id:'receipt',obraId:'work',materialId:'material',tipo:'entrada',qtd:60,valorUnit:1000,pedidoId:'o',pedidoItemId:'l',orcItemId:'i',orcNivel1Id:'s',data:'2026-10-31'}];
  state.notasFiscais=[{id:'stock-invoice',obraId:'work',pedidoId:'o',status:'aprovada',valorBruto:60000,emissao:'2026-10-31'}];
  state.reservasEstoque=[{id:'reserve',obraId:'work',materialId:'material',quantidade:10,etapaId:'s'}];
 }
 if(withCommitments){
  state.terceirizados=[{id:'t',obraId:'work',name:'Instalações da obra',tipoContrato:'medicao',active:true,contractValue:8000,etapas:[{id:'e',valor:8000}]},
   {id:'invalid',obraId:'work',name:'Contrato a conferir',tipoContrato:'medicao',active:true,contractValue:'',etapas:[]}];
  state.medicoesTerc=[{id:'m',tercId:'t',obraId:'work',status:'aprovada',data:'2026-10-31',total:3000}];
  const payment={id:'paid',obraId:'work',tercId:'t',medicaoTercId:'m',status:'ativo',amount:1000,valor:1000,date:'2026-10-31',data:'2026-10-31'};
  state.pagsTerceiros=[payment];state.medicoesTerc[0].notaFiscalId='service-invoice';
  state.notasFiscais=[{id:'purchase-invoice',obraId:'work',pedidoId:'o',status:'aprovada',valorBruto:20000,emissao:'2026-10-31'},
   {id:'service-invoice',obraId:'work',medicaoTercId:'m',status:'aprovada',valorBruto:3000,emissao:'2026-10-31',pagamentos:[payment]}];
  if(withCommitments==='integration'){state.terceirizados=state.terceirizados.slice(0,1);state.terceirizados[0].contractValue=50000;state.terceirizados[0].etapas[0].valor=50000;}
 }
 if(withColumns)state.config.companyId='columns-local-company';
 if(withBank){state.contasBancarias=[{id:'bank',nome:'Banco local',ativa:true}];state.extratos=[{id:'legacy',arquivo:'Legado sem original.csv',qtd:1,version:0}];state.transacoes=[{id:'legacy-t',extratoId:'legacy',data:'2026-10-31',descricao:'Legado sem rastreabilidade',valor:-1,status:'pendente'}];}
 let failNext=false;
 const errors=[],commands=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
 await page.route('**/api/data',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==='operational-command'){
   commands.push(body.command);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'Falha temporária de teste. Tente novamente.'}});}
   const result=applyOperationalCommand(state,{...body.command,actorId:user.id,actorName:user.nome,actorRole:user.role,now:withRetention||withBank?new Date().toISOString():"2026-10-31T15:00:00.000Z"});
   if(result.ok)state=result.data;
   return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:'2026-10-31T15:00:01Z'}});
  }
  if(['save','save-sections','financial-command'].includes(body.action))throw new Error(`Gravação fora do cenário: ${body.action}`);
  return route.fulfill({json:{ok:true,usuario:user,data:state,accessToken:'isolated',refreshToken:'isolated',updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
 const open=async name=>{await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(name);await search.locator('xpath=../..').getByRole('button').filter({hasText:name}).first().click();};
 return {state:()=>state,open,errors,commands,failOnce:()=>{failNext=true;},sourceMovement:movement=>{
  const result=applyOperationalCommand(state,{type:STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,actorId:user.id,actorRole:user.role,idempotencyKey:'stock-source-'+movement.id,payload:{movement}});
  expect(result.ok,result.reason).toBe(true);state=result.data;
 }};
}

async function bankArea(page,app){
 await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
 if(!await page.getByRole('heading',{name:'Conciliação Bancária',exact:true}).isVisible())await app.open('Conciliação');
 const support=page.locator('.reconciliation-support');if(await support.getAttribute('open')===null)await support.locator('summary').click();
 if(page.viewportSize().width<768)await support.getByRole('combobox').selectOption('extratos');
 else await support.getByRole('button',{name:/^Extratos/}).click();
}
test('reversão bancária conserva original e DRE, protege pagamento, recupera falha e persiste',async({page},info)=>{
 const app=await enter(page,{withBank:true});await bankArea(page,app);
 await page.getByText('Importar para a conta:',{exact:true}).locator('..').getByRole('combobox').selectOption('bank');
 const ofx='<OFX><BANKID>001</BANKID><ACCTID>123</ACCTID><BANKTRANLIST>'+[1,2].map(n=>`<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED><TRNAMT>-${n*100}.00</TRNAMT><FITID>local-${n}</FITID><MEMO>Movimento ${n}</MEMO></STMTTRN>`).join('')+'</BANKTRANLIST></OFX>';
 await page.locator('.reconciliation-workspace input[type="file"]').setInputFiles({name:'local.ofx',mimeType:'application/x-ofx',buffer:Buffer.from(ofx)});
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Prévia da importação do extrato');
 await dialog.getByRole('button',{name:'Importar 2 novo(s) movimento(s)',exact:true}).click();await expect.poll(()=>app.state().extratos.length).toBe(2);await expect(dialog).toHaveCount(0);
 const statement=app.state().extratos.find(s=>s.id!=='legacy'),paid=app.state().transacoes.find(t=>t.extratoId===statement.id);
 app.state().outrasDesp.push({id:'paid-origin',obraId:'work',data:'2026-11-10',valor:100,pago:true,transacaoId:paid.id});
 const dre=selectDRE(buildFinancialLedger(app.state()));await page.reload();await bankArea(page,app);
 const row=page.getByRole('row').filter({hasText:'local.ofx'});await row.getByRole('button',{name:'Revisar reversão'}).click();
 await expect(dialog).toContainText('1 movimento reversível · 1 movimento protegido');await expect(dialog).toContainText('Movimento utilizado');
 const downloaded=page.waitForEvent('download');await dialog.getByRole('button',{name:'Baixar original'}).click();const download=await downloaded;
 expect((await readFile(await download.path())).toString()).toBe(ofx);
 await dialog.getByLabel('Justificativa da reversão').fill('Arquivo selecionado incorretamente; origem conferida');
 await dialog.locator('label').filter({hasText:'Conferi os movimentos reversíveis e os protegidos'}).click();
 await dialog.getByRole('button',{name:'Ajuda da reversão'}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});await expect(help).toContainText('Reversão de importações bancárias');await help.getByRole('button',{name:'Fechar ajuda'}).click();
 await dialog.locator('.arcd-dialog__body').evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:info.outputPath('reversao-previa.png')});
 await dialog.getByRole('button',{name:'Reverter 1 movimento',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('reversao-confirmacao.png')});
 app.failOnce();await dialog.getByRole('button',{name:'Reverter 1 movimento',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Falha temporária');
 await expect(dialog.getByLabel('Justificativa da reversão')).toHaveValue('Arquivo selecionado incorretamente; origem conferida');
 await dialog.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('reversao-falha.png')});
 await dialog.getByRole('button',{name:'Reverter 1 movimento',exact:true}).click();await expect(dialog).toHaveCount(0);
 const attempts=app.commands.filter(c=>c.type==='IMPORTACAO_BANCARIA_REVERTIDA');expect(attempts).toHaveLength(2);expect(attempts[0].idempotencyKey).toBe(attempts[1].idempotencyKey);
 expect(app.state().transacoes.find(t=>t.id===paid.id).status).toBe('pendente');expect(app.state().transacoes.filter(t=>t.importReversal)).toHaveLength(1);
 expect(selectDRE(buildFinancialLedger(app.state()))).toEqual(dre);expect(statement.originalFile.dataUrl).toBe('data:application/octet-stream;base64,'+Buffer.from(ofx).toString('base64'));
 await page.reload();await bankArea(page,app);await row.getByRole('button',{name:'Revisar reversão'}).click();await expect(dialog).toContainText('Já revertida');await expect(dialog.getByRole('button',{name:'Reverter 0 movimentos'})).toBeDisabled();
 await dialog.getByRole('button',{name:'Cancelar prévia'}).click();await page.getByRole('row').filter({hasText:'Legado sem original.csv'}).getByRole('button',{name:'Revisar reversão'}).click();
 await expect(dialog).toContainText('Este lote exige revisão da origem');await expect(dialog.getByRole('button',{name:'Baixar original'})).toBeDisabled();
 await expect(dialog).toHaveCSS('opacity','1');
 await page.screenshot({path:info.outputPath('reversao-legado.png'),animations:'disabled'});expect(app.errors).toEqual([]);expect(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
});
test('financeiro consulta prévia bancária sem capacidade de reverter',async({page})=>{
 const app=await enter(page,{withBank:true,role:'financeiro'});await bankArea(page,app);
 await page.getByRole('button',{name:'Revisar reversão'}).click();const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Somente administrador sem restrição de obra');await expect(dialog.getByLabel('Justificativa da reversão')).toBeDisabled();
 await expect(dialog.getByRole('button',{name:'Reverter 0 movimentos'})).toBeDisabled();expect(app.commands).toEqual([]);expect(app.errors).toEqual([]);
});

test('colunas persistem por lista, restauram e preservam origem, DRE e permissões',async({page},info)=>{
 const app=await enter(page,{withRetention:true,withStock:true,withColumns:true});
 const original=JSON.stringify(app.state()),dre=selectDRE(buildFinancialLedger(app.state()),{obraId:'work'});
 await app.open('Gestão financeira');
 const dialog=page.getByRole('dialog');
 await page.getByRole('button',{name:'Colunas',exact:true}).click();
 await expect(dialog.getByRole('checkbox',{name:'Registro / obra',exact:true})).toBeDisabled();
 await dialog.locator('label').filter({hasText:'Vencimento'}).click();
 await dialog.getByRole('button',{name:'Concluir',exact:true}).click();
 await expect(page.getByRole('columnheader',{name:'Vencimento',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('button',{name:'Colunas',exact:true})).toBeVisible();
 await expect(page.getByRole('columnheader',{name:'Vencimento',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Colunas',exact:true}).click();
 await dialog.getByRole('button',{name:'Restaurar colunas padrão',exact:true}).click();
 await dialog.getByRole('button',{name:'Concluir',exact:true}).click();
 await expect(page.locator('th').filter({hasText:/^Vencimento$/})).toHaveCount(1);
 await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await page.getByRole('button',{name:'Colunas dos custos por etapa',exact:true}).click();
 await expect(dialog.getByRole('checkbox',{name:'Incorrido',exact:true})).toBeDisabled();
 await dialog.locator('label').filter({hasText:'Reserva de risco'}).click();
 await dialog.getByRole('button',{name:'Ajuda das colunas',exact:true}).click();
 const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('Colunas das tabelas');await help.getByRole('button',{name:'Fechar ajuda'}).click();
 await expect(dialog.getByRole('checkbox',{name:'Reserva de risco',exact:true})).not.toBeChecked();
 await dialog.getByRole('button',{name:'Concluir',exact:true}).click();
 await expect(page.getByRole('columnheader',{name:'Reserva de risco',exact:true})).toHaveCount(0);
 const stock=page.getByRole('region',{name:'Cobertura do estoque · Casa de teste'});
 await stock.getByText('Conferir cobertura dos materiais (1)',{exact:true}).click();
 await stock.getByRole('textbox',{name:'Pesquisar material ou etapa'}).fill('Bloco');
 await stock.getByRole('button',{name:'Colunas',exact:true}).click();
 await expect(dialog.getByRole('checkbox',{name:'Origem e conferência',exact:true})).toBeDisabled();
 await dialog.locator('label').filter({hasText:'Reservado na etapa'}).click();
 await dialog.locator('.arcd-dialog__body').evaluate(el=>{el.scrollTop=0;});
 await page.screenshot({path:info.outputPath('colunas-dialogo.png')});
 await dialog.locator('.arcd-dialog__body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await page.screenshot({path:info.outputPath('colunas-dialogo-acoes.png')});
 expect(await dialog.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await expect(stock.getByRole('textbox',{name:'Pesquisar material ou etapa'})).toHaveValue('Bloco');
 await expect(stock.getByRole('columnheader',{name:'Reservado na etapa',exact:true})).toHaveCount(0);
 await stock.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('colunas-estoque.png')});
 const guarantees=page.getByRole('region',{name:'Garantias técnicas das medições'});
 await guarantees.getByText('Garantias técnicas das medições (1)',{exact:true}).click();
 await guarantees.getByRole('button',{name:'Colunas',exact:true}).click();
 await expect(dialog.getByRole('checkbox',{name:'Situação',exact:true})).toBeDisabled();
 await dialog.locator('label').filter({hasText:'Bruto medido'}).click();
 await dialog.getByRole('button',{name:'Concluir',exact:true}).click();
 await expect(guarantees.getByRole('columnheader',{name:'Bruto medido',exact:true})).toHaveCount(0);
 expect(app.commands).toEqual([]);expect(JSON.stringify(app.state())).toBe(original);
 expect(selectDRE(buildFinancialLedger(app.state()),{obraId:'work'})).toEqual(dre);
 expect(app.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});

test('garantia separa bruto e líquido, recupera falha, libera, paga e estorna sem outro custo',async({page},info)=>{
 const app=await enter(page,{withRetention:true}),dre=selectDRE(buildFinancialLedger(app.state()),{obraId:'work'});
 await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 const section=page.getByRole('region',{name:'Garantias técnicas das medições'});
 await section.getByText('Garantias técnicas das medições (1)',{exact:true}).click();
 const open=()=>section.getByRole('button',{name:'Conferir garantia de Medição 1'}).click();
 await open();const modal=page.getByRole('dialog');
 await modal.getByLabel('Garantia técnica da medição (R$)',{exact:false}).fill('100');
 await modal.getByLabel('Condição de liberação',{exact:false}).fill('Aceite técnico após vistoria da obra');
 await modal.getByLabel('Justificativa da operação',{exact:false}).fill('Condição contratual conferida na origem');
 await modal.getByRole('button',{name:'Ajuda da garantia técnica'}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('Garantia técnica das medições');await expect(help).toContainText('DRE');
 await help.getByRole('button',{name:'Fechar ajuda'}).click();await expect(modal.getByLabel('Garantia técnica da medição (R$)',{exact:false})).toHaveValue('100');
 app.failOnce();await modal.getByRole('button',{name:'Salvar garantia técnica',exact:true}).click();
 await expect(modal.getByRole('alert').filter({hasText:'Falha temporária'})).toBeVisible();
 await modal.getByRole('button',{name:'Salvar garantia técnica',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.commands[0].idempotencyKey).toBe(app.commands[1].idempotencyKey);
 expect(app.state().medicoesTerc[0].technicalRetention).toMatchObject({amountCents:10000,beneficiaryId:'t'});
 await expect(section).toContainText('Retida até cumprir condição');
 await open();await expect(modal).toContainText('líquido previsto do principal: R$ 740,00');
 await modal.getByLabel('Quem realizou o pagamento',{exact:false}).selectOption('empresa');
 await modal.getByLabel('Justificativa da operação',{exact:false}).fill('Pagamento do principal conferido');
 await modal.getByRole('button',{name:'Confirmar pagamento do principal',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('garantia-principal.png')});
 await modal.getByRole('button',{name:'Confirmar pagamento do principal',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().pagsTerceiros[0]).toMatchObject({amount:900,liquido:740});
 await open();await modal.getByLabel('Evidência da condição cumprida',{exact:false}).fill('Vistoria e termo de aceite assinados');
 await modal.locator('label').filter({hasText:'Conferi que a condição de liberação foi cumprida'}).click();
 await expect(modal.getByRole('checkbox',{name:'Conferi que a condição de liberação foi cumprida'})).toBeChecked();
 await modal.getByLabel('Justificativa da operação',{exact:false}).fill('Garantia liberada após aceite técnico');
 await modal.getByRole('button',{name:'Confirmar liberação da garantia',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('garantia-liberacao.png')});
 await modal.getByRole('button',{name:'Confirmar liberação da garantia',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(section).toContainText('Liberada para pagamento');
 await open();await modal.getByLabel('Quem realizou o pagamento',{exact:false}).selectOption('empresa');await modal.getByLabel('Justificativa da operação',{exact:false}).fill('Pagamento da garantia confirmado');
 await modal.getByRole('button',{name:'Confirmar pagamento da garantia',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().pagsTerceiros).toHaveLength(2);expect(selectAccountsPayable(buildFinancialLedger(app.state()),{obraId:'work'}).balanceCents).toBe(0);
 expect(selectCashFlow(buildFinancialLedger(app.state()),{obraId:'work'}).cashOutCents).toBe(84000);expect(selectDRE(buildFinancialLedger(app.state()),{obraId:'work'})).toEqual(dre);
 await expect(section).toContainText('Garantia baixada');
 await page.reload();await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await section.getByText('Garantias técnicas das medições (1)',{exact:true}).click();await expect(section).toContainText('Garantia baixada');await open();
 await modal.getByLabel('Justificativa da operação',{exact:false}).fill('Baixa da garantia informada por engano');await modal.getByText('Histórico da garantia e pagamentos',{exact:true}).click();
 const guaranteePayment=app.state().pagsTerceiros.find(p=>p.guaranteePayment);
 await modal.getByRole('button',{name:'Estornar baixa '+guaranteePayment.id,exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().medicoesTerc[0].pagamentoId).toBe(app.state().pagsTerceiros.find(p=>!p.guaranteePayment).id);
 expect(selectAccountsPayable(buildFinancialLedger(app.state()),{obraId:'work'}).balanceCents).toBe(10000);expect(selectDRE(buildFinancialLedger(app.state()),{obraId:'work'})).toEqual(dre);
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('garantia-saldo-reaberto.png'),fullPage:true});
 await app.open('Terceirizados');
 if(page.viewportSize().width<768)await page.locator('.terceiros-tabs').getByRole('combobox',{name:'Selecionar visão'}).selectOption('medicoes');
 else await page.locator('.terceiros-tabs').getByRole('button',{name:/^Medições/}).click();
 await page.getByRole('combobox',{name:'Contrato',exact:true}).selectOption('t');
 await page.getByRole('button',{name:'Conferir garantia técnica',exact:true}).click();
 await expect(modal).toContainText('saldo da garantia: R$ 100,00');
 await modal.getByText('Histórico da garantia e pagamentos',{exact:true}).click();
 await modal.getByRole('heading',{name:'Garantia técnica · Medição 1'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('garantia-origem-terceiros.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(app.errors).toEqual([]);
});

test('estoque reaproveita origens, cobre compras uma vez e pede reconferência sem mudar o DRE',async({page},info)=>{
 const app=await enter(page,{withStock:true});await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 const stock=page.getByRole('region',{name:'Cobertura do estoque · Casa de teste'});
 await stock.getByText('Conferir cobertura dos materiais (1)',{exact:true}).click();
 const search=stock.getByRole('textbox',{name:'Pesquisar material ou etapa'});await search.fill('Bloco');
 await expect(stock).toContainText('40.000,00');
 await stock.getByRole('button',{name:'Ajuda da cobertura do estoque'}).click();
 const help=page.getByRole('complementary',{name:'Central de ajuda'});await expect(help).toContainText('Cobertura do estoque');await expect(help).toContainText('DRE');
 await help.getByRole('button',{name:'Fechar ajuda'}).click();await expect(search).toHaveValue('Bloco');
 await stock.getByText('Conferir origens',{exact:true}).click();await expect(stock).toContainText('pedido o');await expect(stock).toContainText('reserva reserve');
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/100.000,00/);
 expect(app.commands).toHaveLength(0);
 await stock.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('estoque-cobertura.png'),fullPage:true});
 await page.getByText(/Conferir apropriação e previsão · 0 custo/).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('40000');await page.getByLabel('Premissas da previsão',{exact:true}).fill('Cobertura e quantidades conferidas nas origens');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 const dre=selectDRE(buildFinancialLedger(app.state()),{obraId:'work'});
 app.sourceMovement({id:'loss',obraId:'work',materialId:'material',tipo:'perda',qtd:5,etapa:'Estrutura',data:'2026-10-31'});
 expect(selectDRE(buildFinancialLedger(app.state()),{obraId:'work'})).toEqual(dre);
 await page.reload();await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await stock.getByText('Conferir cobertura dos materiais (1)',{exact:true}).click();await expect(stock).toContainText('45.000,00');
 expect(app.state().obras[0].costPlanning.stages.s.remainingCents).toBe(4000000);
 await page.getByText(/Conferir apropriação e previsão · 0 custo/).click();
 await expect(page.getByText('Valor revisado preservado; reconferir base atual',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/100.000,00/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await stock.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('estoque-reconferir.png'),fullPage:true});expect(app.errors).toEqual([]);
});

test('vincula contrato e pedido à previsão, recupera falha, persiste após recarga e preserva revisão manual',async({page},info)=>{
 const app=await enter(page,{withCommitments:'integration'});await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 const section=page.getByRole('region',{name:'Compromissos por origem · Casa de teste'});
 await section.getByText('Conferir contratos de terceiros (1)',{exact:true}).click();
 await section.getByRole('button',{name:'Vincular previsão de Instalações da obra'}).click();
 const modal=page.getByRole('dialog');await modal.getByRole('combobox',{name:'Etapa de custo do contrato'}).selectOption('s');
 await modal.getByRole('button',{name:'Ajuda do vínculo'}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('Vínculo de contratos à previsão');await help.getByRole('button',{name:'Fechar ajuda'}).click();await expect(modal.getByRole('combobox',{name:'Etapa de custo do contrato'})).toHaveValue('s');
 await modal.getByRole('checkbox',{name:/^Pedido .*50.000,00/}).check();
 await modal.getByRole('checkbox',{name:'Conferi que os pedidos selecionados representam o mesmo escopo do contrato'}).check();
 await modal.getByRole('textbox',{name:'Justificativa do vínculo'}).fill('Mesmo serviço representado no contrato e no pedido');
 await modal.getByRole('button',{name:'Salvar vínculo da previsão',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('vinculo-previsao-editor.png')});
 app.failOnce();await modal.getByRole('button',{name:'Salvar vínculo da previsão',exact:true}).click();
 await expect(modal.getByRole('alert')).toContainText('Falha temporária');await expect(modal.getByRole('textbox',{name:'Justificativa do vínculo'})).toHaveValue('Mesmo serviço representado no contrato e no pedido');
 await modal.getByRole('button',{name:'Salvar vínculo da previsão',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.commands.slice(0,2).map(c=>c.idempotencyKey)[0]).toBe(app.commands[1].idempotencyKey);
 expect(app.state().obras[0].costPlanning.serviceLinks.t).toMatchObject({stageId:'s',orderIds:['o']});
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/130.000,00/);
 await expect(section).toContainText('27.000,00 a incorrer');
 if(await section.locator('details').filter({has:page.getByText('Conferir contratos de terceiros (1)',{exact:true})}).getAttribute('open')===null)await section.getByText('Conferir contratos de terceiros (1)',{exact:true}).click();
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('vinculo-previsao-integrado.png'),fullPage:true});
 await page.reload();await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await expect(section).toContainText('27.000,00 a incorrer');
 await page.getByText(/Conferir apropriação e previsão · 0 custo/).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('28000');
 await page.getByLabel('Premissas da previsão',{exact:true}).fill('Restante conferido incluindo o compromisso contratado');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/131.000,00/);
 if(await section.locator('details').filter({has:page.getByText('Conferir contratos de terceiros (1)',{exact:true})}).getAttribute('open')===null)await section.getByText('Conferir contratos de terceiros (1)',{exact:true}).click();
 await section.getByRole('button',{name:'Vincular previsão de Instalações da obra'}).click();
 await modal.getByRole('textbox',{name:'Justificativa do vínculo'}).fill('Pedido não representa o mesmo escopo econômico');
 await modal.getByRole('button',{name:'Remover vínculo da previsão'}).click();await expect(modal).toHaveCount(0);
 expect(app.state().obras[0].costPlanning.serviceLinks).toEqual({});expect(app.state().obras[0].costPlanning.serviceLinkHistory).toHaveLength(2);
 expect(app.state().obras[0].costPlanning.stages.s.remainingCents).toBe(2800000);
 await expect(page.getByText('Valor revisado preservado; reconferir base atual',{exact:false})).toBeVisible();
 await section.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('vinculo-previsao-revisao.png'),fullPage:true});expect(app.errors).toEqual([]);
});

test('compromissos por origem separam saldo a medir e a pagar sem gravar ou duplicar baixas',async({page},info)=>{
 const app=await enter(page,{withCommitments:true});await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 const section=page.getByRole('region',{name:'Compromissos por origem · Casa de teste'});
 await expect(section).toBeVisible();await expect(section).toContainText('subtotal dos contratos com valor disponível');
 await expect(section).toContainText('5.000,00');
 await section.getByText('Conferir contratos de terceiros (2)',{exact:true}).click();
 const search=section.getByRole('textbox',{name:'Pesquisar contrato'});await search.fill('Instalações');
 await expect(section.getByRole('button',{name:'Conferir contrato Contrato a conferir'})).toHaveCount(0);
 await expect(section).toContainText('2.000,00');await expect(section).toContainText('3.000,00');
 await section.getByRole('button',{name:'Conferir contrato Instalações da obra'}).click();
 const memorial=page.getByRole('dialog');await expect(memorial).toContainText('Saldo a medir');await expect(memorial).toContainText('5.000,00');
 await expect(memorial).toContainText('Rascunhos e pagamentos não reduzem esse saldo.');
 await memorial.getByRole('button',{name:'Fechar memorial'}).click();await expect(search).toHaveValue('Instalações');
 await search.fill('');await expect(section).toContainText('Valor contratado ausente ou inválido');
 await section.getByRole('button',{name:/30.000,00/}).click();await expect(memorial).toContainText('Compras ainda não faturadas');
 await expect(memorial).toContainText('30.000,00');await memorial.getByRole('button',{name:'Fechar memorial'}).click();
 await section.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('compromissos-por-origem.png'),fullPage:true});
 expect(app.commands).toEqual([]);expect(app.state().obras[0]).not.toHaveProperty('costPlanning');expect(app.errors).toEqual([]);
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await expect(page.getByRole('complementary',{name:'Central de ajuda'})).toContainText('Compromissos por origem');
});

test('previsão e mudança com pendências atualizam o total sem alterar o contrato',async({page})=>{
 const app=await enter(page);await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await expect(page.getByRole('region',{name:'Mudanças e aditivos'})).toBeVisible();
 await page.getByText('Conferir apropriação e previsão · 0 custos pendentes',{exact:true}).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('70000');
 await page.getByLabel('Reserva de risco adicional (R$)',{exact:true}).fill('5000');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 expect(app.state().obras[0].costPlanning.stages.s.remainingCents).toBe(7000000);
 await expect(page.getByText('Premissas incompletas;', {exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Nova mudança ou aditivo',exact:true}).click();
 const modal=page.getByRole('dialog');await modal.getByLabel('O que muda *',{exact:true}).fill('Troca do piso da sala');
 await modal.getByLabel('Impacto no contrato (R$) — negativo para supressão',{exact:true}).fill('12000');
 await modal.getByRole('combobox',{name:'Etapa de custo',exact:true}).selectOption('s');
 await modal.getByRole('combobox',{name:'Situação da execução',exact:true}).selectOption('em_andamento');
 await modal.getByLabel('Impacto no custo restante (R$) — negativo para economia',{exact:true}).fill('8000');
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('adicional');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().obras[0].aditivosContrato[0]).toMatchObject({status:'proposto',execucaoStatus:'em_andamento',impactoCustoRestante:8000});
 expect(app.state().obras[0].contractValue).toBe(200000);
 await expect(page.getByText('Execução em andamento sem aprovação vigente do cliente.',{exact:true})).toBeVisible();
 await expect(page.getByText('Valor revisado preservado; reconferir base atual',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/163.000,00/);
 await page.getByRole('button',{name:'Registrar decisão',exact:true}).click();
 await modal.getByRole('button',{name:'Registrar decisão',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().obras[0].aditivosContrato[0].status).toBe('aprovado');
 await page.getByRole('button',{name:'Atualizar acompanhamento',exact:true}).click();
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('ja_incluido');
 await modal.getByLabel('Evidência da decisão do cliente',{exact:true}).fill('E-mail do cliente de hoje');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i})).toHaveText(/155.000,00/);
 await page.getByText('Previsão para concluir por etapa',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('previsao-por-etapa.png')});
 await page.getByRole('button',{name:'Ajuda da previsão',exact:true}).click();
 const help=page.getByRole('complementary',{name:'Central de ajuda'});await expect(help).toContainText('R$ 163 mil');
 await help.getByRole('button',{name:'Fechar ajuda'}).click();
 await page.getByRole('button',{name:'Ajuda de mudanças',exact:true}).click();await expect(help).toContainText('Mudanças e aditivos');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('previsao-e-ajuda.png')});
 await help.getByRole('button',{name:'Fechar ajuda'}).click();await app.open('Casa de teste');
 await expect(page.getByRole('region',{name:'Mudanças e aditivos'})).toBeVisible();
 await expect(page.getByText('Custo final estimado',{exact:true}).locator('..')).toContainText('155.000,00');
 expect(app.errors).toEqual([]);
});

test('previsão sem orçamento continua em Sem apropriação com aviso',async({page})=>{
 const app=await enter(page,{withoutBudget:true});await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await page.getByText('Conferir apropriação e previsão · 1 custo pendente',{exact:true}).click();
 await page.getByLabel('Custo restante para concluir (R$)',{exact:true}).fill('100000');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 expect(app.state().obras[0].costPlanning.stages.unassigned).toMatchObject({remainingCents:10000000,budgetId:''});
 await expect(page.getByText('Revisão salva.',{exact:false})).toContainText('sem orçamento');
 await expect(page.getByRole('button',{name:/Casa de teste, Sem apropriação: Custo final estimado/i})).toHaveText(/180.000,00/);
 expect(app.errors).toEqual([]);
});

test('possível duplicidade avisa, salva sem bloqueio e permite conferência ou correção',async({page})=>{
 const app=await enter(page);await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Custos por etapa');
 await page.getByText('Conferir apropriação e previsão · 0 custos pendentes',{exact:true}).click();
 const remaining=page.getByLabel('Custo restante para concluir (R$)',{exact:true});
 await remaining.fill('70000');await page.getByLabel('Reserva de risco adicional (R$)',{exact:true}).fill('5000');
 await page.getByLabel('Premissas da previsão',{exact:true}).fill('Compras pendentes e serviços estimados');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(1);
 await page.getByRole('button',{name:'Nova mudança ou aditivo',exact:true}).click();const modal=page.getByRole('dialog');
 await modal.getByLabel('O que muda *',{exact:true}).fill('Porcelanato da sala');
 await modal.getByRole('combobox',{name:'Etapa de custo',exact:true}).selectOption('s');
 await modal.getByLabel('Impacto no custo restante (R$) — negativo para economia',{exact:true}).fill('8000');
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('adicional');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 const amendments=page.getByRole('region',{name:'Mudanças e aditivos'}),form=remaining.locator('xpath=ancestor::fieldset');
 const warning=()=>form.getByRole('status',{name:'Possíveis duplicidades de custo'});
 await remaining.fill('78000');await expect(warning()).toBeVisible();await expect(warning()).toContainText('coincidindo com o impacto');
 await expect(page.getByRole('button',{name:'Confirmar previsão',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();
 await expect.poll(()=>app.state().obras[0].costPlanning?.version).toBe(2);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toBeVisible();
 const total=page.getByRole('button',{name:/Casa de teste, Estrutura: Custo final estimado/i});await expect(total).toHaveText(/171.000,00/);
 await warning().scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('duplicidade-aviso-sem-bloqueio.png')});
 const coverage=page.getByRole('combobox',{name:'Cobertura do aditivo 1',exact:true});
 await coverage.selectOption('separate');await expect(warning()).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Confirmar previsão',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();await expect.poll(()=>app.state().obras[0].costPlanning.version).toBe(3);
 await expect(page.getByText('Conferência do aditivo 1 salva sem justificativa individual.',{exact:false})).toBeVisible();
 await page.getByLabel('Justificativa da conferência do aditivo 1',{exact:true}).fill('Os R$ 78 mil são de outros serviços; piso deve continuar separado.');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();await expect.poll(()=>app.state().obras[0].costPlanning.version).toBe(4);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toHaveCount(0);await expect(total).toHaveText(/171.000,00/);
 await remaining.fill('79000');await expect(coverage).toHaveValue('unreviewed');await remaining.fill('78000');
 await coverage.selectOption('included');await expect(warning()).toContainText('declara este impacto dentro do restante');
 await page.getByLabel('Justificativa da conferência do aditivo 1',{exact:true}).fill('Piso incorporado à composição dos R$ 78 mil.');
 await page.getByRole('button',{name:'Confirmar previsão',exact:true}).click();await expect.poll(()=>app.state().obras[0].costPlanning.version).toBe(5);
 await amendments.getByRole('button',{name:'Editar',exact:true}).click();
 await modal.getByRole('combobox',{name:'Como considerar na previsão',exact:true}).selectOption('ja_incluido');
 await modal.getByRole('button',{name:'Salvar mudança',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(amendments.getByRole('status',{name:'Possíveis duplicidades de custo'})).toHaveCount(0);await expect(warning()).toHaveCount(0);await expect(total).toHaveText(/163.000,00/);
 expect(app.state().obras[0].costPlanning.history.at(-1).amendmentCoverage).toEqual({[app.state().obras[0].aditivosContrato[0].id]:{mode:'included',amountCents:800000,remainingCents:7800000,justification:'Piso incorporado à composição dos R$ 78 mil.'}});
 const history=page.getByRole('region',{name:'Histórico de conferência das duplicidades'});
 await expect(history).toBeVisible();await expect(history).toContainText('Operador de teste');await expect(history).toContainText('31/10/2026');await expect(history).toContainText('Custo separado do restante');await expect(history).toContainText('Já está no restante');await expect(history).toContainText('Os R$ 78 mil são de outros serviços');await expect(history).toContainText('Piso incorporado à composição');
 const count=app.commands.length;await history.getByRole('combobox',{name:'Aditivo do histórico',exact:true}).selectOption(app.state().obras[0].aditivosContrato[0].id);expect(app.commands.length).toBe(count);
 expect(await history.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);await history.scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath('historico-conferencias.png')});
 await page.getByRole('button',{name:'Ajuda da previsão',exact:true}).click();const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('R$ 171 mil');await help.getByText('Possível duplicidade de custo',{exact:true}).click();await expect(help).toContainText('É possível continuar mesmo sem resolver o aviso');
 expect(await help.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);expect(app.errors).toEqual([]);
});
