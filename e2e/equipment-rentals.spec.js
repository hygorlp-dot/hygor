import { expect, test } from "@playwright/test";
import { buildRentalData } from "../src/domains/equipamentos/rental-operations.fixture.js";

// Central operacional de locações (aba "Locações"): integração com a tela
// real - filtros, menu, detalhe e os modais/confirmações que já existiam - e
// verificação de layout em três larguras. O relógio do navegador é fixado em
// 15/09/2026 para o mês, as contagens e o "vence em N dias" não dependerem do
// dia em que o teste roda. Com RENTALS_SHOTS=<pasta> grava capturas de tela.

const PROFILE = { id:"qa-admin", nome:"Administrador QA", email:"qa-admin@arcd.test", role:"admin", active:true };
const SHOTS = process.env.RENTALS_SHOTS || "";

const estado = () => {
  const data = buildRentalData();
  data.obras.push({ id:"ob-long", name:"Residencial Terras Alpha Etapa II · Condomínio Fechado Bloco C", code:"K9-12", status:"active" });
  data.equipamentos.push({
    id:"eq-long", nome:"PLATAFORMA ELEVATÓRIA TESOURA 12 M DIESEL COM ESTABILIZADORES E KIT DE SEGURANÇA NR-18",
    patrimonio:"EQ-0999", categoria:"Acesso", proprietarioId:"own-1", quantidadeTotal:30, tarifas:{ dia:12500, semana:60000, quinzena:110000, mes:200000 }, ativo:true,
  });
  // Massa para densidade/paginação: 40 locações curtas em agosto/setembro.
  for (let i = 0; i < 40; i += 1) {
    const equip = ["eq-bet", "eq-and", "eq-ger"][i % 3];
    data.locacoesEquip.push({
      id:`X${i}`, equipamentoId:equip, obraId:["ob-a", "ob-b"][i % 2], quantidade:equip === "eq-and" ? 2 : 1,
      inicio:`2026-08-${String(1 + (i % 25)).padStart(2, "0")}`, fim:i % 4 === 0 ? "" : `2026-09-${String(1 + (i % 14)).padStart(2, "0")}`, status:"ativa", version:1,
    });
  }
  data.locacoesEquip.push({ id:"LONG", equipamentoId:"eq-long", obraId:"ob-long", quantidade:20, inicio:"2026-09-01", fim:"", plannedEndDate:"2026-09-17", status:"ativa", lifecycleState:"active", version:1 });
  return { usuarios:[PROFILE], attendance:{}, attendanceLocks:{}, unlockRequests:[], dailyCheckDate:"", changeLog:[], config:{ paymentHolidays:[] }, ...data };
};

async function abrirCentral(page) {
  await page.clock.setFixedTime(new Date("2026-09-15T12:00:00-03:00"));
  const state = estado();
  await page.route("**/api/**", route => route.fulfill({ json:{ ok:true, status:200, presencas:[], reply:"" } }));
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === "profiles") return route.fulfill({ json:{ usuarios:[PROFILE], precisaSetup:false } });
    if (body.action === "auth-refresh") return route.fulfill({ json:{ accessToken:"qa-access", refreshToken:"qa-refresh" } });
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
  await page.getByRole("button", { name:/^Locações/ }).click();
  await expect(page.getByRole("region", { name:"Contexto da consulta" })).toBeVisible();
}

