import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportLaborProjectionExcel, exportLaborProjectionPdf } from "../../../reports/labor-projection.js";
import { laborProjectionFixture } from "../../../reports/labor-projection.fixtures.js";
import LaborProjectionReport from "./LaborProjectionReport.jsx";

vi.mock("../../../reports/labor-projection.js", async importOriginal => ({
  ...await importOriginal(), exportLaborProjectionExcel: vi.fn().mockResolvedValue(undefined), exportLaborProjectionPdf: vi.fn(),
}));

let root, container, originalShow, originalClose;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const render = props => act(async () => root.render(<LaborProjectionReport {...props} />));
const button = label => [...container.querySelectorAll("button")].find(item => (item.getAttribute("aria-label") || item.textContent).trim() === label);
const control = label => {
  const element = [...container.querySelectorAll("label")].find(item => item.textContent === label);
  return element ? document.getElementById(element.htmlFor) || element.querySelector("input,select") : null;
};
const click = async element => { expect(element).toBeTruthy(); await act(async () => element.click()); };
const select = async (label, value) => { const element = control(label); expect(element).toBeTruthy(); await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }); };
const submit = () => act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
const settle = (pending, report) => act(async () => pending.resolve({ ok: true, report }));
const text = element => element?.textContent.replace(/\s+/g, " ");

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  originalShow = HTMLDialogElement.prototype.showModal; originalClose = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => {
  act(() => root.unmount()); container.remove();
  if (originalShow) HTMLDialogElement.prototype.showModal = originalShow; else delete HTMLDialogElement.prototype.showModal;
  if (originalClose) HTMLDialogElement.prototype.close = originalClose; else delete HTMLDialogElement.prototype.close;
  vi.restoreAllMocks();
});

