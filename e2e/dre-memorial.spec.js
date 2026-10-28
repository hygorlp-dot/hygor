import {test,expect} from "@playwright/test";
import {buildRequestedDreProjectionRows} from "../server/dre-projection.js";
import {defaultAnnualLayout} from "../src/domains/dre/annual-statement.js";

test("abre o memorial, documento e obra pelo valor do DRE",async({page},testInfo)=>{
  const user={id:"qa",nome:"Financeiro QA",email:"memorial@arcd.test",role:"admin",active:true};
  const data={usuarios:[user],config:{paymentHolidays:[]},obras:[{id:"o1",name:"Obra Memorial QA",status:"active"}],employees:[],attendance:{},
    medicoes:[{id:"m1",obraId:"o1",competencia:"2026-01",dataEmissao:"2026-01-12",valorPrevisto:142130,descricao:"Medição de janeiro",documentos:[{nome:"Nota fiscal 123",url:"https://example.com/nota-123.pdf"}],observacao:"Referência isolada para teste"}]};
  const months=buildRequestedDreProjectionRows(data,Array.from({length:12},(_,month)=>({year:2026,month,scope:"company_dre"}))).map(row=>row.payload);
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],bases:[]}}));
  await page.route("**/api/data",route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
    if(body.action==="financial-annual-dre-report")return route.fulfill({json:{ok:true,year:2026,months,layout:defaultAnnualLayout(),issues:[]}});
    if(["financial-dre-report","financial-company-dre-report"].includes(body.action))return route.fulfill({json:{ok:true,current:null,history:[]}});
    return route.fulfill({json:{ok:true,accessToken:"isolated-access",refreshToken:"isolated-refresh",usuario:user,data,updatedAt:"2026-10-28T12:00:00Z"}});
  });
  await page.goto("/");
  await page.locator("#login-email").fill(user.email);await page.locator("#login-senha").fill("isolated-password");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  if(page.viewportSize().width<1100){
    await page.getByRole("button",{name:"Abrir Visão gerencial",exact:true}).click();
    await page.locator(".mobile-subnav").getByRole("button",{name:"DRE empresa",exact:true}).click();
  }else{
    const group=page.locator(".arcd-sidebar .nav-grp-hd").filter({hasText:/^Visão gerencial/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    await expect(group).toBeVisible();
    if(await group.getAttribute("data-open")!=="true")await group.click();
    await body.locator(".nav-item").filter({hasText:/^DRE empresa$/}).click();
  }
  await page.getByRole("button",{name:"DRE anual ajustável",exact:true}).click();
  await page.getByRole("button",{name:/Receitas de obras, Jan:/}).click();
  const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
  await dialog.locator("summary").filter({hasText:"Medição de janeiro"}).click();
  await expect(dialog.getByText("12/01/2026",{exact:true}).first()).toBeVisible();
  await expect(dialog.locator('a[href="https://example.com/nota-123.pdf"]').first()).toBeVisible();
  await expect(dialog.getByText("Referência isolada para teste")).toBeVisible();
  const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({path:testInfo.outputPath("memorial.png"),fullPage:true});
  await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();
  await page.getByRole("button",{name:/Receitas de obras, Jan:/}).click();
  await dialog.locator("summary").filter({hasText:"Medição de janeiro"}).click();
  await dialog.getByRole("button",{name:"Abrir obra"}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Obra Memorial QA",{exact:true}).first()).toBeVisible();
});
