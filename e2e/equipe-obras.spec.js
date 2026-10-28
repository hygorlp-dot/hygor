import { test, expect } from "@playwright/test";
import { montarEquipeObras } from "../src/domains/ponto-eletronico/equipe-obras.js";
const PROFILE = { id: "qa-admin", nome: "Administrador QA", email: "qa@arcd.test", role: "admin", active: true };
test("painel responsivo: filtros, detalhes, atualização e reconexão", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const obras = [{ id: "a", name: "Residencial Alameda" }, { id: "b", name: "Galpão Industrial" }];
  const employees = [{ id: "e1", name: "José da Silva", role: "Pedreiro", obra: "a", active: true }, { id: "e2", name: "Maria Oliveira", role: "Eletricista", obra: "b", active: true }, { id: "e3", name: "Pedro Souza", obra: "a", active: true }];
  const attendance = { e2: { "2026-10-28": { status: "F" } } };
  const state = { usuarios: [PROFILE], obras, employees, attendance, config: {} };
  let marcacoes = [{ eventId: "1", employeeId: "e1", obraId: "a", tipoRegistro: "ponto", tipoEvento: "entrada", marcadoEm: "2026-10-28T10:00:00Z", horaConfiavel: true }];
  let consultas = 0;
  // Fontes externas não devem bloquear o teste funcional isolado.
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", r => r.abort());
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "ponto-equipe-obras") {
      consultas++;
      return route.fulfill({ json: { pessoas: montarEquipeObras({ employees, obras, attendance, marcacoes, agora: Date.parse("2026-10-28T20:00:00Z") }), obras, dia: "2026-10-28", fuso: "America/Recife", servidorMs: Date.parse("2026-10-28T20:00:00Z"), limitacoes: ["Escala não disponível no cadastro."] } });
    }
    if (body.action === "profiles") return route.fulfill({ json: { usuarios: [PROFILE], precisaSetup: false } });
    return route.fulfill({ json: { ok: true, accessToken: "qa-token", refreshToken: "qa-refresh", usuario: PROFILE, data: state, updatedAt: "2026-10-28T00:00:00Z" } });
  });
  await page.route("**/api/presence", r => r.fulfill({ json: { ok: true, presencas: [] } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(PROFILE.email); await page.locator("#login-senha").fill("teste");
  await page.getByRole("button", { name: /Acessar central/ }).click();
  await expect(page.locator("#login-email")).toBeHidden();
  // Busca global é acessível em todas as larguras e usa o cadastro real de abas.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })));
  const buscaGlobal = page.getByPlaceholder(/Buscar/i).first();
  await buscaGlobal.fill("Equipe nas Obras");
  await page.getByText("Equipe nas Obras", { exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Equipe nas Obras", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver jornada de José/ })).toBeVisible();
  await expect(page.getByText("Sem funcionários em atividade", { exact: true })).toBeVisible();
  await expect(page.getByText("Faltas confirmadas (1)")).toBeVisible();
  await page.getByRole("button", { name: /Ver jornada de José/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Entrada");
  await page.keyboard.press("Escape");
  await page.getByLabel("Buscar funcionário ou obra").fill("José");
  marcacoes.push({ ...marcacoes[0], eventId: "2", tipoEvento: "intervalo", marcadoEm: "2026-10-28T15:00:00Z" });
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  await expect(page.getByRole("button", { name: /Ver jornada de José.*Em intervalo/ })).toBeVisible();
  await expect(page.getByLabel("Buscar funcionário ou obra")).toHaveValue("José");
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  // O evento real do navegador define navigator.onLine; aqui simulamos a rede.
  await page.context().setOffline(true);
  await expect(page.getByText(/Sem conexão — os dados/)).toBeVisible();
  const antes = consultas;
  await page.context().setOffline(false);
  await expect.poll(() => consultas).toBeGreaterThan(antes);
  await page.getByLabel("Buscar funcionário ou obra").fill("");
  await expect(page.locator(".equipe-obras")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("equipe-obras.png"), fullPage: true });
});

