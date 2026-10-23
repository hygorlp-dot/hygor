import { expect, test } from "@playwright/test";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

const PROFILE={id:"qa-admin",nome:"Administrador QA",email:"qa-admin@arcd.test",role:"admin",active:true};
const item=(id,materialId,qtd=10,precoUnit=25,qtdRecebida=0)=>({id,materialId,qtd,precoUnit,qtdRecebida,unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,orcNivel1Id:"foundation"});
const fixture=()=>({
  usuarios:[PROFILE],obras:[{id:"a",name:"Residencial Alameda",status:"active"},{id:"b",name:"Residencial Horizonte",status:"active"}],
  materiais:[{id:"cement",codigo:"MAT-1",descricao:"CIMENTO CP II",unidade:"UN",ativo:true},{id:"steel",codigo:"MAT-2",descricao:"AÇO CA 50",unidade:"KG",ativo:true}],
  fornecedores:[{id:"central",nome:"Depósito Central",ativo:true},{id:"norte",nome:"Materiais Norte",ativo:true}],
  solicitacoesCompra:[{id:"req",numero:"SC-001",obraId:"a",status:"enviada",necessidade:"2026-10-22",criadoEm:"2026-10-20T12:00:00Z",solicitanteId:PROFILE.id,solicitanteNome:PROFILE.nome,
    prioridade:"normal",itens:[{id:"ri",materialId:"cement",descricaoRef:"CIMENTO CP II",unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,quantidade:10,fonteRef:"PRÓPRIO",codigoRef:"MAT-1",orcNivel1Id:"foundation"}]},
    {id:"req-approval",numero:"SC-002",obraId:"a",status:"enviada",necessidade:"2026-10-27",solicitanteNome:"Engenharia QA",aprovacaoInstanciaId:"apr",itens:[{id:"ra",descricaoRef:"Areia média",unidadeRef:"M3",quantidade:5}]}],
  instanciasAprovacao:[{id:"apr",status:"bloqueada",resultadosEtapas:[]}],
  cotacoes:[{id:"quote",numero:"COT-001",obraId:"a",status:"aberta",data:"2026-10-20",materialId:"cement",qtd:10,unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,propostas:[{id:"p1",fornecedorId:"central",precoUnit:25,prazoDias:2},{id:"p2",fornecedorId:"norte",precoUnit:30,prazoDias:3}]}],
  pedidos:[{id:"delivery",numero:"PC-001",obraId:"a",fornecedorId:"central",status:"enviado",data:"2026-10-20",previsao:"2026-10-24",origemPagamento:"empresa",pagamentos:[],itens:[item("di","cement")]},
    {id:"draft",numero:"PC-002",obraId:"a",fornecedorId:"norte",status:"rascunho",data:"2026-10-20",previsao:"2026-10-26",origemPagamento:"empresa",pagamentos:[],itens:[item("draft-i","cement",5)]},
    {id:"other",numero:"PC-003",obraId:"b",fornecedorId:"central",status:"enviado",data:"2026-10-20",previsao:"2026-10-21",origemPagamento:"cliente_direto",pagamentos:[{id:"pg",data:"2026-10-20",valor:75,origem:"cliente_direto",conciliado:true}],itens:[item("oi","cement",3)]}],
  orcamentos:[{id:"budget",obraId:"a",nome:"Orçamento de teste",versionStatus:"rascunho",status:"rascunho",etapas:[{id:"foundation",nome:"FUNDAÇÕES",parentId:""}],itens:[]}],
  budgetBaselines:[],movEstoque:[],employees:[],attendance:{},attendanceLocks:{},unlockRequests:[],dailyCheckDate:"",changeLog:[],
  medicoes:[],pagsTerceiros:[],transacoes:[],caixaObra:[],notasFiscais:[],config:{paymentHolidays:[]},
});

