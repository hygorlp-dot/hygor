import { test,expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { buildLaborProjection } from "../server/labor-projection.js";
import { projectionPeriod,dateRange } from "../src/domains/ponto/labor-projection.js";
import { getPayrollHolidays,prIsWeekdayIso } from "../src/domains/ponto/attendance-engine.js";
const instant="2026-10-29T15:00:00Z";
const user={id:"u",authUserId:"auth",nome:"RH de teste",email:"projecao@example.test",role:"rh",accessTabs:["folha","ponto_geral","relat"],active:true};
const employees=[{id:"p",name:"Pessoa de Campo Sintética",role:"Pedreiro",dailyRate:150,obra:"o",startDate:"2025-01-01",active:true},{id:"m",name:"Mestre Sintético",role:"Mestre de obras",dailyRate:200,obra:"o",startDate:"2025-01-01",active:true},{id:"a",name:"Assistente Central Sintética",role:"Assistente",workArea:"administrativo",dailyRate:130,startDate:"2025-01-01",active:true}];
const period=projectionPeriod("2026-10-29");
const attendance=Object.fromEntries(employees.map(employee=>[employee.id,Object.fromEntries(dateRange(period.historyStart,"2026-10-29").filter(day=>prIsWeekdayIso(day)&&!getPayrollHolidays({},Number(day.slice(0,4))).includes(day)).map((day,index)=>[day,{status:index%10===0?"F":"P",obraId:employee.obra||""}]))]));
const data={usuarios:[user],employees,obras:[{id:"o",name:"Obra Sintética",status:"active",contractType:"admin_only"}],attendance,config:{companyName:"MARCELL"},advances:[],changeLog:[]};
async function navigate(page,label){await page.keyboard.press("Control+k");const search=page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");await search.fill(label);await search.locator("xpath=../..").getByRole("button").filter({hasText:label}).first().click();}

test("projeção, grupos, exportações e ponto usam escopo consistente",async({page},testInfo)=>{
 mkdirSync("output/pdf",{recursive:true});
 let snapshot;
 await page.clock.setFixedTime(new Date(instant));
 await page.route("**/api/**",route=>route.fulfill({json:{ok:true,items:[],presencas:[]}}));
 await page.route("**/api/data",async route=>{
  const body=route.request().postDataJSON()||{};
  if(body.action==="profiles")return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(body.action==="labor-fortnight-projection"){snapshot=buildLaborProjection({data,user,filters:body.filters,instant,sourceVersion:"e2e"});return route.fulfill({json:snapshot});}
  return route.fulfill({json:{ok:true,usuario:user,accessToken:"synthetic",refreshToken:"synthetic",data,updatedAt:instant}});
 });
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await page.locator("#login-email").fill(user.email);await page.locator("#login-senha").fill("teste");await page.getByRole("button",{name:"Acessar central MARCELL"}).click();await expect(page.locator("#login-email")).toHaveCount(0);
 await navigate(page,"Folha");
 const group=page.getByRole("region",{name:"Grupo da equipe"});
 await group.getByRole("button",{name:"Administração Central",exact:true}).click();
 await expect(page.locator(".payroll-workspace")).not.toContainText("Pessoa de Campo Sintética");
 await page.getByRole("button",{name:"Projeção de mão de obra",exact:true}).click();
 const report=page.getByRole("region",{name:"Projeção de mão de obra"});
 await expect(report).toContainText("2026-10-Q2");await expect(report).toContainText("21/07/2026 a 20/10/2026");
 await expect(report).toHaveAttribute("aria-busy","false");
 expect(snapshot.people.map(person=>person.id)).toEqual(["m","a"]);
 expect(await report.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 await report.getByText("Memória de cálculo e qualidade do histórico",{exact:true}).click();
 await expect(report).toContainText("Mestre Sintético");await expect(report).not.toContainText("Pessoa de Campo Sintética");
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({fullPage:true,path:`output/pdf/projecao-${testInfo.project.name}.png`});
 const download=page.waitForEvent("download");await report.getByRole("button",{name:"Excel",exact:true}).click();expect((await download).suggestedFilename()).toContain(snapshot.version);
 const popupPromise=page.waitForEvent("popup");await report.getByRole("button",{name:"PDF",exact:true}).click();const popup=await popupPromise;await popup.evaluate(()=>window.__marcellReportReady);
 await expect(popup.locator("body")).toContainText(snapshot.version);await expect(popup.locator("body")).toContainText("Mestre Sintético");await expect(popup.locator("body")).not.toContainText("Pessoa de Campo Sintética");if(testInfo.project.name.endsWith("desktop"))await popup.pdf({path:"output/pdf/projecao-quinzena-sintetica.pdf",preferCSSPageSize:true,printBackground:true});await popup.close();
 await navigate(page,"Gestão do ponto");await page.getByRole("region",{name:"Grupo da equipe"}).getByRole("button",{name:"Administração Central",exact:true}).click();
 await expect(page.locator(".ponto-geral-table")).toContainText("Mestre Sintético");await expect(page.locator(".ponto-geral-table")).not.toContainText("Pessoa de Campo Sintética");
 await navigate(page,"Relatórios");await page.getByRole("button",{name:"Projeção de mão de obra",exact:true}).click();await expect(page.getByRole("region",{name:"Projeção de mão de obra"})).toContainText("2026-10-Q2");
});
