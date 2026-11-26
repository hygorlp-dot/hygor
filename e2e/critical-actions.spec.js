import {confirmReportIdentity} from './report-identity-helper.js';
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

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
    bdiParams:{ac:3,seguro:0.4,risco:1,garantia:0.4,df:1,lucro:7,pis:0.65,cofins:3,iss:2,cprb:0},
    updatedAt:"2026-09-29T12:00:00.000Z", etapas:ETAPAS,
    itens:[
      item("i1","et-canteiro","98459","TAPUME COM TELHA METÁLICA",20,102.87),
      { ...item("i2","et-pil1","FABEJA-ADM-ESTAGIO-ENG-CIVIL","ESTÁGIO SUPERVISIONADO EM ENGENHARIA CIVIL — APOIO À OBRA, 30 H SEMANAIS",100,13.25),
        fonte:"PRÓPRIA", composicao:JSON.stringify([{codigo:"00012",descricao:"Insumo congelado",coeficiente:0.5,precoUnit:26.5}]) },
      item("i3","et-pilcob","92762","ARMAÇÃO DE PILAR",80,13.25),
    ],
  }],
  composicoesEmpresa:[{id:"somente-catalogo",codigo:"SO-CATALOGO",descricao:"Composição fora do orçamento",unidade:"UN",itens:[]}],
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
  await page.getByRole("button", { name:"Acessar central MARCELL" }).click();
  await expect(page.locator('#login-email')).toHaveCount(0);
  await expect(page.locator('main.arcd-main')).toBeVisible();
}

async function abrirObra(page) {
  if(page.viewportSize().width<1100){
    await page.keyboard.press('Control+k');
    const search=page.getByPlaceholder('Buscar obra, lead, pedido, funcionário, tela...');
    await search.fill('Obras');
    await search.locator('xpath=../..').getByRole('button',{name:'Tela Obras abrir tela',exact:true}).click();
    await page.getByRole('heading',{name:OBRA.name,exact:true}).click();return;
  }
  const sidebar = page.locator(".arcd-sidebar");
  const grupo = sidebar.locator(".nav-grp-hd").filter({ hasText:/^Obras e projetos/ });
  const corpo = grupo.locator("xpath=following-sibling::*[contains(@class,'nav-body')][1]");
  if (!await corpo.isVisible()) await grupo.click();
  await corpo.locator(".nav-item").filter({ hasText:/^Obras$/ }).click();
  await page.getByRole('heading',{name:OBRA.name,exact:true}).click();
}

async function abrirOrcamento(page) {
  await abrirObra(page);
  if(page.viewportSize().width<1100)await page.getByRole('combobox',{name:'Telas da obra',exact:true}).selectOption('orc');
  else{
    await page.getByRole("button", { name:"Obra", exact:true }).click();
    await page.locator(".tab-row__tab").filter({ hasText:/^Orçamento$/ }).click();
  }
  const open = page.getByRole("button", { name:"Abrir", exact:true }).first();
  const sheet = page.getByRole("toolbar", { name:"Ações da planilha" });
  await expect(open.or(sheet).first()).toBeVisible();
  if (await open.isVisible()) await open.click();
  await expect(sheet).toBeVisible();
}

