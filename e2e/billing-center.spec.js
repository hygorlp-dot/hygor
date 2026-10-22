import { expect, test } from "@playwright/test";
import { buildBillingData } from "../src/domains/equipamentos/billing-dashboard.fixture.js";
import { applyOperationalCommand } from "../src/domains/sync/operational-commands.js";

// Central de cobranças (aba "Cobrança por obra"): fluxo real na tela - trocar
// competência, filtrar, seguir uma pendência, abrir a memória da obra,
// alternar propriedade, abrir o PDF e exportar - e layout em 3 larguras.
// Relógio fixo em 15/09/2026. RENTALS_SHOTS=<pasta> grava capturas.

const PROFILE = { id:"qa-admin", nome:"Administrador QA", email:"qa-admin@arcd.test", role:"admin", active:true };
const SHOTS = process.env.RENTALS_SHOTS || "";

async function abrirCentral(page) {
  await page.clock.setFixedTime(new Date("2026-09-15T12:00:00-03:00"));
  let state = { usuarios:[PROFILE], attendance:{}, attendanceLocks:{}, unlockRequests:[], dailyCheckDate:"", changeLog:[], config:{ paymentHolidays:[] }, ...buildBillingData() };
  await page.route("**/api/**", route => route.fulfill({ json:{ ok:true, status:200, presencas:[], reply:"" } }));
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === "profiles") return route.fulfill({ json:{ usuarios:[PROFILE], precisaSetup:false } });
    if (body.action === "auth-refresh") return route.fulfill({ json:{ accessToken:"qa-access", refreshToken:"qa-refresh" } });
    if (body.action === "operational-command") {
      const result = applyOperationalCommand(state, body.command, "2026-09-15T12:00:00.000Z");
      if (result.ok) state = result.data;
      return route.fulfill({ json:{ ...result, updatedAt:"2026-09-15T12:00:00.000Z" } });
    }
    return route.fulfill({ json:{ ok:true, accessToken:"qa-access", refreshToken:"qa-refresh", usuario:PROFILE, data:state, updatedAt:"2026-09-01T00:00:00.000Z" } });
  });
  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button", { name:"Acessar central ARCD" }).click();
  await expect(page.getByText("Administrador QA").first()).toBeVisible();
  const sidebar = page.locator(".arcd-sidebar");
  const group = sidebar.locator(".nav-grp-hd").filter({ hasText:/^Financeiro/ });
  const body = group.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  if (!await body.isVisible()) await group.click();
  await body.locator(".nav-item").filter({ hasText:/^Locação de equipamentos$/ }).click();
  await page.getByRole("button", { name:/^Cobrança por obra/ }).click();
  await expect(page.getByRole("heading", { name:"Central de cobranças" })).toBeVisible();
}

const term = (page, label) => page.locator(".bc-term").filter({ has:page.locator("dt", { hasText:new RegExp(`^${label}`) }) }).first();

