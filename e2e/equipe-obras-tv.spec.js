import { test, expect } from "@playwright/test";
import { montarEquipeObras } from "../src/domains/ponto-eletronico/equipe-obras.js";

async function entrar(page, autorizado = true) {
  const usuario = { id: "tv-user", nome: "Operador", email: "tv@test.local", role: autorizado ? "admin" : "visualizador", active: true };
  const obras = [{ id: "a", name: "Residencial Alameda" }, { id: "b", name: "Galpão Industrial" }];
  const employees = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Funcionário ${i + 1} Silva`, role: "Pedreiro", obra: "a", active: true }));
  const marcacoes = employees.slice(0, 7).map((e, i) => ({ eventId: String(i), employeeId: e.id, obraId: "a", tipoRegistro: "ponto", marcadoEm: "2026-10-28T10:00:00Z", horaConfiavel: true }));
  const state = { usuarios: [usuario], obras, employees, config: {} };
  let consultas = 0, negar = false;
  await page.route("https://fonts.googleapis.com/**", r => r.fulfill({ contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", r => r.abort());
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "ponto-equipe-obras") {
      consultas++;
      if (negar) return route.fulfill({ status: 403, json: { error: "Sem acesso à equipe." } });
      return route.fulfill({ json: { pessoas: montarEquipeObras({ employees, obras, marcacoes, agora: Date.parse("2026-10-28T20:00:00Z") }), obras, dia: "2026-10-28", fuso: "America/Recife", servidorMs: Date.parse("2026-10-28T20:00:00Z"), limitacoes: [] } });
    }
    if (body.action === "profiles") return route.fulfill({ json: { usuarios: [usuario], precisaSetup: false } });
    return route.fulfill({ json: { ok: true, accessToken: "tv-test", refreshToken: "refresh-test", usuario, data: state } });
  });
  await page.route("**/api/presence", r => r.fulfill({ json: { ok: true, presencas: [] } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(usuario.email);
  await page.locator("#login-senha").fill("teste");
  await page.getByRole("button", { name: /Acessar central/ }).click();
  await expect(page.locator("#login-email")).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })));
  await page.getByPlaceholder(/Buscar/i).first().fill("Modo TV");
  await page.getByText("Modo TV", { exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Panorama executivo das obras" })).toBeVisible();
  return { consultas: () => consultas, negar: () => { negar = true; } };
}

test("equipe na TV pagina, pausa, atualiza e protege registros do APK atual", async ({ page }, info) => {
  await page.clock.install();
  const api = await entrar(page);
  await page.getByRole("tab", { name: "Equipe nas Obras", exact: true }).click();
  const painel = page.getByRole("region", { name: "Equipe nas Obras no Modo TV", exact: true });
  await expect(painel.getByRole("heading", { name: "Residencial Alameda" })).toBeVisible();
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(6);
  await expect(painel.getByText("Conferir jornada", { exact: true })).toHaveCount(6);
  await expect(painel.getByText(/não confirmam presença/)).toBeVisible();
  await page.clock.fastForward(12000);
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(1);
  await painel.getByRole("button", { name: "Pausar páginas" }).click();
  const antes = api.consultas();
  await page.clock.fastForward(24000);
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(1);
  await expect.poll(api.consultas).toBeGreaterThan(antes);
  await painel.getByRole("button", { name: "Próxima página da equipe" }).click();
  await expect(painel.getByText("Nenhum funcionário com registro associado a esta obra.")).toBeVisible();
  await painel.getByRole("button", { name: "Próxima página da equipe" }).click();
  await expect(painel.getByRole("heading", { name: "Sem registro de obra / ausências" })).toBeVisible();
  await painel.getByRole("button", { name: "Próxima página da equipe" }).click();
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("equipe-tv.png"), fullPage: true });
  if (info.project.name.endsWith("desktop")) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("button", { name: "Alternar tela cheia" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("arcd-tv"))).toBe(true);
    await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(3);
    const controles = await painel.locator(".equipe-tv__controles").boundingBox();
    expect(controles.y + controles.height).toBeLessThanOrEqual(720);
    await page.screenshot({ path: info.outputPath("equipe-tv-720p.png") });
    await page.getByRole("button", { name: "Alternar tela cheia" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.context().setOffline(true);
  await expect(painel.getByText(/Sem conexão/)).toBeVisible();
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(6);
  await page.context().setOffline(false);
  await painel.getByRole("button", { name: "Atualizar equipe" }).click();
  api.negar();
  await painel.getByRole("button", { name: "Atualizar equipe" }).click();
  await expect(painel.getByText(/Sem acesso à equipe/)).toBeVisible();
  await expect(painel.locator(".equipe-tv__pessoa")).toHaveCount(0);
  await page.getByRole("tab", { name: "Panorama executivo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Panorama executivo das obras" })).toBeVisible();
});

test("Modo TV não concede acesso à equipe a perfil sem permissão", async ({ page }) => {
  const api = await entrar(page, false);
  await expect(page.getByRole("tab", { name: "Equipe nas Obras", exact: true })).toHaveCount(0);
  expect(api.consultas()).toBe(0);
});
