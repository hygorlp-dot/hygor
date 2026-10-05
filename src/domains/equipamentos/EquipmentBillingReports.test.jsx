import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import EquipmentBillingReports from "./EquipmentBillingReports.jsx";
import { BILLING_HOJE, BILLING_YM, buildBillingData } from "./billing-dashboard.fixture.js";

const mounted = [];
const norm = text => String(text || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const PERIODS = [{ v: "2026-09", l: "Setembro 2026" }, { v: "2026-08", l: "Agosto 2026" }, { v: "2026-03", l: "Março 2026" }];

function Harness(props) {
  const [period, setPeriod] = React.useState(props.period || BILLING_YM);
  return <EquipmentBillingReports {...props} period={period} onPeriodChange={value => { props.onPeriodChange?.(value); setPeriod(value); }} />;
}

function render(overrides = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const handlers = {
    onPrintManagement: vi.fn(), onPrintWork: vi.fn(), onExportManagement: vi.fn(), onExportWork: vi.fn(),
    onEditRental: vi.fn(), onDeleteRental: vi.fn(), onAddRentalToWork: vi.fn(), onPeriodChange: vi.fn(),
  };
  const props = {
    data: buildBillingData(), periodOptions: PERIODS, ownerName: () => "Locadora Norte", hoje: BILLING_HOJE,
    formatDate: iso => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "-"), formatComposition: list => (list || []).map(item => `${item.qtd} ${item.label}`).join(" + "),
    ...handlers, ...overrides,
  };
  act(() => root.render(<Harness {...props} />));
  mounted.push({ container, root });
  return { container, ...handlers };
}

afterEach(() => {
  while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); }
  vi.restoreAllMocks();
});

