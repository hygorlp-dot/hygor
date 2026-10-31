import { expect, test } from "@playwright/test";
import { applyReconciliationCommand } from "../server/reconciliation-command.js";

test("concilia casos únicos e mantém dúvidas visíveis, inclusive no mobile", async ({ page }) => {
  const profile = { id: "qa-fin", nome: "Financeiro QA", email: "financeiro@arcd.test", role: "admin", active: true };
  let state = {
    usuarios: [profile], obras: [], config: { paymentHolidays: [] },
    fornecedores: [{ id: "f1", nome: "Fornecedor QA", chavePix: "fornecedor@pix" }],
    notasFiscais: [{ id: "n1", numero: "NF-QA", fornecedorId: "f1", status: "aprovada", valorLiquido: 300, vencimento: "2026-10-20", pagamentos: [] }, { id: "n3", numero: "NF-QA-3", fornecedorId: "f1", status: "aprovada", valorLiquido: 400, vencimento: "2026-10-20", pagamentos: [] }],
    transacoes: [
      { id: "t1", descricao: "Pix enviado Fornecedor QA", data: "2026-10-20", valor: -300, chavePix: "fornecedor@pix", fitid: "fit-qa", status: "pendente" },
      { id: "t2", descricao: "Pix sem identificação", data: "2026-10-21", valor: 123, fitid: "fit-unknown", status: "pendente" },
      { id: "t3", descricao: "Pix com falha temporária", data: "2026-10-20", valor: -400, chavePix: "fornecedor@pix", fitid: "fit-qa-3", status: "pendente" },
    ],
  };
  const commands = [], errors = [];
  let rejectOnce = true;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true, presencas: [] } }));
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "profiles") return route.fulfill({ json: { usuarios: [profile], precisaSetup: false } });
    if (body.action === "auth-refresh") return route.fulfill({ json: { accessToken: "qa-access", refreshToken: "qa-refresh" } });
    if (body.action === "reconciliation-command") {
      commands.push(body.command);
      if (body.command.payload.transactionId === "t3" && rejectOnce) { rejectOnce = false; return route.fulfill({status:409,json:{error:"Falha temporária de teste"}}); }
      const result = applyReconciliationCommand(state, body.command, profile);
      if (!result.resumo.ok) return route.fulfill({ status: 409, json: { error: result.resumo.motivo } });
      const sections = Object.fromEntries(Object.entries(result.data).filter(([key, value]) => value !== state[key]));
      state = result.data;
      return route.fulfill({ json: { ok: true, sections, updatedAt: new Date().toISOString() } });
    }
    return route.fulfill({ json: { ok: true, accessToken: "qa-access", refreshToken: "qa-refresh", usuario: profile, data: state, updatedAt: "2026-10-28T10:00:00Z" } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(profile.email);
  await page.locator("#login-senha").fill("qa-isolado");
  await page.getByRole("button", { name: /Acessar central/ }).click();
  const sidebar = page.locator(".arcd-sidebar");
  await sidebar.locator(".nav-grp-hd").filter({ hasText: /^Financeiro/ }).click();
  await sidebar.locator(".nav-item").filter({ hasText: /^Conciliação$/ }).click();
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  await expect.poll(() => state.transacoes[0].status).toBe("conciliado");
  await expect(page.getByRole("button", {name:"Tentar novamente as falhas"})).toBeVisible();
  expect(commands).toHaveLength(2);
  await page.getByRole("button", {name:"Tentar novamente as falhas"}).click();
  await expect.poll(() => state.transacoes[2].status).toBe("conciliado");
  expect(commands).toHaveLength(3);
  expect(commands[0].type).toBe("AUTO_MATCH");
  expect(state.transacoes[1].status).toBe("pendente");
  await page.getByRole("button",{name:"Comparar e buscar",exact:true}).click();
  const inspector=page.getByRole("region",{name:"Comparar e resolver movimento",exact:true});
  await expect(inspector).toBeVisible();
  const queueBounds=await page.locator(".reconciliation-queue").boundingBox();
  const panelBounds=await inspector.boundingBox();
  expect(panelBounds.x).toBeGreaterThan(queueBounds.x+queueBounds.width-1);
  await page.screenshot({path:"test-results/conciliacao-review-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Fechar comparação",exact:true}).click();
  await page.getByRole("button", { name: /^Identificados/ }).click();
  await expect(page.getByText("Conciliada automaticamente", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Pausar automação" }).click();
  await expect(page.getByText("Conciliação automática pausada", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/conciliacao-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "Selecionar visão", exact:true }).first().selectOption("pendentes");
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/conciliacao-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(3);
  await page.getByRole("button", {name:"Comparar e buscar",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Movimento do banco",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Identificação no app",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirmar vínculos selecionados",exact:true})).toBeDisabled();
  await page.screenshot({path:"test-results/conciliacao-review-mobile.png",fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("comparação persistente mantém dúvidas e exibe divergências sem confirmar pagamentos",async({page})=>{
  const profile={id:"qa-review",nome:"Revisão QA",email:"review@arcd.test",role:"admin",active:true};
  const state={usuarios:[profile],config:{paymentHolidays:[]},obras:[{id:"work",name:"Obra de teste"}],
    fornecedores:[{id:"supplier",nome:"Fornecedor Cadastrado",cnpj:"12345678000199",chavePix:"cadastro@pix"}],
    pedidos:[{id:"purchase",numero:"PC-REVIEW",obraId:"work",fornecedorId:"supplier",status:"enviado",data:"2026-10-18",itens:[{id:"item",qtd:1,precoUnit:300}]}],
    notasFiscais:[{id:"invoice",numero:"NF-REVIEW",pedidoId:"purchase",fornecedorId:"supplier",obraId:"work",status:"aprovada",valorLiquido:300,vencimento:"2026-10-20",documentos:[{nome:"Nota da revisão.png",url:"https://example.test/nota.png"}],pagamentos:[]}],
    transacoes:[{id:"review-one",descricao:"PIX para Pessoa Diferente",contraparteNome:"Pessoa Diferente",cpfCnpj:"98765432000188",chavePix:"outro@pix",data:"2026-10-20",valor:-300,status:"pendente"},
      {id:"review-two",descricao:"Outro movimento sem identificação",data:"2026-10-21",valor:123,status:"pendente"}]};
  const commands=[],errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://example.test/nota.png",route=>route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY3sAAAAASUVORK5CYII=","base64")}));
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,presencas:[]}}));
  await page.route("**/api/data",route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="reconciliation-command")commands.push(body.command);
    return route.fulfill({json:{ok:true,accessToken:"qa",refreshToken:"qa",usuario:profile,data:state,updatedAt:"2026-10-31T12:00:00Z"}});
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("isolated");await page.getByRole("button",{name:/Acessar central/}).click();
  const sidebar=page.locator(".arcd-sidebar");await sidebar.locator(".nav-grp-hd").filter({hasText:/^Financeiro/}).click();await sidebar.locator(".nav-item").filter({hasText:/^Conciliação$/}).click();
  const first=page.locator(".reconciliation-row").filter({hasText:"PIX para Pessoa Diferente"});
  await first.getByRole("button",{name:"Comparar e buscar",exact:true}).click();
  const panel=page.getByRole("region",{name:"Comparar e resolver movimento",exact:true});
  await expect(panel.getByRole("table").first()).toBeVisible();
  await expect(panel.getByRole("row").filter({hasText:"Favorecido / pagador"}).first()).toContainText("Divergente · conferir");
  await expect(panel.getByRole("row").filter({hasText:"CPF/CNPJ"}).first()).toContainText("Divergente · conferir");
  await expect(panel).toContainText("Identificar a pessoa não confirma o lançamento financeiro");
  await panel.getByRole("button",{name:"Documentos e ficha de Nota Fiscal NF-REVIEW",exact:true}).click();
  const documents=panel.getByRole("region",{name:"Documentos da revisão",exact:true});
  await documents.getByRole("button",{name:"Nota da revisão.png",exact:true}).click();
  await expect(documents.getByRole("img",{name:"Nota da revisão.png",exact:true})).toBeVisible();
  await documents.getByRole("button",{name:"Ver ficha da compra nesta revisão",exact:true}).click();
  await expect(documents.getByRole("region",{name:"Ficha completa da compra conjunta",exact:true})).toContainText("PC-REVIEW");
  expect(await page.getByRole("dialog").count()).toBe(0);
  await documents.evaluate(element=>element.scrollIntoView({block:"start"}));
  await page.screenshot({path:"test-results/conciliacao-documentos-desktop.png"});
  await documents.getByRole("button",{name:"Fechar documentos",exact:true}).click();
  await panel.getByRole("textbox",{name:"Buscar lançamentos existentes",exact:true}).fill("busca da primeira revisão");
  await page.screenshot({path:"test-results/conciliacao-evidencias-desktop.png",fullPage:true});
  await panel.evaluate(element=>{element.scrollTop=0;window.scrollTo(0,element.getBoundingClientRect().top+window.scrollY-80);});
  await page.screenshot({path:"test-results/conciliacao-fila-comparacao-desktop.png"});
  await page.locator(".reconciliation-row").filter({hasText:"Outro movimento sem identificação"}).getByRole("button",{name:"Comparar e buscar",exact:true}).click();
  await expect(panel.getByRole("textbox",{name:"Buscar lançamentos existentes",exact:true})).toHaveValue("");
  await expect(panel.getByRole("region",{name:"Movimento do banco",exact:true})).toContainText("Outro movimento sem identificação");
  await page.setViewportSize({width:390,height:844});
  await page.locator(".reconciliation-row").filter({hasText:"PIX para Pessoa Diferente"}).getByRole("button",{name:"Comparar e buscar",exact:true}).click();
  await expect(panel).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await panel.getByRole("button",{name:"Documentos e ficha de Nota Fiscal NF-REVIEW",exact:true}).click();
  await documents.getByRole("button",{name:"Nota da revisão.png",exact:true}).click();
  await expect(documents.getByRole("img",{name:"Nota da revisão.png",exact:true})).toBeVisible();
  await documents.evaluate(element=>element.scrollIntoView({block:"start"}));
  await page.screenshot({path:"test-results/conciliacao-documentos-mobile.png"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await documents.getByRole("button",{name:"Fechar documentos",exact:true}).click();
  await page.screenshot({path:"test-results/conciliacao-evidencias-mobile.png",fullPage:true});
  await panel.evaluate(element=>window.scrollTo(0,element.getBoundingClientRect().top+window.scrollY-80));
  await page.screenshot({path:"test-results/conciliacao-fila-comparacao-mobile.png"});
  expect(commands).toEqual([]);expect(errors).toEqual([]);
});

test("filtros preservam seleção e a revisão só avança após vínculo integral confirmado",async({page})=>{
  const profile={id:"qa-flow",nome:"Conciliação QA",email:"flow@arcd.test",role:"admin",active:true};
  let state={usuarios:[profile],config:{paymentHolidays:[]},obras:[{id:"a",name:"Obra Alfa"},{id:"b",name:"Obra Beta"}],
    caixaObra:[{id:"cash-a",obraId:"a",tipo:"aporte",descricao:"Aporte Alfa",valor:100,data:"2026-10-19"},{id:"cash-b",obraId:"b",tipo:"aporte",descricao:"Aporte Beta",valor:100,data:"2026-10-18"}],
    transacoes:[{id:"one",descricao:"Primeiro depósito para revisar",data:"2026-10-21",valor:100,status:"pendente"},{id:"two",descricao:"Segundo depósito para revisar",data:"2026-10-20",valor:100,status:"pendente"}]};
  const commands=[],errors=[];let failOnce=true;page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,presencas:[]}}));
  await page.route("**/api/data",async route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="reconciliation-command"){
      commands.push(body.command);
      if(failOnce){failOnce=false;return route.fulfill({status:409,json:{error:"Falha simulada de confirmação"}});}
      const result=applyReconciliationCommand(state,body.command,profile);
      if(!result.resumo.ok)return route.fulfill({status:409,json:{error:result.resumo.motivo}});
      state=result.data;return route.fulfill({json:{ok:true,data:state,updatedAt:new Date().toISOString()}});
    }
    return route.fulfill({json:{ok:true,accessToken:"qa",refreshToken:"qa",usuario:profile,data:state,updatedAt:new Date().toISOString()}});
  });
  await page.goto("/",{waitUntil:"domcontentloaded"});await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("isolated");await page.getByRole("button",{name:/Acessar central/}).click();
  const sidebar=page.locator(".arcd-sidebar");await sidebar.locator(".nav-grp-hd").filter({hasText:/^Financeiro/}).click();await sidebar.locator(".nav-item").filter({hasText:/^Conciliação$/}).click();
  await page.locator(".reconciliation-row").filter({hasText:"Primeiro depósito para revisar"}).getByRole("button",{name:"Comparar e buscar",exact:true}).click();
  const panel=page.getByRole("region",{name:"Comparar e resolver movimento",exact:true});
  const search=panel.getByRole("region",{name:"Buscar lançamentos existentes",exact:true});
  await search.getByText("Filtrar lançamentos existentes",{exact:true}).click();
  await search.getByLabel("Obra",{exact:true}).selectOption("a");await search.getByLabel("Data inicial",{exact:true}).fill("2026-10-19");
  await search.getByRole("checkbox").check();
  await search.getByLabel("Obra",{exact:true}).selectOption("b");
  await expect(search).toContainText("Selecionado fora dos filtros: Aporte Alfa");
  await search.getByRole("button",{name:"Limpar filtros da busca",exact:true}).click();
  const confirm=panel.getByRole("button",{name:"Confirmar vínculos selecionados",exact:true});
  await confirm.click();await expect.poll(()=>commands.length).toBe(1);
  await expect(panel.getByRole("region",{name:"Movimento do banco",exact:true})).toContainText("Primeiro depósito para revisar");
  await confirm.click();await expect.poll(()=>state.transacoes[0].status).toBe("conciliado");
  await expect(panel.getByRole("region",{name:"Movimento do banco",exact:true})).toContainText("Segundo depósito para revisar");
  await panel.getByRole("checkbox").check();
  await panel.getByLabel("Valor a vincular: Aporte Beta",{exact:true}).fill("40");await confirm.click();
  await expect.poll(()=>state.transacoes[1].status).toBe("parcial");await expect(panel.getByRole("region",{name:"Movimento do banco",exact:true})).toContainText("Segundo depósito para revisar");
  await panel.getByRole("checkbox").check();await confirm.click();
  await expect.poll(()=>state.transacoes[1].status).toBe("conciliado");await expect(panel).toHaveCount(0);
  await expect(page.getByText("Movimento confirmado. Nenhum outro caso neste filtro precisa de revisão.",{exact:true})).toBeVisible();
  expect(commands).toHaveLength(4);expect(state.reconciliationLinks).toHaveLength(3);expect(state.caixaObra).toHaveLength(2);expect(errors).toEqual([]);
});
