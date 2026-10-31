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
  const shell=page.locator(".arcd-app-shell");
  await expect(shell).toBeVisible();
  // A recarga restaura Compras. Não procurar um item de navegação de uma
  // seção já aberta (nem desfazer o contexto que o teste quer conferir).
  if(await shell.getAttribute("data-tab")==="cmp"){
    await expect(page.locator(".purchase-header")).toBeVisible({timeout:15000});
    return;
  }
  if(page.viewportSize().width<1100){
    await page.getByRole("button",{name:"Abrir Compras e suprimentos",exact:true}).click();
  }else{
    const sidebar=page.locator(".arcd-sidebar");
    const group=sidebar.locator(".nav-grp-hd").filter({hasText:/^Compras/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    if(!await body.isVisible())await group.click();
    await body.locator(".nav-item").filter({hasText:/^Compras$/}).click();
  }
  await expect(page.locator(".purchase-header")).toBeVisible({timeout:15000});
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
    if(body.action==="cotacao-fornecedor-link")return route.fulfill({json:{ok:true,token:"isolated-quotation-link",expiraEm:"2026-10-30T15:00:00.000Z"}});
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
  await page.goto("/",{waitUntil:"domcontentloaded"});await page.locator("#login-email").fill(PROFILE.email);await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await openPurchases(page);
  return {state:()=>state,commands,errors};
}
const navigate=async(page,name)=>{
  const selector=page.getByRole("combobox",{name:"Fluxo de compras",exact:true});
  if(await selector.isVisible()){
    const option=selector.getByRole("option").filter({hasText:new RegExp(`^${name}`)}).first();
    await selector.selectOption(await option.getAttribute("value"));
  }else await page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button",{name:new RegExp(`^${name}`)}).click();
};
const navigateTool=async(page,label)=>{const selector=page.getByRole('combobox',{name:'Fluxo de compras',exact:true});if(await selector.isVisible())await selector.selectOption({label});else{const tools=page.locator('details.purchase-tools');await tools.locator('summary').click();await tools.getByRole('button',{name:label,exact:true}).click();}};
const selectWork=page=>page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true}).selectOption("a");