describe("LaborProjectionReport", () => {
  it("separa carregamento de resultado, mostra o corte do servidor e preserva valores do snapshot", async () => {
    const pending = deferred(), report = laborProjectionFixture(), requestReport = vi.fn().mockReturnValue(pending.promise);
    await render({ requestReport });
    expect(container.querySelector('.lp-results[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector(".lp-kpis")).toBeNull();
    expect(button("PDF").disabled).toBe(true);
    await settle(pending, report);
    expect(requestReport).toHaveBeenCalledOnce();
    expect(container.querySelectorAll(".lp-kpi")).toHaveLength(4);
    expect(container.querySelector(".lp-kpis").compareDocumentPosition(container.querySelector(".lp-filters")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text(container.querySelector('[data-metric="projectedCost"]'))).toBe("R$ 1.440,00");
    expect(text(container.querySelector('[data-metric="actualCost"]'))).toBe("R$ 900,00");
    expect(text(container.querySelector('[data-metric="fullAttendanceReserve"]'))).toBe("R$ 1.500,00");
    expect(text(container.querySelector(".lp-period"))).toContain("21/10/2026 a 05/11/2026");
    expect(text(container.querySelector(".lp-metadata"))).toContain("29/10/2026, 12:30");
    expect(container.textContent).toContain("Saldo a desembolsar aos funcionários");
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector(".lp-groups tbody tr").textContent).toContain("Consolidado ponderado");
  });

  it("mantém filtros em edição separados dos confirmados e exporta o mesmo objeto sem nova consulta", async () => {
    const first = laborProjectionFixture(), pending = deferred();
    const requestReport = vi.fn().mockResolvedValueOnce({ ok: true, report: first }).mockReturnValueOnce(pending.promise);
    await render({ requestReport });
    await select("Área", "works"); await select("Obra", "work-b");
    expect(container.textContent).toContain("Filtros em edição");
    expect(text(container.querySelector(".lp-confirmed-filters"))).toBe("Filtros confirmados: Todas as áreas");
    await click(button("Excel")); await click(button("PDF"));
    expect(exportLaborProjectionExcel).toHaveBeenCalledExactlyOnceWith(first);
    expect(exportLaborProjectionPdf).toHaveBeenCalledExactlyOnceWith(first);
    expect(requestReport).toHaveBeenCalledOnce();
    await submit();
    expect(requestReport).toHaveBeenLastCalledWith({ ...first.filters, area: "works", obraId: "work-b" });
    expect(button("PDF").disabled).toBe(true);
    expect(text(container.querySelector(".lp-confirmed-filters"))).toBe("Filtros confirmados: Todas as áreas");
    const confirmed = laborProjectionFixture();
    confirmed.filters = { ...confirmed.filters, area: "works", obraId: "work-a" };
    confirmed.generatedAt = "2026-10-29T15:45:00.000Z";
    await settle(pending, confirmed);
    expect(control("Obra").value).toBe("work-a");
    expect(text(container.querySelector(".lp-confirmed-filters"))).toBe("Filtros confirmados: Obras · Obra Sintética Alameda");
    expect(container.querySelector(".lp-draft-notice")).toBeNull();
    await click(button("Excel"));
    expect(exportLaborProjectionExcel).toHaveBeenLastCalledWith(confirmed);
    expect(requestReport).toHaveBeenCalledTimes(2);
  });

  it("preserva consulta anterior após falha de rede, mas remove o snapshot se o acesso for negado", async () => {
    const report = laborProjectionFixture(), requestReport = vi.fn().mockResolvedValueOnce({ ok: true, report }).mockResolvedValueOnce({ ok: false, error: "Falha sintética de conexão." }).mockResolvedValueOnce({ ok: false, status: 403, error: "Acesso negado." });
    await render({ requestReport });
    await click(button("Atualizar"));
    expect(container.querySelector('[role="alert"]').textContent).toContain("A atualização não foi concluída");
    expect(text(container.querySelector('[data-metric="projectedCost"]'))).toBe("R$ 1.440,00");
    expect(container.textContent).toContain("seu período e filtros originais");
    await click(button("Tentar novamente"));
    expect(container.textContent).toContain("Acesso negado");
    expect(container.querySelector(".lp-kpis")).toBeNull();
    expect(container.textContent).not.toContain("Pessoa Sintética Alfa");
    expect(button("PDF").disabled).toBe(true);
  });

  it("restringe pessoa, filtro e memória individual mesmo com dados extras no payload", async () => {
    const report = laborProjectionFixture(); report.permissions.canViewPeople = false;
    report.issues = [{ code: "missing", employeeId: "person-a", message: "Pessoa Sintética Alfa precisa de conferência." }];
    await render({ requestReport: vi.fn().mockResolvedValue({ ok: true, report }) });
    expect(control("Pessoa")).toBeNull();
    expect(container.textContent).not.toContain("Pessoa Sintética Alfa");
    expect(container.querySelector('[aria-label="Custos por pessoa autorizada"]')).toBeNull();
    await click(button("Memória de cálculo"));
    expect(container.querySelector("dialog[open]")).toBeTruthy();
    expect(container.querySelector("dialog").textContent).toContain("Este perfil consulta dados agregados");
    expect(container.querySelector("dialog").textContent).not.toContain("Pessoa Sintética Alfa");
  });

  it("abre memória por pessoa, mostra componentes sem dupla soma e devolve foco ao fechar", async () => {
    const report = laborProjectionFixture();
    report.people[0].days[0].component = "salary";
    report.people[0].days[1].component = "attendance";
    await render({ requestReport: vi.fn().mockResolvedValue({ ok: true, report }) });
    const opener = button("Ver memória de Pessoa Sintética Alfa"); opener.focus(); await click(opener);
    const dialog = container.querySelector("dialog[open]");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.textContent).toContain("Salário CLT de competência");
    expect(dialog.textContent).toContain("Benefícios / presença");
    const first = dialog.querySelector('[aria-label="Memória diária da pessoa"] tbody tr');
    expect([...first.querySelectorAll(".lp-money")].map(text)).toEqual(["R$ 140,00", "R$ 20,00", "R$ 10,00", "R$ 150,00", "R$ 150,00"]);
    await act(async () => dialog.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true })));
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    await click(button("Conferir pendências"));
    expect(document.activeElement).toBe(container.querySelector("#lp-pending-title"));
  });

  it("distingue subtotal parcial, valores indisponíveis e ausência de equipe", async () => {
    const report = laborProjectionFixture();
    Object.assign(report.totals, { partial: true, estimatedCost: null, projectedCost: 900, unpricedDays: 4 });
    Object.assign(report.cash, { available: false, partial: true, projectedNet: null, remainingToPay: null, withheldTransfer: null, unionWithheldAmount: 25 });
    report.issues.push({ code: "history_missing", message: "Histórico insuficiente para quatro dias futuros." });
    const requestReport = vi.fn().mockResolvedValue({ ok: true, report });
    await render({ requestReport });
    expect(container.textContent).toContain("Subtotal parcial de custo");
    expect(text(container.querySelector('[data-metric="estimatedCost"]'))).toBe("Indisponível");
    expect(container.querySelector(".lp-cash-values").textContent).toContain("Subtotal conhecido");
    expect(container.querySelector(".lp-cash-values").textContent).toContain("Indisponível");
    const empty = laborProjectionFixture(); empty.totals.employeeCount = 0; empty.groups = []; empty.people = [];
    requestReport.mockResolvedValueOnce({ ok: true, report: empty });
    await click(button("Atualizar"));
    expect(container.textContent).toContain("Nenhuma pessoa neste recorte");
    expect(container.querySelector(".lp-charts")).toBeNull();
    expect(container.textContent).not.toContain("Não foi possível consultar");
  });

  it("mostra condição provisória sem rotular como subtotal uma consulta calculável", async () => {
    const report = laborProjectionFixture(); report.totals.provisional = true;
    await render({ requestReport: vi.fn().mockResolvedValue({ ok: true, report }) });
    expect(container.textContent).toContain("Estimativa provisória");
    expect(container.querySelector(".lp-kpis").textContent).toContain("Custo esperado da quinzena");
    expect(container.querySelector(".lp-kpis").textContent).not.toContain("Subtotal parcial");
    expect(text(container.querySelector('[data-metric="actualCost"]'))).toBe("R$ 900,00");
  });

  it("descarta uma resposta antiga quando a fronteira autorizada muda", async () => {
    const old = deferred(), newest = laborProjectionFixture();
    newest.permissions.canViewPeople = false;
    await render({ requestReport: vi.fn().mockReturnValue(old.promise) });
    await render({ requestReport: vi.fn().mockResolvedValue({ ok: true, report: newest }) });
    await settle(old, laborProjectionFixture());
    expect(container.textContent).not.toContain("Pessoa Sintética Alfa");
    expect(control("Pessoa")).toBeNull();
  });

  it("não publica totais quando a resposta omite filtros ou ciclo confirmado", async () => {
    const report = laborProjectionFixture(); delete report.filters;
    await render({ requestReport: vi.fn().mockResolvedValue({ ok: true, report }) });
    expect(container.querySelector('[role="alert"]').textContent).toContain("O servidor não confirmou");
    expect(container.querySelector(".lp-kpis")).toBeNull();
  });
});
