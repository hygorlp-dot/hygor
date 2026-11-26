import {expect,test} from "@playwright/test";
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';

const tokenValue=(element,token,property)=>element.evaluate((node,{name,property})=>{
  const probe=document.createElement("span");
  probe.hidden=true;
  probe.style.setProperty(property,getComputedStyle(node).getPropertyValue(name).trim());
  node.parentElement.append(probe);
  const value=getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
},{name:token,property});
const tokenSize=(element,token)=>tokenValue(element,token,"font-size");

test('a área autenticada fica fora da entrada até a sessão ser confirmada',async({page})=>{
  const operationalRequests=[];
  page.on('request',request=>{
    const {pathname}=new URL(request.url());
    if(/\/assets\/(?:LegacyApp|fi|charts)-[^/]+\.js$|\/recharts\.js$|\/src\/(?:.*LegacyApp\.jsx|(?:domains|features)\/(?:financeiro|dre|conciliacao)\/.+\.[jt]sx?)$/.test(pathname)){
      operationalRequests.push(pathname);
    }
  });
  await page.route('**/api/data',route=>{
    const {action}=route.request().postDataJSON()||{};
    if(action==='profiles')return route.fulfill({json:{precisaSetup:false}});
    return route.fulfill({status:401,json:{error:'E-mail ou senha inválidos.'}});
  });
  await page.goto('/');
  await page.locator('#login-email').fill('teste@example.test');
  await page.locator('#login-senha').fill('senha-ficticia');
  await page.getByRole('button',{name:'Acessar central MARCELL'}).click();
  await expect(page.getByText('E-mail ou senha inválidos.',{exact:true})).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(operationalRequests).toEqual([]);
});

