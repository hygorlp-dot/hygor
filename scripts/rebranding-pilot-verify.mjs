import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { profile, data } from "./fixtures/rebranding-pilot-data.mjs";

const destination = "artifacts/rebranding-pilot";
await mkdir(destination, { recursive:true });
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
const errors = [], commands = [], metrics = [];
page.on("pageerror", error => errors.push(error.message));
await page.clock.setFixedTime(new Date("2026-10-30T12:00:00-03:00"));
await page.route("https://**/*", route => route.abort());
await page.route("**/api/**", route => route.fulfill({ json:{ ok:true, items:[], bases:[], presencas:[] } }));
await page.route("**/api/data", route => {
  const body = route.request().postDataJSON() || {};
  if (body.action === "profiles") return route.fulfill({ json:{ usuarios:[profile], precisaSetup:false } });
  if (body.action === "operational-command") commands.push(body.command);
  if (["financial-dre-report", "financial-company-dre-report"].includes(body.action)) return route.fulfill({ json:{ ok:true, current:null, history:[] } });
  return route.fulfill({ json:{ ok:true, items:[], bases:[], accessToken:"isolated-pilot", refreshToken:"isolated-pilot", usuario:profile, data, updatedAt:"2026-10-30T15:00:00Z" } });
});

async function open(label, heading) {
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await search.fill(label);
  await search.locator("xpath=../..").getByRole("button").filter({ hasText:label }).first().click();
  await page.getByRole("heading", { name:heading, exact:true }).first().waitFor();
}
async function capture(name, marker) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator(".arcd-app-shell").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const bounds = marker ? await marker.boundingBox() : null;
  const layout = await page.evaluate(() => ({
    viewport:innerWidth, overflow:document.documentElement.scrollWidth > innerWidth + 1,
    pageTitles:document.querySelectorAll('main h1').length,
  }));
  assert.equal(layout.overflow, false, `${name}: page overflow`);
  assert.equal(layout.pageTitles, 1, `${name}: one page title`);
  metrics.push({ name, ...layout, firstWorkRowY:bounds ? Math.round(bounds.y) : null });
  await page.screenshot({ path:`${destination}/${name}.png`, fullPage:false });
}

