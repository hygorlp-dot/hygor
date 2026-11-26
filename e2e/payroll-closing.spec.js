import {expect,test} from "@playwright/test";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";

const defaultProfile={id:"qa-rh",nome:"RH QA",email:"rh@qa.test",role:"rh",active:true};

async function enterPayroll(page,{missingCertificates=false,profile=defaultProfile,archivedPoint=false}={}){
  await page.clock.setFixedTime(new Date("2026-09-25T12:00:00-03:00"));
  await page.addInitScript(theme=>localStorage.setItem("arcd-theme",theme),test.info().project.metadata.theme||"marcell");
  let state={
    usuarios:[profile],
    obras:[{id:"obra",name:"Obra QA",status:"active",contractType:"empreitada"}],
    employees:[{id:"emp",name:"Operário QA",cpf:"529.982.247-25",role:"Pedreiro",obra:"obra",dailyRate:150,
      pixType:"CPF",pixKey:"52998224725",pixHolder:"Operário QA",remunerationMode:"daily",startDate:"2026-01-01",active:true,version:1}],
    advances:[],attendance:{emp:{}},attendanceLocks:{},unlockRequests:[],changeLog:[],
    titulosFolha:[],pagamentosFolha:[],fechamentosFinanceiros:[],
    ...(archivedPoint?{quinzenasArquivadas:{"2026-09-Q2":{
      inicio:"2026-09-21",fim:"2026-10-05",archivedAt:"2026-10-06T12:00:00Z",totalLancamentos:1,funcionarios:1,
    }}}:{}),
    config:{companyName:"Empresa QA",cnpj:"00.000.000/0001-00",paymentHolidays:[]},
  };
  for(let day=1;day<=30;day++){
    const date=`2026-09-${String(day).padStart(2,"0")}`,weekday=new Date(date+"T12:00:00Z").getUTCDay();
    if(weekday>0&&weekday<6)state.attendance.emp[date]={status:"P",obraId:"obra",ot:0};
  }
  if(missingCertificates)state.attendance.emp["2026-09-18"].status="AT";
  let pending=missingCertificates;
  const commands=[];
  const certificateChecks=[];
  await page.route("https://**/*",route=>route.abort());
  await page.route("**/api/**",r=>r.fulfill({json:{ok:true,presencas:[],items:[]}}));
  await page.route("**/api/data",async r=>{
    const body=r.request().postDataJSON()||{};
    if(body.action==="profiles")return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="payroll-certificate-check"){
      certificateChecks.push(body.periodKey);
      return r.fulfill({json:{ok:true,missing:pending&&body.periodKey==="2026-09-Q1"
        ?[{employeeId:"emp",name:"Operário QA",date:"2026-09-18"}]:[],
      }});
    }
    if(body.action==="operational-command"){
      commands.push(body.command);
      const result=applyOperationalCommand(state,{...body.command,actorId:profile.id,actorName:profile.nome,now:"2026-09-25T15:00:00Z"});
      if(result.ok)state=result.data;
      return r.fulfill({json:{...result,updatedAt:"2026-09-25T15:00:00Z"}});
    }
    return r.fulfill({json:{ok:true,accessToken:"qa",refreshToken:"qa",usuario:profile,data:state,updatedAt:"2026-09-24T15:00:00Z"}});
  });
  await page.goto("/");
  await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("teste");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await expect(page.locator(".arcd-app-shell")).toBeVisible();
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Folha");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Folha"}).click();
  await expect(page.getByRole("heading",{name:"Folha de Pagamento",exact:true})).toBeVisible();
  const scope=page.locator(".payroll-controls");
  if(!await scope.isVisible())await scope.locator("xpath=ancestor::details[1]/summary").click();
  await page.getByRole("combobox",{name:"Ciclo da folha"}).selectOption("1");
  return {commands,certificateChecks,getState:()=>state,attachCertificate:()=>{pending=false;}};
}

