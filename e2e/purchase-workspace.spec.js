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
    await page.getByRole("button",{name:"Abrir Compras e suprimentos",exact:true}).click();
  }else{
    const sidebar=page.locator(".arcd-sidebar");
    const group=sidebar.locator(".nav-grp-hd").filter({hasText:/^Compras/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    if(!await body.isVisible())await group.click();
    await body.locator(".nav-item").filter({hasText:/^Compras$/}).click();
  }
  await expect(page.locator(".purchase-header")).toBeVisible();
}

async function enter(page,{role="admin",failFirstRequest=false,prepare=null}={}) {
  let state=fixture();state.usuarios=[{...PROFILE,role}];prepare?.(state);
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
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
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
  await page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button",{name:/^Pagamentos/}).click();
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
  await expect(page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button")).toHaveCount(7);
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

test("comparativo por obra ordena por risco, abre a obra escolhida e explica a falta de baseline",async({page})=>{
  const app=await enter(page);
  const table=page.locator(".purchase-work-table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tfoot")).toContainText("Todas as obras (2)");
  await expect(page.getByText("2 de 2 obra(s) sem orçamento de controle")).toBeVisible();

  await page.getByRole("button",{name:"Abrir compras de Residencial Horizonte",exact:true}).click();
  await expect(page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true})).toHaveValue("b");
  await expect(page.locator(".purchase-work-table")).toHaveCount(0);
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".purchase-queue-table tbody tr").first()).toContainText("PC-003");

  // Obra com orçamento em rascunho: o motivo real é "sem baseline aprovada", não "sem orçamento".
  await selectWork(page);
  const tools=page.locator("details.purchase-tools");
  const openOrcado=async()=>{
    await tools.locator("summary").click();
    await tools.getByRole("button",{name:"Orçado x comprado",exact:true}).click();
    // O menu fecha ao escolher e não cobre o conteúdo; o botão mostra onde você está.
    await expect(tools.locator("summary")).toHaveText("Consultas e cadastros · Orçado x comprado");
    await expect.poll(()=>tools.evaluate(element=>element.open)).toBe(false);
  };
  await openOrcado();
  await expect(page.getByRole("status").filter({hasText:"Sem baseline aprovada."})).toBeVisible();

  // Em "Todas as obras" o orçado × comprado vira o comparativo, não um beco sem saída.
  await page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true}).selectOption("all");
  await openOrcado();
  await expect(page.getByRole("heading",{name:"Orçado × comprado por obra"})).toBeVisible();
  await page.getByRole("button",{name:"Abrir compras de Residencial Alameda",exact:true}).click();
  await expect(page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true})).toHaveValue("a");
  await expect(page.getByRole("status").filter({hasText:"Sem baseline aprovada."})).toBeVisible();
  expect(app.errors).toEqual([]);
});

