import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import { buildLaborProjectionPdfHtml, buildLaborProjectionTables, buildLaborProjectionWorkbook, exportLaborProjectionPdf } from "./labor-projection.js";
import { laborProjectionFixture } from "./labor-projection.fixtures.js";

const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const plain = value => value.replace(/\s+/g, " ");
const documentFor = report => new DOMParser().parseFromString(buildLaborProjectionPdfHtml(report), "text/html");
const column = (sheet, title) => sheet.getRow(1).values.indexOf(title);
const rowByLabel = (sheet, label) => {
  let found;
  sheet.eachRow(row => { if (row.getCell(1).value === label) found = row; });
  return found;
};

describe("exportações da projeção de mão de obra", () => {
  it("preserva snapshot, filtros, valores e identidade MARCELL sem recalcular ou mutar a entrada", () => {
    const report = laborProjectionFixture();
    report.filters = { ...report.filters, area: "works", obraId: "work-a" };
    const before = structuredClone(report);
    freeze(report);
    const doc = documentFor(report), text = plain(doc.body.textContent);
    expect(doc.body.dataset.marcellReport).toBe("true");
    expect(doc.querySelector(".mrc-report-logo")).toBeTruthy();
    expect(doc.querySelector("#marcell-report-theme").textContent).toContain("Nimbus Sans");
    expect(text).toContain("21/10/2026 a 05/11/2026");
    expect(text).toContain("21/07/2026 a 20/10/2026");
    expect(text).toContain("29/10/2026, 12:30");
    expect(text).toContain("Obras · Obra Sintética Alameda");
    expect(text).toContain("R$ 1.440,00");
    expect(text).toContain("R$ 1.500,00");
    expect(text).toContain("snapshot-sintetico-v7");
    expect(text).toContain("Saldo a desembolsar aos funcionários");
    expect(buildLaborProjectionTables(report)).toHaveLength(6);
    expect(report).toEqual(before);
  });

  it("gera XLSX real com seis abas, dinheiro numérico, datas tipadas e componentes sem dupla soma", async () => {
    const report = laborProjectionFixture();
    const workbook = await buildLaborProjectionWorkbook(report);
    const bytes = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes);
    expect(loaded.worksheets.map(sheet => sheet.name)).toEqual(["Resumo", "Obras e Administrativo", "Pessoas autorizadas", "Histórico", "Memória de cálculo", "Pendências"]);
    const summary = loaded.getWorksheet("Resumo");
    const total = rowByLabel(summary, "Custo esperado").getCell(2);
    expect(total.value).toBe(1440);
    expect(typeof total.value).toBe("number");
    expect(total.numFmt).toContain("R$");
    expect(rowByLabel(summary, "Referência com presença integral").getCell(2).value).toBe(1500);
    const cycleStart = rowByLabel(summary, "Início do ciclo").getCell(4);
    expect(cycleStart.value).toBeInstanceOf(Date);
    expect(cycleStart.value.toISOString().slice(0, 10)).toBe("2026-10-21");
    expect(cycleStart.numFmt).toBe("dd/mm/yyyy");
    const memory = loaded.getWorksheet("Memória de cálculo"), first = memory.getRow(2);
    expect(first.getCell(column(memory, "Remuneração e encargos")).value).toBe(140);
    expect(first.getCell(column(memory, "Encargos já incluídos")).value).toBe(20);
    expect(first.getCell(column(memory, "Benefícios")).value).toBe(10);
    expect(first.getCell(column(memory, "Custo da parcela")).value).toBe(150);
    expect(first.getCell(column(memory, "Componente")).value).toBe("Diária");
    expect(memory.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("recusa detalhe individual nas duas exportações mesmo se o payload vier com pessoas não autorizadas", async () => {
    const report = laborProjectionFixture();
    report.permissions.canViewPeople = false;
    report.issues = [{ code: "missing", employeeId: "person-a", message: "Pessoa Sintética Alfa precisa de conferência." }];
    report.people[0].cpf = "CPF-SINTETICO-PROIBIDO";
    report.people[0].pix = "PIX-SINTETICO-PROIBIDO";
    const text = documentFor(report).body.textContent;
    expect(text).not.toContain("Pessoa Sintética Alfa");
    expect(text).not.toContain("CPF-SINTETICO-PROIBIDO");
    expect(text).not.toContain("PIX-SINTETICO-PROIBIDO");
    expect(text).toContain("restritos aos perfis autorizados");
    const workbook = await buildLaborProjectionWorkbook(report);
    const allValues = JSON.stringify(workbook.worksheets.map(sheet => sheet.getSheetValues()));
    expect(allValues).not.toContain("Pessoa Sintética Alfa");
    expect(allValues).not.toContain("person-a");
    expect(allValues).not.toContain("CPF-SINTETICO-PROIBIDO");
    expect(workbook.getWorksheet("Pessoas autorizadas").rowCount).toBe(2);
    expect(workbook.getWorksheet("Memória de cálculo").rowCount).toBe(2);
  });

  it("mantém nulos indisponíveis e rotula subtotal parcial e caixa incompleto", async () => {
    const report = laborProjectionFixture();
    Object.assign(report.totals, { partial: true, projectedCost: 900, estimatedCost: null, unpricedDays: 4 });
    Object.assign(report.cash, { available: false, partial: true, projectedNet: null, remainingToPay: null, withheldTransfer: null, unionWithheldAmount: 25 });
    const doc = documentFor(report);
    expect(doc.body.textContent).toContain("Subtotal parcial");
    expect(doc.body.textContent).toContain("Indisponível");
    expect(doc.body.textContent).toContain("A previsão de caixa está incompleta");
    const workbook = await buildLaborProjectionWorkbook(report), summary = workbook.getWorksheet("Resumo");
    expect(rowByLabel(summary, "Subtotal parcial de custo").getCell(2).value).toBe(900);
    expect(rowByLabel(summary, "Estimativa de dias futuros").getCell(2).value).toBeNull();
    expect(rowByLabel(summary, "Caixa: saldo aos funcionários").getCell(2).value).toBeNull();
    expect(rowByLabel(summary, "Caixa: retenção sindical prevista").getCell(2).value).toBe(25);
    expect(rowByLabel(summary, "Caixa: retenções a repassar").getCell(2).value).toBeNull();
  });

  it("identifica estimativa provisória sem chamar de parcial uma base com valores disponíveis", async () => {
    const report = laborProjectionFixture(); report.totals.provisional = true;
    const doc = documentFor(report);
    expect(doc.body.textContent).toContain("Estimativa provisória");
    expect(doc.body.textContent).not.toContain("Subtotal parcial");
    const summary = (await buildLaborProjectionWorkbook(report)).getWorksheet("Resumo");
    expect(rowByLabel(summary, "Custo esperado").getCell(2).value).toBe(1440);
    expect(rowByLabel(summary, "Condição da estimativa").getCell(5).value).toContain("Provisória");
  });

  it("mantém título junto ao primeiro anexo e troca premissas repetidas por notas integrais referenciadas", () => {
    const report = laborProjectionFixture();
    const assumption = "Salário de competência preservado conforme o motor canônico, com o denominador específico do mês da parcela.";
    report.people[0].days.forEach(day => { day.assumptions = [assumption]; });
    const doc = documentFor(report), person = doc.querySelector(".person");
    expect(person.firstElementChild.tagName).toBe("H2");
    expect(person.firstElementChild.textContent).toBe("Detalhe autorizado por pessoa");
    expect([...doc.querySelectorAll("body > h2")].some(heading => heading.textContent === "Detalhe autorizado por pessoa")).toBe(false);
    expect(person.querySelectorAll(".memory-notes li")).toHaveLength(1);
    expect(person.querySelector(".memory-notes li").textContent).toBe(assumption);
    expect(person.textContent.split(assumption)).toHaveLength(2);
    const dailyRows = [...person.querySelectorAll("table")].at(-1).querySelectorAll("tbody tr");
    expect(dailyRows).toHaveLength(report.people[0].days.length);
    expect([...dailyRows].every(row => row.lastElementChild.textContent.includes("Notas [1]"))).toBe(true);
    expect(buildLaborProjectionPdfHtml(report)).toContain("break-after:avoid;page-break-after:avoid");
  });

  it("escapa conteúdo no HTML e mantém texto de planilha como texto", async () => {
    const report = laborProjectionFixture();
    report.people[0].name = '<img src=x onerror="alert(1)">';
    report.groups[0].name = '=HYPERLINK("https://example.invalid", "texto")';
    const doc = documentFor(report);
    expect(doc.querySelector("img[onerror]")).toBeNull();
    expect(doc.body.textContent).toContain('<img src=x onerror="alert(1)">');
    const workbook = await buildLaborProjectionWorkbook(report);
    expect(workbook.getWorksheet("Obras e Administrativo").getCell("A2").value).toBe(report.groups[0].name);
    expect(workbook.getWorksheet("Obras e Administrativo").getCell("A2").formula).toBeUndefined();
  });

  it("informa bloqueio de janela na exportação PDF", () => {
    const spy = vi.spyOn(window, "open").mockReturnValue(null);
    expect(() => exportLaborProjectionPdf(laborProjectionFixture())).toThrow("Permita a abertura de janelas");
    spy.mockRestore();
  });
});
