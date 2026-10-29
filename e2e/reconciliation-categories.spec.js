import { expect, test } from "@playwright/test";
import { applyReconciliationCommand } from "../server/reconciliation-command.js";
import { buildFinancialLedger, selectDRE } from "../src/domains/financeiro/ledger.js";

const profile = { id:"reconciliation-qa", nome:"Financeiro QA", email:"reconciliation@arcd.test", role:"admin", active:true };
const transaction = (id, valor, descricao) => ({ id, valor, descricao, data:"2026-10-20", status:"pendente" });

async function openReconciliation(page) {
  if (await page.locator(".reconciliation-workspace").isVisible()) return;
  if (page.viewportSize().width < 1100) {
    await page.getByRole("button", { name:"Abrir Financeiro", exact:true }).click();
    await page.locator(".mobile-subnav").getByRole("button", { name:"Conciliação", exact:true }).click();
  } else {
    const group=page.locator(".arcd-sidebar .nav-grp-hd").filter({hasText:/^Financeiro/});
    const body=group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    await expect(group).toBeVisible();
    if (!await body.isVisible()) await group.click();
    await body.locator(".nav-item").filter({hasText:/^Conciliação$/}).click();
  }
  await expect(page.locator(".reconciliation-workspace")).toBeVisible();
}

async function enter(page, { payroll = false } = {}) {
  let state = {
    usuarios:[profile], obras:[{ id:"work", name:"Obra Oásis QA", status:"active", contractType:"fixed_labor" }],
    employees:[], attendance:{}, config:{ paymentHolidays:[] },
    categoriasDesp:[{ v:"ensaios_obra", l:"Ensaios tecnológicos" }],
    transacoes:payroll ? [{ ...transaction("salary",-600,"PIX ANA SOUZA ana@example.test"), chavePix:"ana@example.test", contraparteNome:"Ana Souza" }]
      : [transaction("income",1230,"Crédito por serviço novo"), transaction("expense",-275,"Taxa de ensaio estrutural")],
    titulosFolha:[], pagamentosFolha:[], caixaObra:[], outrasDesp:[], despesasEmpresa:[], payments:[],
    notasFiscais:[], pedidos:[], medicoes:[], medicoesTerc:[], terceirizados:[], pagsTerceiros:[],
    fornecedores:[], reconciliationLinks:[], historicoConc:[], regrasConc:[], extratos:[],
  };
  if (payroll) {
    state.employees=[{ id:"employee", name:"Ana Souza", pixKey:"ana@example.test", obra:"work", active:true, dailyRate:100 }];
    state.titulosFolha=[{ id:"payroll", employeeId:"employee", competencia:"2026-10", periodoInicio:"2026-10-01", periodoFim:"2026-10-15", vencimento:"2026-10-20", bruto:600, liquido:600, valorPago:600, saldo:0, status:"pago", rateiosPorObra:[{obraId:"work",valor:600}], liquidacoes:[{id:"settlement",valor:600,data:"2026-10-20"}] }];
  }
  const commands=[], errors=[];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => route.fulfill({ json:{ok:true,bases:[],items:[]} }));
  await page.route("**/api/data", async route => {
    const body=route.request().postDataJSON()||{};
    if (body.action==="profiles") return route.fulfill({ json:{usuarios:[profile],precisaSetup:false} });
    if (body.action==="reconciliation-command") {
      commands.push(body.command);
      const result=applyReconciliationCommand(state,body.command,profile);
      if (result.resumo.ok) state=result.data;
      return route.fulfill({ status:result.resumo.ok?200:409, json:{ok:result.resumo.ok,data:state,updatedAt:new Date().toISOString(),error:result.resumo.motivo} });
    }
    if (body.action==="save-sections") state={...state,...body.sections};
    if (body.action==="save") state=body.payload||state;
    if (["financial-dre-report","financial-company-dre-report"].includes(body.action)) return route.fulfill({json:{ok:true,current:null,history:[]}});
    return route.fulfill({ json:{ok:true,accessToken:"isolated-access",refreshToken:"isolated-refresh",usuario:profile,data:state,updatedAt:"2026-10-28T12:00:00Z"} });
  });
  await page.goto("/");
  await page.locator("#login-email").fill(profile.email);
  await page.locator("#login-senha").fill("isolated-password");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await openReconciliation(page);
  return {state:()=>state,commands,errors};
}

test("menu de categorias tem superfície opaca e seleção acessível no tema real", async ({page}, testInfo) => {
  const app=await enter(page);
  await page.locator(".reconciliation-row").filter({hasText:"Taxa de ensaio estrutural"}).getByRole("button",{name:"Classificar saída",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Vai para",exact:true}).selectOption("empresa");
  const category=dialog.getByRole("combobox",{name:/Categoria de saída/});
  await category.fill("ocupacao");
  const popup=dialog.locator(".reconciliation-category__popup");
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("option",{name:/Limpeza e conservação/})).toBeVisible();
  // O tema legado também está carregado: uma cor inválida deixa o fundo
  // transparente mesmo quando o CSS declara um fallback.
  const surface=await popup.evaluate(element=>{
    const style=getComputedStyle(element);
    const context=document.createElement("canvas").getContext("2d");
    context.fillStyle=style.backgroundColor;
    context.fillRect(0,0,1,1);
    return {alpha:context.getImageData(0,0,1,1).data[3],opacity:Number(style.opacity)};
  });
  expect(surface).toEqual({alpha:255,opacity:1});
  await expect(popup).toBeInViewport({ratio:0.99});
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath("category-popup-opaque.png")});
  await category.press("ArrowDown");
  await category.press("Enter");
  await expect(popup).toHaveCount(0);
  await expect(category).not.toHaveValue("");
  await category.fill("categoria inexistente");
  await expect(dialog.getByRole("status")).toContainText("Nenhuma categoria encontrada");
  await category.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(category).toBeFocused();
  expect(app.commands).toEqual([]);
  expect(app.errors).toEqual([]);
});

