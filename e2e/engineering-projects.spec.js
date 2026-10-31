import { expect, test } from "@playwright/test";
import { applyOperationalCommand } from "../src/domains/sync/operational-commands.js";
import { ENGINEERING_COMMAND as CMD } from "../src/domains/projetos/commands.js";
import { projectDataForUser } from "../server/data-projection.js";
import { validateOperationalCommandScope } from "../server/operational-command-policy.js";

const PROFILE = { id: "project-admin-qa", nome: "Ana Engenharia", email: "projetos@qa.test", role: "admin", active: true };
const fixture = () => ({ usuarios: [PROFILE], obras: [{ id: "a", name: "Residencial Portugal", status: "active" }], engineeringProjects: [], employees: [], attendance: {}, config: {} });

async function enter(page, { failLink = false, prepare } = {}) {
  let state = fixture(); prepare?.(state);
  const errors = [], commands = [];
  let rejectLink = failLink;
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(id => sessionStorage.setItem(`arcd-section:${id}`, "projetos"), PROFILE.id);
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00.000Z"));
  await page.context().route("**/api/**", route => route.fulfill({ json: { ok: true, items: [], presencas: [], bases: [] } }));
  await page.context().route("**/api/data", async route => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "profiles") return route.fulfill({ json: { usuarios: state.usuarios, precisaSetup: false } });
    if (body.action === "operational-command") {
      commands.push(body.command);
      if (rejectLink && body.command.type === CMD.ENG_LINK_ADDED) { rejectLink = false; return route.fulfill({ status: 503, json: { error: "Falha simulada. Tente novamente." } }); }
      const scope = validateOperationalCommandScope({ user: state.usuarios[0], data: state, command: body.command });
      if (!scope.ok) return route.fulfill({ status: 403, json: { error: scope.error } });
      const serverNow = await page.evaluate(() => new Date().toISOString());
      const result = applyOperationalCommand(state, { ...body.command, actorId: state.usuarios[0].id, actorRole: state.usuarios[0].role, actorName: state.usuarios[0].nome, now: serverNow });
      if (result.ok) state = result.data;
      return route.fulfill({ status: result.ok ? 200 : 409, json: { ...result, data: result.ok ? projectDataForUser(state, state.usuarios[0]) : undefined, updatedAt: "2026-10-31T12:00:01Z" } });
    }
    return route.fulfill({ json: { ok: true, accessToken: "qa-access", refreshToken: "qa-refresh", usuario: state.usuarios[0], data: projectDataForUser(state, state.usuarios[0]), updatedAt: "2026-10-31T12:00:01Z" } });
  });
  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("isolated-password");
  await page.getByRole("button", { name: "Acessar central MARCELL" }).click();
  await expect(page.locator(".engineering-workspace").first()).toBeVisible();
  return { state: () => state, commands, errors };
}

async function capture(page, name) {
  await expect(page.getByText("Registro salvo.", { exact: true })).toBeHidden({ timeout: 10000 });
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("*").forEach(element => { if (element.scrollTop) element.scrollTop = 0; }); });
  await expect(page.getByRole("heading", { name: "Projetos", exact: true })).toBeInViewport();
  await page.screenshot({ path: `artifacts/projetos/${name}.png`, fullPage: true });
}