test("cobrança ao cliente: edição salva, PDF atualizado da obra e total alinhado", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await abrirCentral(page);
  await expect(page.getByRole("button", { name:"PDF de cobrança ao cliente", exact:true })).toBeDisabled();
  await page.getByLabel("Obra", { exact:true }).selectOption("ob-a");
  await page.getByRole("tab", { name:"Por obra" }).click();
  await page.getByRole("button", { name:"Abrir memória da obra Terras Alpha" }).click();
  const row = page.locator(".bc-memory tbody tr").filter({ hasText:"Andaime tubular" });
  await row.getByRole("button", { name:"Editar", exact:true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Quantidade para esta obra *", { exact:true }).fill("1");
  await modal.getByRole("button", { name:"Salvar locação", exact:true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".bc-memory .bc-term").filter({ has:page.locator("dt", { hasText:/^Receita líquida/ }) })).toContainText("R$ 1.850,00");
  await page.getByRole("tab", { name:"Visão geral" }).click();
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name:"PDF de cobrança ao cliente", exact:true }).click();
  const report = await opened;
  await expect(report.locator("body")).toContainText("Relatório de cobrança de equipamentos");
  await expect(report.locator("body")).toContainText("Terras Alpha");
  await expect(report.locator("body")).not.toContainText("Oásis Home Park");
  await expect(report.locator(".kpis")).toContainText("R$ 1.850,00");
  await expect(report.locator("thead")).not.toContainText(/Repasse|Margem|Resultado/);
  await expect(report.locator("tfoot td")).toHaveCount(12);
  await expect(report.locator("tfoot td").last()).toContainText("R$ 1.850,00");
  const pdf = await report.pdf({ path:test.info().outputPath("cobranca-cliente.pdf"), preferCSSPageSize:true, printBackground:true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  await report.screenshot({ path:test.info().outputPath("cobranca-cliente.png"), fullPage:true });
  await report.close();
  expect(errors).toEqual([]);
});

test("central de cobranças: competência, filtros, pendência, memória, PDF e exportação", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await abrirCentral(page);

  // 3. KPIs da competência atual (equação financeira)
  await expect(term(page, "Receita líquida")).toContainText("R$ 6.100,00");
  await expect(term(page, "Resultado")).toContainText("R$ 4.350,00");
  await expect(page.getByText("As faturas ainda não alimentam o DRE.", { exact:false })).toBeVisible();

  // 2. trocar competência
  await page.getByLabel("Competência", { exact:true }).selectOption("2026-08");
  await expect(term(page, "Receita líquida")).toContainText("R$ 1.600,00");
  await page.getByLabel("Competência", { exact:true }).selectOption("2026-09");
  await expect(term(page, "Receita líquida")).toContainText("R$ 6.100,00");

  // 4. filtrar obra
  await page.getByLabel("Obra", { exact:true }).selectOption("ob-a");
  await expect(term(page, "Receita líquida")).toContainText("R$ 1.950,00");
  await expect(term(page, "Custo total")).toContainText("só repasses");
  await page.getByRole("button", { name:"Limpar filtros" }).click();

  // 5. abrir pendência (desconto elevado)
  await page.getByRole("button", { name:"Ver: 1 desconto elevado (≥ 20%)" }).click();
  await expect(page.getByRole("tab", { name:"Por obra" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".bc-table tbody tr")).toHaveCount(1);

  // 6. abrir detalhe (memória) da obra e 7. voltar
  await page.getByRole("button", { name:"Abrir memória da obra Oásis Home Park" }).click();
  await expect(page.locator(".bc-memory")).toContainText("Desconto elevado");
  await page.getByRole("button", { name:"Voltar ao ranking" }).click();
  await expect(page.locator(".bc-memory")).toHaveCount(0);
  await page.getByRole("button", { name:"Limpar filtros" }).click();
  await page.getByRole("tab", { name:"Visão geral" }).click();

  // 8. alternar próprios / terceiros
  await page.getByLabel("Propriedade", { exact:true }).selectOption("terceiros");
  await expect(term(page, "Resultado")).toContainText("R$ 0,00");
  await page.getByLabel("Propriedade", { exact:true }).selectOption("proprios");
  await expect(term(page, "Resultado")).toContainText("R$ 4.350,00");
  await page.getByLabel("Propriedade", { exact:true }).selectOption("all");

  // 9. abrir relatório PDF (documento separado, gerado como antes)
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name:"Relatório gerencial PDF" }).click();
  const popup = await popupPromise;
  await expect(popup.locator("body")).toContainText("Setembro 2026");
  await popup.close();

  // 10. exportar dados
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name:"Exportar dados" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
  expect(pageErrors).toEqual([]);
});

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
  test(`layout da central de cobranças em ${width}px`, async ({ page }) => {
    await abrirCentral(page);
    await page.setViewportSize({ width, height });
    const overflow = async () => page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      tables: [...document.querySelectorAll(".bc .bc-table-wrap")].map(wrap => wrap.scrollWidth - wrap.clientWidth).filter(value => value > 0).length,
    }));
    expect(await overflow()).toEqual({ page: 0, tables: 0 });
    const style = await page.addStyleTag({ content:".bc, .bc *{font-family:Verdana,'DejaVu Sans',sans-serif!important}.bc .bc-mono{font-family:'Courier New','DejaVu Sans Mono',monospace!important}" });
    expect((await overflow()).page, "página com fontes de fallback largas").toBeLessThanOrEqual(0);
    await style.evaluate(node => node.remove());

    if (SHOTS) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator(".bc").screenshot({ path:`${SHOTS}/cobranca-${width}.png` });
      if (width === 1440) {
        await page.getByRole("tab", { name:"Por obra" }).click();
        await page.locator(".bc").screenshot({ path:`${SHOTS}/cobranca-obras.png` });
        await page.getByRole("button", { name:"Abrir memória da obra Oásis Home Park" }).click();
        await page.locator(".bc").screenshot({ path:`${SHOTS}/cobranca-memoria.png` });
        await page.getByRole("tab", { name:"Visão geral" }).click();
        await page.getByLabel("Obra", { exact:true }).selectOption("ob-a");
        await page.getByLabel("Buscar", { exact:true }).fill("betoneira");
        await page.locator(".bc").screenshot({ path:`${SHOTS}/cobranca-sem-pendencia.png` });
        await page.getByLabel("Competência", { exact:true }).selectOption("2026-03");
        await page.locator(".bc").screenshot({ path:`${SHOTS}/cobranca-sem-dados.png` });
      }
    }
  });
}