test("categoria de entrada preserva competência distinta e classificação após recarregar", async ({page}, testInfo) => {
  const app=await enter(page);
  const row=page.locator(".reconciliation-row").filter({hasText:"Crédito por serviço novo"});
  await row.getByRole("button",{name:"Validar entrada",exact:true}).click();
  await page.getByRole("button",{name:"Classificar por categoria / ratear entrada"}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Vai para",exact:true}).selectOption("empresa");
  const category=dialog.getByRole("combobox",{name:/Categoria de entrada/});
  await category.fill("servicos");
  await expect(dialog.getByRole("option",{name:/Salários administrativos/})).toHaveCount(0);
  await dialog.getByRole("option",{name:/Receita de serviços/}).click();
  await dialog.getByLabel("Competência do novo lançamento").fill("2026-09");
  await expect(dialog.getByText("Nova receita no DRE por competência",{exact:true})).toBeVisible();
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath("income-category.png")});
  await dialog.getByRole("button",{name:"Confirmar conciliação",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(app.commands.at(-1)).toMatchObject({type:"CONFIRM_ALLOCATION",payload:{competence:"2026-09"}});
  expect(app.state().payments).toEqual(expect.arrayContaining([expect.objectContaining({categoria:"receita_servicos",competencia:"2026-09",date:"2026-10-20",amount:1230})]));
  expect(buildFinancialLedger(app.state()).events).toEqual(expect.arrayContaining([expect.objectContaining({effect:"revenue",category:"receita_servicos",competence:"2026-09",amountCents:123000})]));
  await page.reload(); await openReconciliation(page);
  await page.getByRole("button",{name:/^Conciliados/}).click();
  const filter=page.getByRole("combobox",{name:"Filtrar categoria",exact:true});
  await filter.fill("servicos"); await page.getByRole("option",{name:/Receita de serviços/}).click();
  await expect(page.locator(".reconciliation-row")).toHaveCount(1);
  await page.locator(".reconciliation-row summary").click();
  await expect(page.locator(".reconciliation-row")).toContainText("Receita de serviços");
  expect(app.errors).toEqual([]);
});

test("categoria personalizada de saída é pesquisável e incompatibilidade de destino exige nova escolha", async ({page}, testInfo) => {
  const app=await enter(page);
  await page.locator(".reconciliation-row").filter({hasText:"Taxa de ensaio estrutural"}).getByRole("button",{name:"Classificar saída",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Vai para",exact:true}).selectOption("obra");
  await dialog.getByRole("combobox",{name:"Obra",exact:true}).selectOption("work");
  const category=dialog.getByRole("combobox",{name:/Categoria de saída/});
  await category.fill("tecnologicos");
  await dialog.getByRole("option",{name:/Ensaios tecnológicos/}).click();
  await dialog.getByRole("combobox",{name:"Vai para",exact:true}).selectOption("empresa");
  await expect(category).toHaveValue("");
  await expect(dialog.getByRole("button",{name:"Confirmar conciliação",exact:true})).toBeDisabled();
  await dialog.getByRole("combobox",{name:"Vai para",exact:true}).selectOption("obra");
  await dialog.getByRole("combobox",{name:"Obra",exact:true}).selectOption("work");
  await category.fill("ensaios"); await dialog.getByRole("option",{name:/Ensaios tecnológicos/}).click();
  await dialog.screenshot({path:testInfo.outputPath("work-category.png")});
  await dialog.getByRole("button",{name:"Confirmar conciliação",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(app.state().outrasDesp).toEqual(expect.arrayContaining([expect.objectContaining({obraId:"work",categoria:"ensaios_obra",valor:275})]));
  expect(app.errors).toEqual([]);
});

test("folha já paga oferece vínculo e preserva o custo sem outra despesa", async ({page}, testInfo) => {
  const app=await enter(page,{payroll:true});
  const before=selectDRE(buildFinancialLedger(app.state())).costCents;
  await page.getByRole("button",{name:"Vincular existente",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByText("Título de folha · pagamento já registrado",{exact:true})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Registrar pagamento e conciliar",exact:true})).toHaveCount(0);
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath("payroll-link.png")});
  await dialog.getByRole("button",{name:"Confirmar vínculo",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(app.commands.at(-1)).toMatchObject({type:"LINK_EXISTING_PAYMENT",payload:{targetType:"tituloFolha",targetId:"payroll",paymentId:"settlement"}});
  expect(app.state().titulosFolha[0].liquidacoes).toHaveLength(1);
  expect(app.state().outrasDesp).toEqual([]);
  expect(app.state().despesasEmpresa).toEqual([]);
  expect(selectDRE(buildFinancialLedger(app.state())).costCents).toBe(before);
  expect(app.errors).toEqual([]);
});
