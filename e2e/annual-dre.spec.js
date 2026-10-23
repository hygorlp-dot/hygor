import {expect,test} from "@playwright/test";
import {defaultAnnualLayout,saveAnnualLayout} from "../src/domains/dre/annual-statement.js";
const profile={id:"annual-qa",nome:"Financeiro QA",role:"financeiro",email:"annual@arcd.test",active:true};
test("DRE anual ajustável preserva fontes, salva estrutura, exporta e abre detalhamento",async({page},testInfo)=>{
  let data={usuarios:[profile],obras:[],employees:[],attendance:{},config:{dreAnnualLayout:defaultAnnualLayout()}};
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  let failFirst=true,saves=0;
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],bases:[]}}));
  await page.route("**/api/data",route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="financial-annual-dre-report")return route.fulfill({json:{ok:true,year:body.year,layout:data.config.dreAnnualLayout,months:Array.from({length:12},(_,i)=>({receitaLocacoes:i===0?1000:0,faturamentoTotal:i===0?1000:0,totalCSP:0,totalDespOp:0,lucroLiquido:i===0?1000:0})),issues:[]}});
    if(body.action==="financial-annual-dre-layout"){
      saves+=1;if(failFirst){failFirst=false;return route.fulfill({status:503,json:{error:"Falha temporária. Tente salvar novamente."}});}
      const saved=saveAnnualLayout(data,body.rows,body.expectedVersion,profile);data=saved.data;
      return route.fulfill({json:{ok:true,layout:saved.layout}});
    }
    if(body.action==="financial-company-dre-report")return route.fulfill({json:{ok:true,current:null,history:[]}});
    return route.fulfill({json:{ok:true,accessToken:"isolated-access",refreshToken:"isolated-refresh",usuario:profile,data,updatedAt:"2026-10-23T12:00:00Z"}});
  });
  await page.goto("/");await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("isolated-password");await page.getByRole("button",{name:"Acessar central ARCD"}).click();
  if(page.viewportSize().width<1100){
    await page.getByRole("button",{name:"Abrir Visão gerencial",exact:true}).click();await page.locator(".mobile-subnav").getByRole("button",{name:"DRE empresa",exact:true}).click();
  }else{
    const group=page.locator(".arcd-sidebar .nav-grp-hd").filter({hasText:/^Visão gerencial/}),body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    await expect(group).toBeVisible();
    if(!await body.isVisible())await group.click();await body.locator(".nav-item").filter({hasText:/^DRE empresa$/}).click();
  }
  await page.getByRole("button",{name:"DRE anual ajustável",exact:true}).click();
  await expect(page.getByRole("heading",{name:"DRE mês a mês"})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:"Dez",exact:true})).toHaveCount(1);
  await page.getByRole("button",{name:"Receitas das locações, Jan: R$ 1.000,00"}).click();
  await expect(page.getByRole("dialog")).toContainText("Fontes do DRE da empresa");await page.getByRole("button",{name:"Fechar",exact:true}).click();
  await page.getByRole("button",{name:"Ajustar linhas",exact:true}).click();
  await page.getByRole("navigation",{name:"Linhas do DRE"}).getByRole("button",{name:"Receitas das locações",exact:true}).click();
  await page.getByLabel("Nome da linha").fill("Receitas de equipamentos");
  await page.getByRole("button",{name:"+ Adicionar linha neste grupo"}).click();await page.getByLabel("Nome da linha").fill("Locações profissionais");
  await page.getByLabel("Receitas das locaçõesTransferir de: Receitas de equipamentos").check();
  await page.getByRole("button",{name:"Subir linha",exact:true}).click();
  await page.getByRole("button",{name:"Salvar estrutura",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Falha temporária");
  await page.getByRole("button",{name:"Salvar estrutura",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(saves).toBe(2);expect(data.config.dreAnnualLayout.version).toBe(1);
  await expect(page.getByRole("rowheader",{name:"Locações profissionais",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Atualizar",exact:true}).click();await expect(page.getByRole("rowheader",{name:"Locações profissionais",exact:true})).toBeVisible();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Exportar CSV"}).click();expect((await download).suggestedFilename()).toMatch(/^DRE-\d{4}\.csv$/);
  expect(await page.locator(".annual-dre").evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await page.locator(".annual-dre").screenshot({path:`C:/tmp/annual-${testInfo.project.name}.png`});expect(errors).toEqual([]);
});