test('Ajuda contextual acompanha a tela e oferece manual pesquisável sem alterar registros',async({page})=>{
 const app=await enter(page,'admin');
 const help=page.getByRole('button',{name:'Ajuda',exact:true});
 await expect(help).toBeVisible();
 if(page.viewportSize().width<768){
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await expect(help).toBeVisible();
   expect(await page.locator('.arcd-topbar').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
  }
 }
 await help.click();
 const panel=page.getByRole('complementary',{name:'Central de ajuda'});
 await expect(panel).toBeVisible();
 await expect(panel.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Manual completo',exact:true}).click();
 const search=panel.getByLabel('O que você precisa fazer?');
 await search.fill('conciliacao');
 await panel.getByRole('navigation',{name:'Guias do manual'}).getByRole('button',{name:'Conciliação',exact:true}).click();
 await expect(panel.locator('article')).toContainText('Relacionar movimentos do extrato');
 await search.fill('termo-impossivel');
 await expect(panel).toContainText('Nenhum guia encontrado');
 await panel.getByRole('button',{name:'Limpar busca'}).click();
 await panel.getByRole('button',{name:'Esta página',exact:true}).click();
 await expect(panel.locator('article')).toContainText('Dashboard');
 expect(await panel.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
 await page.screenshot({path:`artifacts/ajuda/ajuda-${page.viewportSize().width}.png`});
 await panel.getByRole('button',{name:'Fechar ajuda'}).click();
 await expect(help).toBeFocused();
 await page.keyboard.press('Control+k');
 const globalSearch=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
 await globalSearch.fill('Compras');
 await globalSearch.locator('xpath=../..').getByRole('button').filter({hasText:'Compras'}).first().click();
 await selectWorkspaceArea(page,'Fluxo de compras','Receber');
 await help.click();
 await expect(panel.getByRole('heading',{name:'Compras · Receber',exact:true})).toBeVisible();
 await panel.getByRole('heading',{name:'Ajuda e manual'}).focus();
 await page.keyboard.press('Escape');
 await expect(panel).toHaveCount(0);
 await expect(help).toBeFocused();
 expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test('Ajuda mostra somente guias das áreas disponíveis ao perfil',async({page})=>{
 await enter(page,'rh');
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();
 const panel=page.getByRole('complementary',{name:'Central de ajuda'});
 await panel.getByRole('button',{name:'Manual completo',exact:true}).click();
 const index=panel.getByRole('navigation',{name:'Guias do manual'});
 await expect(index.getByRole('button',{name:'Ponto por obra',exact:true})).toBeVisible();
 await expect(index.getByRole('button',{name:'DRE empresa',exact:true})).toHaveCount(0);
});

async function expectModule(page,label){
  if(page.viewportSize().width<1100)await expect(page.getByRole('combobox',{name:`Telas de ${label}`,exact:true})).toBeVisible();
  else await expect(page.locator('.app-breadcrumb')).toContainText(label);
}

test("identidade MARCELL carrega as fontes locais e a marca oficial no acesso",async({page})=>{
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,usuarios:[],precisaSetup:false}}));
  await page.route("https://fonts.googleapis.com/**",route=>route.abort());
  await page.goto("/");
  const signature=page.locator(".mrc-login-signature");
  await expect(signature).toBeVisible();
  await expect(signature).toHaveAttribute("src","/brand/marcell/full-ouro.svg");
  await expect(page.getByRole("button",{name:"Acessar central MARCELL"})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>[...document.fonts].filter(font=>font.family.includes("Inter")&&font.status==="loaded").length)).toBeGreaterThan(0);
  await expect(page.locator("#login-email")).toHaveCSS("font-family",/Inter/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  const brandTitle=page.getByText("Gestão de obras",{exact:true});
  const photo=page.locator(".mrc-access__photo");
  const {height}=page.viewportSize();
  await page.setViewportSize({width:900,height});
  await expect(brandTitle).toBeHidden();
  await page.setViewportSize({width:901,height});
  await expect(brandTitle).toBeVisible();
  await expect(photo).toHaveJSProperty("complete",true);
  expect(await photo.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  await page.setViewportSize({width:900,height});
  await expect(brandTitle).toBeHidden();
  await expect(page.locator("#login-email")).toBeVisible();
  await page.getByRole("button",{name:"Mostrar senha"}).click();
  await expect(page.locator("#login-senha")).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Ocultar senha"}).click();
  await expect(page.locator("#login-senha")).toHaveAttribute("type","password");
  await page.locator("#login-email").press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Informe e-mail e senha.");

  const pinTab=page.getByRole("tab",{name:"PIN de acesso"});
  await pinTab.click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("E-mail ou nome completo").fill("Operador QA");
  await page.getByRole("button",{name:"Continuar com PIN"}).click();
  const keypad=page.getByRole("group",{name:"Teclado do PIN"});
  for(const digit of [1,2,3,4]) await keypad.getByRole("button",{name:String(digit),exact:true}).click();
  await expect(page.getByRole("button",{name:"Confirmar acesso"})).toBeVisible();
  await keypad.getByRole("button",{name:"Apagar último dígito"}).click();
  await expect(page.getByRole("button",{name:"Confirmar acesso"})).toHaveCount(0);
  await page.getByRole("button",{name:"Alterar identificação"}).click();
  await expect(page.getByLabel("E-mail ou nome completo")).toHaveValue("Operador QA");
});

test("login oferece troca de senha e mantém o acesso somente por escolha",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(()=>localStorage.setItem("arcd-theme","plataforma"));
  const requests=[];
  await page.route("**/api/data",route=>{
    const request=route.request().postDataJSON();
    requests.push(request.action);
    if(request.action==="auth-change-password")return route.fulfill({json:{ok:true}});
    if(request.action==="auth-login")return route.fulfill({status:401,json:{error:request.rememberMe?"Opção recebida no teste.":"Opção ausente no teste."}});
    return route.fulfill({json:{precisaSetup:false}});
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme","plataforma");
  const remember=page.getByRole("checkbox",{name:"Manter conectado neste dispositivo"});
  await expect(remember).not.toBeChecked();
  const [email,password,submit,rememberLabel,rememberHint]=await Promise.all([
    page.locator("#login-email").boundingBox(),page.locator("#login-senha").boundingBox(),
    page.getByRole("button",{name:"Acessar central MARCELL"}).boundingBox(),
    page.locator("#login-remember-label").boundingBox(),page.locator("#login-remember-note").boundingBox(),
  ]);
  expect([password.x,submit.x].every(x=>Math.abs(x-email.x)<=1)).toBe(true);
  expect([password.width,submit.width].every(width=>Math.abs(width-email.width)<=1)).toBe(true);
  expect(Math.abs(rememberLabel.x-rememberHint.x)).toBeLessThanOrEqual(1);
  await page.screenshot({path:info.outputPath("login-plataforma.png")});
  await remember.check();
  const trigger=page.getByRole("button",{name:"Alterar senha"});
  await trigger.click();
  const dialog=page.getByRole("dialog",{name:"Alterar senha"});
  await expect(dialog).toBeVisible();
  const [title,firstField,footer]=await Promise.all([
    dialog.getByRole("heading").boundingBox(),dialog.getByLabel("E-mail corporativo").boundingBox(),
    dialog.locator(".mrc-dialog-actions").boundingBox(),
  ]);
  expect([title.x,footer.x].every(x=>Math.abs(x-firstField.x)<=1)).toBe(true);
  await page.screenshot({path:info.outputPath("alterar-senha-plataforma.png"),animations:"disabled"});
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("E-mail corporativo").fill("operador@arcd.test");
  await dialog.getByLabel("Senha atual",{exact:true}).fill("senha-atual-teste");
  await dialog.getByLabel("Nova senha",{exact:true}).fill("nova-senha-teste");
  const confirmation=dialog.getByLabel("Confirmar nova senha");
  await confirmation.fill("senha-diferente");
  const save=dialog.getByRole("button",{name:"Salvar nova senha"});
  await save.click();
  await expect(dialog.getByRole("alert")).toHaveText("A confirmação deve ser igual à nova senha.");
  expect(requests).not.toContain("auth-change-password");
  await confirmation.fill("nova-senha-teste");
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Senha alterada. Entre com a nova senha.");
  await expect(page.getByLabel("E-mail corporativo")).toHaveValue("operador@arcd.test");
  await page.getByLabel("Senha",{exact:true}).fill("nova-senha-teste");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await expect(page.getByRole("alert")).toHaveText("Opção recebida no teste.");
});

for(const theme of ["marcell","noite"])test(`tema MARCELL mantém leitura com ampliação · ${theme}`,async({page},testInfo)=>{
  await page.addInitScript(value=>localStorage.setItem("arcd-theme",value),theme==="marcell"?"architectural":theme);
  const app=await enter(page,"admin");
  await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Gestão financeira");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Gestão financeira"}).click();
  await selectWorkspaceArea(page,'Áreas do financeiro','Visão financeira');
  await expect(page.locator(".financial-summary")).toBeVisible();
  const title=page.getByRole('heading',{name:'Financeiro',exact:true,level:1});
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS("font-family",/Inter/);
  const normalSize=await tokenSize(title,"--arcd-type-page-title");
  await expect(page.locator(".arcd-main")).toHaveCSS("background-image","none");
  expect(await page.locator(".module-workflow").count()).toBe(0);
  await expect(page.getByRole("combobox",{name:"Ano",exact:true})).toBeVisible();
  await expect(page.getByRole("combobox",{name:"Mês",exact:true})).toBeVisible();
  for(const scale of ["100%","200%"]){
    await page.evaluate(value=>document.documentElement.style.fontSize=value,scale);
    await expect(title).toHaveCSS("font-size",await tokenSize(title,"--arcd-type-page-title"));
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,clipped:[...document.querySelectorAll(".financial-metric dd")].some(e=>e.scrollWidth>e.clientWidth+1)}));
    expect(layout).toEqual({overflow:false,clipped:false});
    await page.screenshot({path:testInfo.outputPath(`financeiro-${scale}.png`)});
  }
  expect(parseFloat(await tokenSize(title,"--arcd-type-page-title"))).toBeCloseTo(2*parseFloat(normalSize));
  await page.evaluate(()=>document.documentElement.style.fontSize="100%");
  await page.keyboard.press("Control+k");await search.fill("Folha");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Folha"}).first().click();
  const net=page.locator(".payroll-summary-strip__net");
  await expect(net.locator("strong")).toHaveCSS("color",await tokenValue(net,"--arcd-text-primary","color"));
  await expect(net.locator("small")).toHaveCSS("color",await tokenValue(net,"--arcd-text-secondary","color"));
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test("tipografia mantém hierarquia em páginas, campos e modais",async({page})=>{
  const app=await enter(page,"admin");
  const touch=page.viewportSize().width<768;
  const controlSize=touch?"--arcd-type-control-touch":"--arcd-type-control";
  async function open(label){
    await page.keyboard.press("Control+k");
    const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
    await search.fill(label);
    await search.locator("xpath=../..").getByRole("button").filter({hasText:label}).first().click();
    await expect(page.locator(".arcd-page-loading:visible")).toHaveCount(0);
  }
  await open("Compras");
  const purchaseTitle=page.getByRole('heading',{name:'Compras',exact:true});
  await expect(purchaseTitle).toHaveCSS("font-size",await tokenSize(purchaseTitle,"--arcd-type-page-title"));
  await expect(purchaseTitle).toHaveCSS("font-weight",await purchaseTitle.evaluate(title=>getComputedStyle(title).getPropertyValue("--arcd-heading-weight").trim()));
  await open("Fornecedores");
  const supplierFields=page.locator("main input:visible");
  await expect(supplierFields.first()).toBeVisible();
  for(const field of await supplierFields.all()){
    await expect(field).toHaveCSS("font-family",/Inter/);
    await expect(field).toHaveCSS("font-size",await tokenSize(field,controlSize));
  }
  await open("Obras");
  // Empty portfolio: this existing action emits a notice without saving a record.
  await page.locator('.works-files > summary').click();
  await page.getByRole("button",{name:"Preparar pastas",exact:true}).click();
  await expect(page.locator(".arcd-toast")).toContainText("Nenhuma obra disponível para preparar pastas.");
  await page.getByRole("button",{name:/Nova obra/}).first().click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogTitle=dialog.getByRole("heading",{name:"Nova obra",exact:true});
  await expect(dialogTitle).toHaveCSS("font-size",await tokenSize(dialogTitle,"--arcd-type-dialog-title"));
  const notice=dialog.locator(".arcd-modal-notice .arcd-toast");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS("position","static");
  // Compare both positions in the same frame while the dialog can be animating.
  const {noticeBottom,firstFieldTop}=await dialog.evaluate(node=>{
    const notice=node.querySelector(".arcd-modal-notice .arcd-toast");
    const firstField=node.querySelector("input");
    return {
      noticeBottom:notice.getBoundingClientRect().bottom,
      firstFieldTop:firstField.getBoundingClientRect().top,
    };
  });
  expect(noticeBottom).toBeLessThanOrEqual(firstFieldTop);

  for(const field of await dialog.locator('input:not([type="checkbox"]):not([type="radio"]):visible,select:visible,textarea:visible').all()){
    await expect(field).toHaveCSS("font-family",/Inter/);
    await expect(field).toHaveCSS("font-size",await tokenSize(field,controlSize));
  }
  await page.keyboard.press("Escape");
  await open("Folha");
  const payrollDetail=page.locator(".payroll-summary-strip__net small");
  await expect(payrollDetail).toHaveCSS("font-size",await tokenSize(payrollDetail,"--arcd-type-caption"));
  await expect(page.locator(".payroll-summary-strip__net strong")).toHaveCSS("font-family",/Inter/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await open("Ajustes");
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  const appearance=page.locator('main details:not([open]) > summary').getByText("Aparência",{exact:true});
  if(await appearance.isVisible())await appearance.click();
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
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,connected:true,items:[],bases:[]}}));
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
  await expectModule(page,"Visão gerencial");
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
      await dre.click();await expectModule(page,"Visão gerencial");
      await page.keyboard.press("Control+k");
    }
    await search.fill("Locação de equipamentos");
    const rentals=palette.getByRole("button").filter({hasText:"Locação de equipamentos"});
    await expect(rentals).toHaveCount(role==="financeiro"?1:0);
    if(role==="financeiro"){
      await rentals.click();await expectModule(page,"Equipamentos e locações");
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
  await expectModule(page,"Comercial");
  await page.keyboard.press("Control+k");await search.fill("DRE");
  await expect(palette.getByRole("button")).toHaveCount(0);await page.keyboard.press("Escape");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});

