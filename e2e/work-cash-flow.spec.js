import {expect,test} from "@playwright/test";
import {openFinanceModule} from "../scripts/finance-browser-navigation.mjs";
import {applyReconciliationCommand} from "../server/reconciliation-command.js";
import {authorizeReconciliationCommand} from "../server/reconciliation-policy.js";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";
import {buildFinancialLedger,selectDRE} from "../src/domains/financeiro/ledger.js";

const user={id:"cash-qa",nome:"Financeiro QA",email:"caixa@local.test",role:"financeiro",active:true};
const now="2026-11-19T15:00:00Z";
test.setTimeout(90000);

for(const [width,theme] of [[390,"marcell"],[390,"noite"],[1440,"marcell"],[1440,"noite"]]){
  test(`Banco → Caixa da obra → DRE · ${width} · ${theme}`,async({browser,baseURL},info)=>{
    let data={
      usuarios:[user],config:{},obras:[{id:"work",name:"Obra QA",status:"active",hasCaixa:true}],
      contasBancarias:[{id:"account",nome:"Banco QA",ativa:true}],
      transacoes:[{id:"funding",status:"pendente",contaBancariaId:"account",data:"2026-11-17",descricao:"Envio para o caixa QA",valor:-1000}],
    };
    const errors=[],writes=[];
    const context=await browser.newContext({baseURL,viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();
    await page.clock.setFixedTime(new Date(now));
    await page.addInitScript(theme=>localStorage.setItem("arcd-theme",theme),theme);
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("https://**/*",route=>route.abort());
    await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
    await page.route("**/api/data",route=>{
      const {action,command}=route.request().postDataJSON()||{};
      if(action==="reconciliation-command"){
        const authorization=authorizeReconciliationCommand(data,command,user);
        if(!authorization.ok)return route.fulfill({status:403,json:{error:authorization.error}});
        const result=applyReconciliationCommand(data,command,user);
        if(result.resumo.ok){data=result.data;writes.push(command.type);}
        return route.fulfill({status:result.resumo.ok?200:409,json:{ok:result.resumo.ok,data,resumo:result.resumo,error:result.resumo.motivo,updatedAt:now}});
      }
      if(action==="operational-command"){
        const result=applyOperationalCommand(data,{...command,actorId:user.id,actorName:user.nome,actorRole:user.role},now);
        if(result.ok){data=result.data;writes.push(command.type);}
        return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:now}});
      }
      if(["save","save-sections","financial-command"].includes(action)){
        writes.push(action);
        return route.fulfill({status:403,json:{ok:false}});
      }
      if(action==="financial-dre-report")return route.fulfill({json:{ok:true,current:null,history:[]}});
      return route.fulfill({json:{ok:true,data,usuario:user,usuarios:[user],accessToken:"qa-local",refreshToken:"qa-local",updatedAt:now}});
    });
    await page.goto("/",{waitUntil:"domcontentloaded"});
    await page.locator("#login-email").fill(user.email);
    await page.locator("#login-senha").fill("isolado");
    await page.getByRole("button",{name:"Acessar central MARCELL",exact:true}).click();
    await openFinanceModule(page,"Conciliação");
    const bankRow=page.getByRole("row").filter({hasText:"Envio para o caixa QA"});
    await bankRow.getByRole("button",{name:/Mostrar outras ações/}).click();
    await bankRow.getByRole("button",{name:"Transferência",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByText("Transferir para o caixa da obra",{exact:true}).click();
    await dialog.getByRole("combobox",{name:"Caixa da obra",exact:true}).selectOption("work");
    await dialog.getByRole("button",{name:"Vincular ao caixa",exact:true}).click();
    await expect(dialog).toBeHidden();
    const statuses=page.getByRole("combobox").filter({has:page.getByRole("option",{name:/Conciliados · 1/})});
    if(await statuses.isVisible())await statuses.selectOption({label:"Conciliados · 1"});
    else await page.getByRole("button",{name:/Conciliados · 1/}).click();
    await bankRow.getByRole("button",{name:"Ver no Caixa da obra"}).click();
    const heading=page.getByRole("heading",{name:"Caixa da obra",exact:true});
    await expect(heading).toBeVisible();
    await expect(page.getByRole("button",{name:"Voltar a Conciliação",exact:true})).toHaveCount(1);
    const funding=page.getByRole("article").filter({hasText:"Envio para o caixa QA"});
    await expect(funding).toContainText("Transferência da empresa");
    await expect(funding.getByRole("button",{name:"Ver na Conciliação"})).toBeVisible();
    await page.getByRole("button",{name:"Registrar despesa",exact:true}).click();
    await dialog.getByLabel("Descrição").fill("Cimento para a obra QA");
    await dialog.getByLabel(/Valor \(R\$\)/).fill("250");
    await dialog.getByLabel("Referência da nota ou comprovante").fill("NF QA-1");
    await expect(dialog.getByText(/Saldo após o lançamento/)).toContainText("750,00");
    await dialog.getByRole("button",{name:"Confirmar lançamento"}).click();
    await expect(dialog).toBeHidden();
    const expense=page.getByRole("article").filter({hasText:"Cimento para a obra QA"});
    await expense.getByText("Origem, comprovante e DRE",{exact:true}).click();
    await expect(expense).toContainText("NF QA-1");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:info.outputPath("caixa-da-obra.png"),animations:"disabled"});
    const dre=selectDRE(buildFinancialLedger(data),{obraId:"work",competence:"2026-11"});
    expect(dre).toMatchObject({revenueCents:0,costCents:25000});
    expect(dre.events).toHaveLength(1);
    await expense.getByRole("button",{name:"Ver DRE por obra"}).click();
    await expect(page.getByRole("heading",{name:"DRE por Obra",exact:true})).toBeVisible();
    await expect(page.getByText(/Obra Obra QA · Novembro 2026/)).toBeVisible();
    await expect(page.getByRole("button",{name:/Total de custos.*250,00/})).toBeVisible();
    expect(writes).toEqual(["CONFIRM_TRANSFER","MOVIMENTO_CAIXA_OBRA_CRIADO"]);
    expect(errors).toEqual([]);
    await context.close();
  });
}