const click = element => act(() => { element.click(); });
const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find(item => norm(item.textContent).includes(text));
const field = (root, label) => {
  const el = [...root.querySelectorAll("label")].find(item => norm(item.textContent) === label);
  return el ? document.getElementById(el.htmlFor) : null;
};
const choose = (root, label, value) => {
  const select = field(root, label);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, value);
  act(() => { select.dispatchEvent(new Event("change", { bubbles: true })); });
};
const type = (root, label, value) => {
  const input = field(root, label);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  act(() => { input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const term = (root, label) => norm([...root.querySelectorAll(".bc-term")].find(item => norm(item.querySelector("dt").textContent) === label)?.textContent);
const view = (root, label) => [...root.querySelectorAll('[role="tab"]')].find(item => item.textContent === label);

describe("Central de cobranças · estrutura", () => {
  it("é um painel operacional, não o documento: sem marca institucional nem competência repetida", () => {
    const { container } = render();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("CONTROLE DE LOCAÇÕES");
    expect(container.querySelector("h2").textContent).toBe("Central de cobranças");
    expect(byText(container, "button", "Relatório gerencial PDF")).toBeTruthy();
    expect(container.textContent).not.toContain("Imprimir / salvar PDF");
  });

  it("a equação financeira aparece na ordem certa, com escopo", () => {
    const { container } = render();
    const labels = [...container.querySelectorAll(".bc-equation dt")].map(item => norm(item.textContent));
    expect(labels).toEqual(["Receita contratual", "Descontos", "Receita líquida", "Custo total", "Resultado", "Margem"]);
    expect(term(container, "Receita contratual")).toContain("R$ 7.150,00");
    expect(term(container, "Descontos")).toContain("R$ 1.050,00");
    expect(term(container, "Receita líquida")).toContain("R$ 6.100,00");
    expect(term(container, "Custo total")).toContain("R$ 1.750,00");
    expect(term(container, "Resultado")).toContain("R$ 4.350,00");
    expect(norm(container.querySelector("#bc-result-title").parentElement.textContent)).toContain("Setembro 2026 · todas as obras");
  });

  it("indicadores não óbvios têm explicação (dica e texto para leitor de tela)", () => {
    const { container } = render();
    const receita = [...container.querySelectorAll(".bc-term dt")].find(item => norm(item.textContent) === "Receita contratual");
    expect(receita.getAttribute("title")).toMatch(/tarifas das locações/);
    expect(receita.parentElement.querySelector(".bc-sr-only").textContent).toMatch(/antes dos descontos/);
  });
});

describe("receita x faturamento x resultado", () => {
  it("faturamento é uma seção separada, avisa que não está no DRE e não soma na receita", () => {
    const { container } = render();
    const section = container.querySelector('[aria-labelledby="bc-billing-title"]');
    expect(norm(section.textContent)).toContain("As faturas ainda não alimentam o DRE");
    expect(term(section, "Faturado")).toContain("R$ 4.500,00");
    expect(term(section, "Recebido")).toContain("R$ 1.500,00");
    expect(term(section, "Faturas em aberto")).toContain("R$ 3.000,00");
    expect(term(section, "Faturas vencidas")).toContain("R$ 3.000,00");
    expect(term(container, "Receita líquida")).toContain("R$ 6.100,00");
    expect(term(container, "Resultado")).toMatch(/Não é caixa/);
  });
});

describe("fechamento e atenção necessária", () => {
  it("o fechamento explica o estado pelos fatos e não alega conferência registrada", () => {
    const { container } = render();
    const closing = container.querySelector(".bc-closing");
    expect(norm(closing.querySelector("h3").textContent)).toBe("Revisar antes da conferência");
    expect(norm(closing.textContent)).toContain("5/6 locações com tarifa e cobrança calculada");
    expect(norm(closing.textContent)).toContain("ainda não são registrados pelo sistema");
    expect(container.textContent).not.toContain("CONFERIDO");
  });

  it("cada pendência leva ao recorte correspondente na visão por obra", () => {
    const { container } = render();
    const items = [...container.querySelectorAll(".bc-attention li")].map(item => norm(item.textContent));
    expect(items[0]).toContain("1 locação sem tarifa");
    click(container.querySelector('button[aria-label="Ver: 1 desconto elevado (≥ 20%)"]'));
    expect(view(container, "Por obra").getAttribute("aria-selected")).toBe("true");
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(1);
    expect(norm(rows[0].textContent)).toContain("Oásis Home Park");
    expect(byText(container, ".bc-chip", "Desconto elevado (≥ 20%)")).toBeTruthy();
  });

  it("sem pendências: mensagem positiva explícita", () => {
    const { container } = render();
    choose(container, "Obra", "ob-a");
    type(container, "Buscar", "betoneira");
    expect(norm(container.querySelector(".bc-attention").textContent)).toContain("Nenhuma pendência crítica nesta competência.");
    expect(norm(container.querySelector(".bc-closing h3").textContent)).toBe("Pronto para conferência");
  });
});

describe("filtros", () => {
  it("competência, obra e propriedade mudam os indicadores; chips e 'Limpar filtros'", () => {
    const { container, onPeriodChange } = render();
    expect(byText(container, "button", "Limpar filtros")).toBeUndefined();
    choose(container, "Propriedade", "terceiros");
    expect(term(container, "Resultado")).toContain("R$ 0,00");
    expect(term(container, "Resultado")).not.toContain("Resultado negativo no período");
    choose(container, "Obra", "ob-a");
    expect(term(container, "Custo total")).toContain("só repasses");
    expect([...container.querySelectorAll(".bc-chip")].map(chip => norm(chip.textContent))).toEqual(["K1-04 — Terras Alpha", "Terceiros"]);
    click(byText(container, "button", "Limpar filtros"));
    expect(term(container, "Receita líquida")).toContain("R$ 6.100,00");
    choose(container, "Competência", "2026-08");
    expect(onPeriodChange).toHaveBeenCalledWith("2026-08");
    expect(term(container, "Receita líquida")).toContain("R$ 1.600,00");
  });

  it("'Somente com pendência' restringe o recorte", () => {
    const { container } = render();
    const checkbox = container.querySelector('.bc-filters input[type="checkbox"]');
    expect(norm(checkbox.closest("label").textContent)).toContain("Somente com pendência");
    act(() => { checkbox.click(); });
    expect(term(container, "Receita líquida")).toContain("R$ 3.150,00"); // G1 3.150 + S1 0
    expect(byText(container, ".bc-chip", "Somente com pendência")).toBeTruthy();
  });

  it("competência sem dados x filtro sem resultado são estados distintos", () => {
    const { container } = render();
    type(container, "Buscar", "nada disso existe");
    expect(container.textContent).toContain("Nenhum resultado para estes filtros.");
    expect(byText(container, ".arcd-feedback-state button", "Limpar filtros")).toBeTruthy();
    choose(container, "Competência", "2026-03");
    expect(container.textContent).toContain("Nenhuma cobrança encontrada para Março 2026.");
    expect(container.textContent).not.toContain("Nenhum resultado para estes filtros.");
  });
});

describe("próprios x terceiros, comparação e gráficos", () => {
  it("tabela própria/terceiros mostra terceiros com margem neutra quando repasse acompanha a locação", () => {
    const { container } = render();
    const table = [...container.querySelectorAll("table")].find(item => item.querySelector("caption")?.textContent.includes("próprios e de terceiros"));
    const margem = [...table.querySelectorAll("tbody tr")].find(row => row.querySelector("th").textContent === "Margem");
    expect(norm(margem.textContent)).not.toContain("margem negativa no período");
    expect(margem.querySelectorAll('td[data-negative="true"]')).toHaveLength(0);
  });

  it("compara com a competência anterior quando há dados", () => {
    const { container } = render();
    expect(term(container, "Receita líquida")).toMatch(/\+281,3% vs Agosto/);
    expect(term(container, "Utilização da frota")).toMatch(/p\.p\. vs Agosto/);
  });

  it("gráfico de tendência tem alternativa textual e tabela; meses sem dados não viram zero", () => {
    const { container } = render();
    expect(container.querySelector(".bc-chart__plot").getAttribute("aria-label")).toMatch(/Agosto 2026 a Setembro 2026/);
    const table = container.querySelector(".bc-chart__table table");
    const rows = [...table.querySelectorAll("tbody tr")].map(row => [...row.children].map(cell => norm(cell.textContent)).join(" "));
    expect(rows[0]).toBe("Abril 2026 sem locações");
    expect(rows.at(-1)).toContain("R$ 6.100,00");
  });

  it("resultado por obra: do maior para o menor, negativo com sinal e texto", () => {
    const { container } = render();
    const bars = [...container.querySelectorAll(".bc-bars li")].map(item => norm(item.textContent));
    expect(bars[0]).toContain("Oásis Home Park");
    expect(bars.at(-1)).toContain("−R$ 500,00 (negativo)");
  });
});

describe("visão por obra e memória", () => {
  it("ranking ordenável com aria-sort; a linha abre a memória e volta", () => {
    const { container } = render();
    click(view(container, "Por obra"));
    const names = () => [...container.querySelectorAll("tbody tr")].map(row => norm(row.querySelector("td").textContent));
    expect(names()[0]).toContain("Oásis Home Park");
    click(container.querySelector('button[aria-label="Ordenar por resultado"]'));
    expect(container.querySelector('th[aria-sort="descending"]').textContent).toContain("Resultado");
    click(container.querySelector('button[aria-label="Ordenar por resultado"]'));
    expect(names()[0]).toContain("Green Garden");
    click(container.querySelector('button[aria-label="Abrir memória da obra Oásis Home Park"]'));
    const memory = container.querySelector(".bc-memory");
    expect(norm(memory.querySelector("h3").textContent)).toContain("Oásis Home Park");
    expect(norm(memory.textContent)).toContain("Desconto elevado");
    expect(norm(memory.textContent)).toContain("Fatura vencida");
    click(byText(memory, "button", "Voltar ao ranking"));
    expect(container.querySelector(".bc-memory")).toBeNull();
  });

  it("ações da memória chamam o dono da tela (PDF, exportação, editar, excluir)", () => {
    const { container, onPrintWork, onExportWork, onEditRental, onDeleteRental, onAddRentalToWork } = render();
    click(view(container, "Por obra"));
    click(container.querySelector('button[aria-label="Abrir memória da obra Terras Alpha"]'));
    click(byText(container, "button", "PDF da obra"));
    click(byText(container, "button", "Exportar memória da obra"));
    click(byText(container, "button", "Adicionar equipamento à obra"));
    expect(onPrintWork).toHaveBeenCalledWith(expect.objectContaining({ id: "ob-a" }));
    expect(onExportWork).toHaveBeenCalledWith(expect.objectContaining({ id: "ob-a" }));
    expect(onAddRentalToWork).toHaveBeenCalledWith(expect.objectContaining({ id: "ob-a" }));
    click(byText(container.querySelector(".bc-memory tbody"), "button", "Editar"));
    expect(onEditRental).toHaveBeenCalled();
    click(container.querySelector('button[aria-label="Excluir locação de Andaime tubular"]'));
    expect(onDeleteRental).toHaveBeenCalledWith("A1");
  });

  it("exportação e PDF gerencial no cabeçalho", () => {
    const { container, onExportManagement, onPrintManagement } = render();
    click(byText(container, "button", "Exportar dados"));
    click(byText(container, "button", "Relatório gerencial PDF"));
    expect(onExportManagement).toHaveBeenCalledTimes(1);
    expect(onPrintManagement).toHaveBeenCalledTimes(1);
  });

  it("mapa da frota continua disponível", () => {
    const { container } = render();
    click(view(container, "Mapa da frota"));
    expect(container.querySelector("#bc-map-title").textContent).toContain("Mapa da frota");
    expect(container.querySelector('[aria-label="Obras com equipamentos"]').querySelectorAll("button")).toHaveLength(3);
  });
});

describe("erro e acessibilidade", () => {
  it("falha de cálculo não mostra zero: mostra erro e 'Tentar novamente'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const data = buildBillingData();
    data.locacoesEquip = [null];
    const { container } = render({ data });
    expect(container.textContent).toContain("Não foi possível calcular os indicadores desta competência.");
    expect(container.querySelector(".bc-equation")).toBeNull();
    expect(byText(container, "button", "Tentar novamente")).toBeTruthy();
  });

  it("filtros rotulados, visões como abas e tabelas com legenda", () => {
    const { container } = render();
    ["Competência", "Obra", "Propriedade", "Situação da cobrança", "Buscar"].forEach(label => expect(field(container, label), label).not.toBeNull());
    expect(container.querySelector('[role="tablist"]').getAttribute("aria-label")).toBe("Visões da central de cobranças");
    container.querySelectorAll("table").forEach(table => expect(table.querySelector("caption")).not.toBeNull());
  });
});


describe("análise explicável de próprios x terceiros", () => {
  it("abre o resultado neutro de terceiros e reconcilia até equipamento e locação", () => {
    const { container } = render();
    const trigger = container.querySelector('button[aria-label="Analisar resultado de equipamentos de terceiros"]');
    expect(trigger).not.toBeNull();
    expect(norm(trigger.textContent)).toContain("R$ 0,00");
    click(trigger);

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(norm(dialog.textContent)).toContain("Análise de resultado · Equipamentos de terceiros");
    const metricText = label => norm([...dialog.querySelectorAll(".bc-analysis__metric")].find(item => item.querySelector("span")?.textContent === label)?.textContent);
    expect(metricText("Receita líquida")).toContain("R$ 1.450,00");
    expect(metricText("Custo")).toContain("R$ 1.450,00");
    expect(metricText("Resultado")).toContain("R$ 0,00");
    expect(norm(dialog.textContent)).toContain("✓ fecha com o painel");
    expect(norm(dialog.textContent)).toContain("Grua 30 m");
    expect(norm(dialog.textContent)).not.toContain("Tarifa contratual abaixo do repasse");

    const grua = dialog.querySelector('button[aria-label="Analisar Grua 30 m"]');
    click(grua);
    expect(norm(dialog.textContent)).toContain("Green Garden");
    expect(norm(dialog.textContent)).toContain("R$ 1.000,00");
    expect(norm(dialog.textContent)).toContain("R$ 1.000,00");
    expect(norm(dialog.textContent)).not.toContain("−R$ 500,00");
  });

  it("receita, custo, resultado e margem dos dois grupos são analisáveis", () => {
    const { container } = render();
    ["receita líquida", "custo", "resultado", "margem"].forEach(metric => {
      ["equipamentos próprios", "equipamentos de terceiros"].forEach(group => {
        expect(container.querySelector(`button[aria-label="Analisar ${metric} de ${group}"]`)).not.toBeNull();
      });
    });
  });

  it("fecha com Esc e devolve o foco ao número agregado", () => {
    const { container } = render();
    const trigger = container.querySelector('button[aria-label="Analisar resultado de equipamentos de terceiros"]');
    act(() => trigger.focus());
    click(trigger);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
