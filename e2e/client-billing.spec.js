import { expect, test } from "@playwright/test";
import { openFinanceModule } from "../scripts/finance-browser-navigation.mjs";
import { registrarPagamentoEConciliar } from "../src/domains/conciliacao/mutations.js";
import { applyOperationalCommand, OPERATIONAL_COMMAND as CMD } from "../src/domains/sync/operational-commands.js";
import { buildFinancialLedger, selectAccountsReceivable, selectDRE } from "../src/domains/financeiro/ledger.js";
import { validateOperationalCommandScope } from "../server/operational-command-policy.js";

const user={id:"finance",nome:"Financeiro QA",email:"financeiro@local.test",role:"financeiro",active:true};
const now="2026-11-19T15:00:00Z";
test.setTimeout(90000);

for(const [width,theme] of [[390,"marcell"],[390,"noite"],[1440,"marcell"],[1440,"noite"]]){
  test(`Medições a faturar · ${width} · ${theme}`,async({browser,baseURL},info)=>{
    let data={
      usuarios:[user],config:{},obras:[{id:"work",name:"Obra QA",status:"active",billingType:"livre",contractValue:10000}],
      comercial:{contratos:[{id:"contract",numero:"CTR-QA",obraId:"work",valor:10000,status:"assinado"}]},
      medicoesObra:[
        {id:"technical",obraId:"work",numero:"BM-QA",status:"aprovada",data:"2026-11-10",avancoFisico:10},
        {id:"pending",obraId:"work",numero:"BM-PENDENTE",status:"confirmada",data:"2026-11-18",avancoFisico:20},
      ],
      contasBancarias:[{id:"account",nome:"Banco QA",ativa:true}],
      transacoes:[{id:"linked",contaBancariaId:"account",data:"2026-11-18",descricao:"PIX da parcela QA",status:"pendente",valor:100}],
    };
    const command=(type,payload)=>applyOperationalCommand(data,{type,payload,actorId:user.id,actorName:user.nome,actorRole:user.role,idempotencyKey:type+JSON.stringify(payload)},now);
    data=command(CMD.CLIENT_MEASUREMENT_BILLED,{medicaoTecnicaId:"technical",dataVencimento:"2026-11-18"}).data;
    const writes=[],errors=[],operations=[];
    const context=await browser.newContext({baseURL,viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();
    await page.clock.setFixedTime(new Date(now));
    await page.addInitScript(theme=>localStorage.setItem("arcd-theme",theme),theme);
    page.on("pageerror",error=>errors.push(error.message));
    await page.route("https://**/*",route=>route.abort());
    await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],bases:[],presencas:[]}}));
    await page.route("**/api/data",route=>{
      const {action,command:input}=route.request().postDataJSON()||{};
      if(action==="operational-command"){
        operations.push(input.type);
        const scope=validateOperationalCommandScope({user,data,command:input});
        if(!scope.ok)return route.fulfill({status:403,json:{error:scope.error}});
        const result=applyOperationalCommand(data,{...input,actorId:user.id,actorName:user.nome,actorRole:user.role},now);
        if(result.ok)data=result.data;
        return route.fulfill({status:result.ok?200:409,json:{...result,updatedAt:now}});
      }
      if(["save","save-sections","financial-command","reconciliation-command"].includes(action)){
        writes.push(action);
        return route.fulfill({status:403,json:{ok:false}});
      }
      return route.fulfill({json:{ok:true,data,usuario:user,usuarios:[user],accessToken:"qa-local",refreshToken:"qa-local",updatedAt:now}});
    });
    await page.goto("/",{waitUntil:"domcontentloaded"});
    await page.locator("#login-email").fill(user.email);
    await page.locator("#login-senha").fill("isolado");
    await page.getByRole("button",{name:"Acessar central MARCELL",exact:true}).click();
    await openFinanceModule(page,"Medições a faturar");
    await expect(page.getByRole("heading",{name:"Medições a faturar",exact:true})).toBeVisible();
    const scrollWidth=()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(await scrollWidth()).toBeLessThanOrEqual(1);
    await page.getByText(/boletim aprovado sem faturamento/).click();
    await expect(page.getByRole("listitem").filter({hasText:"18/11/2026"})).toBeVisible();
    await expect(page.getByText("Vencida há 1 dia",{exact:true})).toBeVisible();
    await page.getByText("Origem, documento e recebimentos",{exact:true}).click();
    await expect(page.getByText(/CTR-QA/)).toBeVisible();
    await page.getByRole("button",{name:"Editar dados da cobrança",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByLabel("Referência do documento emitido").fill("NFS-e QA 06");
    await dialog.getByLabel("Data de emissão do documento").fill("2026-11-12");
    await dialog.getByLabel("Retenção informada (R$)",{exact:true}).fill("100");
    await dialog.getByRole("button",{name:"Salvar dados da cobrança"}).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/NFS-e QA 06/)).toBeVisible();
    await page.getByRole("button",{name:"Registrar recebimento",exact:true}).filter({visible:true}).click();
    await dialog.getByLabel("Valor recebido (R$)",{exact:false}).fill("900");
    await expect(dialog.getByText(/Saldo após a baixa/)).toContainText("100,00");
    await page.screenshot({path:info.outputPath("recebimento.png"),animations:"disabled"});
    await dialog.getByRole("button",{name:"Confirmar recebimento"}).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/Recebimento parcial/)).toContainText("100,00");
    await page.getByRole("button",{name:"Estornar recebimentos",exact:true}).click();
    await dialog.getByLabel("Motivo do estorno").fill("Correção de teste");
    await dialog.getByRole("button",{name:"Confirmar estorno"}).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/Estornado.*Correção de teste/)).toBeVisible();
    const ledger=buildFinancialLedger(data);
    expect(selectAccountsReceivable(ledger).balanceCents).toBe(100000);
    expect(selectDRE(ledger,{obraId:"work",competence:"2026-11"}).revenueCents).toBe(100000);
    const linked=registrarPagamentoEConciliar(data,{tipo:"medicao",entidadeId:data.medicoes[0].id,transacaoId:"linked",operador:user});
    expect(linked.resumo.ok).toBe(true);
    data=linked.data;
    const afterBank=buildFinancialLedger(data);
    expect(selectAccountsReceivable(afterBank).balanceCents).toBe(90000);
    expect(selectDRE(afterBank,{obraId:"work",competence:"2026-11"}).revenueCents).toBe(100000);
    await page.reload({waitUntil:"domcontentloaded"});
    const heading=page.getByRole("heading",{name:"Medições a faturar",exact:true});
    await expect(heading).toBeVisible({timeout:15000});
    await page.getByText("Origem, documento e recebimentos",{exact:true}).click();
    await page.getByRole("button",{name:"Ver na Conciliação",exact:true}).click();
    await expect(page.getByText(/PIX da parcela QA/).first()).toBeVisible();
    expect(await scrollWidth()).toBeLessThanOrEqual(1);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(operations).toEqual([CMD.CLIENT_MEASUREMENT_SAVED,CMD.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,CMD.CLIENT_MEASUREMENT_RECEIPTS_CHANGED]);
    await context.close();
  });
}
