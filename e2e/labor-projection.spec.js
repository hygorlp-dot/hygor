import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { buildLaborProjection } from "../src/domains/ponto/labor-projection.js";
import { buildLaborProjectionCash } from "../src/domains/ponto/labor-projection-cash.js";
import { getLaborProjectionAccess, sanitizeLaborProjectionReport, validateLaborProjectionFilters } from "../server/labor-projection.js";
import { projectDataForUser } from "../server/data-projection.js";

const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const makeData = profile => {
  const employees = [
    { id: "daily", name: "Pessoa de campo QA", role: "Pedreiro", obra: "work", workArea: "campo", remunerationMode: "daily", dailyRate: 150, active: true, startDate: "2026-01-01" },
    { id: "admin", name: "Pessoa administrativa QA", role: "Assistente", obra: "", workArea: "administrativo", remunerationMode: "clt", monthlySalary: 3000, vtDaily: 10, active: true, startDate: "2026-01-01" },
    { id: "new", name: "Pessoa recém admitida QA", role: "Servente", obra: "work", workArea: "campo", remunerationMode: "daily", dailyRate: 100, active: true, startDate: "2026-10-27" },
  ];
  const attendance = { daily: {}, admin: {}, new: {} };
  for (let date = new Date("2026-07-21T12:00:00Z"); date.toISOString().slice(0, 10) <= "2026-10-28"; date.setUTCDate(date.getUTCDate() + 1)) {
    if ([0, 6].includes(date.getUTCDay())) continue;
    const iso = date.toISOString().slice(0, 10);
    attendance.daily[iso] = { status: iso < "2026-10-21" && date.getUTCDate() === 23 ? "F" : "P", obraId: "work", ot: 0 };
    attendance.admin[iso] = { status: "P", ot: 0 };
  }
  attendance.new["2026-10-27"] = { status: "P", obraId: "work", ot: 0 };
  return { usuarios: [profile], obras: [{ id: "work", name: "Obra Primavera QA", status: "active", contractType: "empreitada" }],
    employees, attendance, config: { companyName: "Empresa de teste", paymentHolidays: [] },
    advances: [], titulosFolha: [], pagamentosFolha: [], attendanceLocks: {}, unlockRequests: [], changeLog: [] };
};

async function enter(page, role) {
  const profile = { id: `qa-${role}`, nome: "Gestor QA", email: `${role}@qa.test`, role, active: true };
  const data = makeData(profile), original = JSON.stringify(data), requests = [], errors = [];
  let snapshot, failNext = false;
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-29T15:00:00Z"));
  await page.context().addInitScript(() => { window.print = () => {}; });
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true, items: [], presencas: [] } }));
  await page.route("**/api/data", route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "profiles") return route.fulfill({ json: { precisaSetup: false } });
    if (body.action === "labor-projection-report") {
      requests.push(body);
      if (failNext) { failNext = false; return route.fulfill({ status: 409, json: { error: "Os dados mudaram durante a consulta. Atualize a projeção." } }); }
      const access = getLaborProjectionAccess(profile, data);
      const filters = validateLaborProjectionFilters(body.filters, access, data);
      const report = buildLaborProjection(data, { asOf: "2026-10-29", generatedAt: "2026-10-29T15:00:00Z",
        timeZone: "America/Bahia", access, filters, includeCashBasis: true });
      report.sourceVersion = "fonte-sintetica-verificada";
      report.cash = buildLaborProjectionCash(data, report, { access });
      snapshot = sanitizeLaborProjectionReport(report, access);
      return route.fulfill({ json: { ok: true, report: snapshot } });
    }
    return route.fulfill({ json: { ok: true, accessToken: "isolated-access", refreshToken: "isolated-refresh",
      usuario: profile, data: projectDataForUser(data, profile), updatedAt: "2026-10-29T12:00:00Z" } });
  });
  await page.goto("/");
  await page.locator("#login-email").fill(profile.email);
  await page.locator("#login-senha").fill("isolated-password");
  await page.getByRole("button", { name: "Acessar central MARCELL" }).click();
  await expect(page.locator("#login-email")).toHaveCount(0);
  return { requests, errors, snapshot: () => snapshot, unchanged: () => JSON.stringify(data) === original, fail: () => { failNext = true; } };
}

async function navigate(page, label) {
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill(label);
  await search.locator("xpath=../..").getByRole("button").filter({ hasText: label }).first().click();
}

