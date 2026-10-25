import {expect,test} from "@playwright/test";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";
import {newCltDraft} from '../src/domains/ponto/clt-payslip.js';
import {stampEmployeeEngineeringCommand} from '../src/domains/rh/employee-engineering.js';
const profile={id:"qa-rh",nome:"RH QA",email:"rh@qa.test",role:"rh",active:true};
async function enter(page,{point=false,complete=false,legacy=false,profileOnly=false,mixedReady=false,manualDaily=false}={}){
  await page.context().addInitScript(()=>{window.print=()=>{};});
  const now=mixedReady||manualDaily?'2026-10-06T15:00:00Z':'2026-09-25T15:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  let state={usuarios:[profile],obras:[{id:"obra",name:"Obra QA",status:"active"}],employees:[{id:"emp",name:"Operário QA",cpf:"000.000.000-00",role:"Pedreiro",obra:"obra",dailyRate:120,monthlySalary:2406.8,remunerationMode:"clt",startDate:"2026-05-01",active:true,version:1}],advances:[{id:"adv",empId:"emp",date:"2026-09-20",amount:600,description:"Adiantamento 1ª quinzena",status:"ativo",version:1,installments:[{id:"i",dueDate:"2026-09-30",amount:600,status:"programada"}]}],attendance:{},attendanceLocks:{},unlockRequests:[],changeLog:[],config:{companyName:"Empresa QA",cnpj:"00.000.000/0001-00",paymentHolidays:[]},financialSettlements:[{id:"preservar",amount:600}]};
  if(legacy)Object.assign(state.employees[0],{remunerationMode:"daily",monthlySalary:0,vtDaily:0,vrDaily:0,startDate:"2026-03-20",phone:"81977772299",cltPayroll:profileOnly?{profile:{salary:2600,registration:"007",cbo:"715210",category:"helper"}}:null});
  if(mixedReady)state.employees[0].cltPayroll={drafts:{'2026-09':{...newCltDraft('2026-09',{salary:2406.8}),paymentDate:'2026-09-30',workedDays:22,registration:'001',cbo:'715210',confirmed:true}}};
  if(complete)Object.assign(state.employees[0],{cpf:"529.982.247-25",phone:"81999999999",workArea:"campo",workdayHours:8,workStart:"07:00",pixType:"CPF",pixKey:"52998224725",pixHolder:"Operário QA",examExpiresAt:"2027-05-01",remunerationMode:"daily",cltPayroll:{profile:{registration:"001",cbo:"715210",category:"professional"}}});
  if(manualDaily){
    Object.assign(state.employees[0],{name:"Siclano — SIMULAÇÃO",role:"Servente",remunerationMode:"daily",monthlySalary:0,cltPayroll:{profile:{registration:"QA-002",cbo:"717020",category:"helper"}}});
    state.advances=[];
  }
  if(point){
    for(let day=1;day<=30;day++){
      const date=`2026-09-${String(day).padStart(2,"0")}`,weekday=new Date(date+"T12:00:00Z").getUTCDay();
      if(weekday>0&&weekday<6&&day!==7){state.attendance.emp??={};state.attendance.emp[date]={status:day===2&&!manualDaily?"F":"P",obraId:"obra",ot:0};state.attendanceLocks[`${date}__obra`]={locked:true};}
    }
  }
  const commands=[];
  await page.route("**/api/**",r=>r.fulfill({json:{ok:true,presencas:[],items:[]}}));
  await page.route("**/api/data",async r=>{
    const body=r.request().postDataJSON()||{};
    if(body.action==="profiles")return r.fulfill({json:{usuarios:[profile],precisaSetup:false}});
    if(body.action==="operational-command"){
      commands.push(body.command);
      // The real handler stamps the authenticated actor before applying.
      const result=applyOperationalCommand(state,stampEmployeeEngineeringCommand({...body.command,actorId:profile.id,actorName:profile.nome},profile,now));
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
  if(manualDaily)await page.getByLabel("Competência mensal",{exact:true}).fill("2026-09");
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
  await dialog.getByLabel("Valores e jornada válidos a partir de",{exact:true}).fill("2026-10-01");await dialog.getByLabel("Motivo do reajuste de valores ou jornada",{exact:true}).fill("Reajuste contratual confirmado");
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


test("ponto fechado: classificação, importação rastreável e campos protegidos",async({page})=>{
  const {getState}=await enter(page,{point:true});
  await page.getByText("Importar ponto aprovado do mês",{exact:true}).click();
  await page.getByRole("combobox",{name:"Tratamento do DSR das faltas",exact:true}).selectOption("weekly");
  await expect(page.getByRole("button",{name:"Aplicar ponto ao holerite",exact:true})).toBeDisabled();
  await page.getByRole("combobox",{name:"Ausência 2026-09-02",exact:true}).selectOption("unjustified");
  await page.getByLabel("Revisei justificativas, atrasos, compensações, jornada e adicionais da CCT.",{exact:true}).check();
  await page.getByRole("button",{name:"Aplicar ponto ao holerite",exact:true}).click();
  await expect(page.getByLabel("Faltas não justificadas (dias)",{exact:true})).toHaveValue("1");
  await expect(page.getByLabel("Faltas não justificadas (dias)",{exact:true})).toBeDisabled();
  await expect(page.getByLabel("DSR perdido (dias)",{exact:true})).toHaveValue("1");
  await page.getByLabel("Matrícula",{exact:true}).fill("001");await page.getByLabel(/^Cbo$/i).fill("715210");
  await page.getByLabel(/^Confirmo contrato/).check();
  await page.getByRole("button",{name:"Salvar demonstrativo",exact:true}).click();
  await expect(page.getByRole("button",{name:"Exportar holerite PDF",exact:true})).toBeEnabled();
  expect(getState().employees[0].cltPayroll.drafts["2026-09"].attendanceSource.importedBy).toBe("RH QA");
  expect(getState().employees[0].cltPayroll.profile.attendancePolicy.dsrPolicy).toBe("weekly");
  const opened=page.waitForEvent("popup");await page.getByRole("button",{name:"Exportar holerite PDF",exact:true}).click();const report=await opened;
  await expect(report.locator("body")).toContainText("Eventos originados do ponto");await report.close();
  await page.getByText(/Fechamento do mês/).click();
  const batchOpened=page.waitForEvent("popup");await page.getByRole("button",{name:"Imprimir holerites aprovados em lote"}).click();const batch=await batchOpened;await batch.evaluate(()=>window.__marcellReportReady);await expect(batch.locator("body")).toContainText("Operário QA");await batch.pdf({path:test.info().outputPath("holerites-lote.pdf"),preferCSSPageSize:true});await batch.close();
  expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.locator(".clt-payslips").screenshot({path:test.info().outputPath("ponto-importado.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("custos consolidados: fontes separadas e PDF sem inventar dados ausentes",async({page})=>{
  const {commands,getState}=await enter(page);
  await page.getByRole("button",{name:"Custos por funcionário",exact:true}).click();
  await expect(page.getByRole("region",{name:"Custos por funcionário",exact:true})).toContainText("Não apurado");
  const opened=page.waitForEvent("popup");await page.getByRole("button",{name:"Exportar custos PDF"}).click();const report=await opened;await report.evaluate(()=>window.__marcellReportReady);await expect(report.locator("body")).toContainText("Não apurado");await report.pdf({path:test.info().outputPath("custos-funcionario.pdf"),preferCSSPageSize:true});await report.close();
  expect(commands).toHaveLength(0);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.getByRole("region",{name:"Custos por funcionário",exact:true}).screenshot({path:test.info().outputPath("custos.png")});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('preparação em lote cria rascunhos sem aprovar, pagar ou sobrescrever',async({page})=>{
  const {commands,getState}=await enter(page);
  await page.getByText(/Fechamento do mês/).click();
  await page.getByRole('button',{name:'Preparar rascunhos da equipe',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preparar rascunhos da equipe',exact:true})).toBeDisabled();
  const saved=getState().employees[0].cltPayroll.drafts['2026-09'];
  expect(saved.confirmed).toBe(false);expect(saved.salary).toBe(2406.8);expect(saved.advanceIds).toEqual(['adv']);
  expect(commands).toHaveLength(1);expect(getState().financialSettlements).toEqual([{id:'preservar',amount:600}]);
  await expect(page.getByRole('button',{name:'Imprimir holerites aprovados em lote',exact:true})).toBeDisabled();
});

test("prontuário privado: envia, lista e arquiva preservando o histórico",async({page})=>{
  const {commands,getState}=await enter(page);let documents=[];
  await page.route("**/api/upload",async route=>{
    const body=route.request().postDataJSON();expect(body.folder).toBe("rh");expect(body.accessToken).toBe("qa");
    if(body.documentAction==="list")return route.fulfill({json:{ok:true,documents}});
    if(body.documentAction==="upload"){documents.push({id:body.documentId,name:body.fileName,category:body.category,employeeId:body.employeeId,createdByName:"RH QA",createdAt:"2026-09-25T15:00:00Z"});return route.fulfill({json:{ok:true,document:documents[0]}});}
    if(body.documentAction==="archive"){documents[0]={...documents[0],archivedAt:"2026-09-25T15:00:00Z",archiveReason:body.reason};return route.fulfill({json:{ok:true,document:documents[0]}});}
    return route.fulfill({status:400,json:{ok:false}});
  });
  await page.getByRole("button",{name:"Prontuário documental",exact:true}).click();
  await page.getByRole("combobox",{name:"Funcionário do prontuário",exact:true}).selectOption("emp");
  await expect(page.getByRole("button",{name:"Salvar documento",exact:true})).toBeDisabled();
  await page.getByLabel("Arquivo do prontuário",{exact:true}).setInputFiles({name:"contrato-qa.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\nQA")});
  await page.getByRole("button",{name:"Salvar documento",exact:true}).click();
  await expect(page.getByRole("button",{name:"Abrir contrato-qa.pdf",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Arquivar contrato-qa.pdf",exact:true}).click();await page.getByLabel("Motivo do arquivamento",{exact:true}).fill("Substituído pelo contrato atualizado");await page.getByRole("button",{name:"Confirmar arquivamento",exact:true}).click();
  await expect(page.getByRole("button",{name:"Abrir contrato-qa.pdf",exact:true})).toHaveCount(0);
  await page.getByLabel("Mostrar documentos arquivados",{exact:true}).check();await expect(page.getByRole("button",{name:"Abrir contrato-qa.pdf",exact:true})).toBeVisible();
  expect(documents).toHaveLength(1);expect(commands).toHaveLength(0);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.getByRole("region",{name:"Prontuário do funcionário",exact:true}).screenshot({path:test.info().outputPath("prontuario.png")});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('ficha do operário: dados, foto, atestado, ponto, pagamentos e avisos no mesmo fluxo',async({page})=>{
  test.slow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const {commands,getState}=await enter(page,{complete:true,point:true});
  const before=structuredClone(getState());
  let documents=[{id:'atestado-qa',employeeId:'emp',name:'atestado-ficticio.pdf',category:'leave',createdByName:'RH QA',createdAt:'2026-09-25T15:00:00Z'}];
  await page.route('**/api/upload',async route=>{
    const body=route.request().postDataJSON();expect(body.folder).toBe('rh');expect(body.employeeId).toBe('emp');
    if(body.documentAction==='list')return route.fulfill({json:{ok:true,documents}});
    if(body.documentAction==='upload'){
      const document={id:body.documentId,employeeId:body.employeeId,name:body.fileName,category:body.category,createdByName:'RH QA',createdAt:'2026-09-25T15:00:00Z'};documents=[document,...documents];
      return route.fulfill({json:{ok:true,document}});
    }
    return route.fulfill({status:400,json:{ok:false}});
  });
  await page.keyboard.press('Control+k');const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Equipes');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Equipes'}).click();
  await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Ficha de Operário QA'});
  await expect(dialog.getByRole('tab')).toHaveCount(7);await expect(dialog.getByRole('region',{name:'Pendências do operário'})).toBeVisible();
  await dialog.getByRole('tab',{name:'Dados',exact:true}).click();await expect(dialog).toContainText('529.982.247-25');
  await dialog.getByRole('button',{name:'Editar cadastro',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Editar funcionário'});
  await editor.getByLabel('Data de nascimento',{exact:true}).fill('1990-01-20');await editor.getByLabel('E-mail do funcionário',{exact:true}).fill('operario@example.invalid');
  await editor.getByText('Endereço e contato de emergência',{exact:true}).click();await editor.getByLabel('Rua',{exact:true}).fill('Rua de Testes');await editor.getByLabel('Cidade',{exact:true}).fill('Recife');
  await editor.getByLabel('Nome do contato de emergência',{exact:true}).fill('Contato fictício');await editor.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(editor).toHaveCount(0);dialog=page.getByRole('dialog',{name:'Ficha de Operário QA'});
  await dialog.getByRole('tab',{name:'Dados',exact:true}).click();await expect(dialog).toContainText('Rua de Testes');
  await dialog.getByRole('tab',{name:'Documentos e fotos',exact:true}).click();await expect(dialog.getByLabel('Funcionário do prontuário',{exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Abrir atestado-ficticio.pdf',exact:true})).toBeVisible();
  await dialog.getByRole('combobox',{name:'Categoria do documento',exact:true}).selectOption('photo');
  await dialog.getByLabel('Arquivo do prontuário',{exact:true}).setInputFiles({name:'foto-ficticia.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  await dialog.getByRole('button',{name:'Salvar documento',exact:true}).click();await expect(dialog.getByRole('button',{name:'Abrir foto-ficticia.png',exact:true})).toBeVisible();
  await dialog.getByRole('tab',{name:'Ponto',exact:true}).click();await expect(dialog.getByRole('row',{name:/02\/09\/2026/})).toContainText('Falta');
  await dialog.getByRole('tab',{name:'Pagamentos',exact:true}).click();await expect(dialog).toContainText('Adiantamento antigo');await expect(dialog).toContainText('600,00');
  await dialog.getByRole('tab',{name:'Histórico',exact:true}).click();await expect(dialog).toContainText('foto-ficticia.png');
  await dialog.getByRole('tab',{name:'Engenharia',exact:true}).click();await dialog.getByLabel('Título do aviso',{exact:true}).fill('Conferir integração');
  await dialog.getByLabel('Descrição do aviso operacional',{exact:true}).fill('Conferir orientação antes de iniciar a atividade na obra.');
  await dialog.getByRole('button',{name:'Registrar aviso',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Conferir integração · Pendente'})).toBeVisible();
  await dialog.getByLabel('Providência para Conferir integração',{exact:true}).fill('Orientação concluída com o responsável da obra.');await dialog.getByRole('button',{name:'Resolver aviso',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Conferir integração · Resolvido'})).toBeVisible();
  expect(getState().employeeEngineeringRecords[0]).toMatchObject({createdBy:profile.id,status:'resolved',version:2});
  expect(getState().attendance).toEqual(before.attendance);expect(getState().financialSettlements).toEqual(before.financialSettlements);expect(getState().advances).toEqual(before.advances);
  expect(documents).toHaveLength(2);expect(commands).toHaveLength(3);expect(errors).toEqual([]);
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await dialog.screenshot({path:test.info().outputPath('ficha-operario.png')});
});


async function openAttendancePayMode(page){
  await page.keyboard.press("Control+k");const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");await search.fill("ponto");await search.locator("xpath=../..").getByRole("button").filter({hasText:"Gestão do ponto"}).click();
  await page.getByRole("button",{name:"Definir diária ou CLT pelo ponto",exact:true}).click();
  await page.getByRole("combobox",{name:"Funcionário para definir pagamento",exact:true}).selectOption("emp");
}

test("pelo ponto: cadastro incompleto bloqueia e abre a edição do funcionário",async({page})=>{
  const {commands}=await enter(page);await openAttendancePayMode(page);
  await page.getByRole("combobox",{name:"Pagar por",exact:true}).selectOption("daily");
  const dialog=page.getByRole("dialog");await expect(dialog).toContainText("CPF válido");
  await expect(page.getByRole("button",{name:"Salvar modalidade pelo ponto",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Completar cadastro de Operário QA",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Editar funcionário");await expect(page.getByLabel("CBO do funcionário",{exact:true})).toBeVisible();expect(commands).toHaveLength(0);
});

test("pelo ponto: escolhe CLT com cadastro completo e abre o holerite correto",async({page})=>{
  const {commands,getState}=await enter(page,{complete:true});await openAttendancePayMode(page);
  await page.getByRole("combobox",{name:"Pagar por",exact:true}).selectOption("clt");
  await page.getByLabel("Vigência da modalidade pelo ponto",{exact:true}).fill("2026-09-26");await page.getByLabel("Justificativa da modalidade pelo ponto",{exact:true}).fill("Contrato mensal formalizado pelo RH");await page.getByLabel(/^Conferi cadastro, documentação e condições contratuais/).check();
  await page.getByRole("button",{name:"Salvar modalidade pelo ponto",exact:true}).click();
  await expect(page.getByRole("dialog")).toContainText("Modalidade salva. Folhas anteriores e pagamentos preservados.");
  expect(commands).toHaveLength(1);expect(getState().employees[0].remunerationMode).toBe("clt");expect(getState().employees[0].payModeDecisions[0]).toMatchObject({source:"attendance",effectiveFrom:"2026-09-26"});expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.getByRole("dialog").screenshot({path:test.info().outputPath("pagamento-pelo-ponto.png")});
  await page.getByRole("button",{name:"Abrir holerite CLT deste funcionário",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Funcionário do holerite",exact:true})).toHaveValue("emp");await expect(page.getByLabel("Competência mensal",{exact:true})).toHaveValue("2026-09");await expect(page.getByLabel("Salário contratual mensal (R$)",{exact:true})).toHaveValue("2406.8");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});


async function openEmployeeEditor(page){
  await page.keyboard.press("Control+k");const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");await search.fill("Equipes");await search.locator("xpath=../..").getByRole("button").filter({hasText:"Equipes"}).click();await page.getByRole("button",{name:"Editar",exact:true}).first().click();return page.getByRole("dialog");
}

test("editar legado: Salvar sempre visível, zeros mantidos e cadastro sem exigir CLT",async({page})=>{
  await page.setViewportSize(test.info().project.name.includes("mobile")?{width:390,height:640}:{width:900,height:550});
  const {getState}=await enter(page,{legacy:true}),dialog=await openEmployeeEditor(page);
  const save=dialog.getByRole("button",{name:"Salvar",exact:true});
  await expect.poll(async()=>{const b=await save.boundingBox();return !!b&&b.y>=0&&b.y+b.height<=page.viewportSize().height;}).toBe(true);
  await expect(dialog.getByLabel("VT diário",{exact:true})).toHaveValue("0");await expect(dialog.getByLabel("VR diário",{exact:true})).toHaveValue("0");await expect(dialog.getByLabel("Salário mensal para opção CLT",{exact:true})).toHaveValue("");
  await dialog.getByLabel("Telefone",{exact:true}).fill("81988887777");
  await save.click();await expect(dialog).toHaveCount(0);
  expect(getState().employees[0]).toMatchObject({dailyRate:120,vtDaily:0,vrDaily:0,monthlySalary:0});expect(getState().employees[0].phone.replace(/\D/g,"")).toBe("81988887777");expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await page.getByRole("button",{name:"Editar",exact:true}).first().click();await page.getByRole("dialog").screenshot({path:test.info().outputPath("editar-legado-footer.png")});
});

test("editar funcionário reaproveita o perfil salvo e mantém o formulário após falha",async({page})=>{
  const {getState}=await enter(page,{legacy:true,profileOnly:true}),dialog=await openEmployeeEditor(page);
  await expect(dialog.getByLabel("Salário mensal para opção CLT",{exact:true})).toHaveValue("2600");await expect(dialog.getByLabel("Matrícula do funcionário",{exact:true})).toHaveValue("007");await expect(dialog.getByLabel("CBO do funcionário",{exact:true})).toHaveValue("715210");
  await page.route("**/api/data",async route=>{if(route.request().postDataJSON()?.action==="operational-command")return route.fulfill({status:503,json:{ok:false,error:"Falha simulada para conferir preservação"}});return route.fallback();});
  await dialog.getByLabel("Telefone",{exact:true}).fill("81988887777");await dialog.getByRole("button",{name:"Salvar",exact:true}).click();
  await expect(dialog.locator('.employee-edit-feedback[role="alert"]')).toContainText("Falha");await expect(dialog.getByLabel("Salário mensal para opção CLT",{exact:true})).toHaveValue("2600");await expect(dialog.getByRole("button",{name:"Salvar",exact:true})).toBeEnabled();expect(getState().employees[0].monthlySalary).toBe(0);
});


test('quinzena mista: aprova parcela conferida e mostra saldo sem registrar pagamento',async({page})=>{
  const {commands,getState}=await enter(page,{mixedReady:true});
  await page.getByRole('button',{name:'Preparar quinzena',exact:true}).click();
  const section=page.getByRole('region',{name:'Preparar quinzena mista',exact:true});
  await section.getByLabel('Mês do corte',{exact:true}).fill('2026-09');
  await section.getByRole('combobox',{name:'Corte da quinzena mista',exact:true}).selectOption('2');
  await section.locator('summary').filter({hasText:'Parcela CLT'}).click();
  await section.getByLabel('Parcela CLT Operário QA',{exact:true}).fill('700');
  await section.getByLabel('Critério da parcela Operário QA',{exact:true}).fill('Parcela conferida pelo RH');
  await section.getByLabel('Data prevista para pagamento da quinzena',{exact:true}).fill('2026-10-06');
  await section.getByRole('button',{name:'Selecionar demonstrativos sem pendência',exact:true}).click();
  await section.getByRole('checkbox',{name:/Conferi dias, valores/}).check();
  await section.getByRole('button',{name:'Aprovar e encaminhar ao financeiro',exact:true}).click();
  await expect(section.getByRole('status')).toContainText('Fechamento aprovado');
  expect(getState().titulosFolha).toHaveLength(1);expect(getState().titulosFolha[0].liquido).toBe(700);
  expect(getState().pagamentosFolha||[]).toEqual([]);expect(getState().financialSettlements).toEqual([{id:'preservar',amount:600}]);expect(commands).toHaveLength(1);
  await expect(section.getByRole('checkbox',{name:'Selecionar Operário QA clt',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test("quinzena mista: sem ponto recebido não aprova nem cria pagamento",async({page})=>{
  const {commands,getState}=await enter(page);
  await page.getByRole("button",{name:"Preparar quinzena",exact:true}).click();
  const section=page.getByRole("region",{name:"Preparar quinzena mista",exact:true});
  await expect(section).toContainText("06 a 20");await expect(section).toContainText("pendência");
  await section.getByRole("button",{name:"Selecionar demonstrativos sem pendência",exact:true}).click();
  await expect(section.getByRole("button",{name:"Aprovar e encaminhar ao financeiro",exact:true})).toBeDisabled();
  expect(commands).toHaveLength(0);expect(getState().financialSettlements).toEqual([{id:"preservar",amount:600}]);
  await section.screenshot({path:test.info().outputPath("preparar-quinzena.png")});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('CLT por diária: cadastro separado, memória identificada, origem conferida e PDF',async({page})=>{
  test.setTimeout(90_000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const {commands,getState}=await enter(page,{point:true,complete:true,manualDaily:true});
  const dialog=await openEmployeeEditor(page);
  await expect(dialog.getByRole('combobox',{name:'Vínculo contratual',exact:true})).toHaveValue('');
  await dialog.getByRole('combobox',{name:'Vínculo contratual',exact:true}).selectOption('clt');
  await dialog.getByLabel('Vínculo válido a partir de',{exact:true}).fill('2026-09-01');
  await dialog.getByLabel('Motivo da definição ou alteração do vínculo',{exact:true}).fill('Contrato fictício da simulação CLT por diária.');
  await expect(dialog.getByRole('combobox',{name:'Modalidade de remuneração',exact:true})).toHaveValue('daily');
  await expect(dialog).toContainText('Empregado CLT por diária');
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(getState().employees[0]).toMatchObject({employmentRelationship:'clt',remunerationMode:'daily',dailyRate:120,monthlySalary:0});
  expect(getState().employees[0].employmentRelationshipHistory.at(-1)).toMatchObject({date:'2026-09-01',relationship:'clt',changedBy:profile.id});

  await page.keyboard.press('Control+k');
  const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
  await search.fill('Folha');await search.locator('xpath=../..').getByRole('button').filter({hasText:'Folha'}).click();
  await page.getByRole('button',{name:'Holerites CLT',exact:true}).click();
  await page.getByLabel('Competência mensal',{exact:true}).fill('2026-09');
  await page.getByRole('combobox',{name:'Funcionário do holerite',exact:true}).selectOption('emp');
  await expect(page.getByText('Diária contratual de referência: R$ 120,00.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Salário contratual mensal (R$)',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Apuração de INSS e IRRF',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('INSS apurado (R$)',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('FGTS do empregador apurado (R$)',{exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'Exportar holerite PDF',exact:true})).toBeDisabled();

  await page.getByText('Importar ponto aprovado do mês',{exact:true}).click();
  await page.getByRole('combobox',{name:'Tratamento do DSR das faltas',exact:true}).selectOption('none');
  await page.getByLabel('Revisei justificativas, atrasos, compensações, jornada e adicionais da CCT.',{exact:true}).check();
  await page.getByRole('button',{name:'Aplicar ponto ao holerite',exact:true}).click();
  await expect(page.getByLabel('Dias efetivamente trabalhados',{exact:true})).toHaveValue('21');
  await expect(page.getByLabel('Dias efetivamente trabalhados',{exact:true})).toBeDisabled();
  await expect(page.getByLabel('Justificativa para ajustar os eventos manualmente',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Salvar demonstrativo',exact:true}).click();
  await expect(page.locator('.clt-actions').getByRole('status')).toHaveText('Salvo');
  expect(getState().employees[0].cltPayroll.drafts['2026-09']).toMatchObject({assessmentMethod:'manual_daily_clt',confirmed:false,calculated:null});
  await expect(page.getByRole('button',{name:'Exportar holerite PDF',exact:true})).toBeDisabled();

  await page.getByLabel('Referência da apuração',{exact:true}).fill('QA-CCT-DIARIA-2026-09');
  await page.getByLabel('Responsável pela apuração',{exact:true}).fill('Contabilidade fictícia de teste');
  await page.getByLabel('Memória de cálculo',{exact:true}).fill('SIMULAÇÃO: 21 diárias de R$120 totalizam R$2520; descansos e feriado de teste totalizam R$480. INSS250, IRRF0, base2750 e FGTS240 foram informados para este ensaio, sem validação fiscal real.');
  for(const [index,rubric] of [{label:'Diárias trabalhadas',amount:'2520',reference:'21 presenças aprovadas × R$120'},{label:'Descansos e feriado',amount:'480',reference:'Memória fictícia QA-CCT-DIARIA-2026-09'}].entries()){
    await page.getByRole('button',{name:'Adicionar rubrica',exact:true}).click();
    await page.getByLabel(`Descrição da rubrica ${index+1}`,{exact:true}).fill(rubric.label);
    await page.getByLabel(`Valor da rubrica ${index+1} (R$)`,{exact:true}).fill(rubric.amount);
    await page.getByLabel(`Referência da rubrica ${index+1}`,{exact:true}).fill(rubric.reference);
    const row=page.locator('.clt-custom').nth(index);
    for(const incidence of ['INSS','IRRF','FGTS'])await row.getByLabel(`Compõe base ${incidence}`,{exact:true}).check();
  }
  await page.getByLabel('INSS apurado (R$)',{exact:true}).fill('250');
  await page.getByLabel('IRRF apurado (R$)',{exact:true}).fill('0');
  await page.getByLabel('Base do IRRF apurada (R$)',{exact:true}).fill('2750');
  await page.getByLabel('FGTS do empregador apurado (R$)',{exact:true}).fill('240');
  for(const label of [
    'Conferi diárias, vigências, admissão e dias trabalhados.',
    'Conferi DSR, feriados e dias sem trabalho.',
    'Conferi extras, faltas, afastamentos e demais eventos.',
    'Conferi benefícios, elegibilidade e descontos.',
    'Conferi bases, incidências, INSS, IRRF e FGTS.',
    'Conferi pagamentos anteriores, adiantamentos e regime de caixa.',
  ])await page.getByLabel(label,{exact:true}).check();
  await page.getByLabel(/^Confirmo contrato/).check();
  await page.getByRole('button',{name:'Salvar demonstrativo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Exportar holerite PDF',exact:true})).toBeEnabled();
  const saved=getState().employees[0].cltPayroll.drafts['2026-09'];
  expect(saved).toMatchObject({confirmed:true,salary:0,dailyRate:120,workedDays:21,assessmentReference:'QA-CCT-DIARIA-2026-09',calculated:{gross:3000,inss:250,irrf:0,net:2750,fgts:240},manualAssessmentAudit:{reviewedBy:profile.id,reference:'QA-CCT-DIARIA-2026-09'}});
  expect(saved.attendanceSource.signature).toBeTruthy();
  expect(getState().titulosFolha||[]).toEqual([]);expect(getState().pagamentosFolha||[]).toEqual([]);
  expect(getState().financialSettlements).toEqual([{id:'preservar',amount:600}]);
  expect(commands).toHaveLength(3);
  const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'Exportar holerite PDF',exact:true}).click();const report=await opened;
  await report.evaluate(()=>window.__marcellReportReady);
  await expect(report.locator('body')).toContainText('QA-CCT-DIARIA-2026-09');
  await expect(report.locator('body')).toContainText('2.750,00');
  await expect(report.locator('body')).toContainText('não comprova pagamento');
  await report.pdf({path:test.info().outputPath('holerite-clt-diaria.pdf'),preferCSSPageSize:true,printBackground:true});await report.close();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await page.locator('.clt-payslips').screenshot({path:test.info().outputPath('holerite-clt-diaria.png')});
});
