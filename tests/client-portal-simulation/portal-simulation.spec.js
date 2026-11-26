import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";

for(const width of [1440,390])test(`prestação de contas leva o mês no arquivo baixado em ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});
  await page.route('https://**/*',route=>route.abort());
  await page.goto('/cliente',{waitUntil:'domcontentloaded'});
  await page.getByRole('textbox',{name:'E-mail'}).fill('cliente@example.test');
  await page.getByLabel('Senha',{exact:false}).fill('ClienteLocal1234');
  await page.getByRole('button',{name:'Entrar no portal',exact:true}).click();
  await page.getByRole('button',{name:'Ver contrato e recebimentos',exact:true}).click();
  const actions=page.getByRole('region',{name:'Prestação de contas',exact:true});
  await expect(actions.getByRole('note')).toContainText('Mês atual, até a data do download');
  const response=page.waitForResponse(result=>result.url().includes('/statement?format=pdf'));
  const pending=page.waitForEvent('download');
  await actions.getByRole('button',{name:'Baixar prestação de contas',exact:true}).click();
  const result=await response;
  expect(result.ok()).toBe(true);
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/^prestacao-contas-\d{4}-(?:0[1-9]|1[0-2])\.pdf$/);
  expect(result.headers()['content-disposition']).toContain(download.suggestedFilename());
  expect((await readFile(await download.path())).subarray(0,5).toString()).toBe('%PDF-');
  await actions.screenshot({path:info.outputPath('prestacao-de-contas.png'),animations:'disabled',timeout:10000});
});

for(const width of [1440,390])test(`confere a obra simulada por todas as abas em ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.route('https://**/*',route=>route.abort());
  await page.goto("/cliente",{waitUntil:'domcontentloaded'});await page.getByRole("textbox",{name:"E-mail"}).fill("cliente@example.test");await page.getByLabel("Senha",{exact:false}).fill("ClienteLocal1234");await page.getByRole("button",{name:"Entrar no portal",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Acompanhamento da obra",exact:true})).toBeVisible();
  const response=await page.request.get("/api/client/projects/obra-local/dashboard"),{portal}=await response.json();
  expect(response.status()).toBe(200);
  const afterThirdDay=portal.costSummaries[0].asOf>='2026-11-18';
  const cut=afterThirdDay?{recognized:5590,paid:2400,laborToDate:1200,laborBenefitsToDate:90}:{recognized:4960,paid:2400,laborToDate:600,laborBenefitsToDate:60};
  const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  expect(portal.costSummaries[0]).toMatchObject(cut);
  expect(portal.dailyReports).toHaveLength(14);expect(portal.publishedMedia).toHaveLength(13);
  expect(portal.contractPositions[0]).toMatchObject({contractCurrent:110000,accumulatedPercentage:50,accumulatedAmount:55000});
  await expect(page.getByText("78%",{exact:true})).toBeVisible();await expect(page.getByText(brl.format(cut.laborToDate),{exact:true})).toBeVisible();await expect(page.getByText(brl.format(cut.recognized),{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ver contrato e recebimentos",exact:true}).click();await expect(page).toHaveURL(/\/financeiro$/);await expect(page.getByRole("heading",{name:"Contrato e recebimentos",exact:true})).toBeVisible();await expect(page.getByText("Percentual contratual informado: 40,91%",{exact:false})).toBeVisible();await expect(page.getByText("novembro de 2026",{exact:false}).first()).toBeVisible();await page.goBack();await expect(page.getByRole("heading",{name:"Acompanhamento da obra",exact:true})).toBeVisible();
  await expect(page.locator(".arcd-client-financial-grid article").first()).toHaveCSS("background-color","rgba(248, 251, 253, 0.76)");
  await page.screenshot({path:`artifacts/portal-simulation-overview-${width}.png`,fullPage:true});
  const visit=async(id,label)=>{
    if(width===390)await page.getByRole("combobox",{name:"Abas do portal do cliente",exact:true}).selectOption(id);
    else{const button=page.getByRole("button",{name:label,exact:true});if(!await button.isVisible())await page.locator(".workspace-navigation__tools>summary").click();await button.click();}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  };
  await visit("photos","Diário da obra");await expect(page.getByText("13 de nov. de 2026 · 2 diários",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Mostrar mais dias",exact:true}).click();await expect(page.locator("details.arcd-client-disclosure")).toHaveCount(14);
  await expect(page.getByText("Alvenaria ilustrativa · 22 m² · avanço acumulado informado: 30%",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ampliar foto: Imagem demonstrativa do diário 13",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.keyboard.press("Escape");
  await page.getByLabel("Dia do diário",{exact:true}).fill("2026-11-13");await expect(page.locator("details.arcd-client-disclosure")).toHaveCount(2);
  await page.screenshot({path:`artifacts/portal-simulation-diaries-${width}.png`,fullPage:true});
  await visit("progress","Avanço físico");await expect(page.getByRole("heading",{name:"Fundação",exact:true})).toBeVisible();
  await visit("costs","Gastos por categoria");await expect(page.getByText("R$ 3.500,00",{exact:true}).first()).toBeVisible();await expect(page.getByText("R$ 800,00",{exact:true}).first()).toBeVisible();
  await visit("cash","Caixa da obra");await expect(page.getByText(brl.format(afterThirdDay?14600:9600),{exact:true}).first()).toBeVisible();
  if(width===390){await page.evaluate(()=>window.scrollTo(0,0));const firstEntry=await page.getByText(afterThirdDay?"18 de nov. de 2026 · Aporte":"Pagamento da nota fiscal 2002",{exact:true}).boundingBox();expect(firstEntry.y).toBeLessThan(844);}
  await expect(page.getByRole("link",{name:"Abrir nota fiscal 2002",exact:true})).toHaveAttribute("href","https://files.example.test/nota-2002.pdf");if(width===390)expect((await page.getByRole("link",{name:"Abrir nota fiscal 2002",exact:true}).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("+ R$ 2.000,00",{exact:true})).toHaveCSS("color","rgb(36, 99, 75)");
  await expect(page.getByText("− R$ 1.800,00",{exact:true})).toHaveCSS("color","rgb(162, 50, 59)");
  await page.getByLabel("Tipo de movimentação",{exact:true}).selectOption("out");await expect(page.getByRole("link",{name:"Abrir nota fiscal 2002",exact:true})).toBeVisible();await expect(page.getByText("+ R$ 2.000,00",{exact:true})).toHaveCount(0);
  const refreshed=page.waitForResponse(response=>response.url().endsWith("/projects/obra-local/dashboard"));await page.getByRole("button",{name:"Atualizar consulta",exact:true}).click();await refreshed;await expect(page.getByLabel("Tipo de movimentação",{exact:true})).toHaveValue("out");
  if(!await page.getByLabel("Data inicial do extrato",{exact:true}).isVisible())await page.getByRole("button",{name:/^Filtros/}).click();
  await page.getByLabel("Data inicial do extrato",{exact:true}).fill("2026-11-10");await expect(page.getByText("− R$ 600,00",{exact:true})).toHaveCount(0);
  await page.getByLabel("Buscar no extrato",{exact:true}).fill("2002");await expect(page.getByRole("link",{name:"Abrir nota fiscal 2002",exact:true})).toBeVisible();
  await page.getByLabel("Data final do extrato",{exact:true}).fill("2026-11-01");await expect(page.getByText("A data final deve ser igual ou posterior à data inicial.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Limpar filtros do extrato",exact:true}).click();await expect(page.getByText("+ R$ 2.000,00",{exact:true})).toBeVisible();
  const filtersToggle=page.getByRole("button",{name:/^Filtros/});if(await filtersToggle.getAttribute("aria-expanded")==="true")await filtersToggle.click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`artifacts/portal-priorities-statement-${width}.png`,fullPage:false});await page.screenshot({path:`artifacts/portal-simulation-statement-${width}.png`,fullPage:true});
  await visit("budget","Previsto e realizado");await expect(page.getByText("R$ 3.300,00",{exact:true}).first()).toBeVisible();await expect(page.getByText("Etapa ainda não informada",{exact:true}).first()).toBeVisible();
  await visit("purchases","Compras e notas fiscais");await page.locator("summary").filter({hasText:"PC-SIM-002"}).click();await expect(page.getByRole("link",{name:"Nota fiscal ilustrativa 2002.pdf",exact:true})).toBeVisible();
  await page.screenshot({path:`artifacts/portal-simulation-purchases-${width}.png`,fullPage:true});
  await visit("financial","Financeiro");await expect(page.getByRole("heading",{name:"Contrato e recebimentos",exact:true})).toBeVisible();await expect(page.getByText(brl.format(afterThirdDay?48400:47500),{exact:true})).toBeVisible();await expect(page.getByText(brl.format(afterThirdDay?6600:7500),{exact:true}).first()).toBeVisible();
  await page.screenshot({path:`artifacts/portal-simulation-contract-${width}.png`,fullPage:true});
  await visit("documents","Documentos");await expect(page.getByRole("heading",{name:"Cronograma ilustrativo.pdf",exact:true})).toBeVisible();
  await visit("decisions","Decisões");await expect(page.getByText("Ampliação de escopo ilustrativa",{exact:true})).toBeVisible();
  await visit("account","Minha conta");await expect(page.getByRole("button",{name:"Alterar senha",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ajuda",exact:true}).click();await expect(page.getByRole("heading",{name:"Cliente · Alterar senha e sair",exact:true})).toBeVisible();await page.getByRole("button",{name:"Fechar ajuda",exact:true}).click();
});
