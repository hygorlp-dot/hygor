import {expect,test} from "@playwright/test";
import {buildDreCashManagement} from "../src/domains/conciliacao/cash-allocations.js";
import {applyReconciliationCommand} from "../server/reconciliation-command.js";
const profile={id:"qa-dre",nome:"Financeiro QA",email:"dre@arcd.test",role:"admin",active:true};
async function enter(page,{failFirst=false}={}){
  let state={usuarios:[profile],obras:[{id:"work",name:"Obra QA",status:"active",contractType:"fixed_labor"}],employees:[],attendance:{},config:{paymentHolidays:[]},
    transacoes:[{id:"bank",valor:100,status:"pendente",descricao:"Crédito real do teste isolado",data:"2026-10-20"},{id:"mt7l9lt5xrta",valor:7160,status:"pendente",descricao:"Aporte a conferir",data:"2026-07-21"}],
    caixaObra:[{id:"fund",obraId:"work",tipo:"aporte",valor:150,data:"2026-10-20",descricao:"Aporte de teste isolado"}],
    outrasDesp:[{id:"paid",obraId:"work",pago:true,valor:20,data:"2026-10-20",dataPagamento:"2026-10-20"}],payments:[],notasFiscais:[],reconciliationLinks:[],pedidos:[],pagsTerceiros:[],medicoes:[],pagamentosFolha:[]};
  const protectedBefore=JSON.stringify([state.caixaObra,state.outrasDesp,state.payments,state.notasFiscais,state.pagamentosFolha]);
  let fail=failFirst;const commands=[];
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,bases:[],items:[]}}));
  await page.route("**/api/data",async route=>{
    const body=route.request().postDataJSON()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="financial-management-report")return route.fulfill({json:{ok:true,...buildDreCashManagement(state)}});
    if(body.action==="reconciliation-command"){
      commands.push(body.command);
      if(fail){fail=false;return route.fulfill({status:409,json:{ok:false,error:"Falha isolada de validação. Tente novamente."}});}
      const result=applyReconciliationCommand(state,body.command,profile);
      if(result.resumo.ok)state=result.data;
      return route.fulfill({json:{ok:result.resumo.ok,data:state,updatedAt:new Date().toISOString(),error:result.resumo.motivo}});
    }
    if(["financial-dre-report","financial-company-dre-report"].includes(body.action))return route.fulfill({json:{ok:true,current:null,history:[]}});
    return route.fulfill({json:{ok:true,accessToken:"isolated-access",refreshToken:"isolated-refresh",usuario:profile,data:state,updatedAt:"2026-10-23T12:00:00Z"}});
  });
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  if(page.viewportSize().width<1100){
    await page.getByRole("button",{name:"Abrir Visão gerencial",exact:true}).click();
    await page.locator(".mobile-subnav").getByRole("button",{name:"DRE obras",exact:true}).click();
  }else{
    const sidebar=page.locator(".arcd-sidebar"),group=sidebar.locator(".nav-grp-hd").filter({hasText:/^Visão gerencial/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    await expect(group).toBeVisible();
    if(!await body.isVisible())await group.click();
    await body.locator(".nav-item").filter({hasText:/^DRE obras$/}).click();
  }
  await page.getByRole("button",{name:/Conciliação integrada ao DRE/}).click();
  await expect(page.getByText("Pendente de composição",{exact:false})).toBeVisible();
  return {commands,errors,state:()=>state,protectedBefore};
}
test("associação parcial, falha, retentativa e desfazer preservam pagamentos",async({page},testInfo)=>{
  const app=await enter(page,{failFirst:true});
  await page.getByLabel("1. Movimento bancário").selectOption("bank");
  await page.getByLabel("2. Registro existente no DRE").selectOption("caixa_obra:fund:cash_in");
  await page.getByLabel("3. Valor a vincular (R$)").fill("60");
  await page.getByRole("button",{name:"Confirmar vínculo",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Falha isolada");
  await page.getByRole("button",{name:"Confirmar vínculo",exact:true}).click();
  await expect(page.getByText("Salvo. Pagamentos e valores do DRE preservados.",{exact:true})).toBeVisible();
  expect(app.commands[0].idempotencyKey).toBe(app.commands[1].idempotencyKey);
  expect(app.state().transacoes.find(item=>item.id==="bank")).toMatchObject({status:"parcial",saldoNaoVinculado:40});
  expect(app.state().transacoes.find(item=>item.id==="mt7l9lt5xrta").status).toBe("pendente");
  const noOverflow=await page.locator(".dre-reconciliation").evaluate(element=>element.scrollWidth<=element.clientWidth+1);
  expect(noOverflow).toBe(true);
  await page.locator(".dre-reconciliation").screenshot({path:`C:/tmp/${testInfo.project.name}.png`});
  await page.getByRole("button",{name:"Desfazer vínculo",exact:true}).click();
  await page.getByLabel("Motivo para desfazer").fill("Composição não confirmada");
  await page.getByRole("button",{name:"Confirmar remoção do vínculo"}).click();
  await expect(page.getByRole("button",{name:"Desfazer vínculo",exact:true})).toHaveCount(0);
  expect(app.state().transacoes.find(item=>item.id==="bank").status).toBe("pendente");
  const state=app.state();
  expect(JSON.stringify([state.caixaObra,state.outrasDesp,state.payments,state.notasFiscais,state.pagamentosFolha])).toBe(app.protectedBefore);
  expect(app.errors).toEqual([]);
});
