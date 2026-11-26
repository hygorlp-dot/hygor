import {test,expect} from "@playwright/test";
async function login(page,email="cliente@example.test",password="ClienteLocal1234"){
  await page.goto("/cliente");await page.getByRole("textbox",{name:"E-mail"}).fill(email);await page.getByLabel("Senha",{exact:false}).fill(password);await page.getByRole("button",{name:"Entrar no portal",exact:true}).click();await expect(page.getByRole("heading",{name:"Acompanhamento da obra",exact:true})).toBeVisible();
}
for(const width of [1440,390])test(`portal em ${width}px: resumo, diários, gastos, caixa, orçamento e notas`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1000});await login(page);
  const progress=page.getByRole("heading",{name:"Avanço físico",exact:true});
  expect((await progress.boundingBox()).y).toBeLessThan(width===390?844:1000);
  expect(await progress.evaluate(element=>Boolean(element.compareDocumentPosition(document.querySelector('[aria-label="Contrato e cobrança do período"]'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByRole("button",{name:"Ver diário e fotos",exact:true})).toBeVisible();
  await expect(page.getByText("R$ 7.500,00",{exact:true})).toBeVisible();
  await expect(page.getByText("40%",{exact:true})).toBeVisible();
  const visit=async(id,label)=>width===390?page.getByRole("combobox",{name:"Abas do portal do cliente",exact:true}).selectOption(id):page.getByRole("button",{name:label,exact:true}).click();
  await page.screenshot({path:`artifacts/client-portal-overview-${width}.png`,fullPage:true});
  await visit("photos","Diário da obra");await expect(page.getByText("12 de nov. de 2026 · 1 diário",{exact:true})).toBeVisible();
  const thumbnail=page.getByRole("button",{name:"Ampliar foto: Imagem de teste · alvenaria"});
  await expect(thumbnail.locator("img")).toHaveCSS("object-fit","contain");
  expect((await thumbnail.boundingBox()).width).toBeGreaterThan(width===390?280:250);
  expect((await thumbnail.boundingBox()).width).toBeLessThan(500);
  await page.screenshot({path:`artifacts/client-portal-diary-${width}.png`,fullPage:true});
  await thumbnail.click();await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").locator("img")).toHaveCSS("object-fit","contain");
  await expect(page.getByRole("link",{name:"Abrir imagem original",exact:true})).toBeVisible();
  expect((await page.getByRole("dialog").locator("img").boundingBox()).width).toBeGreaterThan((await thumbnail.boundingBox()).width);
  await page.keyboard.press("Escape");await expect(thumbnail).toBeFocused();
  const diary=page.locator("summary").filter({hasText:"Recolher diário"}).first();await diary.focus();await page.keyboard.press("Enter");await expect(page.getByText("Abrir diário",{exact:true}).first()).toBeVisible();await page.keyboard.press("Enter");
  await page.getByLabel("Dia do diário",{exact:true}).fill("2026-11-11");await expect(page.getByText("Etapa de fundação",{exact:true}).first()).toBeVisible();await expect(page.getByText("12 de nov. de 2026 · 1 diário",{exact:true})).toHaveCount(0);
  await visit("costs","Gastos por categoria");await expect(page.getByText("R$ 1.200,00",{exact:true}).first()).toBeVisible();
  await visit("cash","Caixa da obra");await expect(page.getByRole("region",{name:"Resumo do caixa da obra",exact:true}).getByText("R$ 9.400,00",{exact:true})).toBeVisible();
  await visit("budget","Previsto e realizado");await expect(page.getByText("Fundação",{exact:true}).first()).toBeVisible();
  await visit("purchases","Compras e notas fiscais");await page.locator("summary").filter({hasText:"PC-001"}).click();await expect(page.getByRole("link",{name:"Nota fiscal 1001.pdf"})).toHaveAttribute("href","https://files.example.test/nota-1001.pdf");
  await expect(page.getByRole("heading",{name:"Notas sem pedido vinculado",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Ajuda",exact:true}).click();await expect(page.getByRole("heading",{name:"Cliente · Compras e notas fiscais"})).toBeVisible();await page.getByRole("button",{name:"Fechar ajuda",exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/client-portal-purchases-${width}.png`,fullPage:true});
  await page.getByRole("button",{name:"Sair do portal",exact:true}).click();await expect(page.getByRole("button",{name:"Entrar no portal",exact:true})).toBeVisible();
});
test("administrador cadastra credenciais e revoga somente o vínculo escolhido",async({page})=>{
  const email=`browser-${Date.now()}@example.test`;
  await page.goto("/__portal_review_admin");await page.getByLabel("E-mail de login",{exact:false}).fill(email);await page.getByLabel("Senha inicial ou nova senha",{exact:false}).fill("BrowserLocal12345");await page.getByRole("button",{name:"Salvar acesso do cliente",exact:true}).click();
  await expect(page.getByRole("button",{name:"Copiar convite do cliente",exact:true})).toBeVisible();await expect(page.getByLabel("Senha inicial ou nova senha",{exact:false})).toHaveValue("");
  const row=page.locator("article").filter({has:page.getByText(email,{exact:true})});await row.getByRole("button",{name:"Revogar acesso",exact:true}).click();await page.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.getByRole("button",{name:"Revogar acesso",exact:true}).click();await page.getByRole("button",{name:"Confirmar revogação",exact:true}).click();await expect(row.getByText("Proprietário · Revogado",{exact:true})).toBeVisible();
});
test("cliente altera a senha e entra novamente com a nova credencial",async({page})=>{
  await page.request.post("/api/data",{data:{action:"client-portal-admin",operation:"provision",obraId:"obra-local",email:"senha-browser@example.test",password:"SenhaAnterior1234",profile:"owner"}});
  await page.setViewportSize({width:390,height:844});await login(page,"senha-browser@example.test","SenhaAnterior1234");
  await page.getByRole("combobox",{name:"Abas do portal do cliente",exact:true}).selectOption("account");
  await page.getByLabel(/^Senha atual/).fill("SenhaAnterior1234");await page.getByLabel(/^Nova senha/).fill("SenhaAlterada1234");await page.getByLabel(/^Confirmar nova senha/).fill("SenhaAlterada1234");
  await page.getByRole("button",{name:"Alterar senha",exact:true}).click();await expect(page.getByText("Senha alterada.",{exact:false})).toBeVisible();await page.getByRole("button",{name:"Entrar novamente",exact:true}).click();
  await expect(page.getByRole("button",{name:"Entrar no portal",exact:true})).toBeVisible();await login(page,"senha-browser@example.test","SenhaAlterada1234");
});
test("fotos verticais e horizontais permanecem inteiras no celular, tablet e computador",async({page})=>{
  await login(page);
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:1000});
    for(const dimensions of [{w:600,h:1200},{w:1600,h:900}]){
      await page.route("**/brand/marcell/monogram-azul.svg",route=>route.fulfill({contentType:"image/svg+xml",body:`<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.w}" height="${dimensions.h}"><rect x="1" y="1" width="${dimensions.w-2}" height="${dimensions.h-2}" fill="white" stroke="black"/></svg>`}));
      await page.goto("/cliente/obra/obra-local/diario");
      const thumbnail=page.getByRole("button",{name:"Ampliar foto: Imagem de teste · alvenaria"});
      await expect(thumbnail).toBeVisible();
      await expect.poll(()=>thumbnail.locator("img").evaluate(image=>image.naturalWidth)).toBe(dimensions.w);
      await expect(thumbnail.locator("img")).toHaveCSS("object-fit","contain");
      await thumbnail.click();
      const image=page.getByRole("dialog").locator("img");
      await expect(image).toHaveCSS("object-fit","contain");
      const frame=await image.boundingBox();expect(frame.width).toBeLessThanOrEqual(width);expect(frame.height).toBeLessThan(1000);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.keyboard.press("Escape");await expect(thumbnail).toBeFocused();
      await page.unroute("**/brand/marcell/monogram-azul.svg");
    }
  }
});
test("tema vidro aparece no login e preserva a aparência escolhida para o ERP",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("arcd-theme","operacional"));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto("/cliente");
    await expect(page.getByRole("button",{name:"Entrar no portal",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Ajuda",exact:true}).locator(".app-help-button__label")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme","vidro");
    await expect(page.locator(".arcd-material-panel")).toHaveCSS("background-color","rgba(248, 251, 253, 0.68)");
    await expect(page.locator(".arcd-themed-canvas")).toHaveCSS("background-image",/portal-residencia.webp/);
    expect(await page.evaluate(()=>localStorage.getItem("arcd-theme"))).toBe("operacional");
    await page.screenshot({path:`artifacts/client-portal-login-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect((await page.request.get("/brand/marcell/portal-residencia.webp")).status()).toBe(200);
});