test("todos os módulos ficam acessíveis e locações sai do Financeiro",async({page},testInfo)=>{
  const app=await enter(page,"admin");
  const modules=["Visão gerencial","Financeiro","Obras e projetos","Compras e suprimentos","Equipamentos e locações","Pessoas e terceiros","Comercial","Administração"];
  if(page.viewportSize().width<1100){
    const navigation=page.locator(".mobile-primary-nav");
    await expect(navigation).toBeVisible();
    for(const label of modules){
      const direct=navigation.getByRole("button",{name:new RegExp(`^Abrir ${label}(?: · .+)?$`)});
      if(await direct.count())await direct.click();
      else{
        await page.getByRole("button",{name:"Abrir mais módulos",exact:true}).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        if(label==='Equipamentos e locações')await page.screenshot({path:testInfo.outputPath('mais-modulos.png')});
        await page.getByRole("dialog").getByRole("button",{name:label,exact:true}).click();
      }
      await expectModule(page,label);
      await expect(direct).toHaveAttribute("aria-current","page");
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
  await page.getByRole("button",{name:"Fechar chat da equipe",exact:true}).click();
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});


test("fluxos internos e atalho do DRE preservam competência e pagamentos",async({page})=>{
  const app=await enter(page,"admin");
  async function open(label){
    await page.keyboard.press("Control+k");const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");await search.fill(label);
    await search.locator("xpath=../..").getByRole("button").filter({hasText:label}).first().click();
  }
  await open("Compras");
  if(page.viewportSize().width<1100)await expect(page.getByRole('combobox',{name:'Fluxo de compras',exact:true}).getByRole('option',{name:/^Pagamentos/})).toHaveCount(1);
  else await expect(page.getByRole("navigation",{name:"Fluxo de compras"}).getByRole("button",{name:/^Pagamentos/})).toBeVisible();
  await page.getByRole("region",{name:"Integração com o DRE"}).locator("summary").click();
  await page.getByLabel("Competência do DRE").fill("2026-09");
  const requests=[];page.on("request",request=>{if(request.url().endsWith("/api/data")){const body=request.postDataJSON();if(body.action==="financial-dre-report")requests.push(body);}});
  const integration=page.getByRole("region",{name:"Integração com o DRE"});
  await integration.getByRole("button",{name:"Consultar valores no DRE",exact:true}).click();
  await expect(integration).toContainText("Não foi possível consultar o DRE");
  expect(requests.at(-1)).toMatchObject({year:2026,month:8,period:"mes",obraId:""});
  await integration.getByRole("button",{name:"Abrir DRE neste recorte",exact:true}).click();
  if(page.viewportSize().width<1100)await expect(page.getByRole('combobox',{name:'Telas de Visão gerencial',exact:true})).toHaveValue('dre');
  else await expect(page.locator(".app-breadcrumb")).toContainText("DRE obras");
  await expect.poll(()=>requests.filter(body=>body.year===2026&&body.month===8).length).toBeGreaterThan(1);
  await open("Folha");
  const scope=page.locator("summary").filter({hasText:/^Competência e escopo · /});
  if(page.viewportSize().width<1100){
    await scope.waitFor();
    if(!await scope.evaluate(summary=>summary.parentElement.open))await scope.click();
  }
  const controls=page.getByRole("region",{name:"Competência e escopo da folha"});await expect(controls).toBeVisible();
  const order=await page.locator(".payroll-workspace").evaluate(element=>{
    const filters=element.querySelector(".payroll-controls"),report=element.querySelector(".payroll-actionbar"),check=element.querySelector(".payroll-checklist");
    return Boolean(filters.compareDocumentPosition(check)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(check.compareDocumentPosition(report)&Node.DOCUMENT_POSITION_FOLLOWING);
  });expect(order).toBe(true);
  await expect(page.getByRole("region",{name:"Áreas da folha"}).locator("details")).not.toHaveAttribute("open");
  expect(app.errors).toEqual([]);expect(app.financialUnchanged()).toBe(true);
});
