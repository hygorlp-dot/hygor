import { expect, test } from "@playwright/test";

const PROFILE = {
  id:"qa-admin",
  nome:"Administrador QA",
  email:"qa-admin@arcd.test",
  role:"admin",
  active:true,
};

const groups = [
  ["Administração", ["Central do administrador"]],
  ["Painel", ["Dashboard", "Modo TV", "Comunicação", "Minhas aprovações"]],
  ["Engenharia", ["Obras", "Marcos e Curva A"]],
  ["Compras", ["Compras", "Fornecedores", "Suprimentos", "Estoque"]],
  ["Financeiro", ["DRE empresa", "DRE obras", "Gestão financeira", "Conciliação",
    "Locação de equipamentos", "Medições", "Caixa da obra", "Relatórios"]],
  ["Recursos humanos", ["Equipes", "Ponto por obra", "Gestão do ponto",
    "Terceirizados", "Folha", "Rescisão"]],
  ["Comercial", ["Meu trabalho", "Pipeline", "Relacionamentos",
    "Propostas e contratos", "Gestão comercial"]],
  ["IA", ["IA", "Configurar Gemini"]],
  ["Ajustes", ["Cadastros", "Ajustes", "Telas antigas"]],
];

const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("todos os módulos autorizados abrem sem erro de runtime", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const state = {
    usuarios:[PROFILE],
    obras:[
      {id:"obra-qa",name:"Residencial Alameda",status:"active"},
    ],
    employees:[
      {id:"employee-qa",name:"José Henrique de Lira Lima",pixKey:"10573521",obraId:"obra-qa",status:"active"},
    ],
    transacoes:[
      {id:"tr-pix",data:"2026-07-20",descricao:'Pix enviado: "Cpf :10573521-Jose Silva de Lima"',valor:-1000,status:"pendente",extratoId:"ext-qa"},
      {id:"tr-entry",data:"2026-07-21",descricao:'Pix recebido: "Cpf :90400888-Anderson Ferreira de Oliveira"',valor:7060,status:"pendente",extratoId:"ext-qa"},
      {id:"tr-vendor",data:"2026-07-22",descricao:'Pagamento fornecedor: "Concreto Forte Ltda"',valor:-2450,status:"pendente",extratoId:"ext-qa"},
    ],
    extratos:[
      {id:"ext-qa",arquivo:"Extrato Julho QA.ofx",status:"ativo"},
    ],
    attendance:{},
    attendanceLocks:{},
    unlockRequests:[],
    dailyCheckDate:"",
    changeLog:[],
    config:{paymentHolidays:[]},
  };

  await page.route("**/api/**", route =>
    route.fulfill({ json:{ok:true,status:200,presencas:[],reply:""} }));
  await page.route("**/api/data", async route => {
    const body=route.request().postDataJSON?.() || {};
    if(body.action==="profiles") {
      return route.fulfill({json:{usuarios:[PROFILE],precisaSetup:false}});
    }
    if(body.action==="auth-refresh") {
      return route.fulfill({json:{accessToken:"qa-access",refreshToken:"qa-refresh"}});
    }
    return route.fulfill({json:{
      ok:true,
      accessToken:"qa-access",
      refreshToken:"qa-refresh",
      usuario:PROFILE,
      data:state,
      updatedAt:"2026-07-27T00:00:00.000Z",
    }});
  });

  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button",{name:"Acessar central ARCD"}).click();
  await expect(page.getByText("Administrador QA").first()).toBeVisible();

  const sidebar=page.locator(".arcd-sidebar");
  for(const [group,items] of groups) {
    const groupButton=sidebar.locator(".nav-grp-hd")
      .filter({hasText:new RegExp(`^${escaped(group)}`)});
    const body=groupButton.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
    if(!await body.isVisible()) await groupButton.click();

    for(const item of items) {
      const navItem=body.locator(".nav-item")
        .filter({hasText:new RegExp(`^${escaped(item)}$`)});
      await expect(navItem, `menu ${group} > ${item}`).toBeVisible();
      await navItem.click();
      await expect(page.locator("main.arcd-main")).toBeVisible();
      await expect(page.getByText("Algo quebrou nesta tela")).toHaveCount(0);
      if(item==="Conciliação") {
        await expect(page.locator(".reconciliation-row")).toHaveCount(3);
        await expect(page.getByRole("button",{name:"Confirmar PIX"})).toBeVisible();
        await expect(page.getByRole("button",{name:"Rateio manual"})).toHaveCount(0);
        const pixRow=page.locator(".reconciliation-row").filter({has:page.getByRole("button",{name:"Confirmar PIX"})});
        await pixRow.getByRole("button",{name:/Mostrar outras ações/}).click();
        await expect(pixRow.getByRole("button",{name:"Rateio manual"})).toBeVisible();
        await pixRow.getByRole("button",{name:/Ocultar outras ações/}).click();
      }
      if(item==="Conciliação"&&process.env.ARCD_VISUAL_CAPTURE) {
        await page.screenshot({path:"/tmp/arcd-conciliacao-desktop.png",fullPage:true});
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:"/tmp/arcd-conciliacao-mobile.png",fullPage:true});
        await page.setViewportSize({width:1440,height:900});
      }
    }
  }

  expect(pageErrors).toEqual([]);
});
