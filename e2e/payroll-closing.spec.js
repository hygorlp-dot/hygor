import {expect,test} from "@playwright/test";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";

const profile={id:"qa-rh",nome:"RH QA",email:"rh@qa.test",role:"rh",active:true};

async function enterPayroll(page){
  await page.clock.setFixedTime(new Date("2026-09-25T12:00:00-03:00"));
  let state={
    usuarios:[profile],
    obras:[{id:"obra",name:"Obra QA",status:"active",contractType:"empreitada"}],
    employees:[{id:"emp",name:"Operário QA",cpf:"529.982.247-25",role:"Pedreiro",obra:"obra",dailyRate:150,
      pixType:"CPF",pixKey:"52998224725",pixHolder:"Operário QA",remunerationMode:"daily",startDate:"2026-01-01",active:true,version:1}],
    advances:[],attendance:{emp:{}},attendanceLocks:{},unlockRequests:[],changeLog:[],
    titulosFolha:[],pagamentosFolha:[],fechamentosFinanceiros:[],
    config:{companyName:"Empresa QA",cnpj:"00.000.000/0001-00",paymentHolidays:[]},
  };
  for(let day=1;day<=30;day++){
    const date=`2026-09-${String(day).padStart(2,"0")}`,weekday=new Date(date+"T12:00:00Z").getUTCDay();
    if(weekday>0&&weekday<6)state.attendance.emp[date]={status:"P",obraId:"obra",ot:0};
  }
  const commands=[];
  await page.route("**/api/**",r=>r.fulfill({json:{ok:true,presencas:[],items:[]}}));
  await page.route("**/api/data",async r=>{
    const body=r.request().postDataJSON()||{};
    if(body.action==="profiles")return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});
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
  await expect(page.locator("#login-email")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Folha");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Folha"}).click();
  await page.getByRole("combobox",{name:"Ciclo da folha"}).selectOption("1");
  return {commands,getState:()=>state};
}

test("RH fecha a quinzena: cria o título a pagar rateado e só reabre com motivo",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const {commands,getState}=await enterPayroll(page);
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