test("RH consulta a quinzena, filtra e exporta a mesma fotografia em PDF e Excel", async ({ page, context }, testInfo) => {
  const app = await enter(page, "rh");
  await navigate(page, "Folha");
  await page.getByRole("button", { name: "Projeção da quinzena", exact: true }).click();
  const report = page.getByRole("region", { name: "Projeção de mão de obra", exact: true });
  await expect(report.getByRole("heading", { name: "Projeção de mão de obra", exact: true })).toBeVisible();
  await expect(report).toContainText("21/10/2026 a 05/11/2026");
  await expect(report).toContainText("21/07/2026 a 20/10/2026");
  await expect(report.locator('[data-metric="projectedCost"]')).toHaveText(money(app.snapshot().totals.projectedCost));
  await expect(report).toContainText("Subtotal parcial");
  await expect(page.getByRole("combobox", { name: "Ciclo da folha", exact: true })).toHaveCount(0);
  await report.getByRole("button", { name: "Ver memória de Pessoa de campo QA", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Memória de Pessoa de campo QA" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("table").last()).toContainText("Encargos incluídos");
  expect(await dialog.evaluate(element => {
    const color = getComputedStyle(element).backgroundColor;
    const box = element.getBoundingClientRect();
    return color !== "transparent" && !/rgba\([^)]*,\s*0(?:\.\d+)?\)$/.test(color)
      && box.left >= 0 && box.right <= innerWidth + 1;
  })).toBe(true);
  await dialog.screenshot({ path: testInfo.outputPath("memoria-da-projecao.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(report.getByRole("button", { name: "Ver memória de Pessoa de campo QA", exact: true })).toBeFocused();
  await report.getByRole("combobox", { name: "Área", exact: true }).selectOption("administrative");
  await expect(report).toContainText("Filtros em edição");
  const callsBeforeExport = app.requests.length;
  const popupEvent = context.waitForEvent("page");
  await report.getByRole("button", { name: "PDF", exact: true }).click();
  const popup = await popupEvent;
  await expect(popup.locator("body")).toContainText("Pessoa de campo QA");
  await expect(popup.locator("body")).toContainText(money(app.snapshot().totals.projectedCost));
  await expect(popup.locator("body")).toContainText("fonte-sintetica-verificada");
  await popup.evaluate(() => window.__marcellReportReady);
  await popup.pdf({ path: testInfo.outputPath("projecao-quinzena.pdf"), preferCSSPageSize: true, printBackground: true });
  await popup.close();
  const downloadEvent = page.waitForEvent("download");
  await report.getByRole("button", { name: "Excel", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain("2026-10-Q2");
  const file = testInfo.outputPath("projecao-quinzena.xlsx");
  await download.saveAs(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  expect(workbook.worksheets).toHaveLength(6);
  const values = workbook.getWorksheet("Resumo").getSheetValues();
  expect(values.some(row => row?.[1] === "Subtotal parcial de custo" && row[2] === app.snapshot().totals.projectedCost)).toBe(true);
  expect(app.requests).toHaveLength(callsBeforeExport);
  await report.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(report.getByRole("button", { name: "Ver memória de Pessoa administrativa QA", exact: true })).toBeVisible();
  await expect(report.getByRole("button", { name: "Ver memória de Pessoa de campo QA", exact: true })).toHaveCount(0);
  expect(app.snapshot().filters.area).toBe("administrative");
  await expect(report.locator('[data-metric="projectedCost"]')).toHaveText(money(app.snapshot().totals.projectedCost));
  app.fail();
  await report.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(report.getByRole("alert")).toContainText("Os dados mudaram durante a consulta");
  await expect(report.locator('[data-metric="projectedCost"]')).toHaveText(money(app.snapshot().totals.projectedCost));
  await report.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(report.getByRole("alert")).toHaveCount(0);
  await report.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(report.getByRole("button", { name: "Ver memória de Pessoa de campo QA", exact: true })).toBeVisible();
  expect(await report.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await report.screenshot({ path: testInfo.outputPath("projecao-quinzena.png") });
  await page.evaluate(() => { document.querySelector("main")?.scrollTo(0, 0); window.scrollTo(0, 0); });
  await page.screenshot({ path: testInfo.outputPath("projecao-visao-inicial.png") });
  expect(app.unchanged()).toBe(true);
  expect(app.errors).toEqual([]);
});

test("Financeiro acessa Relatórios e exporta só agregados sem abrir a Folha", async ({ page, context }, testInfo) => {
  const app = await enter(page, "financeiro");
  await navigate(page, "Relatórios");
  await page.getByRole("button", { name: "Projeção de mão de obra", exact: true }).click();
  const report = page.getByRole("region", { name: "Projeção de mão de obra", exact: true });
  await expect(report).toContainText("Este perfil consulta valores agregados");
  await expect(report.getByRole("combobox", { name: "Pessoa", exact: true })).toHaveCount(0);
  await expect(report).not.toContainText("Pessoa de campo QA");
  await report.getByRole("button", { name: "Memória de cálculo", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toContainText("Pessoa de campo QA");
  await page.keyboard.press("Escape");
  const popupEvent = context.waitForEvent("page");
  await report.getByRole("button", { name: "PDF", exact: true }).click();
  const popup = await popupEvent;
  await expect(popup.locator("body")).toContainText("detalhe individual e a memória diária são restritos");
  await expect(popup.locator("body")).not.toContainText("Pessoa de campo QA");
  await popup.close();
  expect(await report.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await report.screenshot({ path: testInfo.outputPath("projecao-financeiro.png") });
  expect(app.unchanged()).toBe(true);
  expect(app.errors).toEqual([]);
});
