import {test,expect} from '@playwright/test';
import {openFinanceModule,selectFinanceArea} from '../scripts/finance-browser-navigation.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {createMonthlyClosingSnapshot} from '../src/domains/financeiro/workflows.js';
const user={id:'finance-wf',nome:'Financeiro local',email:'finance-wf@local.test',role:'admin',active:true};
async function enter(page,{failInvoice=false,failClosing=false,prepare,mode=''}={}){
 let state={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:'a',name:'Obra Alfa',status:'active'}],contasBancarias:[{id:'bank',nome:'Conta operacional',ativa:true}],
  notasFiscais:[{id:'nf',tipo:'nfe',numero:'123',obraId:'a',status:'aprovada',emissao:'2026-09-20',competencia:'2026-09',vencimento:'2026-10-10',fornecedorNome:'Fornecedor local',valorBruto:1000,valorLiquido:1000,categoria:'',contaBancariaId:'bank',documentos:[{id:'doc',nome:'Nota original',url:'https://files.example.test/nota.xml',tipo:'application/xml'}],pagamentos:[{id:'pg',data:'2026-09-25',valor:250,origem:'empresa',transacaoId:'tx',conciliado:false}]},
   {id:'other',tipo:'nfe',numero:'999',obraId:'a',status:'aprovada',emissao:'2026-09-20',competencia:'2026-09',vencimento:'2026-10-10',valorBruto:200,valorLiquido:200,categoria:'material',documentos:[{url:'https://files.example.test/other.xml'}],pagamentos:[]}],
  transacoes:[{id:'tx',data:'2026-09-25',descricao:'PIX do fornecedor',valor:-250,status:'parcial',contaBancariaId:'bank'},{id:'unrelated',data:'2026-09-25',descricao:'Outro pagamento',valor:-200,status:'pendente',contaBancariaId:'bank'}]};
 prepare?.(state);
 const commands=[],closing=[],errors=[],writes=[];let rejectInvoice=failInvoice,triggered=false,expired=false;
 page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-31T15:00:00Z'));
 await page.route('https://**/*',route=>route.abort());await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
 await page.route('**/api/data',async route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='auth-refresh'&&expired)return route.fulfill({status:401,json:{error:'Sessão expirada.'}});
  if(body.action==='auth-login'&&expired){if(body.password!=='renovar-local')return route.fulfill({status:401,json:{error:'Senha inválida.'}});expired=false;}
  if(['save','save-sections'].includes(body.action))writes.push(body.action);
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==='financial-command'){
   if(!triggered&&mode==='expired-closing'){triggered=true;expired=true;closing.push(body.command);return route.fulfill({status:401,json:{ok:false,error:'Sessão expirada ao confirmar o período.'}});}
   closing.push(body.command);if(failClosing)return route.fulfill({json:{ok:false,error:'Falha simulada ao confirmar o fechamento.'}});
   const prepared=createMonthlyClosingSnapshot(state,{competencia:body.command.payload.competencia,actor:{...user,nome:'Servidor confirmado'},closedAt:'2026-10-31T15:01:00Z'});
   const confirmed={...prepared.closing,idempotencyKey:body.command.idempotencyKey};state={...state,fechamentosFinanceiros:[...(state.fechamentosFinanceiros||[]),confirmed]};
   return route.fulfill({json:{ok:true,closing:confirmed,sections:{fechamentosFinanceiros:state.fechamentosFinanceiros},updatedAt:'2026-10-31T15:01:00Z'}});
  }
  if(body.action==='operational-command'){
   if(!triggered&&mode==='concurrent'){
    triggered=true;state.notasFiscais=state.notasFiscais.map(n=>n.id==='nf'?{...n,version:Number(n.version||0)+1,fornecedorNome:'Fornecedor concorrente'}:n);
   }
   if(!triggered&&mode==='expired'){triggered=true;expired=true;commands.push(body.command);return route.fulfill({status:401,json:{ok:false,error:'Sessão expirada. Renove o acesso.'}});}
   commands.push(body.command);if(rejectInvoice){rejectInvoice=false;return route.fulfill({json:{ok:false,reason:'Conflito simulado. O preenchimento foi mantido.'}});}
   if(!triggered&&mode==='lost-before'){triggered=true;return route.abort('failed');}
   const result=applyOperationalCommand(state,body.command,'2026-10-31T15:00:00Z');if(result.ok)state=result.data;
   if(!triggered&&mode==='lost-response'){triggered=true;return route.abort('failed');}
   return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:'2026-10-31T15:00:01Z'}});
  }
  return route.fulfill({json:{ok:true,accessToken:'isolated-qa',refreshToken:'isolated-qa',usuario:user,data:state,updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();await openFinanceModule(page);
 return {state:()=>state,commands,closing,errors,writes};
}

test('WF05 documento, obrigação e banco preservam a origem sem gravar',async({page})=>{
 const app=await enter(page);await selectFinanceArea(page,'Documentos');await page.getByLabel('Competência ou mês de emissão').fill('2026-09');await page.getByLabel('Pesquisar documento ou fornecedor').fill('123');
 await page.getByRole('button',{name:'Conferir documentos',exact:true}).click();const aside=page.getByRole('complementary',{name:'Documento e dados para conferência'});
 await aside.getByRole('button',{name:'Consultar pagamentos deste documento',exact:true}).click();await expect(page.locator('.payment-workspace article')).toHaveCount(1);await expect(page.getByLabel('Situação',{exact:true})).toHaveValue('todas');
 await page.getByRole('button',{name:'Revisar conciliação',exact:true}).click();await expect(page.getByRole('region',{name:'Origem da revisão bancária'})).toContainText('Documento 123');
 await expect(page.getByRole('button',{name:'Retomar automação',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Comparar e resolver movimento'})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('wf05-movimento-vinculado.png')});
 await page.getByRole('navigation',{name:'Retornar ao contexto anterior'}).getByRole('button').click();await expect(page.locator('.payment-workspace article')).toHaveCount(1);
 await page.getByRole('button',{name:'Voltar à central de documentos',exact:true}).click();await expect(page.getByLabel('Pesquisar documento ou fornecedor')).toHaveValue('123');await expect(aside).toBeVisible();
 expect(app.commands).toHaveLength(0);expect(app.closing).toHaveLength(0);expect(app.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('wf05-retorno-documentos.png')});
 await openFinanceModule(page,'Conciliação');await expect(page.getByRole('button',{name:'Retomar automação',exact:true})).toBeVisible();expect(app.commands).toHaveLength(0);
});

test('WF06 corrige a origem, conserva formulário rejeitado e retorna à competência',async({page})=>{
 const app=await enter(page,{failInvoice:true});await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-09');
 const pending=page.getByRole('region',{name:'Pendências para conferência do fechamento'});await pending.getByRole('button',{name:'Corrigir ficha fiscal',exact:true}).click();
 const modal=page.getByRole('dialog');await expect(modal).toBeVisible();if(page.viewportSize().width<901)await modal.getByRole('tab',{name:'Dados da nota',exact:true}).click();
 await modal.getByLabel('Categoria',{exact:true}).selectOption('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(page.getByText('Conflito simulado. O preenchimento foi mantido.',{exact:true})).toBeVisible();await expect(modal.getByLabel('Categoria',{exact:true})).toHaveValue('material');
 await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true}).click();
 await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);await page.getByRole('button',{name:'Voltar à conferência do fechamento',exact:true}).click();
 await expect(page.getByLabel('Competência',{exact:true})).toHaveValue('2026-09');await expect(pending.getByRole('button',{name:'Corrigir ficha fiscal',exact:true})).toHaveCount(0);
 expect(app.state().notasFiscais.find(n=>n.id==='nf').categoria).toBe('material');expect(app.commands).toHaveLength(2);expect(app.closing).toHaveLength(0);expect(app.errors).toEqual([]);
 await page.screenshot({path:test.info().outputPath('wf06-origem-corrigida.png')});
});

test('WF06 falha no fechamento libera a interface e reutiliza a chave na retomada',async({page})=>{
 const app=await enter(page,{failClosing:true});await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-08');
 page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Fechar competência',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Falha simulada ao confirmar o fechamento.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Fechar competência',exact:true})).toBeEnabled();await expect(page.getByLabel('Competência',{exact:true})).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('wf06-falha-recuperavel.png')});
 await page.getByRole('button',{name:'Abrir central deste mês',exact:true}).click();await page.getByRole('button',{name:'Voltar à conferência do fechamento',exact:true}).click();await expect(page.getByLabel('Competência',{exact:true})).toHaveValue('2026-08');
 await page.getByRole('button',{name:'Fechar competência',exact:true}).click();await expect.poll(()=>app.closing.length).toBe(2);expect(app.closing[0].idempotencyKey).toBe(app.closing[1].idempotencyKey);expect(app.state().fechamentosFinanceiros||[]).toHaveLength(0);expect(app.errors).toEqual([]);
});

