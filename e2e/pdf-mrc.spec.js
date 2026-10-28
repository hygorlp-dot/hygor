import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve("output/pdf");
test.beforeAll(() => mkdirSync(output, { recursive: true }));

test("relatório A4 repete a marca d'água MRC sem alterar o conteúdo", async ({ page }) => {
  await page.route("**/api/**", r => r.fulfill({ json: {} }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const html = await page.evaluate(async () => {
    const { marcellReportHtml } = await import("/src/reports/marcell-report.js");
    return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><title>Relatório de verificação MRC</title><style>@page{size:A4 portrait;margin:15mm}section+section{break-before:page}td,th{padding:12px}</style></head><body><h1>ArcD Construtech</h1><section><h2>Relatório de verificação - dados fictícios</h2><p>CNPJ: 00.000.000/0001-00</p><table><tr><th>Descrição</th><th>Valor</th></tr><tr><td>Serviço de teste</td><td>R$ 1.234,56</td></tr></table></section><section><h2>Segunda página - dados fictícios</h2><p>Conferência do monograma em todas as páginas.</p><footer>Gerado por ArcD Obras</footer></section></body></html>`);
  });
  await page.setContent(html);
  await page.evaluate(() => window.__marcellReportReady);
  await expect(page.locator("body")).not.toContainText(/ArcD Construtech|ArcD Obras/i);
  await expect(page.locator(".mrc-report-watermark img")).toBeVisible();
  await page.pdf({ path: resolve(output, "mrc-relatorio-a4-teste.pdf"), preferCSSPageSize: true, printBackground: true });
});

test("exportação real da folha remove a assinatura antiga salva na configuração", async ({ page, context }) => {
  const user = { id: "pdf-admin", nome: "QA", email: "pdf@teste.local", role: "admin", active: true };
  const employees = Array.from({ length: 41 }, (_, i) => ({ id: `p${i}`, name: `Funcionário de teste ${String(i + 1).padStart(2, "0")}`, role: i % 2 ? "Servente" : "Pedreiro", dailyRate: i % 2 ? 100 : 160 }))
    .map(e => ({ ...e, obra: "o1", active: true, startDate: "2026-01-01", pixKey: "teste", remunerationMode: "daily" }));
  const attendance = Object.fromEntries(employees.map(e => [e.id, Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-10-${i + 21}`, { status: "P", obraId: "o1", ot: 0 }]))]));
  const config = { companyName: "ArcD Construtech", cnpj: "00.000.000/0001-00", paymentHolidays: [] };
  const state = { usuarios: [user], obras: [{ id: "o1", name: "Obra de teste", status: "active" }], employees, attendance, config };
  await context.addInitScript(() => { window.print = () => {}; });
  await page.clock.setFixedTime(new Date("2026-10-28T12:00:00-03:00"));
  await page.route("**/api/**", r => r.fulfill({ json: { ok: true, presencas: [], items: [] } }));
  await page.route("**/api/data", async route => {
    const b = route.request().postDataJSON() || {};
    if (b.action === "profiles") return route.fulfill({ json: { usuarios: [user], precisaSetup: false } });
    return route.fulfill({ json: { ok: true, usuario: user, accessToken: "pdf-test", refreshToken: "test", data: state, updatedAt: "2026-10-28T12:00:00Z" } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(user.email); await page.locator("#login-senha").fill("teste");
  await page.getByRole("button", { name: "Acessar central MARCELL" }).click();
  await expect(page.locator("#login-email")).toHaveCount(0);
  await page.keyboard.press("Control+k");
  const busca = page.getByPlaceholder("Buscar obra, lead, pedido, funcionário, tela...");
  await busca.fill("Folha");
  await busca.locator("xpath=../..").getByRole("button").filter({ hasText: "Folha" }).click();
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Gerar PDF", exact: true }).click();
  const report = await popup;
  await report.evaluate(() => window.__marcellReportReady);
  await expect(report.locator("body")).not.toContainText(/ArcD Construtech|ArcD Obras/i);
  await expect(report.locator("body")).toContainText("Folha de Pagamento");
  await expect(report.locator("body")).toContainText("00.000.000/0001-00");
  await expect(report.locator("table").first().locator("tbody tr")).toHaveCount(41);
  await expect(report.locator(".mrc-report-watermark")).toHaveCount(1);
  expect(config.companyName).toBe("ArcD Construtech");
  await report.pdf({ path: resolve(output, "mrc-folha-a3-teste.pdf"), preferCSSPageSize: true, printBackground: true });
  await report.close();
});