test("orçado × comprado mostra o maior estouro primeiro, a barra proporcional e os pedidos da etapa",async({page})=>{
  const app=await enter(page,{prepare:state=>{
    state.orcamentos=[{id:"budget",obraId:"a",nome:"Orçamento aprovado",versionStatus:"aprovado",status:"aprovado",
      etapas:[{id:"foundation",nome:"FUNDAÇÕES",parentId:"",ordem:1},{id:"paint",nome:"PINTURA",parentId:"",ordem:2},{id:"roof",nome:"COBERTURA",parentId:"",ordem:3}],
      itens:[{id:"f",etapaId:"foundation",quantidade:1,precoUnit:1000},{id:"p",etapaId:"paint",quantidade:1,precoUnit:100},{id:"r",etapaId:"roof",quantidade:1,precoUnit:10000}]}];
    state.budgetBaselines=[{id:"bl",obraId:"a",tipo:"controle",ativo:true,budgetId:"budget"}];
    // PC-001 (enviado): R$ 250 na fundação (25%). PC-004: R$ 2.000 na pintura (2.000%) e R$ 1.050 na cobertura.
    state.pedidos.push({id:"paint-order",numero:"PC-004",obraId:"a",fornecedorId:"norte",status:"enviado",data:"2026-10-21",previsao:"2026-10-25",
      origemPagamento:"empresa",pagamentos:[],itens:[{...item("pi","cement",80,25),orcNivel1Id:"paint"},{...item("ri","cement",42,25),orcNivel1Id:"roof"}]});
  }});
  await selectWork(page);
  const tools=page.locator("details.purchase-tools");
  await tools.locator("summary").click();
  await tools.getByRole("button",{name:"Orçado x comprado",exact:true}).click();

  const etapas=page.locator(".orc-etapa");
  await expect(etapas).toHaveCount(3);
  await expect(etapas.nth(0)).toContainText("PINTURA");
  await expect(etapas.nth(0)).toHaveAttribute("data-alerta","estourou");
  await expect(etapas.nth(1)).toContainText("FUNDAÇÕES");
  await expect(etapas.nth(2)).toContainText("COBERTURA");

  // 2.000%: o trecho vermelho ocupa 95% da barra.
  const excesso=etapas.nth(0).locator("[data-segmento=excesso]");
  await expect(excesso).toBeVisible();
  const largura=await excesso.evaluate(el=>el.getBoundingClientRect().width/el.parentElement.getBoundingClientRect().width);
  expect(largura).toBeGreaterThan(0.94);
  expect(largura).toBeLessThan(0.96);
  await expect(etapas.nth(1).locator("[data-segmento=excesso]")).toHaveCount(0);

  // Detalhe: a fundação lista o pedido enviado e o rascunho separado.
  await etapas.nth(1).getByText("Ver os 2 pedidos desta etapa").click();
  await expect(etapas.nth(1).locator("li")).toHaveCount(2);
  await expect(etapas.nth(1).locator("li").nth(0)).toContainText("PC-001");
  await expect(etapas.nth(1).locator("li").nth(0)).toContainText("Depósito Central");
  await expect(etapas.nth(1).locator("li").nth(1)).toContainText("PC-002");
  await expect(etapas.nth(1).locator("li").nth(1)).toContainText("(não comprometido)");
  await etapas.nth(0).getByText("Ver o pedido desta etapa").click();
  await expect(etapas.nth(0).locator("li")).toContainText("PC-004");
  await expect(etapas.nth(0).locator("li")).toContainText("R$ 2.000,00");
  expect(app.errors).toEqual([]);
});

test("cabeçalho compacto mostra a primeira linha da fila em 1000 px e o menu não repete nomes das abas",async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  const app=await enter(page);
  await selectWork(page);
  // Obra, aviso de salvamento e ações ficam no próprio cabeçalho.
  await expect(page.locator(".purchase-header .purchase-context-bar").getByLabel("Obra",{exact:true})).toHaveValue("a");
  const primeira=page.locator(".purchase-queue-table tbody tr").first();
  await expect(primeira).toBeVisible();
  const caixa=await primeira.boundingBox();
  expect(caixa.y+40).toBeLessThan(1000);
  // "Fila de trabalho" aparece uma vez (na navegação); o painel tem título próprio.
  await expect(page.locator("#compras-area-atual")).toHaveAttribute("data-compact","true");
  await expect(page.locator("#compras-area-atual h3")).toHaveText("Fila de trabalho");
  const titulo=await page.locator("#compras-area-atual h3").boundingBox();
  expect(titulo.width*titulo.height).toBeLessThanOrEqual(1);

  // Menu lateral de Compras e abas internas: nenhum nome igual para telas diferentes.
  const grupo=page.locator(".arcd-sidebar .nav-grp-hd").filter({hasText:/^Compras/});
  const corpo=grupo.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  const menu=(await corpo.locator(".nav-item").allInnerTexts()).map(texto=>texto.trim());
  expect(menu).toContain("Curva e preços");
  expect(menu).not.toContain("Cotações");
  const tools=page.locator("details.purchase-tools");
  await tools.locator("summary").click();
  const abas=[
    ...(await page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button").allInnerTexts()).map(texto=>texto.split("\n")[0].trim()),
    ...(await tools.getByRole("button").allInnerTexts()).map(texto=>texto.trim()),
  ];
  expect(abas).toContain("Cadastro de fornecedores");
  expect(abas.filter(aba=>aba!=="Compras"&&menu.includes(aba))).toEqual([]);

  // A área de pagamentos tem o mesmo nome na navegação e no título.
  await tools.locator("summary").click();
  await navigate(page,"Pagamentos");
  await expect(page.locator("#compras-area-atual h3")).toHaveText(/^Pagamentos/);
  expect(app.errors).toEqual([]);
});