test('WF06 fechamento adota a confirmação auditável sem reenviar o cadastro',async({page})=>{
 const app=await enter(page);await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-08');page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Fechar competência',exact:true}).click();await expect(page.getByText(/Fechado por Servidor confirmado/)).toBeVisible();await expect(page.getByRole('button',{name:'Fechar competência',exact:true})).toBeDisabled();
 expect(app.state().fechamentosFinanceiros).toHaveLength(1);expect(app.closing).toHaveLength(1);expect(app.writes).toEqual([]);expect(app.errors).toEqual([]);
 await page.screenshot({path:test.info().outputPath('wf06-fechamento-confirmado.png')});
});

for(const [source,key,label] of [['pedido','pedidos','Pedido de conferência'],['medicao','medicoes','Medição de conferência'],['despesa_empresa','despesasEmpresa','Despesa corporativa de conferência'],['outra_despesa','outrasDesp','Despesa da obra de conferência']])test(`WF06 corrige referência e categoria da origem ${source} sem outro fato financeiro`,async({page})=>{
 const app=await enter(page,{prepare:state=>{
  state.notasFiscais[0].categoria='material';state.materiais=[{id:'m',descricao:'Material de conferência',unidade:'UN'}];
  state[key]=[{id:'source',obraId:source==='despesa_empresa'?'':'a',numero:source==='pedido'?label:undefined,descricao:label,status:source==='pedido'?'enviado':'ativo',data:'2026-09-20',competencia:'2026-09',dataEmissao:'2026-09-20',tipo:'livre',valor:100,valorPrevisto:100,version:0,categoria:'',itens:[{id:'i',materialId:'m',qtd:2,precoUnit:50,qtdRecebida:0}],recebimentos:[],pagamentos:[]}];
 }});await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-09');
 const row=page.getByRole('region',{name:'Pendências para conferência do fechamento'}).getByRole('article').filter({hasText:label});await row.getByRole('button',{name:'Corrigir origem',exact:true}).click();const modal=page.getByRole('dialog',{name:'Corrigir origem do fechamento'});
 if(['despesa_empresa','outra_despesa'].includes(source)){const select=modal.getByLabel('Categoria da origem',{exact:true});await select.selectOption(await select.getByRole('option').nth(1).getAttribute('value'));}
 await modal.getByLabel('Nome da referência',{exact:true}).fill('Original conferido');await modal.getByLabel('Endereço do documento',{exact:true}).fill('https://files.example.test/original.pdf');await modal.getByRole('button',{name:'Adicionar referência',exact:true}).click();await modal.getByLabel(/^Motivo da correção/).fill('Original conferido para o fechamento');await page.screenshot({path:test.info().outputPath('formulario-origem.png')});await modal.getByRole('button',{name:'Salvar correção da origem',exact:true}).click();await expect(modal).toHaveCount(0);
 await expect(page.getByLabel('Competência',{exact:true})).toHaveValue('2026-09');await expect(row).toHaveCount(0);expect(app.state()[key]).toHaveLength(1);expect(app.state()[key][0]).toMatchObject({valor:100,valorPrevisto:100,version:1,pagamentos:[],recebimentos:[]});expect(app.state()[key][0].documentos).toHaveLength(1);expect(app.commands).toHaveLength(1);expect(app.commands[0].type).toBe('ORIGEM_FECHAMENTO_CORRIGIDA');expect(app.errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await page.screenshot({path:test.info().outputPath('origem-nao-fiscal-corrigida.png')});
});

async function openInvoiceCorrection(page){
 await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-09');await page.getByRole('button',{name:'Corrigir ficha fiscal',exact:true}).click();
 const modal=page.getByRole('dialog');if(page.viewportSize().width<901)await modal.getByRole('tab',{name:'Dados da nota',exact:true}).click();return modal;
}
test('WF06 conflito real de versão exige escolha e preserva alterações concorrentes',async({page})=>{
 const app=await enter(page,{mode:'concurrent'});const modal=await openInvoiceCorrection(page);await modal.getByLabel('Fornecedor',{exact:true}).fill('Meu fornecedor');await modal.getByLabel('Categoria',{exact:true}).selectOption('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal.getByRole('region',{name:'Recuperação da edição'})).toBeVisible();
 expect(app.commands[0].expectedVersion).toBe(0);expect(app.state().notasFiscais[0].version).toBe(1);await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true})).toBeDisabled();await modal.getByLabel('Valor para Fornecedor',{exact:true}).selectOption('current');await page.screenshot({path:test.info().outputPath('conflito-versao.png')});
 await modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true}).click();await expect(modal.getByLabel('Fornecedor',{exact:true})).toHaveValue('Fornecedor concorrente');await expect(modal.getByLabel('Categoria',{exact:true})).toHaveValue('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.commands).toHaveLength(2);expect(app.commands[1].expectedVersion).toBe(1);expect(app.state().notasFiscais[0]).toMatchObject({fornecedorNome:'Fornecedor concorrente',categoria:'material',version:2});expect(app.errors).toEqual([]);
});
test('WF06 sessão expirada renova a mesma conta sem perder o formulário',async({page})=>{
 const app=await enter(page,{mode:'expired'});const modal=await openInvoiceCorrection(page);await modal.getByLabel('Fornecedor',{exact:true}).fill('Fornecedor mantido');await modal.getByLabel('Categoria',{exact:true}).selectOption('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal.getByLabel('Senha para renovar a sessão',{exact:true})).toBeVisible();await expect(modal.getByLabel('Fornecedor',{exact:true})).toHaveValue('Fornecedor mantido');
 await modal.getByLabel('Senha para renovar a sessão',{exact:true}).fill('renovar-local');await modal.getByRole('button',{name:'Renovar sessão',exact:true}).click();await expect(modal.getByRole('region',{name:'Recuperação da edição'})).toContainText('Acesso renovado');await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true}).click();await expect(modal.getByLabel('Fornecedor',{exact:true})).toHaveValue('Fornecedor mantido');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.commands).toHaveLength(2);expect(app.state().notasFiscais[0].fornecedorNome).toBe('Fornecedor mantido');expect(app.errors).toEqual([]);
});
test('WF06 resposta perdida consulta o recibo e não duplica a confirmação',async({page})=>{
 const app=await enter(page,{mode:'lost-response'});const modal=await openInvoiceCorrection(page);await modal.getByLabel('Categoria',{exact:true}).selectOption('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal.getByRole('region',{name:'Recuperação da edição'})).toBeVisible();expect(app.state().notasFiscais[0].categoria).toBe('material');expect(app.commands).toHaveLength(1);
 await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await expect(modal.getByRole('button',{name:'Aplicar confirmação recebida',exact:true})).toBeVisible();await modal.getByRole('button',{name:'Aplicar confirmação recebida',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.commands).toHaveLength(1);expect(app.state().notasFiscais).toHaveLength(2);expect(app.errors).toEqual([]);
});
test('WF06 revisão de conflito cabe em 320 px e mantém a escolha explícita',async({page})=>{
 await page.setViewportSize({width:320,height:844});const app=await enter(page,{mode:'concurrent'});const modal=await openInvoiceCorrection(page);await modal.getByLabel('Fornecedor',{exact:true}).fill('Escolha explícita');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByLabel('Valor para Fornecedor',{exact:true}).selectOption('mine');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(await modal.evaluate(e=>e.scrollWidth>e.clientWidth+1)).toBe(false);await page.screenshot({path:test.info().outputPath('conflito-320.png')});await modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true}).click();await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.state().notasFiscais[0].fornecedorNome).toBe('Escolha explícita');expect(app.commands).toHaveLength(2);expect(app.errors).toEqual([]);
});
test('WF06 queda antes da confirmação repete somente por ação explícita com a mesma chave',async({page})=>{
 const app=await enter(page,{mode:'lost-before'});const modal=await openInvoiceCorrection(page);await modal.getByLabel('Categoria',{exact:true}).selectOption('material');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal.getByRole('region',{name:'Recuperação da edição'})).toBeVisible();expect(app.commands).toHaveLength(1);expect(app.state().notasFiscais[0].categoria).toBe('');
 await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.commands).toHaveLength(2);expect(app.commands[0].idempotencyKey).toBe(app.commands[1].idempotencyKey);expect(app.state().notasFiscais[0].version).toBe(1);expect(app.errors).toEqual([]);
});
test('WF06 fechamento renova a sessão e conserva competência e chave da tentativa',async({page})=>{
 const app=await enter(page,{mode:'expired-closing'});await selectFinanceArea(page,'Fechamento');await page.getByLabel('Competência',{exact:true}).fill('2026-08');page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Fechar competência',exact:true}).click();await expect(page.getByLabel('Senha para renovar a sessão',{exact:true})).toBeVisible();await page.getByLabel('Senha para renovar a sessão',{exact:true}).fill('renovar-local');await page.getByRole('button',{name:'Renovar sessão',exact:true}).click();await expect(page.getByText('Acesso renovado. Confira a competência e confirme novamente quando estiver pronto.',{exact:true})).toBeVisible();await expect(page.getByLabel('Competência',{exact:true})).toHaveValue('2026-08');await page.getByRole('button',{name:'Fechar competência',exact:true}).click();await expect(page.getByText(/Fechado por Servidor confirmado/)).toBeVisible();expect(app.closing).toHaveLength(2);expect(app.closing[0].idempotencyKey).toBe(app.closing[1].idempotencyKey);expect(app.state().fechamentosFinanceiros).toHaveLength(1);expect(app.errors).toEqual([]);
});
test('WF06 novo documento conserva a identidade após queda e edição do preenchimento',async({page})=>{
 const app=await enter(page,{mode:'lost-before'});await selectFinanceArea(page,'Documentos');await page.getByRole('button',{name:'Receber documento fiscal',exact:true}).click();const modal=page.getByRole('dialog');if(page.viewportSize().width<901)await modal.getByRole('tab',{name:'Dados da nota',exact:true}).click();await modal.getByLabel('Obra *',{exact:true}).selectOption('a');await modal.getByLabel('Número *',{exact:true}).fill('NOVA-WF06');await modal.getByLabel('Valor bruto *',{exact:true}).fill('100');await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal.getByRole('region',{name:'Recuperação da edição'})).toBeVisible();await modal.getByLabel('Fornecedor',{exact:true}).fill('Fornecedor revisto');await modal.getByRole('button',{name:'Consultar versão atual',exact:true}).click();await modal.getByRole('button',{name:'Aplicar revisão ao formulário',exact:true}).click();await modal.getByRole('button',{name:'Salvar e conferir',exact:true}).click();await expect(modal).toHaveCount(0);expect(app.state().notasFiscais).toHaveLength(3);expect(app.commands[0].payload.invoice.id).toBe(app.commands[1].payload.invoice.id);expect(app.state().notasFiscais.find(n=>n.numero==='NOVA-WF06').fornecedorNome).toBe('Fornecedor revisto');expect(app.errors).toEqual([]);
});