try {
  await page.goto(process.env.PILOT_URL || "http://127.0.0.1:4195");
  await page.locator("#login-email").fill(profile.email);
  await page.locator("#login-senha").fill("isolated-review");
  await page.getByRole("button", { name:"Acessar central MARCELL" }).click();
  await page.getByRole("heading", { name:"Visão gerencial", exact:true }).waitFor();
  await capture("dashboard-desktop", page.locator(".gav-linha:not(.gav-linha--cabecalho)").first());
  await page.getByRole("button", { name:"Mês anterior", exact:true }).click();
  assert.match(await page.locator(".workspace-period").innerText(), /Setembro/i);
  await page.getByRole("button", { name:"Próximo mês", exact:true }).click();
  await page.getByText("Resumo financeiro e comercial", { exact:true }).click();
  assert.equal(await page.getByRole("heading", { name:"Resumo financeiro", exact:true }).isVisible(), true);
  await page.getByText("Resumo financeiro e comercial", { exact:true }).click();

  await open("Compras", "Compras");
  await page.locator(".purchase-queue-table tbody tr").first().waitFor();
  await capture("compras-desktop", page.locator(".purchase-queue-table tbody tr").first());
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await capture("compras-zoom-200", page.locator(".purchase-queue-table tbody tr").first());
  await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
  await page.setViewportSize({ width:390, height:844 });
  await capture("compras-mobile", page.locator(".purchase-queue-table tbody tr").first());
  await page.getByRole("button", { name:/^Filtros/ }).click();
  await page.getByRole("combobox", { name:"Prazo", exact:true }).selectOption("overdue");
  await page.getByRole("button", { name:/^Filtros/ }).click();
  assert.equal(await page.getByRole("combobox", { name:"Prazo", exact:true }).isVisible(), false);
  await page.getByRole("combobox", { name:"Fluxo de compras", exact:true }).selectOption("cotacoes");
  await page.getByRole("combobox", { name:"Fluxo de compras", exact:true }).selectOption("fila");
  await page.getByRole("button", { name:/^Filtros/ }).click();
  assert.equal(await page.getByRole("combobox", { name:"Prazo", exact:true }).inputValue(), "overdue");
  await page.getByRole("button", { name:/^Filtros/ }).click();
  await page.setViewportSize({ width:320, height:844 });
  await capture("compras-320", page.locator(".purchase-queue-table tbody tr").first());

  await page.setViewportSize({ width:1440, height:1000 });
  await open("Gestão financeira", "Financeiro");
  await page.getByRole("button", { name:"Ver memorial", exact:true }).first().waitFor();
  await capture("financeiro-desktop", page.locator(".finance-today__row").first());
  await page.getByRole("button", { name:"Ver memorial", exact:true }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name:"Obra", exact:true }).selectOption("a");
  await page.getByRole("navigation", { name:"Áreas do financeiro", exact:true }).getByRole("button", { name:"Visão financeira", exact:true }).click();
  await page.locator(".financial-summary").waitFor();
  await capture("financeiro-visao-desktop", page.locator(".financial-summary"));
  await page.getByRole("navigation", { name:"Áreas do financeiro", exact:true }).getByRole("button", { name:"Hoje", exact:true }).click();
  assert.equal(await page.getByRole("combobox", { name:"Obra", exact:true }).inputValue(), "a");
  await page.setViewportSize({ width:390, height:844 });
  await capture("financeiro-mobile", page.locator(".finance-today__row").first());
  await page.getByRole("combobox", { name:"Fila de vencimentos", exact:true }).selectOption("receiveToday");
  assert.equal(await page.locator(".finance-today__empty").isVisible(), true);
  await page.getByRole("combobox", { name:"Fila de vencimentos", exact:true }).selectOption("payToday");
  await page.getByRole("combobox", { name:"Áreas do financeiro", exact:true }).selectOption("visao");
  await page.locator(".financial-summary").waitFor();
  await capture("financeiro-visao-mobile", page.locator(".financial-summary"));
  await page.getByRole("combobox", { name:"Áreas do financeiro", exact:true }).selectOption("hoje");
  await page.setViewportSize({ width:320, height:844 });
  await capture("financeiro-320", page.locator(".finance-today__row").first());
  await page.setViewportSize({ width:1024, height:900 });
  await capture("financeiro-tablet", page.locator(".finance-today__row").first());
  await page.setViewportSize({ width:1440, height:1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await capture("financeiro-zoom-200", page.locator(".finance-today__row").first());
  await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
  await page.setViewportSize({ width:390, height:844 });
  await open("Dashboard", "Visão gerencial");
  await capture("dashboard-mobile", page.locator(".dashboard-mission-rows > button").first());
  await page.getByRole("button", { name:"Mais indicadores", exact:true }).click();
  assert.equal(await page.locator('.dashboard-executive-grid > span').nth(7).isVisible(), true);
  await page.getByRole("button", { name:"Menos indicadores", exact:true }).click();
  await page.setViewportSize({ width:320, height:844 });
  await capture("dashboard-320", page.locator(".dashboard-mission-rows > button").first());
  assert.equal(await page.locator('.mobile-subnav').count(), 0);
  await page.getByRole("combobox", { name:"Telas de Visão gerencial", exact:true }).selectOption("dre_emp");
  await page.locator('.arcd-app-shell[data-tab="dre_emp"]').waitFor();
  assert.deepEqual(errors, [], "No runtime errors");
  assert.deepEqual(commands, [], "Visual inspection must not issue business commands");
  await writeFile(`${destination}/verification.json`, JSON.stringify({ passed:true, errors, commands, metrics }, null, 2));
  console.log(JSON.stringify({ passed:true, metrics }, null, 2));
} finally { await browser.close(); }