// Conteúdo que o app escreveu na janela de exportação.
async function conteudoDaJanela(page, disparar) {
  const pending = page.waitForEvent("popup");await disparar();await confirmReportIdentity(page);const janela=await pending;
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

  test("PDF do orçamento sai completo: m², resumo por etapa, paginação e assinaturas", async ({ page }, testInfo) => {
    await abrirOrcamento(page);
    await page.locator('.budget-analysis > summary').click();
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

    const printSettings = janela.getByRole("dialog", { name:"Configurar PDF do orçamento" });
    const control = printSettings.getByRole("slider", { name:/Largura da coluna/ });
    const columns = janela.locator(".planilha-detalhada col");
    const tableWidths = () => columns.evaluateAll(cols => cols.map(col => col.style.width));
    await expect(control).toHaveValue("13");
    await printSettings.screenshot({ path:testInfo.outputPath("ajuste-desktop.png") });
    await janela.setViewportSize({ width:390, height:844 });
    await expect(control).toBeVisible();
    await printSettings.screenshot({ path:testInfo.outputPath("ajuste-celular.png") });
    const defaultWidths = await tableWidths();
    await control.press("Home");
    await expect(control).toHaveValue("6");
    expect(await tableWidths()).toEqual(defaultWidths);
    await printSettings.getByRole("button", { name:"Cancelar" }).click();
    const configure = janela.getByRole("button", { name:"Configurar PDF", exact:true });
    await configure.click();
    await expect(control).toHaveValue("13");
    await printSettings.getByRole("checkbox", { name:"Memória de cálculo do BDI", exact:true }).uncheck();
    await printSettings.getByRole("button", { name:"Aplicar à prévia" }).click();
    await expect(janela.locator(".bdi-box")).toBeHidden();
    await expect(janela.locator(".meta").getByText("BDI aplicado")).toBeVisible();
    const totalCell = janela.locator(".planilha-detalhada tfoot .tot td").last();
    const totalBefore = await totalCell.textContent();
    await configure.click();
    await printSettings.getByRole("checkbox", { name:"Código", exact:true }).uncheck();
    await printSettings.getByRole("checkbox", { name:"BDI aplicado", exact:true }).uncheck();
    await printSettings.getByRole("checkbox", { name:"Assinaturas", exact:true }).uncheck();
    await printSettings.getByRole("combobox", { name:"Orientação" }).selectOption("landscape");
    await printSettings.getByRole("combobox", { name:"Papel" }).selectOption("A3");
    await printSettings.getByRole("combobox", { name:"Margens" }).selectOption("8mm");
    await printSettings.getByRole("button", { name:"Aplicar à prévia" }).click();
    await expect(janela.getByRole("columnheader", { name:"Código", exact:true })).toHaveCount(0);
    await expect(janela.getByText("Responsável técnico", { exact:true })).toBeHidden();
    await expect(janela.getByText("BDI aplicado", { exact:true }).first()).toBeHidden();
    await expect(totalCell).toHaveText(totalBefore);
    expect(await janela.content()).toContain("size:A3 landscape;margin:8mm");
    await janela.pdf({ path:testInfo.outputPath("orcamento-a3-paisagem.pdf"), preferCSSPageSize:true, printBackground:true });
    await configure.click();
    await printSettings.getByRole("button", { name:"Restaurar padrão" }).click();
    await expect(control).toHaveValue("13");
    await expect(printSettings.getByRole("checkbox", { name:"Memória de cálculo do BDI", exact:true })).toBeChecked();
    await control.press("Home");
    await printSettings.getByRole("button", { name:"Aplicar à prévia" }).click();
    expect(await tableWidths()).toEqual(defaultWidths.map((width, index) => index === 1 ? "6%" : index === 3 ? "43%" : width));
    await janela.setViewportSize({ width:718, height:1000 });
    await janela.emulateMedia({ media:"print" });
    await expect(configure).toBeHidden();
    const longCode = janela.getByRole("cell", { name:"FABEJA-ADM-ESTAGIO-ENG-CIVIL", exact:true });
    await expect(longCode).toBeVisible();
    const widths = await longCode.evaluate(cell => {
      const row = cell.parentElement;
      const code = cell.getBoundingClientRect();
      const description = row.cells[3].getBoundingClientRect();
      return {
        codeShare: code.width / row.getBoundingClientRect().width,
        descriptionShare: description.width / row.getBoundingClientRect().width,
        overflow: cell.scrollWidth - cell.clientWidth,
      };
    });
    expect(widths.codeShare).toBeCloseTo(0.06, 2);
    expect(widths.descriptionShare).toBeGreaterThan(0.35);
    expect(widths.overflow).toBeLessThanOrEqual(1);
    await janela.pdf({ path:testInfo.outputPath("orcamento-coluna-compacta.pdf"), preferCSSPageSize:true, printBackground:true });
  });

  test("exporta somente as composições próprias do orçamento aberto", async ({ page }) => {
    await abrirOrcamento(page);
    await page.getByRole("button", { name:"Composições próprias", exact:true }).click();
    await expect(page.getByRole("heading", { name:"Exportar composições do orçamento" })).toBeVisible();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name:"Exportar em Excel", exact:true }).click();
    const download = await pending;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await download.path());
    expect(download.suggestedFilename()).toContain("V1.xlsx");
    const compositions = workbook.getWorksheet("Composições");
    expect(compositions.rowCount).toBe(2);
    expect(compositions.getCell("B2").value).toBe("FABEJA-ADM-ESTAGIO-ENG-CIVIL");
    expect(compositions.getCell("F2").value).toBe(13.25);
    const components = workbook.getWorksheet("Componentes");
    expect(components.rowCount).toBe(2);
    expect(components.getCell("E2").value).toBe("00012");
    expect(components.getCell("H2").value).toBe(0.5);
  });

  test("PDF exporta somente as composições próprias da versão aberta", async ({ page }, testInfo) => {
    await abrirOrcamento(page);
    await page.getByRole("button", { name:"Composições próprias", exact:true }).click();
    const section = page.locator("header").filter({ has:page.getByRole("heading", { name:"Exportar composições do orçamento" }) });
    const excel = section.getByRole("button", { name:"Exportar em Excel", exact:true });
    const pdf = section.getByRole("button", { name:"Exportar em PDF", exact:true });
    for (const theme of ["marcell", "noite", "plataforma"]) {
      await page.setViewportSize({ width:1440, height:900 });
      await page.getByRole("button", { name:"Alterar aparência" }).click();
      await page.getByRole("combobox", { name:"Tema", exact:true }).selectOption(theme);
      await page.keyboard.press("Escape");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(excel).toBeVisible();
      await expect(pdf).toBeEnabled();
      await section.screenshot({ path:testInfo.outputPath(`exportacao-${theme}-desktop.png`) });
      await page.setViewportSize({ width:390, height:844 });
      await expect(excel).toBeVisible();
      await expect(pdf).toBeVisible();
      await section.screenshot({ path:testInfo.outputPath(`exportacao-${theme}-celular.png`) });
    }
    const preview = await conteudoDaJanela(page, () => pdf.click());
    await expect(preview).toHaveTitle(/Composições próprias.*ORÇAMENTO V1 · V1/);
    await expect(preview.getByText("1 item com composição própria nesta versão")).toBeVisible();
    const compositions = preview.getByRole("table", { name:"Composições", exact:true });
    await expect(compositions.locator("tbody tr")).toHaveCount(1);
    const code = compositions.getByRole("cell", { name:"FABEJA-ADM-ESTAGIO-ENG-CIVIL", exact:true });
    await expect(code).toHaveCount(1);
    const components = preview.getByRole("table", { name:"Componentes", exact:true });
    await expect(components.locator("tbody tr")).toHaveCount(1);
    await expect(components.getByRole("cell", { name:"00012", exact:true })).toHaveCount(1);
    await expect(preview.getByText("SO-CATALOGO", { exact:true })).toHaveCount(0);
    await expect(preview.getByText("98459", { exact:true })).toHaveCount(0);
    await expect(preview.getByRole("button", { name:"Imprimir / salvar PDF", exact:true })).toBeVisible();
    await preview.setViewportSize({ width:1045, height:730 });
    await preview.emulateMedia({ media:"print" });
    expect(await code.evaluate(cell => cell.scrollWidth - cell.clientWidth)).toBeLessThanOrEqual(1);
    await preview.pdf({ path:testInfo.outputPath("composicoes-proprias.pdf"), preferCSSPageSize:true, printBackground:true });
  });

  test("aprovar e adotar baseline aprova o orçamento aberto", async ({ page }) => {
    await abrirOrcamento(page);
    await page.locator('.budget-management > summary').click();
    await page.getByRole("button", { name:"Aprovar e adotar baseline" }).click();
    await expect(page.getByText(/Versão aprovada e adotada como baseline/)).toBeVisible();
    await expect(page.getByText("Orçamento não encontrado")).toHaveCount(0);
  });

  test("cronograma A2 abre com régua mensal, datas com ano e etapas numeradas", async ({ page }) => {
    await abrirObra(page);
    if(page.viewportSize().width<1100)await page.getByRole('combobox',{name:'Telas da obra',exact:true}).selectOption('plan');
    const abrirPlanejamento = page.getByRole("button", { name:"Abrir planejamento" });
    if (await abrirPlanejamento.isVisible().catch(() => false)) await abrirPlanejamento.click();
    await page.locator('.planning-tools > summary').click();
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
    if(page.viewportSize().width<1100)await page.getByRole('combobox',{name:'Áreas do orçamento',exact:true}).selectOption({label:'Insumos e Curva ABC'});
    else await page.getByRole("button", { name:"Insumos e Curva ABC",exact:true }).click();
    await expect(page.getByText(/Curva calculada pelos itens do orçamento/)).toBeVisible();
  });

  test('célula de descrição cresce e Escape restaura o texto sem substituir a composição',async({page},info)=>{
    await abrirOrcamento(page);const description=page.locator('textarea.budget-cell.is-desc').first();await expect(description).toBeVisible();
    const original=await description.inputValue();await description.fill('Descrição longa para revisão da composição e da unidade. '.repeat(8));
    expect(await description.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(26);
    await description.press('Escape');await expect(description).toHaveValue(original);await expect(description).not.toBeFocused();
    const menu=page.getByRole('button',{name:'Mais ações da etapa 1',exact:true});
    await expect(menu.locator('svg')).toBeVisible();
    await menu.click();await expect(page.getByRole('menuitem',{name:'Editar nome e posição',exact:true})).toBeVisible();await menu.press('Escape');
    await page.screenshot({path:info.outputPath('orcamento-padrao.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
});