async function createProject(page, name = "Casa Portugal · Arquitetura") {
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await page.getByLabel(/Nome\ do\ projeto/).fill(name);
  await page.getByLabel("Cliente", { exact: true }).fill("Cliente Portugal");
  await page.getByLabel("Obra vinculada", { exact: true }).selectOption("a");
  await page.getByLabel("Horas previstas", { exact: true }).fill("40");
  await page.getByLabel("Prazo de entrega", { exact: true }).fill("2026-11-30");
  await page.getByRole("button", { name: "Salvar projeto", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function projectArea(page, label, value) {
  const mobile = page.getByRole("combobox", { name: "Área do projeto", exact: true });
  if (await mobile.isVisible()) await mobile.selectOption(value);
  else await page.getByRole("tab", { name: label, exact: true }).click();
}

async function addLink(page) {
  await projectArea(page, "Links e entregas", "links");
  await page.getByRole("button", { name: "Adicionar link", exact: true }).click();
  await page.getByLabel(/Título/).fill("Planta arquitetônica");
  await page.getByLabel(/Endereço\ do\ link/).fill("https://example.com/planta.pdf");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
}

for (const width of [1440, 390]) test(`projeto, cronômetro, links e revisões em ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const app = await enter(page);
  await expect(page.getByText("Seu primeiro projeto começa aqui")).toBeVisible();
  await createProject(page);
  await page.getByRole("button", { name: "Nova atividade", exact: true }).click();
  await page.getByLabel(/Título/).fill("Detalhamento das esquadrias");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await expect(page.locator(".engineering-record").getByText("Detalhamento das esquadrias", { exact: true })).toBeVisible();
  await page.getByLabel("Atividade do cronômetro", { exact: true }).selectOption({ label: "Detalhamento das esquadrias" });
  await page.getByLabel("Nota da sessão", { exact: true }).fill("Executivo de arquitetura");
  await page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausar cronômetro", exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-31T13:30:00.000Z"));
  await expect(page.getByLabel("Tempo da sessão", { exact: true })).toHaveText("01:30:00");
  await page.reload();
  await expect(page.locator(".engineering-active")).toContainText("Cronômetro ativo");
  await page.getByRole("button", { name: "Abrir projeto ativo", exact: true }).click();
  await expect(page.getByLabel("Tempo da sessão", { exact: true })).toHaveText("01:30:00");
  await page.getByRole("button", { name: "Pausar cronômetro", exact: true }).click();
  await projectArea(page, "Horas", "hours");
  await expect(page.locator(".engineering-people")).toContainText("01:30:00");
  await page.getByRole("button", { name: "Ajustar horas", exact: true }).click();
  await page.getByLabel(/Duração\ corrigida\ em\ minutos/).fill("80");
  await page.getByLabel(/Motivo\ do\ ajuste/).fill("Descontar intervalo de dez minutos");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await expect(page.locator(".engineering-people")).toContainText("01:20:00");
  await addLink(page);
  await expect(page.getByRole("link", { name: "Abrir arquivo ou pasta" })).toHaveAttribute("href", "https://example.com/planta.pdf");
  await projectArea(page, "Revisões", "revisions");
  await page.getByRole("button", { name: "Enviar revisão", exact: true }).click();
  await page.getByLabel(/Link\ desta\ versão/).fill("https://example.com/planta-r1.pdf");
  await page.getByLabel(/O\ que\ mudou\ nesta\ revisão\?/).fill("Primeira emissão do executivo");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await page.getByRole("button", { name: "Registrar parecer", exact: true }).click();
  await page.getByLabel(/Justificativa\ do\ parecer/).fill("Conferido com a arquitetura aprovada");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await expect(page.locator(".engineering-revision")).toContainText("Aprovada");
  await page.getByRole("button", { name: "Enviar revisão", exact: true }).click();
  await page.getByLabel(/Link\ desta\ versão/).fill("https://example.com/planta-r2.pdf");
  await page.getByLabel(/O\ que\ mudou\ nesta\ revisão\?/).fill("Ajuste no layout das esquadrias");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await expect(page.locator(".engineering-revision").first()).toContainText("Aguardando revisão");
  await expect(page.locator(".engineering-revision").last()).toContainText("Aprovada");
  expect(app.state().engineeringProjects[0].revisions).toHaveLength(2);
  expect(app.state().engineeringProjects[0].sessions).toHaveLength(1);
  await capture(page, `revisoes-${width}`);
  if (width < 600) {
    await page.getByLabel("Área do projeto", { exact: true }).evaluate(element => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `artifacts/projetos/revisoes-${width}-viewport.png` });
  }
  await page.getByRole("button", { name: "Todos os projetos", exact: true }).click();
  await expect(page.locator(".engineering-project-row")).toContainText("01:20:00");
  await page.getByLabel("Buscar projetos", { exact: true }).fill("inexistente");
  await expect(page.getByText("Nenhum projeto com estes filtros")).toBeVisible();
  await page.getByLabel("Buscar projetos", { exact: true }).fill("");
  await capture(page, `carteira-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(app.errors).toEqual([]);
});

test("preserva formulário após falha e repete a mesma chave idempotente", async ({ page }) => {
  const app = await enter(page, { failLink: true });
  await createProject(page);
  await addLink(page);
  await expect(page.getByRole("alert").filter({ hasText: "Falha simulada" })).toBeVisible();
  await expect(page.getByLabel(/Título/)).toHaveValue("Planta arquitetônica");
  await page.getByRole("button", { name: "Salvar registro", exact: true }).click();
  await expect(page.getByRole("link", { name: "Abrir arquivo ou pasta" })).toBeVisible();
  const attempts = app.commands.filter(command => command.type === CMD.ENG_LINK_ADDED);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].idempotencyKey).toBe(attempts[1].idempotencyKey);
  expect(app.state().engineeringProjects[0].links).toHaveLength(1);
});