async function openPurchases(page){
  if(page.viewportSize().width<1100){
    await page.getByRole("button",{name:"Abrir Compras",exact:true}).click();
  }else{
    const sidebar=page.locator(".arcd-sidebar");
    const group=sidebar.locator(".nav-grp-hd").filter({hasText:/^Compras/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    if(!await body.isVisible())await group.click();
    await body.locator(".nav-item").filter({hasText:/^Compras$/}).click();
  }
  await expect(page.locator(".purchase-header")).toBeVisible();
}

async function enter(page,{role="admin",failFirstRequest=false}={}) {
  let state=fixture();state.usuarios=[{...PROFILE,role}];
  let fail=failFirstRequest;const commands=[];
  await page.clock.setFixedTime(new Date("2026-10-23T12:00:00-03:00"));
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,bases:[],items:[],components:[],presencas:[],reply:""}}));
  await page.route("**/api/data",async route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:state.usuarios,precisaSetup:false}});
    if(body.action==="auth-refresh")return route.fulfill({json:{accessToken:"qa-access",refreshToken:"qa-refresh"}});
    if(body.action==="operational-command"){
      commands.push(body.command);
      await new Promise(resolve=>setTimeout(resolve,150));
      if(fail&&body.command.type===OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED){fail=false;return route.fulfill({json:{ok:false,reason:"Falha simulada: tente novamente."}});}
      const result=applyOperationalCommand(state,body.command);
      if(result.ok)state=result.data;
      return route.fulfill({json:{...result,updatedAt:"2026-10-23T15:00:00Z"}});
    }
    return route.fulfill({json:{ok:true,accessToken:"qa-access",refreshToken:"qa-refresh",usuario:state.usuarios[0],data:state,updatedAt:"2026-10-23T12:00:00Z"}});
  });
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");await page.locator("#login-email").fill(PROFILE.email);await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button",{name:"Acessar central ARCD"}).click();
  await openPurchases(page);
  return {state:()=>state,commands,errors};
}
const navigate=(page,name)=>page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button",{name:new RegExp(`^${name}`)}).click();
const selectWork=page=>page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true}).selectOption("a");

