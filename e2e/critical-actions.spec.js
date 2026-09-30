import { expect, test } from "@playwright/test";

// Ações críticas que quebraram em produção em 29-30/09/2026 SEM derrubar a
// tela - o smoke de módulos (que só abre cada tela) não as via:
//  - "Aprovar e adotar baseline" respondia "Orçamento não encontrado";
//  - "Exportar A2" do cronograma abria aba em branco e depois saía sem datas;
//  - PDF do orçamento com fórmula/unidades corrompidas.
// Aqui cada ação é executada de verdade e o resultado é conferido.

const PROFILE = { id:"qa-admin", nome:"Administrador QA", email:"qa-admin@arcd.test", role:"admin", active:true };

const OBRA = { id:"obra-qa", name:"Residencial Alameda", status:"active", cliente:"Construtora Cliente QA", address:"Rua das Obras, 100" };
const ETAPAS = [
  { id:"et-prelim", nome:"SERVIÇOS PRELIMINARES", parentId:"" },
  { id:"et-canteiro", nome:"PREPARAÇÃO DO CANTEIRO", parentId:"et-prelim" },
  { id:"et-sup1", nome:"SUPRAESTRUTURA (1º PAVIMENTO)", parentId:"" },
  { id:"et-pil1", nome:"PILARES", parentId:"et-sup1" },
  { id:"et-cob", nome:"(SUPRAESTRUTURA) COBERTURA", parentId:"" },
  { id:"et-pilcob", nome:"PILARES", parentId:"et-cob" },
];
const item = (id, etapaId, codigo, descricao, quantidade, precoUnit) =>
  ({ id, etapaId, tipo:"item", fonte:"SINAPI", codigo, descricao, unidade:"UN", quantidade, precoUnit, precoRef:precoUnit });

const estado = () => ({
  usuarios:[PROFILE],
  obras:[OBRA],
  orcamentos:[{
    id:"orc-qa", obraId:"obra-qa", nome:"ORÇAMENTO V1", versionNumber:1, versionStatus:"rascunho", status:"rascunho",
    fonte:"SINAPI", uf:"PE", dataBase:"2026-07", desonerado:false, bdi:22.12, areaM2:120.5, referencias:[],
    updatedAt:"2026-09-29T12:00:00.000Z", etapas:ETAPAS,
    itens:[
      item("i1","et-canteiro","98459","TAPUME COM TELHA METÁLICA",20,102.87),
      item("i2","et-pil1","92762","ARMAÇÃO DE PILAR",100,13.25),
      item("i3","et-pilcob","92762","ARMAÇÃO DE PILAR",80,13.25),
    ],
  }],
  budgetBaselines:[],
  planos:[{
    id:"plano-qa", obraId:"obra-qa", budgetId:"orc-qa", inicio:"2026-09-29", diasSemana:[1,2,3,4,5], pularFeriados:true, feriados:[], marcos:[],
    tarefas:[
      { id:"t1", etapaId:"et-prelim", nome:"SERVIÇOS PRELIMINARES", inicio:"2026-09-29", fim:"2026-10-20", progresso:0, depende:[] },
      { id:"t2", etapaId:"et-canteiro", nome:"PREPARAÇÃO DO CANTEIRO", inicio:"2026-09-29", fim:"2026-10-20", progresso:50, depende:[] },
      { id:"t3", etapaId:"et-sup1", nome:"SUPRAESTRUTURA (1º PAVIMENTO)", inicio:"2026-11-02", fim:"2027-01-29", progresso:0, depende:[] },
      { id:"t4", etapaId:"et-pil1", nome:"PILARES", inicio:"2026-11-02", fim:"2027-01-29", progresso:0, depende:["t2"] },
      { id:"t5", etapaId:"et-cob", nome:"(SUPRAESTRUTURA) COBERTURA", inicio:"2027-02-01", fim:"2027-03-15", progresso:0, depende:[] },
      { id:"t6", etapaId:"et-pilcob", nome:"PILARES", inicio:"2027-02-01", fim:"2027-03-15", progresso:0, depende:["t4"] },
    ],
  }],
  employees:[], terceirizados:[], medicoesTerc:[], pagsTerceiros:[], transacoes:[], extratos:[], rdos:[],
  attendance:{}, attendanceLocks:{}, unlockRequests:[], dailyCheckDate:"", changeLog:[],
  config:{ paymentHolidays:[], companyName:"ARCD Construtech QA" },
});

