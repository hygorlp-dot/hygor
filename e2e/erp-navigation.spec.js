import {expect,test} from "@playwright/test";

test("identidade MARCELL carrega as fontes locais e a marca oficial no acesso",async({page})=>{
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,usuarios:[],precisaSetup:false}}));
  await page.route("https://fonts.googleapis.com/**",route=>route.abort());
  await page.goto("/");
  const signature=page.locator(".mrc-login-signature");
  await expect(signature).toBeVisible();
  await expect(signature).toHaveAttribute("src","/brand/marcell/full-ouro.svg");
  await expect(page.getByRole("button",{name:"Acessar central MARCELL"})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>[...document.fonts].filter(font=>font.family.includes("Nimbus Sans")&&font.status==="loaded").length)).toBeGreaterThan(0);
  await expect(page.locator("#login-email")).toHaveCSS("font-family",/Nimbus Sans/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});

test("tema MARCELL migra a aparência e mantém leitura com ampliação",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("arcd-theme","architectural"));
  const app=await enter(page,"admin");
  await expect(page.locator("html")).toHaveAttribute("data-theme","marcell");
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Gestão financeira");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Gestão financeira"}).click();
  await expect(page.locator(".financial-summary")).toBeVisible();
  await expect(page.locator(".page-hero__title")).toHaveCSS("font-size","24px");
  await expect(page.locator(".arcd-main")).toHaveCSS("background-image","none");
  expect(await page.locator(".module-workflow").count()).toBe(0);
  await expect(page.getByRole("combobox",{name:"Ano",exact:true})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Mês",exact:true})).toBeVisible();
  for(const scale of ["100%","200%"]){
    await page.evaluate(value=>document.documentElement.style.fontSize=value,scale);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll(".financial-metric dd")].some(e=>e.scrollWidth>e.clientWidth+1)}));
    expect(layout).toEqual({overflow:false,clipped:false});
  }
  await page.evaluate(()=>document.documentElement.style.fontSize="100%");
  await page.keyboard.press("Control+k");await search.fill("Folha");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Folha"}).first().click();
  await expect(page.locator(".payroll-summary-strip__net strong")).toHaveCSS("color","rgb(255, 255, 255)");
  await expect(page.locator(".payroll-summary-strip__net small")).toHaveCSS("color","rgb(217, 221, 226)");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test("tipografia mantém hierarquia em páginas, campos e modais",async({page})=>{
  const app=await enter(page,"admin");
  const touch=page.viewportSize().width<768;
  async function open(label){
    await page.keyboard.press("Control+k");
    const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
    await search.fill(label);
    await search.locator("xpath=../..").getByRole("button").filter({hasText:label}).first().click();
    await expect(page.locator(".arcd-page-loading:visible")).toHaveCount(0);
  }
  await open("Compras");
  await expect(page.locator(".purchase-header h2")).toHaveCSS("font-size","24px");
  await expect(page.locator(".purchase-header h2")).toHaveCSS("font-weight","500");
  await open("Fornecedores");
  const supplierFields=page.locator("main input:visible");
  expect(await supplierFields.count()).toBeGreaterThan(0);
  for(const field of await supplierFields.all()){
    await expect(field).toHaveCSS("font-family",/Nimbus Sans/);
    await expect(field).toHaveCSS("font-size",touch?"16px":"14px");
  }
  await open("Obras");
  // Empty portfolio: this existing action emits a notice without saving a record.
  await page.getByRole("button",{name:"Preparar pastas",exact:true}).click();
  await expect(page.locator(".arcd-toast")).toContainText("Todas as obras já estão com a estrutura documental preparada.");
  await page.getByRole("button",{name:/Nova obra/}).first().click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h3")).toHaveCSS("font-size","18px");
  await expect(dialog.locator("h3")).toHaveCSS("font-weight","500");
  const notice=dialog.locator(".arcd-modal-notice .arcd-toast");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS("position","static");
  const noticeBounds=await notice.boundingBox(),firstFieldBounds=await dialog.locator("input").first().boundingBox();
  expect(noticeBounds.y+noticeBounds.height).toBeLessThanOrEqual(firstFieldBounds.y);

  for(const field of await dialog.locator('input:not([type="checkbox"]):not([type="radio"]):visible,select:visible,textarea:visible').all()){
    await expect(field).toHaveCSS("font-family",/Nimbus Sans/);
    await expect(field).toHaveCSS("font-size",touch?"16px":"14px");
  }
  await page.keyboard.press("Escape");
  await open("Folha");
  await expect(page.locator(".payroll-summary-strip__net small")).toHaveCSS("font-size","12px");
  await expect(page.locator(".payroll-summary-strip__net strong")).toHaveCSS("font-family",/Nimbus Sans/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await open("Ajustes");
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  const themeSelect=page.getByRole("combobox",{name:"Tema",exact:true});
  await expect(themeSelect).toBeVisible();
  expect(await themeSelect.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.evaluate(()=>document.documentElement.style.fontSize="100%");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

async function enter(page,role,accessTabs){
  const profile={id:"erp-qa",nome:"Operador QA",role,email:"erp@arcd.test",active:true,...(accessTabs?{accessTabs}:{})};
  let data={usuarios:[profile],obras:[],employees:[],attendance:{},config:{companyName:"ARCD",paymentHolidays:[]},payments:[],notasFiscais:[],pagamentosFolha:[],caixaObra:[],transacoes:[]};
  const original=JSON.stringify([data.payments,data.notasFiscais,data.pagamentosFolha,data.caixaObra,data.transacoes]);
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],bases:[]}}));
  await page.route("**/api/data",route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="save-sections")data={...data,...body.sections};
    if(body.action==="save")data=body.payload||data;
    if(["financial-dre-report","financial-company-dre-report"].includes(body.action))return route.fulfill({json:{ok:true,current:null,history:[]}});
    return route.fulfill({json:{ok:true,accessToken:"isolated-access",refreshToken:"isolated-refresh",usuario:profile,data,updatedAt:"2026-10-23T12:00:00Z"}});
  });
  await page.goto("/");await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("isolated-password");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await expect(page.locator(".app-breadcrumb")).toContainText("Visão gerencial");
  return {errors,financialUnchanged:()=>JSON.stringify([data.payments,data.notasFiscais,data.pagamentosFolha,data.caixaObra,data.transacoes])===original};
}