test("duas abas concorrentes não iniciam dois cronômetros para a mesma pessoa", async ({ page, context }) => {
  const app = await enter(page);
  await createProject(page);
  const second = await context.newPage();
  await second.addInitScript(id => sessionStorage.setItem(`arcd-section:${id}`, "projetos"), PROFILE.id);
  await second.clock.setFixedTime(new Date("2026-10-31T12:00:00.000Z"));
  await second.goto("/");
  await second.locator("#login-email").fill(PROFILE.email);
  await second.locator("#login-senha").fill("isolated-password");
  await second.getByRole("button", { name: "Acessar central MARCELL" }).click();
  await second.getByRole("button", { name: "Casa Portugal · Arquitetura", exact: true }).click();
  await expect(second.getByRole("heading", { name: "Casa Portugal · Arquitetura", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casa Portugal · Arquitetura", exact: true })).toBeVisible();
  await Promise.all([page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click(), second.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click()]);
  await expect.poll(() => app.commands.filter(command => command.type === CMD.ENG_TIMER_STARTED).length).toBe(2);
  await expect.poll(() => app.state().engineeringProjects[0].sessions.length).toBe(1);
  await expect.poll(async () => (await page.getByRole("alert").filter({ hasText: "já possui um cronômetro ativo" }).count()) + (await second.getByRole("alert").filter({ hasText: "já possui um cronômetro ativo" }).count())).toBe(1);
  await second.close();
});

test("mantém indicador e permite pausar ao navegar para outro módulo", async ({ page }) => {
  const app = await enter(page);
  await createProject(page);
  await page.getByRole("button", { name: "Iniciar cronômetro", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausar cronômetro", exact: true })).toBeVisible();
  await page.locator(".arcd-sidebar").getByRole("button", { name: "Dashboard", exact: true }).click();
  const banner = page.getByRole("complementary", { name: "Cronômetro ativo", exact: true });
  await expect(banner).toContainText("Casa Portugal");
  await page.clock.setFixedTime(new Date("2026-10-31T12:15:00.000Z"));
  await banner.getByRole("button", { name: "Pausar cronômetro", exact: true }).click();
  await expect(banner).toBeHidden();
  expect(app.state().engineeringProjects[0].sessions[0].endedAt).toBe("2026-10-31T12:15:00.000Z");
});

test("carteira de engenharia mostra somente a obra autorizada", async ({ page }) => {
  await enter(page, { prepare: state => {
    state.usuarios = [{ ...PROFILE, role: "engenheiro", obraId: "a" }];
    state.obras.push({ id: "b", name: "Obra restrita", status: "active" });
    const project = { responsibleId: PROFILE.id, plannedHours: 0, stage: "Executivo", discipline: "Arquitetura", status: "ativo", sessions: [], links: [], revisions: [] };
    state.engineeringProjects = [{ ...project, id: "pa", name: "Projeto autorizado", obraId: "a" }, { ...project, id: "pb", name: "Projeto confidencial", obraId: "b" }, { ...project, id: "office", name: "Projeto de escritório", obraId: "" }];
  } });
  await expect(page.locator(".engineering-project-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Projeto autorizado", exact: true })).toBeVisible();
  await expect(page.getByText("Projeto confidencial", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Projeto de escritório", { exact: true })).toHaveCount(0);
});
