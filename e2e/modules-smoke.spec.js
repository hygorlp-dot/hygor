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
  ["Comercial", ["Comercial da empresa", "Venda de imóveis", "Pipeline", "Relacionamentos",
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
    equipamentos:[{id:"eq-qa",nome:"Betoneira QA",patrimonio:"EQ-QA",ativo:true,status:"disponivel",quantidadeTotal:2,version:1,tarifas:{dia:100}}],
    locacoesEquip:[
      {id:"rental-lifecycle-qa",equipamentoId:"eq-qa",obraId:"obra-qa",inicio:"2026-09-01",fim:"",quantidade:1,status:"ativa",lifecycleState:"active",version:1,tarifas:{dia:100}},
      {id:"rental-separation-qa",equipamentoId:"eq-qa",obraId:"obra-qa",inicio:"2026-10-01",fim:"",quantidade:1,status:"ativa",lifecycleState:"separating",version:1,tarifas:{dia:100}},
      {id:"rental-return-qa",equipamentoId:"eq-qa",obraId:"obra-qa",inicio:"2026-11-01",fim:"",quantidade:2,status:"ativa",lifecycleState:"pickup_requested",version:1,tarifas:{dia:100}},
    ],manutencoesEquip:[],transferenciasEquip:[],equipmentUnavailability:[],
    orcamentos:[
      {
        id:"orcamento-rascunho-qa",
        obraId:"obra-qa",
        versionStatus:"rascunho",
        updatedAt:"2026-07-29T12:00:00.000Z",
        etapas:[{id:"etapa-fundacoes-qa",nome:"Fundações",parentId:"",ordem:1}],
        itens:[{id:"item-concreto-qa",etapaId:"etapa-fundacoes-qa",descricao:"Concreto",quantidade:10,precoUnit:500}],
      },
    ],
    budgetBaselines:[],
    employees:[
      {id:"employee-qa",name:"José Henrique de Lira Lima",pixKey:"10573521",obraId:"obra-qa",status:"active"},
    ],
    terceirizados:[
      {id:"third-party-qa",prestadorId:"provider-qa",name:"Elétrica Modelo",specialty:"eletricista",obraId:"obra-qa",contractValue:3500,weeklyRate:0,situacao:"andamento",active:true,documentos:[],etapas:[]},
      {id:"third-party-2",prestadorId:"provider-2",name:"Alessandro Ângelo da Silva",specialty:"pintor",obraId:"obra-qa",contractValue:13500,weeklyRate:2600,situacao:"andamento",active:true,documentos:[],etapas:[{id:"stage-2",nome:"Pintura interna",valor:13500}]},
      {id:"third-party-3",prestadorId:"provider-3",name:"José Henrique da Silva Santos",specialty:"eletricista",obraId:"obra-qa",contractValue:9400,weeklyRate:0,situacao:"pausado",active:false,documentos:[{id:"doc-3",tipo:"CND",validade:"2026-07-15"}],etapas:[{id:"stage-3",nome:"Infraestrutura elétrica",valor:9400}]},
      {id:"third-party-4",prestadorId:"provider-4",name:"Marcos Aclésio Bezerra",specialty:"encanador",obraId:"obra-qa",contractValue:3500,weeklyRate:0,situacao:"contratado",active:true,documentos:[],etapas:[]},
    ],
    medicoesTerc:[
      {id:"measurement-qa",tercId:"third-party-2",data:"2026-07-20",total:4050,itens:[{etapaId:"stage-2",pctAcum:30}],fotos:[]},
    ],
    pagsTerceiros:[
      {id:"third-payment-qa",tercId:"third-party-2",date:"2026-07-18",amount:2600,pagador:"empresa",description:"Pagamento semanal"},
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
      if(item==="Compras") {
        await page.locator(".compras-journey").getByRole("button").filter({hasText:"Solicitar"}).click();
        await page.getByRole("button",{name:"SOLICITAR MATERIAIS PARA A OBRA"}).click();
        await page.getByRole("button",{name:"CRIAR ITEM PRÓPRIO"}).click();
        await page.getByLabel("Unidade *").fill("KG");
        await page.getByLabel("Unidade de compra").selectOption("SC");
        await page.getByLabel("Conteúdo de 1 SC em KG *").fill("20");
        await page.getByLabel("Quantidade de compra *").fill("10");
        await expect(page.getByText("10 SC = 200 KG")).toBeVisible();
        const etapa=page.getByLabel("Etapa de 1º nível do orçamento");
        await expect(etapa.locator('option[value="etapa-fundacoes-qa"]')).toHaveCount(1);
        await expect(page.getByText(/Vinculação ao orçamento em rascunho/)).toBeVisible();
        await page.getByRole("button",{name:"Fechar"}).click();
      }
      if(item==="Conciliação") {
        await expect(page.locator(".reconciliation-row")).toHaveCount(3);
        await expect(page.getByRole("button",{name:"Confirmar PIX"})).toBeVisible();
        await expect(page.getByRole("button",{name:"Rateio manual"})).toHaveCount(0);
        const pixRow=page.locator(".reconciliation-row").filter({has:page.getByRole("button",{name:"Confirmar PIX"})});
        await pixRow.getByRole("button",{name:/Mostrar outras ações/}).click();
        await expect(pixRow.getByRole("button",{name:"Rateio manual"})).toBeVisible();
        await pixRow.getByRole("button",{name:/Ocultar outras ações/}).click();
      }
      if(item==="Locação de equipamentos") {
        await page.getByRole("button",{name:/Cadastro físico/}).click();
        await expect(page.getByText("Identidade e localização física")).toBeVisible();
        await expect(page.getByText("Prévia compatível calculada a partir da frota atual.")).toBeVisible();
        await expect(page.getByText("Betoneira QA").first()).toBeVisible();
        await expect(page.getByText("Registro com várias unidades e um único patrimônio")).toBeVisible();
        await page.getByRole("button",{name:/Mapa de ocupação/}).click();
        await expect(page.getByText("R = Reserva")).toBeVisible();
        await expect(page.getByText("livre 2").first()).toBeVisible();
        await page.getByRole("button",{name:/Reservar \/ bloquear/}).click();
        await expect(page.getByText("Reservar ou bloquear equipamento")).toBeVisible();
        await page.getByLabel("Equipamento *").selectOption("eq-qa");
        await page.getByLabel("Motivo *").fill("Reserva de homologação");
        await expect(page.getByRole("button",{name:/Salvar/})).toBeVisible();
        await page.getByRole("button",{name:"Fechar"}).click();
        await page.getByRole("button",{name:/Locações/}).click();
        await expect(page.getByText("CICLO · ATIVA")).toBeVisible();
        await expect(page.getByRole("button",{name:"Avançar: Retirada solicitada"})).toBeVisible();
        await page.getByRole("button",{name:"Checklist: Separação"}).click();
        const checklistDialog=page.getByRole("dialog",{name:/Separação · Betoneira QA/});
        await expect(checklistDialog.getByText("EVIDÊNCIA OPERACIONAL OBRIGATÓRIA")).toBeVisible();
        await expect(checklistDialog.getByRole("button",{name:"Salvar checklist"})).toBeVisible();
        await checklistDialog.getByRole("button",{name:"Cancelar"}).click();
        await page.getByRole("button",{name:"Checklist: Devolução"}).click();
        const returnDialog=page.getByRole("dialog",{name:/Devolução · Betoneira QA/});
        await expect(returnDialog.getByLabel("Limpeza")).toBeVisible();
        await expect(returnDialog.getByLabel("Avarias")).toBeVisible();
        await expect(returnDialog.getByLabel("Itens faltantes")).toBeVisible();
        await returnDialog.getByRole("button",{name:"Cancelar"}).click();
        await page.getByRole("button",{name:"Devolução parcial"}).click();
        const partialDialog=page.getByRole("dialog",{name:/Devolução parcial · Betoneira QA/});
        await expect(partialDialog.getByLabel("Quantidade *")).toHaveValue("1");
        await partialDialog.getByRole("button",{name:"Cancelar"}).click();
      }
      if(item==="Terceirizados") {
        const excluirContrato=page.getByRole("button",{name:"Excluir contrato de Elétrica Modelo"});
        await expect(excluirContrato).toBeVisible();
        if(process.env.ARCD_VISUAL_CAPTURE) {
          await page.screenshot({path:"/tmp/arcd-terceirizados-desktop.png",fullPage:true});
          await page.setViewportSize({width:390,height:844});
          await page.screenshot({path:"/tmp/arcd-terceirizados-mobile.png",fullPage:true});
          await page.setViewportSize({width:1440,height:900});
          await page.locator(".terceiros-tabs").getByRole("button",{name:/^Cadastro/}).click();
          await page.screenshot({path:"/tmp/arcd-terceirizados-cadastro-desktop.png",fullPage:true});
          await page.setViewportSize({width:390,height:844});
          await page.screenshot({path:"/tmp/arcd-terceirizados-cadastro-mobile.png",fullPage:true});
          await page.setViewportSize({width:1440,height:900});
          await page.getByRole("button",{name:"Novo contrato"}).click();
          await page.screenshot({path:"/tmp/arcd-terceirizados-form-desktop.png",fullPage:true});
          await page.setViewportSize({width:390,height:844});
          await page.screenshot({path:"/tmp/arcd-terceirizados-form-mobile.png",fullPage:true});
          await page.getByRole("button",{name:"Fechar"}).click();
          await page.setViewportSize({width:1440,height:900});
          await page.locator(".terceiros-tabs").getByRole("button",{name:/^Medições/}).click();
          await page.locator(".terceiros-workspace select").first().selectOption("third-party-2");
          await page.screenshot({path:"/tmp/arcd-terceirizados-medicoes-desktop.png",fullPage:true});
          await page.setViewportSize({width:390,height:844});
          await page.screenshot({path:"/tmp/arcd-terceirizados-medicoes-mobile.png",fullPage:true});
          await page.setViewportSize({width:1440,height:900});
          await page.locator(".terceiros-tabs").getByRole("button",{name:/^Pagamentos/}).click();
          await page.screenshot({path:"/tmp/arcd-terceirizados-pagamentos-desktop.png",fullPage:true});
          await page.locator(".terceiros-tabs").getByRole("button",{name:/^Quadro/}).click();
        }
        const tabsTerceiros=page.locator(".terceiros-tabs");
        await tabsTerceiros.getByRole("button",{name:/^Cadastro/}).click();
        await expect(page.getByRole("heading",{name:"Prestadores e contratos"})).toBeVisible();
        await expect(page.getByLabel("Especialidade")).toBeVisible();
        await expect(page.getByRole("button",{name:/Alessandro Ângelo da Silva/})).toBeVisible();
        await page.getByRole("button",{name:"Novo contrato"}).click();
        await expect(page.getByRole("heading",{name:"Prestador e alocação"})).toBeVisible();
        await expect(page.getByRole("heading",{name:"Dados fiscais"})).toBeVisible();
        await expect(page.getByRole("heading",{name:"Valores e pagamento"})).toBeVisible();
        await expect(page.getByRole("button",{name:"Criar contrato"})).toBeVisible();
        await page.getByRole("button",{name:"Fechar"}).click();
        await tabsTerceiros.getByRole("button",{name:/^Pagamentos/}).click();
        await expect(page.getByRole("button",{name:"Semana anterior"})).toBeVisible();
        await expect(page.getByRole("button",{name:"Próxima semana"})).toBeVisible();
        await expect(page.getByText("Filtrar por obra")).toBeVisible();
        await tabsTerceiros.getByRole("button",{name:/^Medições/}).click();
        await page.locator(".terceiros-workspace select").first().selectOption("third-party-2");
        await expect(page.getByText("Medição 1 · 20/07/2026")).toBeVisible();
        await tabsTerceiros.getByRole("button",{name:/^Quadro/}).click();
        page.once("dialog",dialog=>dialog.accept("Contrato duplicado no teste"));
        await excluirContrato.click();
        await expect(excluirContrato).toHaveCount(0);
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
