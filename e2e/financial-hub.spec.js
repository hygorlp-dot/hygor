import { expect, test } from "@playwright/test";

const PROFILE={id:"qa-fin",nome:"Financeiro QA",email:"financeiro@arcd.test",role:"financeiro",active:true};
const STATE={
  usuarios:[PROFILE],
  obras:[{id:"obra-a",name:"Residencial Alameda",status:"active"}],
  payments:[{id:"entrada-1",obraId:"obra-a",date:"2026-08-04",amount:12500,description:"Recebimento da medição",status:"ativo",origem:"manual"}],
  despesasEmpresa:[{id:"saida-1",competencia:"2026-08",descricao:"Aluguel da sede",valor:3500,pago:true,dataPagamento:"2026-08-05",status:"ativo",origem:"dre_empresa"}],
  transacoes:[],notasFiscais:[],pedidos:[],medicoes:[],medicoesTerc:[],pagsTerceiros:[],
  outrasDesp:[],titulosFolha:[],pagamentosFolha:[],caixaObra:[],locacoesEquip:[],
  rentalChargeItems:[],rentalInvoices:[],despesasOperacionais:[],fornecedores:[],employees:[],
  config:{paymentHolidays:[]},attendance:{},attendanceLocks:{},changeLog:[],
};

test("centraliza entradas e saídas e abre lançamento por empresa ou obra",async({page})=>{
  await page.route("**/api/**",route=>route.fulfill({json:{ok:true,status:200,presencas:[]}}));
  await page.route("**/api/data",async route=>{
    const body=route.request().postDataJSON?.()||{};
    if(body.action==="profiles")return route.fulfill({json:{usuarios:[PROFILE],precisaSetup:false}});
    if(body.action==="auth-refresh")return route.fulfill({json:{accessToken:"qa-access",refreshToken:"qa-refresh"}});
    return route.fulfill({json:{ok:true,accessToken:"qa-access",refreshToken:"qa-refresh",usuario:PROFILE,data:STATE,updatedAt:"2026-08-07T00:00:00.000Z"}});
  });
  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button",{name:"Acessar central ARCD"}).click();
  const financeiro=page.locator(".nav-grp-hd").filter({hasText:/^Financeiro/});
  const grupo=financeiro.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  if(!await grupo.isVisible())await financeiro.click();
  await grupo.locator(".nav-item").filter({hasText:/^Gestão financeira$/}).click();
  await expect(page.getByRole("heading",{name:"Movimentações financeiras"})).toBeVisible();
  await page.getByLabel("Competência").fill("2026-08");
  await expect(page.getByText("R$ 12.500,00")).toBeVisible();
  await expect(page.getByText("R$ 3.500,00")).toBeVisible();
  await expect(page.getByText("R$ 9.000,00")).toBeVisible();
  await page.getByRole("button",{name:/Registrar saída/}).click();
  await expect(page.getByRole("heading",{name:"Registrar saída"})).toBeVisible();
  await page.getByLabel("Centro financeiro").last().selectOption("empresa");
  await expect(page.getByLabel("Obra *")).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Confirmar movimentação/})).toBeVisible();
});