test("pedidos: uma ação principal por cartão, destrutivas só no menu ⋯ e filtros por status, fornecedor, atraso e obra",async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  const app=await enter(page,{prepare:state=>{
    // PC-001 já foi enviado ao fornecedor por WhatsApp: o menu oferece "Reenviar", não "Enviar".
    state.pedidos[0].envios=[{id:"env1",canal:"whatsapp",data:"2026-10-21"}];
    state.fornecedores[0].telefone="11999990000";
  }});
  await navigate(page,"Pedidos");
  const cartao=numero=>page.getByRole("article",{name:`Pedido ${numero}`});
  const nomesVisiveis=async()=>(await page.getByRole("article").evaluateAll(els=>els.map(el=>el.getAttribute("aria-label")))).sort();

  // Enviado: só "Receber material" + o botão do menu. Nada destrutivo, nada de "Enviar" na linha.
  const enviado=cartao("PC-001");
  await expect(enviado.getByRole("button")).toHaveCount(2);
  await expect(enviado.getByRole("button",{name:"Receber material"})).toBeVisible();
  await expect(enviado.getByRole("button",{name:/Cancelar pedido|Excluir definitivamente|Enviar ao fornecedor|Reenviar/})).toHaveCount(0);
  // Rascunho: a ação principal é revisar.
  await expect(cartao("PC-002").getByRole("button")).toHaveCount(2);
  await expect(cartao("PC-002").getByRole("button",{name:"Revisar pedido"})).toBeVisible();
  await expect(cartao("PC-002").getByRole("button",{name:"Receber material"})).toHaveCount(0);

  // Menu por teclado: abre no primeiro item, navega, Esc fecha e o foco volta ao botão.
  const gatilho=enviado.getByRole("button",{name:"Mais ações do pedido PC-001"});
  await gatilho.focus();
  await page.keyboard.press("ArrowDown");
  const menu=enviado.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  const itens=(await menu.getByRole("menuitem").allInnerTexts()).map(texto=>texto.trim());
  expect(itens).toContain("Reenviar ao fornecedor");
  expect(itens).not.toContain("Enviar ao fornecedor");
  expect(itens.slice(-2)).toEqual(["Cancelar pedido…","Excluir definitivamente…"]);
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem",{name:"Excluir definitivamente…"})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(gatilho).toBeFocused();

  // Excluir continua pedindo motivo e a confirmação digitada (agora a partir do menu).
  await gatilho.click();
  await menu.getByRole("menuitem",{name:"Excluir definitivamente…"}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Excluir compra · PC-001");
  await expect(dialog.getByLabel("Digite PC-001 para confirmar *")).toBeVisible();
  await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(app.state().pedidos.map(order=>order.id)).toContain("delivery");

  // Filtros: status, fornecedor, atraso e obra se combinam, com contagem e "Limpar filtros".
  const filtros=page.getByRole("group",{name:"Filtros de pedidos"});
  await expect(page.getByText("3 de 3 pedido(s)")).toBeVisible();
  await filtros.getByLabel("Status",{exact:true}).selectOption("rascunho");
  expect(await nomesVisiveis()).toEqual(["Pedido PC-002"]);
  await filtros.getByLabel("Status",{exact:true}).selectOption("a_receber");
  expect(await nomesVisiveis()).toEqual(["Pedido PC-001","Pedido PC-003"]);
  await filtros.getByLabel("Fornecedor",{exact:true}).selectOption("central");
  await filtros.getByLabel("Obra",{exact:true}).selectOption("b");
  expect(await nomesVisiveis()).toEqual(["Pedido PC-003"]);
  await filtros.getByRole("button",{name:"Limpar filtros"}).click();
  await expect(page.getByText("3 de 3 pedido(s)")).toBeVisible();
  await filtros.getByLabel(/Só entregas atrasadas/).check();
  expect(await nomesVisiveis()).toEqual(["Pedido PC-003"]);
  await expect(cartao("PC-003").getByText("ATRASADO +2d")).toBeVisible();
  // Atrasado com telefone do fornecedor: "Cobrar entrega" está no menu, como link do WhatsApp.
  await cartao("PC-003").getByRole("button",{name:"Mais ações do pedido PC-003"}).click();
  const cobrar=cartao("PC-003").getByRole("menuitem",{name:"Cobrar entrega"});
  await expect(cobrar).toHaveAttribute("href",/wa\.me\/.*11999990000/);
  await page.keyboard.press("Escape");
  await filtros.getByRole("button",{name:"Limpar filtros"}).click();
  await filtros.getByLabel("Fornecedor",{exact:true}).selectOption("central");
  await filtros.getByLabel("Status",{exact:true}).selectOption("cancelado");
  await expect(page.getByText("Nenhum pedido com estes filtros.")).toBeVisible();
  expect(app.errors).toEqual([]);
});