test("RH restrito à obra consulta a folha sem ações de fechamento da empresa",async({page},info)=>{
  const {commands,certificateChecks}=await enterPayroll(page,{profile:{...defaultProfile,obraId:"obra"},archivedPoint:true});
  await expect(page.locator(".payroll-person").filter({hasText:"Operário QA"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Fechar quinzena",exact:true,includeHidden:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Reabrir quinzena",includeHidden:true})).toHaveCount(0);
  const closing=page.locator(".payroll-closing");
  if(!await closing.isVisible())await closing.locator("xpath=ancestor::details[1]/summary").click();
  await expect(closing).toContainText("O fechamento exige acesso à Folha da empresa inteira.");
  expect(commands).toEqual([]);
  expect(certificateChecks).toEqual([]);
  await page.screenshot({path:info.outputPath("folha-acesso-por-obra.png")});
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Gestão do ponto");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Gestão do ponto"}).click();
  await expect(page.getByRole("heading",{name:"Ponto da quinzena"})).toBeVisible();
  await expect(page.getByText("QUINZENA FINALIZADA E ARQUIVADA",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Ver arquivo",exact:true,includeHidden:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Restaurar",exact:true,includeHidden:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath("arquivo-ponto-acesso-por-obra.png")});
});

test("Folha bloqueia o fechamento até a conferência do atestado pendente",async({page},info)=>{
  const {commands,attachCertificate}=await enterPayroll(page,{missingCertificates:true});
  const closing=page.getByRole("region",{name:"Fechamento da quinzena",includeHidden:true});
  if(!await closing.isVisible())await page.locator(".payroll-closing").locator("xpath=ancestor::details[1]/summary").click();
  const close=closing.getByRole("button",{name:"Fechar quinzena"});
  await expect(close).toBeDisabled();
  await closing.getByText("Ver atestados pendentes",{exact:true}).click();
  await expect(closing.getByText("Operário QA · 18/09/2026",{exact:true})).toBeVisible();
  expect(commands).toEqual([]);
  await closing.screenshot({path:info.outputPath("folha-atestado-pendente.png")});
  attachCertificate();
  await closing.getByRole("button",{name:"Conferir anexos novamente"}).click();
  await expect(close).toBeEnabled();
  await close.click();
  await page.getByRole("button",{name:"Confirmar fechamento"}).click();
  await expect(closing).toContainText("Quinzena fechada");
});

test("RH fecha a quinzena: cria o título a pagar rateado e só reabre com motivo",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const {commands,getState}=await enterPayroll(page);
  const closingPanel=page.locator(".payroll-closing");
  if(!await closingPanel.isVisible())await closingPanel.locator("xpath=ancestor::details[1]/summary").click();
  const closing=page.getByRole("region",{name:"Fechamento da quinzena"});
  await expect(closing).toContainText("Fechamento da quinzena");
  await closing.getByRole("button",{name:"Fechar quinzena"}).click();
  await page.getByRole("button",{name:"Confirmar fechamento"}).click();
  await expect(closing).toContainText("Quinzena fechada");

  expect(commands.map(c=>c.type)).toEqual(["QUINZENA_FOLHA_FECHADA"]);
  const [title]=getState().titulosFolha;
  expect(title).toMatchObject({employeeId:"emp",periodKey:"2026-09-Q1",status:"em_aberto",fechadoFolhaPor:"RH QA"});
  expect(title.liquido).toBeGreaterThan(0);
  expect(title.rateiosPorObra).toEqual([{obraId:"obra",obraNome:"Obra QA",valor:title.liquido,pagador:"construtora"}]);

  await closing.getByRole("button",{name:"Reabrir quinzena"}).click();
  const reopen=page.getByRole("button",{name:"Reabrir quinzena"}).last();
  await expect(reopen).toBeDisabled();
  await page.getByLabel("Motivo da reabertura").fill("Ponto corrigido");
  await reopen.click();
  await expect(closing).toContainText("Fechamento da quinzena");
  expect(commands.map(c=>c.type)).toEqual(["QUINZENA_FOLHA_FECHADA","QUINZENA_FOLHA_REABERTA"]);
  expect(getState().titulosFolha[0]).toMatchObject({status:"cancelado",motivoCancelamento:"Ponto corrigido"});
  expect(errors).toEqual([]);
  await closing.screenshot({path:test.info().outputPath("fechamento-quinzena.png")});
});
