import {expect,test} from '@playwright/test';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

async function enter(page){
 const user={id:'flow-demo',nome:'Operador de teste',email:'flow@local.test',role:'admin',active:true};
 let state={usuarios:[user],config:{paymentHolidays:[]},employees:[],attendance:{},obras:[{id:'work',name:'Obra de teste local',status:'active',hasCaixa:true}],fornecedores:[{id:'supplier',nome:'Fornecedor de teste',ativo:true}],materiais:[{id:'cement',descricao:'Cimento de teste',unidade:'KG',ativo:true}],
  solicitacoesCompra:[{id:'request',numero:'SC-TESTE',obraId:'work',status:'pedido_gerado',aprovacaoInstanciaId:'approval',pedidoId:'order',itens:[]}],instanciasAprovacao:[{id:'approval',status:'em_andamento'}],
  pedidos:[{id:'order',numero:'PC-AVISO',obraId:'work',fornecedorId:'supplier',data:'2026-10-31',previsao:'2026-11-03',status:'enviado',version:1,solicitacaoId:'request',pagamentos:[],documentos:[],itens:[{id:'line',materialId:'cement',qtd:10,qtdRecebida:0,precoUnit:20,unidadeCompra:'SC',unidadeRef:'KG',fatorConversao:50}]}],
  notasFiscais:[{id:'invoice',numero:'NF-AVISO',tipo:'nfe',obraId:'work',pedidoId:'order',fornecedorId:'supplier',fornecedorNome:'Fornecedor de teste',emissao:'2026-10-31',vencimento:'2026-11-10',valorBruto:200,valorLiquido:200,status:'recebida',version:1,documentos:[],pagamentos:[],divergencias:['Nota anterior à entrega física.']}],movEstoque:[],caixaObra:[],transacoes:[]};
 const errors=[],commands=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
 await page.route('**/api/data',route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==='profiles')return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==='operational-command'){
   commands.push(body.command);
   const result=applyOperationalCommand(state,{...body.command,actorId:user.id,actorName:user.nome,actorRole:user.role});
   if(result.ok)state=result.data;
   return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:'2026-10-31T15:00:01Z'}});
  }
  if(['save','save-sections','financial-command'].includes(body.action))throw new Error(`Gravação fora do cenário: ${body.action}`);
  return route.fulfill({json:{ok:true,usuario:user,data:state,accessToken:'isolated',refreshToken:'isolated',updatedAt:'2026-10-31T15:00:00Z'}});
 });
 await page.goto('/');await page.locator('#login-email').fill(user.email);await page.locator('#login-senha').fill('isolated');await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
 await expect(page.getByRole('button',{name:'Ajuda',exact:true})).toBeVisible();
 const open=async name=>{await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');await search.fill(name);await search.locator('xpath=../..').getByRole('button').filter({hasText:name}).first().click();};
 return {state:()=>state,open,errors,commands};
}

test('recebimento parcial avança com aprovação pendente e estoque atômico',async({page})=>{
 const app=await enter(page);await app.open('Compras');await selectWorkspaceArea(page,'Fluxo de compras','Pedidos');
 await page.getByRole('button',{name:'Receber material',exact:true}).first().click();
 const modal=page.getByRole('dialog');await modal.getByLabel('Chegou agora (SC)').fill('6');
 await modal.getByRole('button',{name:'Dar entrada no estoque'}).click();
 await expect(modal).toHaveCount(0);
 expect(app.state().pedidos[0].itens[0].qtdRecebida).toBe(6);expect(app.state().movEstoque[0].qtd).toBe(300);
 expect(app.state().instanciasAprovacao[0].status).toBe('em_andamento');expect(app.state().pedidos[0].pagamentos).toEqual([]);
 await page.getByRole('button',{name:'Ficha completa · notas e anexos',exact:true}).first().click();
 const flow=page.getByRole('region',{name:'Etapas e responsáveis da compra'});await expect(flow).toBeVisible();
 await expect(flow).toContainText('Você pode continuar');await expect(flow).toContainText('Responsável:');
 await flow.scrollIntoViewIfNeeded();
 await page.screenshot({path:test.info().outputPath('compras-avisos.png')});expect(app.errors).toEqual([]);
});

test('pagamento disponível com nota em conferência mantém pendência fiscal',async({page})=>{
 const app=await enter(page);await app.open('Gestão financeira');await selectWorkspaceArea(page,'Áreas do financeiro','Pagamentos');
 await page.getByRole('button',{name:'Registrar pagamento',exact:true}).first().click();
 const modal=page.getByRole('dialog');await expect(modal).toContainText('Pagamento com conferência fiscal pendente.');
 await modal.getByLabel('Valor pago *',{exact:true}).fill('200');
 await modal.getByRole('button',{name:'Registrar pagamento',exact:true}).click();await expect(modal).toHaveCount(0);
 expect(app.state().notasFiscais[0]).toMatchObject({status:'paga',conferenciaFiscalPendente:true});
 expect(app.state().notasFiscais[0].pagamentos[0].valor).toBe(200);expect(app.state().movEstoque).toEqual([]);
 await selectWorkspaceArea(page,'Áreas do financeiro','Notas fiscais');
 await page.getByRole('button',{name:'Em conferência',exact:true}).click();
 await expect(page.getByText(/NF-AVISO/).first()).toBeVisible();
 await page.getByRole('button',{name:'Concluir conferência fiscal',exact:true}).click();
 await expect.poll(()=>app.state().notasFiscais[0].conferenciaFiscalPendente).toBe(false);
 expect(app.state().notasFiscais[0].status).toBe('paga');expect(app.commands).toHaveLength(2);expect(app.errors).toEqual([]);
});

test('ajuda explica responsáveis e exceções sem perder o contexto',async({page})=>{
 const app=await enter(page);await app.open('Compras');await selectWorkspaceArea(page,'Fluxo de compras','Receber');
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();
 const help=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(help).toContainText('Quem cuida de cada parte');
 await help.getByText('Pagamento antes da conferência',{exact:true}).click();
 await expect(help).toContainText('a falta dele gera aviso');
 await help.getByText('Aprovação pendente ou recusada',{exact:true}).click();
 await expect(help).toContainText('O pedido pode seguir com aviso');
 expect(await help.evaluate(element=>element.scrollWidth>element.clientWidth+1)).toBe(false);
 await page.screenshot({path:test.info().outputPath('ajuda-excecoes.png')});expect(app.commands).toEqual([]);
});