for(const width of [390,1440])test(`condições do pedido preservam o legado e as revisões em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const app=await enter(page,{prepare:state=>{state.pedidos[1].itens[0].previsao="2026-10-27";state.pedidos[1].itens[0].remessas=[{id:"scheduled-delivery",data:"2026-10-25",qtd:2}];}});await selectWork(page);await navigate(page,"Pedidos");
 const card=()=>page.getByRole("article",{name:"Pedido PC-002",exact:true});
 await card().getByRole("button",{name:"Ficha completa · notas e anexos",exact:true}).click();
 let modal=page.getByRole("dialog"),conditions=modal.getByRole("region",{name:"Condições preservadas de PC-002",exact:true});
 await expect(conditions).toContainText("Dados originais não registrados");expect(app.commands).toEqual([]);
 await modal.getByRole("button",{name:"Fechar",exact:true}).click();
 await card().getByRole("button",{name:"Revisar pedido",exact:true}).click();modal=page.getByRole("dialog");
 await modal.locator("summary").filter({hasText:"Faturamento e entrega"}).click();
 await modal.getByLabel("Dados e condições de faturamento",{exact:true}).fill("Faturar para Cliente original · CPF informado");
 await modal.getByLabel("Endereço de entrega",{exact:true}).fill("Rua da entrega original, 20");
 await modal.getByLabel("Condições de entrega",{exact:true}).fill("Com descarga, pela manhã");
 await modal.getByLabel("Condições de pagamento",{exact:true}).fill("30/60 dias");
 await modal.getByLabel("Motivo do ajuste *").fill("Condições conferidas com fornecedor");
 await modal.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(modal).not.toBeVisible();
 const previous=structuredClone(app.state().pedidos.find(p=>p.id==="draft").historicoCondicoesPedido);expect(previous).toHaveLength(2);expect(previous[0].origem).toBe("legado");
 await card().getByRole("button",{name:"Revisar pedido",exact:true}).click();modal=page.getByRole("dialog");
 await modal.locator("summary").filter({hasText:"Faturamento e entrega"}).click();
 await modal.getByLabel("Endereço de entrega",{exact:true}).fill("Rua renegociada, 30");
 await modal.getByLabel("Motivo do ajuste *").fill("Novo destino acordado");
 await modal.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(modal).not.toBeVisible();
 const p=app.state().pedidos.find(p=>p.id==="draft");expect(p.historicoCondicoesPedido).toHaveLength(3);expect(p.historicoCondicoesPedido.slice(0,2)).toEqual(previous);
 app.state().fornecedores[1].nome="Nome atual diferente";app.state().obras[0].address="Endereço cadastral atual diferente";
 await page.reload({waitUntil:"domcontentloaded"});await openPurchases(page);await navigate(page,"Pedidos");await card().getByRole("button",{name:"Ficha completa · notas e anexos",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Fechar",exact:true}).click();
 await card().getByRole("button",{name:"Revisar pedido",exact:true}).click();modal=page.getByRole("dialog");
 await expect(modal.getByLabel("Data 1",{exact:true})).toHaveValue("2026-10-25");
 await modal.getByLabel("Motivo do ajuste *").fill("Conferência após recarga, mantendo o plano de entregas");
 await modal.getByRole("button",{name:"Salvar rascunho",exact:true}).click();await expect(modal).not.toBeVisible();
 expect(app.state().pedidos.find(p=>p.id==="draft").itens[0].remessas).toEqual([{id:"scheduled-delivery",data:"2026-10-25",qtd:2}]);
 expect(app.state().pedidos.find(p=>p.id==="draft").itens[0].previsao).toBe("2026-10-27");
 expect(app.state().pedidos.find(p=>p.id==="draft").historicoCondicoesPedido).toHaveLength(3);
 await card().getByRole("button",{name:"Ficha completa · notas e anexos",exact:true}).click();
 modal=page.getByRole("dialog");conditions=modal.getByRole("region",{name:"Condições preservadas de PC-002",exact:true});
 await expect(conditions).toContainText("Rua renegociada, 30");await expect(conditions).not.toContainText("Endereço cadastral atual diferente");
 await conditions.locator("summary").click();await expect(conditions).toContainText("Rua da entrega original, 20");await expect(conditions).toContainText("Novo destino acordado");
 await conditions.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/compras/conditions-${width}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(app.errors).toEqual([]);expect(app.state().transacoes).toEqual([]);
});

for(const width of [390,1440])test(`envio declarado, prazos e auditoria sem mensagens em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const app=await enter(page);await selectWork(page);await navigate(page,"Cotar");
 await page.locator('#purchase-record-quote').getByRole('button',{name:'Comparar propostas · COT-001',exact:true}).click();const workspace=page.getByRole("region",{name:"Análise da cotação COT-001",exact:true});await workspace.getByRole("tab",{name:"Fornecedores",exact:true}).click();
 await workspace.getByRole("button",{name:"Gerar link de cotação · Depósito Central",exact:true}).click();await expect(workspace.getByLabel("Link para Depósito Central",{exact:true})).toBeVisible();expect(app.state().cotacoes[0].enviosFornecedor).toBeUndefined();expect(app.commands).toEqual([]);
 const panel=workspace.getByRole("region",{name:"Envio e prazo de Depósito Central",exact:true});await panel.getByRole("button",{name:"Registrar envio realizado · Depósito Central",exact:true}).click();await panel.getByLabel("Data e hora do envio realizado").fill("2026-10-20T09:00");await panel.getByLabel("Prazo de resposta",{exact:false}).fill("2026-10-21T09:00");await panel.getByLabel("Destinatário do envio").fill("contato@central.test");await panel.getByRole("button",{name:"Confirmar registro",exact:true}).click();
 await expect(panel).toContainText("Prazo de resposta vencido");expect(app.state().cotacoes[0].enviosFornecedor).toHaveLength(1);const queue=page.getByRole("region",{name:"Fila de fornecedores",exact:true});await queue.getByLabel("Situação do retorno").selectOption("overdue");await expect(queue).toContainText("Depósito Central");
 await panel.getByRole("button",{name:"Retificar prazo",exact:true}).click();await panel.getByLabel("Prazo de resposta").fill("2026-10-25T09:00");await panel.getByLabel("Justificativa do registro").fill("Novo prazo acordado por e-mail");await panel.getByRole("button",{name:"Confirmar registro",exact:true}).click();await expect(panel).not.toContainText("Prazo de resposta vencido");
 const prices=JSON.stringify(app.state().cotacoes[0].propostas);await panel.getByRole("button",{name:"Registrar retorno por outro canal",exact:true}).click();await panel.getByLabel("Data e hora do retorno recebido").fill("2026-10-22T10:00");await panel.getByLabel("Justificativa do registro").fill("Resposta por e-mail recebida; conferir valores no mapa");await panel.getByRole("button",{name:"Confirmar registro",exact:true}).click();await expect(panel.getByRole("button",{name:"Retificar prazo",exact:true})).toBeDisabled();expect(JSON.stringify(app.state().cotacoes[0].propostas)).toBe(prices);
 await queue.getByLabel("Situação do retorno").selectOption("retorno_manual");await expect(queue).toContainText("Retorno por outro canal");
 await panel.getByRole("button",{name:"Anular registro de envio",exact:true}).click();await panel.getByLabel("Justificativa do registro").fill("Registro duplicado no controle anterior");await panel.getByRole("button",{name:"Confirmar registro",exact:true}).click();await workspace.getByText("Histórico de envios (1)",{exact:true}).click();await expect(workspace.getByRole("heading",{name:"Depósito Central · Registro anulado",exact:true})).toBeVisible();
 expect(app.state().cotacoes[0].enviosFornecedor[0].history).toHaveLength(3);expect(app.commands.map(c=>c.type)).toEqual([OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED,...Array(3).fill(OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_UPDATED)]);expect(app.state().pedidos).toHaveLength(3);expect(app.state().transacoes).toEqual([]);expect(app.errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/compras/dispatch-${width}.png`});
});

const contractsFixture=state=>{
 state.terceirizados=[{id:"service-a",name:"Serviço elétrico QA",obraId:"a",tipoContrato:"medicao",specialty:"eletricista",active:true,contractValue:1000,etapas:[{id:"stage",nome:"Instalação",valor:1000}]},{id:"service-b",name:"Serviço de outra obra",obraId:"b",tipoContrato:"medicao",active:true,contractValue:9999,etapas:[{id:"other-stage",nome:"Etapa",valor:9999}]}];
 state.medicoesTerc=[{id:"measured",tercId:"service-a",obraId:"a",numero:1,data:"2026-10-01",status:"aprovada",total:500,notaFiscalId:"service-nf",itens:[{etapaId:"stage",pctAcum:50}]}];
 const pg={id:"service-payment",tercId:"service-a",medicaoTercId:"measured",obraId:"a",data:"2026-10-02",date:"2026-10-02",valor:200,amount:200,status:"ativo"};state.pagsTerceiros=[pg];
 state.notasFiscais=[{id:"service-nf",medicaoTercId:"measured",obraId:"a",numero:"SERV-1",status:"aprovada",valorBruto:500,emissao:"2026-10-01",pagamentos:[pg],documentos:[{id:"doc-service",nome:"Nota de serviço QA",url:"https://example.test/service.pdf"}]}];
 state.contratosFornecimento=[{id:"supply",numero:"CF-QA",fornecedorId:"central",obraId:"a",status:"ativo",vigenciaInicio:"2026-01-01",vigenciaFim:"2026-12-31",itens:[{id:"supply-item",materialId:"cement",qtdContratada:100,precoUnit:25,unidadeRef:"UN",unidadeCompra:"UN"}]}];
 state.pedidos[0].itens[0].contratoId="supply";state.pedidos[0].itens[0].contratoItemId="supply-item";
};
async function openContracts(page){const selector=page.getByRole('combobox',{name:'Fluxo de compras',exact:true});if(await selector.isVisible())await selector.selectOption({label:'Contratos e medições'});else{await page.locator(".purchase-tools summary").click();await page.getByRole("button",{name:"Contratos e medições",exact:true}).click();}}
for(const width of [390,1440])test(`contratos e medições: origem única e operação existente em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const app=await enter(page,{prepare:contractsFixture});await selectWork(page);await openContracts(page);
 const hub=page.getByRole("region",{name:"Contratos e medições",exact:true});await expect(hub).toContainText("CF-QA");await hub.getByRole("button",{name:"Ficha da compra PC-001",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
 await hub.getByRole("tab",{name:"Serviços e medições",exact:true}).click();const table=hub.getByRole("region",{name:"Contratos de serviços",exact:true});await expect(table).not.toContainText("Serviço de outra obra");
 const row=table.locator("tbody tr").first();await expect(row.locator('td[data-label="Baixado"]')).toContainText("200,00");await expect(row.locator('td[data-label="A pagar"]')).toContainText("300,00");
 await row.getByRole("button",{name:"Ficha do contrato Serviço elétrico QA",exact:true}).click();await hub.getByRole("tab",{name:"Documentos (1)",exact:true}).click();await expect(hub.getByRole("link",{name:"Nota de serviço QA",exact:true})).toHaveAttribute("href","https://example.test/service.pdf");
 await hub.getByRole("tab",{name:"Movimentos financeiros",exact:true}).click();await expect(hub).toContainText("Custo reconhecido");expect(app.commands).toEqual([]);
 await hub.getByRole("button",{name:"Registrar medição neste contrato",exact:true}).click();await expect(page.getByRole("heading",{name:"Terceirizados",exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog").getByLabel("Data da medição",{exact:true})).toBeVisible();expect(app.state().medicoesTerc).toHaveLength(1);expect(app.state().pagsTerceiros).toHaveLength(1);expect(app.commands).toEqual([]);await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Voltar a Contratos e medições",exact:true}).click();await expect(hub).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(app.errors).toEqual([]);
 await hub.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/compras/contracts-${width}.png`});
 await page.locator(".purchase-context-bar").getByLabel("Obra",{exact:true}).selectOption("b");await hub.getByRole("tab",{name:"Serviços e medições",exact:true}).click();await expect(hub).toContainText("Serviço de outra obra");await expect(hub).not.toContainText("Serviço elétrico QA");expect(app.commands).toEqual([]);
});
test("contratos e medições: perfil Compras mantém a restrição de Terceiros",async({page})=>{
 const app=await enter(page,{role:"compras",prepare:contractsFixture});await selectWork(page);await openContracts(page);const hub=page.getByRole("region",{name:"Contratos e medições",exact:true});
 await hub.getByRole("tab",{name:"Serviços e medições",exact:true}).click();await expect(hub).toContainText("Seu perfil não tem acesso ao módulo Terceiros");await expect(hub).not.toContainText("Serviço elétrico QA");expect(app.commands).toEqual([]);
});

for(const width of [390,1440])test(`retornos, comparação e referência histórica em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const app=await enter(page,{prepare:state=>{
  const quote=state.cotacoes[0],costs={frete:0,desconto:0,impostos:0,despesas:0};
  quote.propostas.forEach(p=>{p.custoFinal=costs});quote.propostas.push({id:"waiting",fornecedorId:"waiting-supplier"});state.fornecedores.push({id:"waiting-supplier",nome:"Fornecedor sem retorno",ativo:true});
  quote.respostasFornecedor=[{id:"response",proposalId:"p1",fornecedorId:"central",status:"pendente",nome:"Vendedor QA",recebidaEm:"2026-10-19T12:00:00Z",total:260,offer:{precos:{__item:26},custoFinal:costs,prazoDias:3,condicoesPagamento:"30 dias",documentos:[]}}];
  state.pedidos.push({id:"historical",numero:"PC-HIST",obraId:"a",fornecedorId:"central",status:"recebido",data:"2026-10-01",custoFinal:costs,itens:[{...item("history-item","cement",2,10,2),precoUnitCotado:10,recebimentos:[{data:"2026-10-02",qtd:2}]}]});
 }});
 await selectWork(page);await navigate(page,"Cotar");
 const queue=page.getByRole("region",{name:"Fila de fornecedores",exact:true});await expect(queue).toContainText("1 para revisar · 0 aguardando retorno · 1 sem envio registrado");
 await queue.getByRole("button",{name:"Abrir cotação COT-001",exact:true}).first().click();
 const workspace=page.getByRole("region",{name:"Análise da cotação COT-001",exact:true});
 await expect(workspace.getByRole("heading",{name:"Depósito Central · Aguardando revisão",exact:true})).toBeVisible();
 await workspace.getByRole("tab",{name:"Comparativo",exact:true}).click();await expect(workspace.getByRole("region",{name:"Mapa de propostas por item"})).toContainText("Aguardando revisão");
 await workspace.getByRole("tab",{name:"Histórico de preços",exact:true}).click();await expect(workspace).toContainText("+200.0% sobre a referência");
 await workspace.getByRole("button",{name:"Abrir compra de referência PC-HIST",exact:true}).click();
 const dossier=page.getByRole("dialog");await expect(dossier.getByRole("region",{name:"Pendências da compra"})).toContainText("1 pedido(s) sem nota fiscal vinculada");await page.keyboard.press("Escape");
 await expect(dossier).toHaveCount(0);expect(app.commands).toEqual([]);expect(app.errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`artifacts/compras/roadmap-cotacao-${width}.png`,fullPage:true});
 await navigateTool(page,"Preços por material");await page.getByLabel("Material do histórico",{exact:true}).selectOption("cement");
 const download=page.waitForEvent("download");await page.getByRole("button",{name:"Exportar histórico filtrado para Excel",exact:true}).click();expect((await download).suggestedFilename()).toBe("historico-precos-material.xlsx");
 expect(app.commands).toEqual([]);expect(app.errors).toEqual([]);
});

test("fila por obra, múltiplas palavras, aprovação e retorno preservam o contexto",async({page})=>{
  const app=await enter(page);await selectWork(page);
  await page.getByLabel("Buscar na fila").fill("central cimento");
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(2);
  await page.getByRole("button",{name:"Comparar propostas · COT-001",exact:true}).click();
  await expect(page.getByRole("button",{name:"Adicionar cotação",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Voltar à fila",exact:true}).click();
  await expect(page.locator('.purchase-context-bar').getByLabel('Obra',{exact:true})).toHaveValue('a');
  await expect(page.getByLabel("Buscar na fila")).toHaveValue("central cimento");
  await page.getByRole("button",{name:"Limpar filtros",exact:true}).click();
  await page.getByRole("button",{name:/Em aprovação/}).click();
  await expect(page.locator('.purchase-context-bar').getByLabel('Obra',{exact:true})).toHaveValue('a');
  await expect(page.locator(".purchase-queue-table tbody tr")).toHaveCount(1);
  await navigate(page,"Receber");
  await expect(page.locator('.purchase-context-bar').getByLabel('Obra',{exact:true})).toHaveValue('a');
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
  await page.reload({waitUntil:"domcontentloaded"});await expect(page.locator(".purchase-header")).toBeVisible();await selectWork(page);await navigate(page,"Receber");
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
  for(const label of ["Frete (R$)","Desconto (R$)","Impostos adicionais (R$)","Outras despesas (R$)"]){
    await dialog.getByLabel(label,{exact:true}).nth(0).fill("0");
    await dialog.getByLabel(label,{exact:true}).nth(1).fill("0");
  }
  await dialog.screenshot({path:test.info().outputPath("cotacao-comparacao.png")});
  await dialog.getByRole("button",{name:"Salvar cotação",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  const quote=app.state().cotacoes.find(quote=>quote.solicitacaoId==="req");
  expect(quote.itens[0]).toMatchObject({materialId:"cement",qtd:10,orcNivel1Id:"foundation"});
  await navigate(page,"Cotar");
  await page.getByLabel("Buscar",{exact:true}).fill("SC-001");
  const quoteRow=page.locator(`[id="purchase-record-${quote.id}"]`);
  await quoteRow.getByRole('button',{name:/^Comparar propostas · /}).click();
  await quoteRow.locator('.quote-workspace-heading').getByRole("button",{name:"Decidir e gerar pedidos"}).click();
  dialog=page.getByRole("dialog");
  const chosenProposal=quote.propostas.find(proposal=>proposal.fornecedorId==="central");
  expect(chosenProposal).toBeDefined();
  await dialog.getByRole("combobox",{name:"Fornecedor",exact:true}).selectOption(chosenProposal.id);
  await expect(dialog.getByRole("button",{name:"Aprovar e gerar pedido(s)"})).toBeEnabled();
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
  await page.locator("#purchase-record-quote").getByRole('button',{name:'Comparar propostas · COT-001',exact:true}).click();
  await expect(page.getByRole("button",{name:"Decidir e gerar pedidos"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Editar mapa"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Excluir cotação",exact:true})).toHaveCount(0);
  expect(app.errors).toEqual([]);
});

for(const width of [390,768,1280,1440])test(`layout, teclado e filtros em ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const app=await enter(page);await selectWork(page);
  await expect(page.getByRole("button",{name:"Receber materiais · PC-001"})).toBeVisible();
  if(width<768){
    const selector=page.getByRole("combobox",{name:"Fluxo de compras",exact:true});
    await expect(selector).toBeInViewport();
    await expect(selector.locator('optgroup[label="Áreas de trabalho"] option')).toHaveCount(7);
  }else{
    await expect(page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button")).toHaveCount(7);
    for(const button of await page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button").all()){
      await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();
    }
  }
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
  await page.getByText("Comparar compras por obra",{exact:true}).click();
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

  // A barra de ações do pedido enviado mantém "Receber material" + menu; a ficha é uma consulta separada.
  const enviado=cartao("PC-001");
  await expect(enviado.locator(".purchase-order-actions").getByRole("button")).toHaveCount(2);
  await expect(enviado.getByRole("button",{name:"Ficha completa · notas e anexos",exact:true})).toBeVisible();
  await expect(enviado.getByRole("button",{name:"Receber material"})).toBeVisible();
  await expect(enviado.getByRole("button",{name:/Cancelar pedido|Excluir definitivamente|Enviar ao fornecedor|Reenviar/})).toHaveCount(0);
  // Rascunho: a ação principal é revisar.
  await expect(cartao("PC-002").locator(".purchase-order-actions").getByRole("button")).toHaveCount(2);
  await expect(cartao("PC-002").getByRole("button",{name:"Ficha completa · notas e anexos",exact:true})).toBeVisible();
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


test("ficha conjunta mostra custo final, pedidos e notas com anexos no celular",async({page})=>{
  const app=await enter(page,{prepare:state=>{
    state.cotacoes[0].propostas.forEach((p,index)=>{p.custoFinal={frete:index?0:100,desconto:0,impostos:0,despesas:0};p.condicoesPagamento="30 dias";});
    state.pedidos[0].cotacaoId="quote";state.pedidos[1].cotacaoId="quote";
    state.notasFiscais=[{id:"nf-dossier",pedidoId:"delivery",obraId:"a",fornecedorId:"central",numero:"NF-TESTE-123",status:"aprovada",emissao:"2026-10-20",vencimento:"2026-11-20",valorBruto:250,valorLiquido:250,documentos:[{id:"doc",nome:"nota.pdf",legenda:"DANFE de teste",url:"https://example.test/nota.pdf"}]}];
  }});
  await page.route("https://example.test/**",route=>route.fulfill({contentType:"text/html",body:"<p>Documento de teste isolado</p>"}));
  await selectWork(page);await navigate(page,"Pedidos");
  await page.getByRole("button",{name:"Ficha completa · notas e anexos",exact:true}).first().click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByRole("heading",{name:"Ficha completa da compra conjunta",exact:true})).toBeVisible();
  await expect(dialog.getByRole("heading",{name:"NF NF-TESTE-123 · aprovada",exact:true})).toBeVisible();
  await expect(dialog.getByRole("heading",{name:/PC-002/})).toBeVisible();
  await expect(dialog.getByText(/PC-003/)).toHaveCount(0);
  await expect(dialog.getByText("Menor custo final",{exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Visualizar",exact:true}).click();
  await expect(dialog.locator("iframe")).toHaveAttribute("src","https://example.test/nota.pdf");
  await page.screenshot({path:"test-results/compras-ficha-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await dialog.getByRole("button",{name:"Custos",exact:true}).click();
  await expect(dialog.locator('[data-section="cost"]')).toBeFocused();
  const comparison=dialog.getByRole("region",{name:"Valores das propostas"});
  expect(await comparison.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.screenshot({path:"test-results/compras-ficha-mobile.png"});
  await dialog.getByRole("button",{name:"Anexos (1)",exact:true}).click();
  await expect(dialog.locator('[data-section="documents"]')).toBeFocused();
  await expect(dialog.getByRole("button",{name:"Visualizar",exact:true})).toBeInViewport();
  await page.screenshot({path:"test-results/compras-anexos-mobile.png"});
  expect(app.commands).toEqual([]);expect(app.errors).toEqual([]);
});


test("condições comerciais persistem e o comparativo usa o custo final",async({page})=>{
  const app=await enter(page,{prepare:state=>{state.cotacoes[0].propostas[0].prazoDias=null;}});await selectWork(page);
  await page.getByRole("button",{name:"Comparar propostas · COT-001",exact:true}).click();
  await page.getByRole("button",{name:"Editar mapa",exact:true}).click();
  const modal=page.getByRole("dialog");
  for(const field of ["Frete (R$)","Desconto (R$)","Impostos adicionais (R$)","Outras despesas (R$)"]){
    for(const input of await modal.getByLabel(field,{exact:true}).all())await input.fill("0");
  }
  await modal.getByLabel("Frete (R$)",{exact:true}).first().fill("100");
  await modal.getByLabel("Condições de pagamento",{exact:true}).first().fill("30 dias");
  await modal.locator(".order-conditions-fields summary").first().click();
  await modal.getByLabel("Dados e condições de faturamento",{exact:true}).first().fill("Emitir nota para destinatário acordado");
  await modal.getByLabel("Endereço de entrega",{exact:true}).first().fill("Endereço acordado na proposta");
  await modal.getByRole("button",{name:"Salvar cotação",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(app.state().cotacoes[0].propostas[0].custoFinal.frete).toBe("100");
  expect(app.state().cotacoes[0].propostas[0].condicoesPagamento).toBe("30 dias");
  expect(app.state().cotacoes[0].propostas[0].condicoesFaturamento).toBe("Emitir nota para destinatário acordado");
  expect(app.state().cotacoes[0].propostas[0].enderecoEntrega).toBe("Endereço acordado na proposta");
  await expect(page.locator(".purchase-cost-comparison").getByText("Menor custo final",{exact:true})).toBeVisible();
  await page.reload({waitUntil:"domcontentloaded"});await openPurchases(page);await selectWork(page);await navigate(page,"Fila");
  await page.getByRole("button",{name:"Comparar propostas · COT-001",exact:true}).click();
  await page.getByRole("button",{name:"Editar mapa",exact:true}).click();
  const reopened=page.getByRole("dialog");await reopened.locator(".order-conditions-fields summary").first().click();
  await expect(reopened.getByLabel("Dados e condições de faturamento",{exact:true}).first()).toHaveValue("Emitir nota para destinatário acordado");
  await expect(reopened.getByLabel("Endereço de entrega",{exact:true}).first()).toHaveValue("Endereço acordado na proposta");
  await expect(reopened.getByLabel("Condições de pagamento",{exact:true}).first()).toHaveValue("30 dias");
  await expect(reopened.getByLabel("Frete (R$)",{exact:true}).first()).toHaveValue("100");
  await expect(reopened.getByLabel("Prazo (dias)",{exact:true}).first()).toHaveValue("");
  expect(app.errors).toEqual([]);
});

for(const width of [390,1280])test(`painel 'Uso da equipe' conta lançamentos, autores e compra fora do fluxo em ${width}px (A0.1)`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const app=await enter(page,{prepare:state=>{
    state.pedidos[0].criadoPor="Compradora QA";
    state.pedidos[0].itens[0].recebimentos=[{id:"r1",data:"2026-10-22",qtd:4,responsavel:"Almoxarife QA",responsavelId:"alm",registradoEm:"2026-10-22T14:00:00Z"}];
    state.notasFiscais=[{id:"nf-solta",obraId:"b",numero:"901",emissao:"2026-10-21",vencimento:"2026-11-21",valorBruto:640,status:"recebida",criadoPor:"Compradora QA"}];
  }});
  const tools=page.locator("details.purchase-tools");
  const selector=page.getByRole("combobox",{name:"Fluxo de compras",exact:true});
  if(await selector.isVisible())await selector.selectOption({label:"Mapa gerencial"});
  else {await tools.locator("summary").click();await tools.getByRole("button",{name:"Mapa gerencial",exact:true}).click();}
  const painel=page.locator(".compras-management-map");
  await painel.getByRole("tab",{name:"Uso da equipe"}).click();
  const uso=painel.locator(".purchase-adoption");
  // 1 solicitação datada, 1 cotação, 2 pedidos (o rascunho não conta), 1 recebimento; a nota sem pedido não é lançamento do fluxo.
  await expect(uso.locator(".purchase-adoption__tiles > div").first().locator("b")).toHaveText("5");
  await expect(uso.getByRole("row",{name:/^Pedidos/})).toContainText("2");
  await expect(uso.getByRole("row",{name:/^Recebimentos/})).toContainText("1");
  await expect(uso.getByText("Almoxarife QA")).toBeVisible();
  await expect(uso.getByRole("region",{name:"Lançamentos por semana: tabela"})).toBeVisible();
  const fora=uso.locator("section",{has:page.getByRole("heading",{name:"Compras fora do fluxo"})});
  await expect(fora).toContainText("NF 901");
  await expect(fora).toContainText("Residencial Horizonte");
  await expect(fora).toContainText("R$ 640,00");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(app.errors).toEqual([]);
});

for(const atrasoDownload of [0,1500])test(`exportar para Excel baixa só o que a tela mostra, com valores em número e datas como data (A0.3)${atrasoDownload?" — início do download atrasado":""}`,async({page})=>{
  if(atrasoDownload)await page.addInitScript(delay=>{
    // Simula o navegador ocupado antes de consumir o endereço temporário.
    // O arquivo baixado continua sendo o XLSX real gerado pela aplicação.
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){
      if(this.download&&this.href.startsWith("blob:"))setTimeout(()=>click.call(this),delay);
      else click.call(this);
    };
  },atrasoDownload);
  const ExcelJS=(await import("exceljs")).default;
  const lerDownload=async acao=>{
    const [download]=await Promise.all([page.waitForEvent("download",{timeout:10000}),acao()]);
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


test("histórico por material normaliza unidades, distingue custo final e abre a compra",async({page})=>{
 const app=await enter(page,{prepare:state=>{
  const p=state.pedidos[0];p.custoFinal={frete:20,desconto:0,impostos:0,despesas:0};
  p.itens[0]={...p.itens[0],qtd:2,qtdRecebida:2,unidadeCompra:"CX",unidadeRef:"UN",fatorConversao:10,precoUnitCotado:100,precoUnit:110,recebimentos:[{data:"2026-10-20",qtd:1},{data:"2026-10-22",qtd:1}]};
 }});
 await selectWork(page);await navigateTool(page,"Preços por material");
 await page.getByLabel("Material do histórico",{exact:true}).selectOption("cement");
 await expect(page.getByRole("heading",{name:"Histórico de preços por material"})).toBeVisible();
 const history=page.getByRole("region",{name:"Histórico de preços por material"});
 await expect(history).toContainText("R$ 11,00");await expect(history).toContainText("R$ 10,00");await expect(history).not.toContainText("PC-003");
 await page.screenshot({path:"artifacts/compras/precos-desktop.png"});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await history.locator("tbody tr").first().scrollIntoViewIfNeeded();
 await page.screenshot({path:"artifacts/compras/precos-mobile.png"});
 await expect(page.getByRole("figure",{name:"Evolução de preços por UN"})).toBeVisible();
 await page.getByRole("button",{name:"Abrir compra PC-001",exact:true}).first().click();
 await expect(page.getByRole("heading",{name:"Ficha completa da compra conjunta"})).toBeVisible();
 expect(app.commands).toEqual([]);expect(app.errors).toEqual([]);
});
