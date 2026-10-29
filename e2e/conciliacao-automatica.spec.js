import { expect, test } from "@playwright/test";
import { applyReconciliationCommand } from "../server/reconciliation-command.js";

test("concilia casos únicos e mantém dúvidas visíveis, inclusive no mobile", async ({ page }) => {
  const profile = { id: "qa-fin", nome: "Financeiro QA", email: "financeiro@arcd.test", role: "admin", active: true };
  let state = {
    usuarios: [profile], obras: [], config: { paymentHolidays: [] },
    fornecedores: [{ id: "f1", nome: "Fornecedor QA", chavePix: "fornecedor@pix" }],
    notasFiscais: [{ id: "n1", numero: "NF-QA", fornecedorId: "f1", status: "aprovada", valorLiquido: 300, vencimento: "2026-10-20", pagamentos: [] }, { id: "n3", numero: "NF-QA-3", fornecedorId: "f1", status: "aprovada", valorLiquido: 400, vencimento: "2026-10-20", pagamentos: [] }],
    transacoes: [
      { id: "t1", descricao: "Pix enviado Fornecedor QA", data: "2026-10-20", valor: -300, chavePix: "fornecedor@pix", fitid: "fit-qa", status: "pendente" },
      { id: "t2", descricao: "Pix sem identificação", data: "2026-10-21", valor: 123, fitid: "fit-unknown", status: "pendente" },
      { id: "t3", descricao: "Pix com falha temporária", data: "2026-10-20", valor: -400, chavePix: "fornecedor@pix", fitid: "fit-qa-3", status: "pendente" },
    ],
  };
  const commands = [], errors = [];
  let rejectOnce = true;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true, presencas: [] } }));
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "profiles") return route.fulfill({ json: { usuarios: [profile], precisaSetup: false } });
    if (body.action === "auth-refresh") return route.fulfill({ json: { accessToken: "qa-access", refreshToken: "qa-refresh" } });
    if (body.action === "reconciliation-command") {
      commands.push(body.command);
      if (body.command.payload.transactionId === "t3" && rejectOnce) { rejectOnce = false; return route.fulfill({status:409,json:{error:"Falha temporária de teste"}}); }
      const result = applyReconciliationCommand(state, body.command, profile);
      if (!result.resumo.ok) return route.fulfill({ status: 409, json: { error: result.resumo.motivo } });
      const sections = Object.fromEntries(Object.entries(result.data).filter(([key, value]) => value !== state[key]));
      state = result.data;
      return route.fulfill({ json: { ok: true, sections, updatedAt: new Date().toISOString() } });
    }
    return route.fulfill({ json: { ok: true, accessToken: "qa-access", refreshToken: "qa-refresh", usuario: profile, data: state, updatedAt: "2026-10-28T10:00:00Z" } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(profile.email);
  await page.locator("#login-senha").fill("qa-isolado");
  await page.getByRole("button", { name: /Acessar central/ }).click();
  const sidebar = page.locator(".arcd-sidebar");
  await sidebar.locator(".nav-grp-hd").filter({ hasText: /^Financeiro/ }).click();
  await sidebar.locator(".nav-item").filter({ hasText: /^Conciliação$/ }).click();
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  await expect.poll(() => state.transacoes[0].status).toBe("conciliado");
  await expect(page.getByRole("button", {name:"Tentar novamente as falhas"})).toBeVisible();
  expect(commands).toHaveLength(2);
  await page.getByRole("button", {name:"Tentar novamente as falhas"}).click();
  await expect.poll(() => state.transacoes[2].status).toBe("conciliado");
  expect(commands).toHaveLength(3);
  expect(commands[0].type).toBe("AUTO_MATCH");
  expect(state.transacoes[1].status).toBe("pendente");
  await page.getByRole("button", { name: /^Identificados/ }).click();
  await expect(page.getByText("Conciliada automaticamente", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Pausar automação" }).click();
  await expect(page.getByText("Conciliação automática pausada", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/conciliacao-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Revisar ·/ }).click();
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/conciliacao-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Pix sem identificação", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(3);
  await page.getByRole("button", {name:"Comparar e buscar",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Movimento do banco",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Identificação no app",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirmar vínculos selecionados",exact:true})).toBeDisabled();
  await page.screenshot({path:"test-results/conciliacao-review-mobile.png",fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