test("central operacional: contexto, indicadores, situação e tabela", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await abrirCentral(page);

  // Contexto padrão: mês atual, todas as obras, em andamento.
  await expect(page.getByLabel("Período", { exact:true })).toHaveValue("mes");
  await expect(page.getByLabel("Obra", { exact:true })).toHaveValue("all");
  await expect(page.getByRole("button", { name:/^Em andamento/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".arcd-summary-card").filter({ hasText:"Receita no período" })).toContainText("Setembro 2026 · todas as obras");
  await expect(page.getByText("Cobrança por ciclo ainda não está integrada ao DRE.")).toBeVisible();
  await expect(page.locator("tr[data-row-id]").first()).toBeVisible();

  // Obra com código e nome, e o filtro vira chip removível.
  await page.getByLabel("Obra", { exact:true }).selectOption("ob-long");
  await expect(page.getByRole("button", { name:/Remover filtro K9-12 — Residencial Terras Alpha/ })).toBeVisible();
  await expect(page.locator("tr[data-row-id]")).toHaveCount(1);
  await expect(page.locator("tr[data-row-id=\"LONG\"]")).toContainText("PLATAFORMA ELEVATÓRIA TESOURA 12 M");
  await page.getByRole("button", { name:"Limpar filtros" }).click();
  await expect(page.getByLabel("Obra", { exact:true })).toHaveValue("all");

  // Busca por patrimônio + limpar pelo X do campo.
  await page.getByRole("button", { name:/^Todas/ }).click();
  await page.getByLabel("Buscar", { exact:true }).fill("eq-051");
  await expect(page.locator("tr[data-row-id]").first()).toContainText("Gerador 5 kVA");
  await page.getByRole("button", { name:"Limpar busca" }).click();
  await expect(page.getByLabel("Buscar", { exact:true })).toHaveValue("");

  // Agrupar por obra: cabeçalhos com contagem e total.
  await page.getByLabel("Agrupar por", { exact:true }).selectOption("obra");
  await expect(page.locator(".ro-group-row").first()).toContainText("locações");
  await page.getByLabel("Agrupar por", { exact:true }).selectOption("none");

  // Sem resultado x sem locação: mensagens distintas.
  await page.getByLabel("Buscar", { exact:true }).fill("nada disso existe");
  await expect(page.getByText("Nenhuma locação encontrada para estes filtros.")).toBeVisible();
  await page.locator(".arcd-feedback-state").getByRole("button", { name:"Limpar filtros" }).click();
  await expect(page.locator("tr[data-row-id]").first()).toBeVisible();

  // Menu ⋯ + exclusão com a confirmação que já existia (nada é excluído aqui).
  const row = page.locator("tr[data-row-id=\"L1\"]");
  await row.getByRole("button", { name:/Mais ações de/ }).click();
  await page.getByRole("menuitem", { name:"Excluir locação…" }).click();
  const confirm = page.getByRole("dialog", { name:/Excluir a locação de/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name:/Cancelar|Fechar/ }).first().click();

  // Detalhe lateral.
  await row.getByRole("button", { name:/Abrir detalhes de/ }).click();
  const drawer = page.getByRole("dialog", { name:/BETONEIRA 400 L/ });
  await expect(drawer.getByRole("heading", { name:"Histórico" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
  test(`layout da central em ${width}px: sem rolagem horizontal e colunas coerentes`, async ({ page }) => {
    // A navegação lateral muda abaixo de 1100px: abre a central em desktop
    // largo e só então estreita a janela (o estado da tela é preservado).
    await abrirCentral(page);
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name:/^Todas/ }).click();
    await page.getByLabel("Período", { exact:true }).selectOption("tudo");
    await expect(page.locator("tr[data-row-id]").first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const wrap = document.querySelector(".ro-table-wrap");
      const visible = selector => [...document.querySelectorAll(selector)].some(node => node.offsetParent !== null);
      return {
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        tableOverflow: wrap.scrollWidth - wrap.clientWidth,
        owner: visible("th.ro-col--owner"), periodo: visible("th.ro-col--periodo"), panel: document.querySelector(".ro").getBoundingClientRect().width,
      };
    });
    expect(metrics.pageOverflow).toBeLessThanOrEqual(0);
    expect(metrics.tableOverflow).toBeLessThanOrEqual(0);
    if (metrics.panel > 1200) expect(metrics.owner).toBe(true); else expect(metrics.owner).toBe(false);
    if (metrics.panel > 1060) expect(metrics.periodo).toBe(true); else expect(metrics.periodo).toBe(false);

    if (SHOTS) {
      await page.evaluate(() => document.querySelector("main")?.scrollTo?.(0, 0));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path:`${SHOTS}/topo-${width}.png` });
      await page.locator(".ro").screenshot({ path:`${SHOTS}/central-${width}.png` });
      await page.locator("tr[data-row-id=\"LONG\"]").getByRole("button", { name:/Mais ações de/ }).click();
      await page.screenshot({ path:`${SHOTS}/menu-${width}.png` });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name:/Abrir detalhes de PLATAFORMA/ }).click();
      await page.waitForTimeout(500); // animação de entrada do painel
      await page.screenshot({ path:`${SHOTS}/detalhe-${width}.png` });
    }
  });
}