async function entrar(page) {
  const state = estado();
  await page.route("**/api/**", route => route.fulfill({ json:{ ok:true, status:200, presencas:[], reply:"", bases:[], items:[], components:[] } }));
  await page.route("**/api/data", async route => {
    const body = route.request().postDataJSON?.() || {};
    if (body.action === "profiles") return route.fulfill({ json:{ usuarios:[PROFILE], precisaSetup:false } });
    if (body.action === "auth-refresh") return route.fulfill({ json:{ accessToken:"qa-access", refreshToken:"qa-refresh" } });
    return route.fulfill({ json:{ ok:true, accessToken:"qa-access", refreshToken:"qa-refresh", usuario:PROFILE, data:state, updatedAt:"2026-09-29T00:00:00.000Z" } });
  });
  // A folha A2 chama window.print() ao carregar; no teste não há impressora.
  await page.context().addInitScript(() => { window.print = () => {}; });
  await page.goto("/");
  await page.locator("#login-email").fill(PROFILE.email);
  await page.locator("#login-senha").fill("senha-isolada");
  await page.getByRole("button", { name:"Acessar central ARCD" }).click();
  await expect(page.getByText("Administrador QA").first()).toBeVisible();
}

async function abrirObra(page) {
  const sidebar = page.locator(".arcd-sidebar");
  const grupo = sidebar.locator(".nav-grp-hd").filter({ hasText:/^Engenharia/ });
  const corpo = grupo.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  if (!await corpo.isVisible()) await grupo.click();
  await corpo.locator(".nav-item").filter({ hasText:/^Obras$/ }).click();
  await page.getByText(OBRA.name).first().click();
}

async function abrirOrcamento(page) {
  await abrirObra(page);
  await page.getByRole("button", { name:"Obra", exact:true }).click();
  await page.locator(".tab-row__tab").filter({ hasText:/^Orçamento$/ }).click();
  await page.getByRole("button", { name:"Abrir", exact:true }).first().click();
  await expect(page.getByText("ORÇAMENTO V1").first()).toBeVisible();
}

// Conteúdo que o app escreveu na janela de exportação.
async function conteudoDaJanela(page, disparar) {
  const [janela] = await Promise.all([page.waitForEvent("popup"), disparar()]);
  await expect.poll(async () => (await janela.content()).length, { timeout:10_000 }).toBeGreaterThan(2_000);
  return janela;
}

test.describe("ações críticas", () => {
  test.setTimeout(90_000);
  let erros;
  test.beforeEach(async ({ page }) => {
    erros = [];
    page.on("pageerror", erro => erros.push(erro.message));
    await entrar(page);
  });
  test.afterEach(async ({ page }) => {
    await expect(page.getByText("Algo quebrou nesta tela")).toHaveCount(0);
    expect(erros, "erros de runtime na página").toEqual([]);
  });

  test("PDF do orçamento sai completo: m², resumo por etapa, paginação e assinaturas", async ({ page }) => {
    await abrirOrcamento(page);
    await page.getByRole("button", { name:/Ferramentas do orçamento/ }).click();
    const janela = await conteudoDaJanela(page, () => page.getByRole("button", { name:"PDF", exact:true }).click());
    const html = await janela.content();
    expect(html).toContain("Resumo por etapa");
    expect(html).toContain("120,50 m²");
    expect(html).toContain("counter(pages)");
    expect(html).toContain("Responsável técnico");
    expect(html).toContain("Construtora Cliente QA"); // cliente vindo da obra
    expect(html).not.toMatch(/\/m<\/td>/);
    await expect(janela.getByRole("button", { name:"Imprimir / salvar PDF" })).toBeVisible();
  });

  test("aprovar e adotar baseline aprova o orçamento aberto", async ({ page }) => {
    await abrirOrcamento(page);
    await page.getByRole("button", { name:"Aprovar e adotar baseline" }).click();
    await expect(page.getByText(/Versão aprovada e adotada como baseline/)).toBeVisible();
    await expect(page.getByText("Orçamento não encontrado")).toHaveCount(0);
  });

  test("cronograma A2 abre com régua mensal, datas com ano e etapas numeradas", async ({ page }) => {
    await abrirObra(page);
    const abrirPlanejamento = page.getByRole("button", { name:"Abrir planejamento" });
    if (await abrirPlanejamento.isVisible().catch(() => false)) await abrirPlanejamento.click();
    await page.getByRole("button", { name:"Exportar A2" }).click();
    const janela = await conteudoDaJanela(page, () => page.getByRole("button", { name:"Gerar A2" }).click());
    // Setembro tem só 2 dias na janela: estreito demais para rótulo.
    await expect(janela.locator(".regua")).toContainText("out/26");
    await expect(janela.locator(".regua")).toContainText("jan/27");
    await expect(janela.locator("td.c-inicio").first()).toHaveText("29/09/26");
    const atividades = await janela.locator("td.c-atividade").allTextContents();
    // O espaço entre número e nome é margem visual, não caractere.
    expect(atividades).toEqual(expect.arrayContaining([expect.stringMatching(/^2\.1\s*PILARES$/), expect.stringMatching(/^3\.1\s*PILARES$/)]));
  });

  test("Curva ABC abre sem base analítica e consolida pelo orçamento", async ({ page }) => {
    await abrirOrcamento(page);
    await page.getByRole("button", { name:"INSUMOS E COMPOSIÇÕES / CURVA ABC" }).click();
    await expect(page.getByText(/Curva calculada pelos itens do orçamento/)).toBeVisible();
  });
});
