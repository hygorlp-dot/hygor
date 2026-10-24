import {expect,test} from "@playwright/test";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";
const profile={id:"qa-rh",nome:"RH QA",email:"rh@qa.test",role:"rh",active:true};
async function enter(page){
  await page.context().addInitScript(()=>{window.print=()=>{};});
  await page.clock.setFixedTime(new Date("2026-09-25T12:00:00-03:00"));
  let state={usuarios:[profile],obras:[{id:"obra",name:"Obra QA",status:"active"}],employees:[{id:"emp",name:"Operário QA",cpf:"000.000.000-00",role:"Pedreiro",obra:"obra",dailyRate:120,monthlySalary:2406.8,remunerationMode:"clt",startDate:"2026-05-01",active:true,version:1}],advances:[{id:"adv",empId:"emp",date:"2026-09-20",amount:600,description:"Adiantamento 1ª quinzena",status:"ativo",version:1,installments:[{id:"i",dueDate:"2026-09-30",amount:600,status:"programada"}]}],attendance:{},attendanceLocks:{},unlockRequests:[],changeLog:[],config:{companyName:"Empresa QA",cnpj:"00.000.000/0001-00",paymentHolidays:[]},financialSettlements:[{id:"preservar",amount:600}]};
  const commands=[];
  await page.route("**/api/**",r=>r.fulfill({json:{ok:true,presencas:[],items:[]}}));
  await page.route("**/api/data",async r=>{
    const body=r.request().postDataJSON()||{};
    if(body.action==="profiles")return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="operational-command"){
      commands.push(body.command);
      // The real handler stamps the authenticated actor before applying.
      const result=applyOperationalCommand(state,{...body.command,actorId:profile.id,actorName:profile.nome},"2026-09-25T15:00:00Z");
      if(result.ok)state=result.data;
      return r.fulfill({json:{...result,updatedAt:"2026-09-25T15:00:00Z"}});
    }
    return r.fulfill({json:{ok:true,accessToken:"qa",refreshToken:"qa",usuario:profile,data:state,updatedAt:"2026-09-24T15:00:00Z"}});
  });
  await page.goto("/");await page.locator("#login-email").fill(profile.email);await page.locator("#login-senha").fill("teste");
  await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
  await expect(page.locator("#login-email")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Folha");
  await search.locator("xpath=../..").getByRole("button").filter({hasText:"Folha"}).click();
  await page.getByRole("button",{name:"Holerites CLT",exact:true}).click();
  await page.getByRole("combobox",{name:"Funcionário do holerite",exact:true}).selectOption("emp");
  return {commands,getState:()=>state};
}
test("RH: mensal CLT, vínculo de adiantamento, persistência, recibos e PDF sem baixa financeira",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const {commands,getState}=await enter(page);
  await expect(page.getByRole("region",{name:"Competência e escopo da folha"})).toHaveCount(0);
  await expect(page.getByLabel("Salário contratual mensal (R$)",{exact:true})).toHaveValue("2406.8");
  await page.getByLabel("Matrícula",{exact:true}).fill("001");await page.getByLabel(/^Cbo$/i).fill("715210");
  await page.getByLabel("Dias efetivamente trabalhados",{exact:true}).fill("22");
  await page.getByLabel(/2026-09-20.*parcela/).check();
  await expect(page.locator(".clt-issues")).toContainText("regime de caixa");
  await page.getByRole("combobox",{name:"Apuração de INSS e IRRF",exact:true}).selectOption("manual");
  await page.getByLabel("INSS apurado (R$)",{exact:true}).fill("192.30");await page.getByLabel("IRRF apurado (R$)",{exact:true}).fill("0");
  await page.getByLabel("Base do IRRF apurada (R$)",{exact:true}).fill("1799.60");
  await page.getByLabel("Responsável e referência da apuração contábil",{exact:true}).fill("Contabilidade — 09/2026");
  await page.getByLabel(/^Confirmo contrato/).check();
  await expect(page.getByRole("button",{name:"Exportar holerite PDF"})).toBeDisabled();
  await page.getByRole("button",{name:"Salvar demonstrativo",exact:true}).click();
  await expect(page.getByRole("button",{name:"Exportar holerite PDF"})).toBeEnabled();
  expect(commands).toHaveLength(1);expect(commands[0].type).toBe("FUNCIONARIO_SALVO");
  expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  expect(getState().advances[0].amount).toBe(600);
  await page.getByLabel("Competência mensal",{exact:true}).fill("2026-10");
  await expect(page.getByLabel("Salário contratual mensal (R$)",{exact:true})).toHaveValue("2406.8");
  await page.getByLabel("Competência mensal",{exact:true}).fill("2026-09");
  await expect(page.getByLabel("Matrícula",{exact:true})).toHaveValue("001");
  const opened=page.waitForEvent("popup");await page.getByRole("button",{name:"Exportar holerite PDF"}).click();const report=await opened;
  await report.evaluate(()=>window.__marcellReportReady);
  await expect(report.locator("body")).toContainText("1.614,50");
  await expect(report.locator(".mrc-report-logo")).toHaveCount(1);
  await report.pdf({path:test.info().outputPath("holerite-clt.pdf"),preferCSSPageSize:true,printBackground:true});await report.close();
  await page.getByText("Recibos dos adiantamentos quinzenais registrados",{exact:true}).click();
  const receiptOpened=page.waitForEvent("popup");await page.getByRole("button",{name:"Recibo 2026-09-20",exact:true}).click();const receipt=await receiptOpened;
  await expect(receipt.locator("body")).toContainText("600,00");await receipt.close();
  expect(commands).toHaveLength(1);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator(".clt-payslips").screenshot({path:test.info().outputPath("holerite-tela.png")});
});

