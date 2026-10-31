import {expect,test} from "@playwright/test";
import {readFile} from "node:fs/promises";
for(const mode of ["conciliacao","compras"])test(`piloto de ${mode} confere sem gravar lançamentos, mede e exporta a amostra`,async({page})=>{
 const profile={id:"pilot-admin",nome:"Piloto QA",email:"pilot@local.test",role:"admin",active:true};
 const state={usuarios:[profile],config:{paymentHolidays:[]},obras:[{id:"o",name:"Obra do piloto",status:"active"}],transacoes:[{id:"t",descricao:"PIX para conferência",status:"pendente",data:"2026-10-20",valor:50}],pedidos:[{id:"p",numero:"PC-PILOTO",obraId:"o",status:"enviado",data:"2026-10-20",itens:[]}],fornecedores:[],employees:[],attendance:{},notasFiscais:[],cotacoes:[],solicitacoesCompra:[]};
 const writes=[],errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/api/**",route=>route.fulfill({json:{ok:true,presencas:[],items:[],bases:[]}}));
 await page.route("**/api/data",route=>{const body=route.request().postDataJSON()||{};if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});if(["reconciliation-command","operational-command","save"].includes(body.action))writes.push(body);return route.fulfill({json:{ok:true,usuario:profile,data:state,accessToken:"qa",refreshToken:"qa",updatedAt:"2026-10-31T12:00:00Z"}});});
 await page.goto("/",{waitUntil:"domcontentloaded"});await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("isolated");await page.getByRole("button",{name:/Acessar central/}).click();
 const sidebar=page.locator(".arcd-sidebar");await sidebar.locator(".nav-grp-hd").filter({hasText:mode==="compras"?/^Compras/:/^Financeiro/}).click();await sidebar.locator(".nav-item").filter({hasText:mode==="compras"?/^Compras$/:/^Conciliação$/}).click();
 if(mode==="compras"){await page.getByRole("button",{name:"Mais ações de Compras",exact:true}).click();await page.getByRole("menuitem",{name:"Piloto de conferência",exact:true}).click();}else await page.getByRole("button",{name:"Abrir piloto de conferência",exact:true}).click();
 const pilot=page.getByRole("region",{name:mode==="compras"?"Piloto de Compras":"Piloto de Conciliação",exact:true});await expect(pilot).toBeVisible();
 if(mode!=="compras")await expect(pilot).toContainText("Sem amostra conferida");
 await pilot.getByRole("button",{name:"Conferir caso",exact:true}).first().click();await pilot.getByLabel("Ajuste necessário",{exact:true}).check();await pilot.getByRole("button",{name:"Registrar avaliação do piloto",exact:true}).click();await expect(pilot.getByRole("alert")).toContainText("motivo");
 await pilot.getByLabel("Motivo ou observação",{exact:true}).fill("Conferir documento original antes de confirmar.");await pilot.getByRole("button",{name:"Registrar avaliação do piloto",exact:true}).click();await expect(pilot).toContainText("Avaliação registrada nesta sessão");
 const downloaded=page.waitForEvent("download");await pilot.getByRole("button",{name:"Exportar indicadores do piloto",exact:true}).click();const file=await downloaded;const report=JSON.parse(await readFile(await file.path(),"utf8"));expect(report).toMatchObject({mode,financialWrites:0,metrics:{reviewed:1,corrections:1}});expect(JSON.stringify(report)).not.toContain(profile.email);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`artifacts/pilot-${mode}-mobile.png`,fullPage:true});
 await pilot.getByRole("button",{name:"Voltar ao módulo",exact:true}).click();expect(writes).toEqual([]);expect(errors).toEqual([]);
});