test("pedidos: engenharia não ganha 'Enviar', 'Registrar aceite' nem 'Excluir' no menu",async({page})=>{
  const app=await enter(page,{role:"engenheiro"});
  await navigate(page,"Pedidos");
  const gatilho=page.getByRole("article",{name:"Pedido PC-001"}).getByRole("button",{name:"Mais ações do pedido PC-001"});
  await gatilho.click();
  const itens=(await page.getByRole("menu").getByRole("menuitem").allInnerTexts()).map(texto=>texto.trim());
  expect(itens).not.toContain("Enviar ao fornecedor");
  expect(itens).not.toContain("Reenviar ao fornecedor");
  expect(itens).not.toContain("Registrar aceite");
  expect(itens).not.toContain("Excluir definitivamente…");
  expect(app.errors).toEqual([]);
});

for(const width of [390,768,1280,1440])test(`pedidos: cartões, menu ⋯ e filtros sem rolagem lateral em ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const app=await enter(page);
  await navigate(page,"Pedidos");
  const gatilho=page.getByRole("article",{name:"Pedido PC-003"}).getByRole("button",{name:"Mais ações do pedido PC-003"});
  await gatilho.click();
  const menu=page.getByRole("menu");
  await expect(menu).toBeVisible();
  const caixa=await menu.boundingBox();
  expect(caixa.x).toBeGreaterThanOrEqual(0);
  expect(caixa.x+caixa.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),"a página não deve transbordar horizontalmente").toBe(false);
  if(width===390)expect((await gatilho.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:test.info().outputPath(`pedidos-${width}.png`),fullPage:true});
  await page.keyboard.press("Escape");
  expect(app.errors).toEqual([]);
});

test("fila agrupada por fornecedor cobra três entregas atrasadas numa só visão e mostra valores em R$",async({page})=>{
  const app=await enter(page,{prepare:state=>{
    state.fornecedores[0].telefone="81999990000";
    const atrasado=(id,numero,obraId,previsao)=>({id,numero,obraId,fornecedorId:"central",status:"enviado",data:"2026-10-10",previsao,
      origemPagamento:"empresa",pagamentos:[],itens:[item(`${id}-i`,"cement",4,50)]});
    state.pedidos.push(atrasado("late-1","PC-010","a","2026-10-19"),atrasado("late-2","PC-011","b","2026-10-20"));
  }});
  const fila=page.locator(".purchase-workspace");
  await expect(fila.locator(".purchase-queue-metrics")).toContainText("R$");
  await fila.getByLabel("Agrupar por").selectOption("fornecedor");
  const grupos=fila.locator("tbody.purchase-group");
  const central=grupos.first();
  await expect(central).toHaveAttribute("data-group","Depósito Central");
  await expect(central.locator(".purchase-group-row")).toContainText("3 atrasado(s)");
  await expect(central.locator("tr:not(.purchase-group-row)")).toHaveCount(4);
  const cobrar=central.getByRole("link",{name:"Cobrar as 3 entregas atrasadas"});
  await expect(cobrar).toBeVisible();
  const texto=decodeURIComponent((await cobrar.getAttribute("href")).split("text=")[1]);
  expect(texto).toContain("3 pedidos atrasados");
  for(const numero of ["PC-003","PC-010","PC-011"])expect(texto).toContain(`Pedido ${numero}`);
  expect(texto).not.toContain("PC-001");
  // Fornecedor sem telefone ou sem atraso não ganha botão de cobrança.
  await expect(fila.locator('tbody[data-group="Materiais Norte"] .purchase-group-charge')).toHaveCount(0);

  await fila.getByLabel("Agrupar por").selectOption("obra");
  await expect(grupos).toHaveCount(2);
  await expect(fila.locator(".purchase-group-charge")).toHaveCount(0);
  // Limpar filtros mantém o agrupamento escolhido.
  await fila.getByLabel("Prazo").selectOption("overdue");
  await fila.getByRole("button",{name:"Limpar filtros"}).first().click();
  await expect(fila.getByLabel("Agrupar por")).toHaveValue("obra");
  expect(app.errors).toEqual([]);
});

test("'Chegou' na tela da obra abre o mesmo recebimento de Compras, preenchido e aceitando parcial",async({page})=>{
  const app=await enter(page);
  const sidebar=page.locator(".arcd-sidebar");
  const grupo=sidebar.locator(".nav-grp-hd").filter({hasText:/^Obras e projetos/});
  const corpo=grupo.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  if(!await corpo.isVisible())await grupo.click();
  await corpo.locator(".nav-item").filter({hasText:/^Obras$/}).click();
  await page.getByText("Residencial Alameda").first().click();
  await expect(page.getByText("O material ja chegou na obra?")).toBeVisible();
  await page.getByRole("button",{name:"Chegou",exact:true}).click();

  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText("Confirmar chegada - pedido PC-001");
  // Mesmo modal do "Receber": já vem com tudo o que falta, na unidade de compra.
  await expect(dialog.getByLabel("Chegou agora (UN)")).toHaveValue("10");
  await expect(dialog.locator(".purchase-receipt-payment")).toContainText("R$ 250,00 em aberto. O recebimento não depende dele.");
  // A mesma regra: acima do que falta não confirma; parcial confirma.
  await dialog.getByLabel("Chegou agora (UN)").fill("11");
  await expect(dialog.getByRole("button",{name:/Dar entrada no estoque/})).toBeDisabled();
  await dialog.getByLabel("Chegou agora (UN)").fill("4");
  await dialog.getByRole("button",{name:/Dar entrada no estoque/}).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(()=>app.commands.filter(c=>c.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED).length).toBe(1);
  const comando=app.commands.find(c=>c.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED);
  expect(comando.payload.receivedQuantities).toEqual({di:4});
  expect(comando.payload.stockEntries[0]).toMatchObject({qtd:4,descricao:"Chegada confirmada - pedido PC-001"});
  expect(app.state().pedidos.find(p=>p.id==="delivery").itens[0].qtdRecebida).toBe(4);
  expect(app.errors).toEqual([]);
});

test("painel separa Resumo de Análises, sem ação destrutiva, e cada exceção abre a lista filtrada",async({page})=>{
  const app=await enter(page);
  const tools=page.locator("details.purchase-tools");
  const abrirPainel=async()=>{await tools.locator("summary").click();await tools.getByRole("button",{name:"Mapa gerencial",exact:true}).click();};
  await abrirPainel();
  const painel=page.locator(".compras-management-map");
  await expect(painel.getByRole("tab",{name:"Resumo"})).toHaveAttribute("aria-selected","true");
  await expect(painel.getByText("Exceções para decidir agora")).toBeVisible();
  await expect(painel.getByText("Fluxo de compras e prazos")).toHaveCount(0);
  await expect(painel.getByRole("button",{name:/Excluir/})).toHaveCount(0);

  // Exceção de atraso: abre Pedidos com "só atrasadas" marcado.
  await painel.getByRole("button",{name:/entrega\(s\) atrasada\(s\)/}).click();
  await expect(page.locator(".purchase-order-filters__toggle input")).toBeChecked();
  await expect(page.locator(".purchase-order-count")).toContainText("1 de 3 pedido(s)");

  // Exceção de pedidos sem concorrência: abre a lista exata, com a origem visível.
  await abrirPainel();
  await painel.getByRole("button",{name:/sem concorrência registrada/}).click();
  // Só pedido enviado conta (o rascunho PC-002 fica de fora).
  await expect(page.getByRole("note")).toContainText("2 pedido(s) sem concorrência registrada");
  await expect(page.locator(".purchase-order-count")).toContainText("2 de 3 pedido(s)");
  await page.getByRole("note").getByRole("button",{name:"Ver todos os pedidos"}).click();
  await expect(page.getByRole("note")).toHaveCount(0);

  // Análises: Kanban e controle dos pedidos, só leitura.
  await abrirPainel();
  await painel.getByRole("tab",{name:"Análises"}).click();
  await expect(painel.getByText("Fluxo de compras e prazos")).toBeVisible();
  await expect(painel.getByText("Veredicto gerencial")).toBeVisible();
  await expect(painel.getByRole("button",{name:/Excluir/})).toHaveCount(0);
  await painel.getByRole("button",{name:"Abrir o pedido PC-001 na aba Pedidos"}).click();
  await expect(page.locator(".purchase-order-count")).toContainText("1 de 1 pedido(s)");
  expect(app.errors).toEqual([]);
});

test("exportar para Excel baixa só o que a tela mostra, com valores em número e datas como data (A0.3)",async({page})=>{
  const ExcelJS=(await import("exceljs")).default;
  const lerDownload=async acao=>{
    const [download]=await Promise.all([page.waitForEvent("download"),acao()]);
    const livro=new ExcelJS.Workbook();await livro.xlsx.readFile(await download.path());
    return {nome:download.suggestedFilename(),livro};
  };
  const app=await enter(page,{prepare:state=>{state.pedidos[0].previsao="2026-10-20";}});await selectWork(page);

  // Pedidos filtrados por "só atrasadas": a planilha traz só o PC-001, com itens e notas.
  await navigate(page,"Pedidos");
  await page.locator(".purchase-order-filters__toggle input").check();
  await expect(page.locator(".purchase-order-count")).toContainText("1 de 2 pedido(s)");
  const pedidos=await lerDownload(()=>page.getByRole("button",{name:/Exportar para Excel os 1 pedido/}).click());
  expect(pedidos.nome).toMatch(/^compras-pedidos-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(pedidos.livro.worksheets.map(aba=>aba.name)).toEqual(["Pedidos","Itens dos pedidos","Notas fiscais"]);
  const aba=pedidos.livro.getWorksheet("Pedidos");
  expect(aba.rowCount).toBe(2);
  expect(aba.getCell("A2").value).toBe("PC-001");
  expect(aba.getCell("G2").value).toBe(250);
  expect(aba.getCell("D2").value).toBeInstanceOf(Date);
  expect(pedidos.livro.getWorksheet("Itens dos pedidos").getCell("E2").value).toBe(10);

  // Fila: o botão exporta os registros listados.
  await navigate(page,"Fila");
  const fila=await lerDownload(()=>page.getByRole("button",{name:/Exportar para Excel os \d+ registro/}).click());
  const linhasFila=fila.livro.getWorksheet("Fila de trabalho").rowCount-1;
  await expect(page.locator(".purchase-result-count")).toContainText(`${linhasFila} registro(s)`);
  expect(app.errors).toEqual([]);
});