test("RH escolhe diária ou CLT no cadastro, com salário mensal e vigência",async({page})=>{
  const {commands,getState}=await enter(page);
  await page.keyboard.press("Control+k");
  const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill("Equipes");await search.locator("xpath=../..").getByRole("button").filter({hasText:"Equipes"}).click();
  await page.getByRole("button",{name:"Editar",exact:true}).first().click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Modalidade de remuneração",exact:true}).selectOption("daily");
  await dialog.getByLabel("Modalidade válida a partir de",{exact:true}).fill("2026-09-25");
  await dialog.getByRole("button",{name:"Salvar",exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(getState().employees[0].remunerationMode).toBe("daily");
  await page.getByRole("button",{name:"Editar",exact:true}).first().click();
  await dialog.getByRole("combobox",{name:"Modalidade de remuneração",exact:true}).selectOption("clt");
  await dialog.getByLabel("Modalidade válida a partir de",{exact:true}).fill("2026-10-01");
  await dialog.getByLabel("Salário contratual mensal *",{exact:true}).fill("2600");
  await dialog.getByRole("button",{name:"Salvar",exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(getState().employees[0]).toMatchObject({remunerationMode:"clt",monthlySalary:2600,dailyRate:120});
  expect(getState().employees[0].remunerationHistory.at(-1)).toMatchObject({date:"2026-10-01",mode:"clt"});
  expect(commands).toHaveLength(2);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
});

test("provisões: total mensal, por funcionário, saldo informado e exportação sem lançamentos",async({page})=>{
  const {commands,getState}=await enter(page);
  await page.getByRole("button",{name:"Provisões trabalhistas",exact:true}).click();
  const region=page.getByRole("region",{name:"Provisões trabalhistas",exact:true});
  await expect(region).toContainText("Não apurado");
  await region.getByRole("button",{name:"Ajustar Operário QA",exact:true}).click();
  await page.getByLabel("Base mensal para provisões (R$)",{exact:true}).fill("3000");
  await page.getByLabel("Reserva existente antes desse mês (R$)",{exact:true}).fill("1000");
  await page.getByLabel("Reserva já utilizada no período (R$)",{exact:true}).fill("500");
  await page.getByLabel("Base FGTS para fins rescisórios — extrato (R$)",{exact:true}).fill("10000");
  await page.getByRole("button",{name:"Salvar provisões",exact:true}).click();
  await expect(page.getByRole("button",{name:"Exportar provisões PDF",exact:true})).toBeEnabled();
  await expect(region.locator(".clt-totals")).toContainText("744,67");
  await expect(region).toContainText("4.000,00");
  expect(getState().employees[0].laborProvisions["2026-09"]).toMatchObject({base:"3000",openingBalance:"1000",usedReserve:"500"});
  await page.getByLabel("Competência das provisões",{exact:true}).fill("2026-10");await page.getByLabel("Competência das provisões",{exact:true}).fill("2026-09");
  await region.getByRole("button",{name:"Ajustar Operário QA",exact:true}).click();
  await expect(page.getByLabel("Base mensal para provisões (R$)",{exact:true})).toHaveValue("3000");
  const opened=page.waitForEvent("popup");await page.getByRole("button",{name:"Exportar provisões PDF",exact:true}).click();const report=await opened;
  await report.evaluate(()=>window.__marcellReportReady);await expect(report.locator("body")).toContainText("744,67");await expect(report.locator("body")).toContainText("1.244,67");
  await report.pdf({path:test.info().outputPath("provisoes.pdf"),preferCSSPageSize:true,printBackground:true});await report.close();
  expect(commands).toHaveLength(1);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await region.screenshot({path:test.info().outputPath("provisoes-tela.png")});
});

test("simulação: RH escolhe CLT ou diária no mês sem alterar cadastro, folha ou DRE",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const {commands,getState}=await enter(page);
  await page.getByRole("button",{name:"Simulação CLT × diária",exact:true}).click();
  const region=page.getByRole("region",{name:"Simulação CLT ou diária",exact:true});
  await expect(region.getByRole("radio",{name:"CLT"})).toBeChecked();
  await region.getByRole("button",{name:"Ajustar Operário QA",exact:true}).click();
  await page.getByLabel("Dias trabalhados no mês",{exact:true}).fill("22");
  // Simples Nacional Anexo IV (construção) é o padrão: CPP 20% + RAT 3% × FAP 1.
  await expect(region.locator(".pay-mode-regime")).toContainText("23%");
  await page.getByRole("combobox",{name:"Regime tributário",exact:true}).selectOption("normal");
  await expect(region.locator(".pay-mode-regime")).toContainText("28,8%");
  await page.getByRole("combobox",{name:"Regime tributário",exact:true}).selectOption("simples_iv");
  await page.getByLabel("FAP da empresa",{exact:true}).fill("1.5");
  await expect(region.locator(".pay-mode-regime")).toContainText("24,5%");
  // Diária 120 × 22 = 2.640,00 líquido; custo soma VT/VR do cadastro (zero aqui).
  await expect(region.locator("tbody")).toContainText("2.640,00");
  await region.getByRole("radio",{name:"Diária"}).check();
  await expect(region.locator(".clt-totals")).toContainText("2.640,00");
  await page.getByLabel("Incluir custos de admissão nesta competência",{exact:true}).check();
  for(const label of ["ASO / exame admissional (R$)","Exames complementares (R$)","EPIs e uniformes iniciais (R$)","Treinamentos e integração inicial (R$)","Registro e serviços de admissão (R$)","Outros custos de admissão (R$)"]){await page.getByLabel(label,{exact:true}).fill(label.startsWith("ASO")?"100":"0");}
  await expect(region.locator(".clt-totals")).toContainText("2.740,00");
  await region.getByRole("button",{name:/^Salvar simulação/}).click();
  await expect(region.getByRole("status").first()).toContainText("Simulação salva");
  const employee=getState().employees[0];
  expect(employee.payModeSimulations["2026-09"]).toMatchObject({choice:"daily",workedDays:"22",regime:"simples_iv",rat:3,fap:"1.5"});
  expect(employee.payModeSimulations["2026-09"]).toMatchObject({includeAdmissionCosts:true,admissionCosts:{admissionExam:"100"}});
  expect(employee).toMatchObject({remunerationMode:"clt",monthlySalary:2406.8});
  expect(employee.cltPayroll??null).toBeNull();
  expect(commands).toHaveLength(1);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.getByLabel("Competência da simulação",{exact:true}).fill("2026-10");await page.getByLabel("Competência da simulação",{exact:true}).fill("2026-09");
  await expect(region.getByRole("radio",{name:"Diária"})).toBeChecked();
  await expect(region.locator(".clt-totals")).toContainText("2.740,00");
  await expect(page.getByLabel("FAP da empresa",{exact:true})).toHaveValue("1.5");
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await region.screenshot({path:test.info().outputPath("simulacao-tela.png")});
});