test("fila por obra, múltiplas palavras, aprovação e retorno preservam o contexto",async({page})=>{
  const app=await enter(page);await selectWork(page);
  await page.getByLabel("Buscar na fila").fill("central cimento");
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(2);
  await page.getByRole("button",{name:"Comparar propostas · COT-001",exact:true}).click();
  await expect(page.getByText("Mapa de cotações",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Voltar à fila",exact:true}).click();
  await expect(page.getByLabel("Buscar na fila")).toHaveValue("central cimento");
  await page.getByRole("button",{name:"Limpar filtros",exact:true}).click();
  await page.getByRole("button",{name:/Em aprovação/}).click();
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(1);
  await navigate(page,"Receber");
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(1);
  await navigate(page,"Aprovações");
  await page.getByRole("button",{name:"Ver aprovação · SC-002"}).click();
  await expect(page.locator("#purchase-record-req-approval")).toBeFocused();
  await expect(page.getByText("Aguardando configuração",{exact:true})).toBeVisible();
  expect(app.errors).toEqual([]);
});

test("receber parcialmente a prazo atualiza estoque e saldo sem registrar pagamento",async({page})=>{
  const app=await enter(page);await selectWork(page);await navigate(page,"Receber");
  await page.getByRole("button",{name:"Receber materiais · PC-001"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).not.toContainText("Pagamento já verificado");
  await dialog.getByLabel("Chegou agora (UN)").fill("11");
  await expect(dialog.getByRole("button",{name:"Dar entrada no estoque"})).toBeDisabled();
  await dialog.getByLabel("Chegou agora (UN)").fill("4");
  await expect(dialog).toContainText("saldo após esta entrada: 6 UN");
  await dialog.screenshot({path:test.info().outputPath("recebimento-parcial.png")});
  await dialog.getByRole("button",{name:"Dar entrada no estoque"}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".purchase-save-state")).toContainText("Salvo e confirmado");
  expect(app.state().pedidos.find(order=>order.id==="delivery").itens[0].qtdRecebida).toBe(4);
  expect(app.state().pedidos.find(order=>order.id==="delivery").pagamentos).toEqual([]);
  expect(app.state().movEstoque.filter(movement=>movement.pedidoId==="delivery").reduce((sum,movement)=>sum+movement.qtd,0)).toBe(4);
  await page.reload();await openPurchases(page);await selectWork(page);await navigate(page,"Receber");
  await page.getByRole("button",{name:"Receber materiais · PC-001"}).click();
  await expect(page.getByRole("dialog").getByLabel("Chegou agora (UN)")).toHaveValue("6");
  expect(app.errors).toEqual([]);
});

test("solicitação mantém preenchimento após falha e salva conversão e etapa ao tentar novamente",async({page})=>{
  const app=await enter(page,{failFirstRequest:true});await selectWork(page);
  await page.getByRole("button",{name:"Nova solicitação",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Data necessária na obra *").fill("2026-10-29");
  await dialog.getByRole("button",{name:"Adicionar somente a esta solicitação"}).click();
  await dialog.getByLabel("Descrição *").fill("ARGAMASSA TESTE");
  await dialog.getByLabel("Unidade *",{exact:true}).fill("KG");
  await dialog.getByRole("combobox",{name:"Unidade de compra",exact:true}).selectOption("SC");
  await dialog.getByLabel("Conteúdo de 1 SC em KG *").fill("20");
  await dialog.getByLabel("Quantidade de compra *").fill("10");
  await dialog.getByLabel("Etapa principal do orçamento").selectOption("foundation");
  await expect(dialog).toContainText("10 SC = 200 KG");
  await dialog.screenshot({path:test.info().outputPath("solicitacao-conversao.png")});
  await dialog.getByRole("button",{name:"Formalizar e enviar para Compras"}).click();
  await expect(dialog.locator(".purchase-save-state")).toContainText("Falha");
  await expect(dialog.getByLabel("Descrição *")).toHaveValue("ARGAMASSA TESTE");
  await dialog.getByRole("button",{name:"Formalizar e enviar para Compras"}).click();
  await expect(dialog).not.toBeVisible();
  const request=app.state().solicitacoesCompra.find(request=>request.itens.some(material=>material.descricaoRef==="ARGAMASSA TESTE"));
  expect(request.itens[0]).toMatchObject({quantidade:10,unidadeCompra:"SC",unidadeRef:"KG",fatorConversao:20,orcNivel1Id:"foundation"});
  expect(request.itens[0].materialId).toBeTruthy();
  expect(app.commands.filter(command=>command.type===OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED)).toHaveLength(2);
  expect(app.errors).toEqual([]);
});

test("pedido salva rascunho, encontra material por palavras e confirma persistência",async({page})=>{
  const app=await enter(page);await selectWork(page);
  await page.getByRole("button",{name:"Revisar pedido · PC-002"}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Previsão de entrega").fill("2026-10-30");
  await dialog.getByLabel("Motivo do ajuste *").fill("Ajuste do prazo com o fornecedor");
  await dialog.getByRole("button",{name:"Salvar rascunho"}).click();
  await expect(dialog).not.toBeVisible();
  expect(app.state().pedidos.find(order=>order.id==="draft").previsao).toBe("2026-10-30");
  await navigate(page,"Pedidos");await page.getByLabel("Buscar pedidos").fill("norte cimento");
  await expect(page.getByText("PC-002",{exact:true})).toBeVisible();
  await expect(page.getByText("PC-001",{exact:true})).not.toBeVisible();
  expect(app.errors).toEqual([]);
});

test("catálogo reutiliza o material existente sem criar uma cópia",async({page})=>{
  const app=await enter(page);await selectWork(page);
  await page.getByRole("button",{name:"Nova solicitação",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Data necessária na obra *").fill("2026-10-29");
  await dialog.getByLabel("Pesquisar no catálogo").fill("ii cimento");
  await dialog.getByRole("button",{name:/MAT-1 CIMENTO CP II Adicionar/}).click();
  await dialog.getByLabel("Quantidade de compra *").fill("12");
  await dialog.getByRole("button",{name:"Formalizar e enviar para Compras"}).click();
  await expect(dialog).not.toBeVisible();
  expect(app.state().materiais).toHaveLength(2);
  expect(app.state().solicitacoesCompra.at(-1).itens[0].materialId).toBe("cement");
  expect(app.errors).toEqual([]);
});

test("solicitação vira cotação e pedido com material, quantidade e apropriação preservados",async({page})=>{
  const app=await enter(page);await selectWork(page);
  await page.getByRole("button",{name:"Analisar solicitação · SC-001"}).click();
  await page.locator("#purchase-record-req").getByRole("button",{name:"Cotar",exact:true}).click();
  let dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Fornecedor 1",exact:true}).selectOption("central");
  await dialog.getByRole("combobox",{name:"Fornecedor 2",exact:true}).selectOption("norte");
  await dialog.getByLabel("Preço unit. (R$)",{exact:true}).nth(0).fill("20");
  await dialog.getByLabel("Preço unit. (R$)",{exact:true}).nth(1).fill("25");
  await dialog.screenshot({path:test.info().outputPath("cotacao-comparacao.png")});
  await dialog.getByRole("button",{name:"Salvar cotação",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const quote=app.state().cotacoes.find(quote=>quote.solicitacaoId==="req");
  expect(quote.itens[0]).toMatchObject({materialId:"cement",qtd:10,orcNivel1Id:"foundation"});
  await navigate(page,"Cotar");
  await page.getByLabel("Buscar",{exact:true}).fill("SC-001");
  const quoteRow=page.locator(`[id="purchase-record-${quote.id}"]`);
  await quoteRow.locator('[role="button"]').first().click();
  await quoteRow.getByRole("button",{name:"Decidir e gerar pedidos"}).click();
  dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"Aprovar e gerar pedido(s)"}).click();
  await expect(dialog).not.toBeVisible();
  const order=app.state().pedidos.find(order=>order.cotacaoId===quote.id);
  expect(order).toMatchObject({obraId:"a",fornecedorId:"central"});
  expect(order.itens[0]).toMatchObject({materialId:"cement",qtd:10,precoUnit:20,orcNivel1Id:"foundation"});
  expect(app.errors).toEqual([]);
});

test("pagamento direto do cliente continua separado da entrega e do caixa da empresa",async({page})=>{
  const app=await enter(page);
  const delivery=page.locator(".purchase-queue-table tbody tr").filter({hasText:"PC-003"});
  await expect(delivery).toContainText("Pago");
  await expect(delivery.getByRole("button",{name:"Receber materiais · PC-003"})).toBeVisible();
  await page.getByRole("navigation",{name:"Financeiro e consultas de compras"}).getByRole("button",{name:/^Pagamentos/}).click();
  await expect(page.locator(".compras-funding")).toContainText("Cliente direto");
  await expect(page.locator(".compras-funding")).toContainText("75,00");
  expect(app.state().pedidos.find(order=>order.id==="other").pagamentos[0]).toMatchObject({origem:"cliente_direto",conciliado:true});
  expect(app.state().transacoes).toEqual([]);
  expect(app.errors).toEqual([]);
});

test("engenharia consulta propostas sem ganhar ações de decisão de Compras",async({page})=>{
  const app=await enter(page,{role:"engenheiro"});
  await navigate(page,"Cotar");
  await page.locator("#purchase-record-quote").locator('[role="button"]').first().click();
  await expect(page.getByRole("button",{name:"Decidir e gerar pedidos"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Editar mapa"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Excluir cotação",exact:true})).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

for(const width of [390,768,1280,1440])test(`layout, teclado e filtros em ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const app=await enter(page);await selectWork(page);
  await expect(page.getByRole("button",{name:"Receber materiais · PC-001"})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button")).toHaveCount(6);
  for(const button of await page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button").all())await expect(button).toBeInViewport();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow,"a página não deve transbordar horizontalmente").toBe(false);
  const search=page.getByLabel("Buscar na fila");await search.focus();await page.keyboard.type("horizonte");
  await expect(page.getByText("Nenhum resultado para estes filtros",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Mostrar todos os registros"}).click();
  await page.screenshot({path:test.info().outputPath(`compras-${width}.png`),fullPage:true});
  expect(app.errors).toEqual([]);
});

test("formulários no celular cabem na tela e protegem alterações ao sair",async({page})=>{
  await page.setViewportSize({width:390,height:844});const app=await enter(page);await selectWork(page);
  await page.getByRole("button",{name:"Nova solicitação",exact:true}).click();
  let dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"Adicionar somente a esta solicitação"}).click();
  await dialog.getByLabel("Descrição *").fill("Material de teste");
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:test.info().outputPath("solicitacao-mobile.png")});
  await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
  await page.getByRole("button",{name:"Continuar editando",exact:true}).click();
  await expect(dialog.getByLabel("Descrição *")).toHaveValue("Material de teste");
  await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
  await page.getByRole("button",{name:"Descartar alterações",exact:true}).click();
  await page.getByRole("button",{name:"Comparar propostas · COT-001",exact:true}).click();
  await page.getByRole("button",{name:"Editar mapa",exact:true}).click();
  dialog=page.getByRole("dialog");
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:test.info().outputPath("cotacao-mobile.png")});
  expect(app.errors).toEqual([]);
});
