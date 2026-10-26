import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchasesByWork, motivoSemControle } from "./PurchasesByWork.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = [];
const norm = text => String(text || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

const linha = (extra = {}) => ({
  obraId: "o", obra: "Obra", temControle: true, motivoSemControle: null, temOrcamento: true,
  orcado: 100000, comprometido: 40000, pctOrcado: 40, estouradas: 0, atencaoOrcamento: 0,
  aReceber: 12000, aPagar: 8000, andamento: 3, atrasados: 0, atencaoPrazo: 0, aprovacoes: 0, gravidade: 3, ...extra,
});
const totais = (extra = {}) => ({ obras: 3, semControle: 1, orcado: 150000, comprometido: 90000, comprometidoComControle: 85000, aReceber: 20000, aPagar: 15000, atrasados: 2, andamento: 7, pctOrcado: 56.7, ...extra });

function render(model, props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onOpenWork = vi.fn();
  act(() => root.render(<PurchasesByWork model={model} onOpenWork={onOpenWork} {...props} />));
  mounted.push({ root, container });
  return { container, onOpenWork };
}

afterEach(() => { mounted.splice(0).forEach(({ root, container }) => { act(() => root.unmount()); container.remove(); }); });

const model = () => ({
  linhas: [
    linha({ obraId: "e", obra: "Obra estourada", pctOrcado: 150, comprometido: 150000, estouradas: 2, gravidade: 0, atrasados: 1 }),
    linha({ obraId: "p", obra: "Obra perto do limite", pctOrcado: 93, atencaoOrcamento: 1, gravidade: 2, atencaoPrazo: 2 }),
    linha({ obraId: "s", obra: "Obra sem baseline", temControle: false, orcado: 0, pctOrcado: null, motivoSemControle: "baseline_ausente", gravidade: 3, andamento: 0 }),
  ],
  totais: totais(),
});

describe("PurchasesByWork", () => {
  it("mostra uma linha por obra, na ordem recebida, e o rodapé com os totais", () => {
    const { container } = render(model());
    const names = [...container.querySelectorAll("tbody .purchase-work-name b")].map(node => norm(node.textContent));
    expect(names).toEqual(["Obra estourada", "Obra perto do limite", "Obra sem baseline"]);
    const footer = norm(container.querySelector("tfoot").textContent);
    expect(footer).toContain("Todas as obras (3)");
    expect(footer).toContain("R$ 150.000");
    expect(footer).toContain("57% do orçado nas obras com controle");
    expect(footer).toContain("2 atrasadas");
  });

  it("sinaliza estouro, perto do limite e a barra com o percentual por extenso para leitor de tela", () => {
    const { container } = render(model());
    const rows = container.querySelectorAll("tbody tr");
    expect(norm(rows[0].textContent)).toContain("Estourou em 2 etapas");
    expect(norm(rows[0].textContent)).toContain("▲ 150% do orçado");
    expect(rows[0].querySelector(".purchase-work-bar").dataset.tone).toBe("danger");
    expect(rows[0].querySelector(".purchase-work-bar i").style.width).toBe("100%");
    expect(rows[0].querySelector('[role="img"]').getAttribute("aria-label")).toBe("150% do orçamento comprometido");
    expect(norm(rows[1].textContent)).toContain("1 etapa perto do limite");
    expect(rows[1].querySelector(".purchase-work-bar").dataset.tone).toBe("warning");
    expect(rows[1].querySelector(".purchase-work-bar i").style.width).toBe("93%");
  });

  it("obra sem orçamento de controle mostra o motivo, traço no orçado e nenhuma barra", () => {
    const { container } = render(model());
    const row = container.querySelectorAll("tbody tr")[2];
    expect(norm(row.textContent)).toContain("Sem baseline aprovada");
    expect(row.querySelector(".purchase-work-bar")).toBeNull();
    expect(row.querySelector('[aria-label="sem orçamento de controle"]').textContent).toBe("—");
    expect(row.querySelector(".purchase-chip[title]").getAttribute("title")).toContain("Aprovar baseline");
    expect(norm(container.querySelector(".purchase-by-work__note").textContent)).toBe("1 de 3 obra(s) sem orçamento de controle");
  });

  it("o botão Abrir leva o id da obra e tem nome acessível com a obra", () => {
    const { container, onOpenWork } = render(model());
    const button = [...container.querySelectorAll("button")].find(item => item.getAttribute("aria-label") === "Abrir compras de Obra perto do limite");
    act(() => button.click());
    expect(onOpenWork).toHaveBeenCalledWith("p");
  });

  it("usa linhas de cabeçalho semânticas (rowheader) sem herdar o estilo global de th", () => {
    const { container } = render(model());
    expect(container.querySelectorAll('tbody td[role="rowheader"]')).toHaveLength(3);
    expect(container.querySelectorAll("tbody th")).toHaveLength(0);
    expect(container.querySelectorAll("thead th")).toHaveLength(7);
  });

  it("sem nenhuma obra com controle o rodapé mostra traço em vez de R$ 0", () => {
    const semControle = { linhas: [linha({ temControle: false, orcado: 0, pctOrcado: null, motivoSemControle: "baseline_ausente" })], totais: totais({ obras: 1, semControle: 1, orcado: 0, pctOrcado: null }) };
    const { container } = render(semControle);
    expect(container.querySelector('tfoot [aria-label="nenhuma obra com orçamento de controle"]').textContent).toBe("—");
  });

  it("não renderiza nada sem obras", () => {
    const { container } = render({ linhas: [], totais: totais({ obras: 0 }) });
    expect(container.querySelector(".purchase-by-work")).toBeNull();
  });

  it("título e legenda podem ser trocados (uso no Orçado × comprado)", () => {
    const { container } = render(model(), { titulo: "Orçado × comprado por obra", legenda: "Abra uma obra." });
    expect(container.querySelector("h4").textContent).toBe("Orçado × comprado por obra");
    expect(container.querySelector("header p").textContent).toBe("Abra uma obra.");
  });
});

describe("motivoSemControle", () => {
  it("separa 'sem orçamento' de 'falta aprovar a baseline' e dá a providência de cada caso", () => {
    expect(motivoSemControle({ temOrcamento: false, motivoSemControle: "baseline_ausente" }).label).toBe("Sem orçamento");
    expect(motivoSemControle({ temOrcamento: true, motivoSemControle: "baseline_ausente" }).dica).toContain("Aprovar baseline");
    expect(motivoSemControle({ temOrcamento: true, motivoSemControle: "baseline_ambigua" }).label).toBe("Baseline duplicada");
    expect(motivoSemControle({ temOrcamento: true, motivoSemControle: "versao_ausente" }).label).toBe("Baseline sem versão");
  });
});