for(const role of ["financeiro","engenheiro","rh"]){
  test(`busca e atalhos mantêm as permissões de ${role}`,async({page})=>{
    const app=await enter(page,role);
    await page.keyboard.press("Control+k");
    const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela..."),palette=search.locator("xpath=../..");
    await search.fill("DRE empresa");
    const dre=palette.getByRole("button").filter({hasText:"DRE empresa"});
    await expect(dre).toHaveCount(role==="financeiro"?1:0);
    if(role==="financeiro"){
      await dre.click();await expect(page.locator(".app-breadcrumb")).toContainText("Visão gerencial");
      await page.keyboard.press("Control+k");
    }
    await search.fill("Locação de equipamentos");
    const rentals=palette.getByRole("button").filter({hasText:"Locação de equipamentos"});
    await expect(rentals).toHaveCount(role==="financeiro"?1:0);
    if(role==="financeiro"){
      await rentals.click();await expect(page.locator(".app-breadcrumb")).toContainText("Equipamentos e locações");
    }else await page.keyboard.press("Escape");
    expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
    if(page.viewportSize().width<1100)expect(await page.locator(".mobile-primary-nav").evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  });
}

test("permissão comercial personalizada mantém o destino antigo e o módulo correto",async({page})=>{
  const app=await enter(page,"comercial",["com_clientes"]);
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela..."),palette=search.locator("xpath=../..");
  await search.fill("Clientes");await palette.getByRole("button").filter({hasText:"Clientes"}).click();
  await expect(page.locator(".app-breadcrumb")).toContainText("Comercial");
  await page.keyboard.press("Control+k");await search.fill("DRE");
  await expect(palette.getByRole("button")).toHaveCount(0);await page.keyboard.press("Escape");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test("todos os módulos ficam acessíveis e locações sai do Financeiro",async({page},testInfo)=>{
  const app=await enter(page,"admin");
  const modules=["Visão gerencial","Financeiro","Obras e projetos","Compras e suprimentos","Equipamentos e locações","Pessoas e terceiros","Comercial","Administração"];
  if(page.viewportSize().width<1100){
    await expect(page.locator(".mobile-primary-nav")).toBeVisible();
    for(const label of modules){
      const direct=page.getByRole("button",{name:`Abrir ${label}`,exact:true});
      if(await direct.count())await direct.click();
      else{
        await page.getByRole("button",{name:"Abrir mais módulos",exact:true}).click();
        await page.getByRole("dialog").getByRole("button",{name:label,exact:true}).click();
      }
      await expect(page.locator(".app-breadcrumb")).toContainText(label);
      await expect(page.getByRole("button",{name:`Abrir ${label}`,exact:true})).toHaveAttribute("aria-current","page");
    }
    expect(await page.locator(".mobile-primary-nav > button").count()).toBeLessThanOrEqual(5);
  }else{
    const headers=page.locator(".arcd-sidebar .nav-grp-hd");
    await expect(headers).toHaveCount(8);
    const finance=headers.filter({hasText:/^Financeiro/});await finance.click();
    const body=finance.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    await expect(body.getByRole("button",{name:"Locação de equipamentos",exact:true})).toHaveCount(0);
    await expect(body.getByRole("button",{name:"DRE empresa",exact:true})).toHaveCount(0);
  }
  await page.screenshot({path:`C:/tmp/erp-${testInfo.project.name}.png`});
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test("chat fica acima da navegação e cabe na tela em modo paisagem",async({page})=>{
  test.skip(page.viewportSize().width>=1100,"O limite de altura cobre a navegação do celular.");
  const app=await enter(page,"rh");
  await page.setViewportSize({width:844,height:390});
  await page.getByRole("button",{name:"Abrir chat da equipe",exact:true}).click();
  const panel=page.locator(".arcd-team-chat > div").first();
  await expect(panel).toBeVisible();
  const bounds=await panel.boundingBox(),navigation=await page.locator(".arcd-mobile-nav").boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(navigation.y);
  await page.getByRole("button",{name:"Abrir chat da equipe",exact:true}).click();
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});


test("fluxos internos e atalho do DRE preservam competência e pagamentos",async({page})=>{
  const app=await enter(page,"admin");
  async function open(label){
    await page.keyboard.press("Control+k");const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");await search.fill(label);
    await search.locator("xpath=../..").getByRole("button").filter({hasText:label}).first().click();
  }
  await open("Compras");
  await expect(page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button",{name:/^Pagamentos/})).toBeVisible();
  await page.getByRole("region",{name:"Integração com o DRE"}).locator("summary").click();
  await page.getByLabel("Competência do DRE").fill("2026-09");
  const requests=[];page.on("request",request=>{if(request.url().endsWith("/api/data")){const body=request.postDataJSON();if(body.action==="financial-dre-report")requests.push(body);}});
  const integration=page.getByRole("region",{name:"Integração com o DRE"});
  await integration.getByRole("button",{name:"Consultar valores no DRE",exact:true}).click();
  await expect(integration).toContainText("Não foi possível consultar o DRE");
  expect(requests.at(-1)).toMatchObject({year:2026,month:8,period:"mes",obraId:""});
  await integration.getByRole("button",{name:"Abrir DRE neste recorte",exact:true}).click();
  await expect(page.locator(".app-breadcrumb")).toContainText("DRE obras");
  await expect.poll(()=>requests.filter(body=>body.year===2026&&body.month===8).length).toBeGreaterThan(1);
  await open("Folha");
  const controls=page.getByRole("region",{name:"Competência e escopo da folha"});await expect(controls).toBeVisible();
  const order=await page.locator(".payroll-workspace").evaluate(element=>{
    const filters=element.querySelector(".payroll-controls"),report=element.querySelector(".payroll-actionbar"),check=element.querySelector(".payroll-checklist");
    return Boolean(filters.compareDocumentPosition(check)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(check.compareDocumentPosition(report)&Node.DOCUMENT_POSITION_FOLLOWING);
  });expect(order).toBe(true);
  await expect(page.getByRole("region",{name:"Áreas da folha"}).locator("details")).not.toHaveAttribute("open");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});
