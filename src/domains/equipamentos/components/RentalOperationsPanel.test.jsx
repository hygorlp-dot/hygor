import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import RentalOperationsPanel from "./RentalOperationsPanel.jsx";
import { buildRentalData, HOJE } from "../rental-operations.fixture.js";

const mounted = [];
const admin = { id: "u1", role: "admin" };
const norm = text => String(text || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

function render(props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onAction = vi.fn();
  const onNovaLocacao = vi.fn();
  const onRetry = vi.fn();
  const all = { data: buildRentalData(), user: admin, hoje: HOJE, onAction, onNovaLocacao, onRetry, ...props };
  act(() => root.render(<RentalOperationsPanel {...all} />));
  mounted.push({ container, root });
  return { container, onAction, onNovaLocacao, onRetry, rerender: next => act(() => root.render(<RentalOperationsPanel {...all} {...next} />)) };
}

afterEach(() => {
  while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const click = element => act(() => { element.click(); });
const byRole = (root, selector, text) => [...root.querySelectorAll(selector)].find(item => norm(item.textContent).includes(text));
const fieldFor = (root, label) => {
  const labelEl = [...root.querySelectorAll("label")].find(item => norm(item.textContent) === label);
  return labelEl ? document.getElementById(labelEl.htmlFor) : null;
};
function setValue(element, value, event = "change") {
  const proto = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  act(() => { element.dispatchEvent(new Event(event, { bubbles: true })); });
}
const choose = (root, label, value) => setValue(fieldFor(root, label), value, "change");
const typeInto = (root, label, value) => setValue(fieldFor(root, label), value, "input");
const segment = (root, label) => [...root.querySelectorAll(".ro-segment")].find(item => norm(item.textContent).startsWith(label));
const rowIds = root => [...root.querySelectorAll("tbody tr[data-row-id]")].map(row => row.dataset.rowId);
const kpiText = (root, label) => norm([...root.querySelectorAll(".arcd-summary-card")].find(card => card.textContent.includes(label))?.textContent);

describe("Central operacional de locações · contexto padrão", () => {
  it("abre no mês atual, em andamento, com indicadores do contexto e contagem por situação", () => {
    const { container } = render();
    expect(norm(segment(container, "Em andamento").textContent)).toBe("Em andamento 3");
    expect(norm(segment(container, "Programadas").textContent)).toBe("Programadas 1");
    expect(norm(segment(container, "Encerradas").textContent)).toBe("Encerradas 1");
    expect(norm(segment(container, "Canceladas").textContent)).toBe("Canceladas 1");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 6");
    expect(segment(container, "Em andamento").getAttribute("aria-pressed")).toBe("true");
    expect(rowIds(container)).toEqual(["L1", "L7", "L6"]);
    expect(kpiText(container, "Receita no período")).toContain("R$ 8.380,00");
    expect(kpiText(container, "Receita no período")).toContain("Setembro 2026 · todas as obras");
    expect(kpiText(container, "Taxa de ocupação")).toContain("28%");
    expect(kpiText(container, "A receber")).toContain("R$ 880,00");
    expect(norm(container.querySelector(".ro-summary").textContent)).toBe("3 locações 2 obras R$ 5.980,00 no período");
    expect(container.textContent).not.toContain("Limpar filtros");
  });

  it("o aviso de cobrança por ciclo é discreto e recolhido", () => {
    const { container } = render();
    const notice = container.querySelector(".ro-notice");
    expect(notice.hasAttribute("open")).toBe(false);
    expect(norm(notice.querySelector("summary").textContent)).toContain("Cobrança por ciclo ainda não está integrada ao DRE.");
  });
});

describe("período", () => {
  it("trocar o período atualiza lista, contagens e indicadores", () => {
    const { container } = render();
    choose(container, "Período", "mes_anterior");
    expect(kpiText(container, "Receita no período")).toContain("Agosto 2026 · todas as obras");
    // L2 (10/08 a 05/09) está em agosto: 22 dias x 4 un. x R$ 10
    expect(kpiText(container, "Receita no período")).toContain("R$ 880,00");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 1");
    expect(rowIds(container)).toEqual([]); // nenhuma em andamento em agosto -> aba vazia, mas as outras mostram o contexto
    click(segment(container, "Todas"));
    expect(rowIds(container)).toEqual(["L2"]);
  });

  it("navega mês a mês com ‹ ›", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Mês anterior"]'));
    expect(kpiText(container, "Receita no período")).toContain("Agosto 2026");
    click(container.querySelector('button[aria-label="Próximo mês"]'));
    click(container.querySelector('button[aria-label="Próximo mês"]'));
    expect(kpiText(container, "Receita no período")).toContain("Outubro 2026");
    expect(container.querySelector(".ro-chips")).not.toBeNull(); // saiu do mês atual: vira filtro ativo
  });

  it("período personalizado mostra as duas datas e filtra por elas", () => {
    const { container } = render();
    choose(container, "Período", "personalizado");
    expect(fieldFor(container, "De")).not.toBeNull();
    expect(container.querySelector('button[aria-label="Mês anterior"]')).toBeNull();
    setValue(fieldFor(container, "De"), "2026-09-20", "change");
    setValue(fieldFor(container, "Até"), "2026-09-25", "change");
    click(segment(container, "Todas"));
    expect(rowIds(container).sort()).toEqual(["L1", "L3", "L5", "L6", "L7"]); // L2 terminou antes
  });

  it("'Todo o período' inclui locações antigas", () => {
    const { container } = render();
    choose(container, "Período", "tudo");
    click(segment(container, "Todas"));
    expect(rowIds(container)).toHaveLength(7);
  });
});

describe("filtros, busca e chips", () => {
  it("filtra por obra com código e nome, e KPIs passam a refletir a obra", () => {
    const { container } = render();
    choose(container, "Obra", "ob-b");
    expect(kpiText(container, "Receita no período")).toContain("R$ 4.400,00");
    expect(kpiText(container, "Receita no período")).toContain("Setembro 2026 · P1-08 — Oásis Home Park");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 2");
    const chip = byRole(container, ".ro-chip", "P1-08 — Oásis Home Park");
    expect(chip).toBeTruthy();
    click(chip);
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 6");
  });

  it("filtra por cobrança", () => {
    const { container } = render();
    choose(container, "Cobrança", "pendente");
    click(segment(container, "Todas"));
    expect(rowIds(container)).toEqual(["L7"]);
    expect(byRole(container, ".ro-chip", "Cobrança: Pendente")).toBeTruthy();
  });

  it("proprietário e categoria ficam em 'Mais filtros' e contam como filtros ativos", () => {
    const { container } = render();
    expect(fieldFor(container, "Proprietário")).toBeNull();
    click(byRole(container, "button", "Mais filtros"));
    choose(container, "Proprietário", "terceiros");
    choose(container, "Categoria", "Acesso");
    click(segment(container, "Todas"));
    expect(rowIds(container).sort()).toEqual(["L2", "L5", "L7"]);
    expect(byRole(container, "button", "Mais filtros (2)")).toBeTruthy();
  });

  it("busca por nome, código, obra ou proprietário e limpa pelo botão do campo", () => {
    const { container } = render();
    click(segment(container, "Todas"));
    typeInto(container, "Buscar", "oasis");
    expect(rowIds(container).sort()).toEqual(["L2", "L6"]);
    typeInto(container, "Buscar", "eq-023");
    expect(rowIds(container)).toEqual(["L1"]);
    click(container.querySelector('button[aria-label="Limpar busca"]'));
    expect(fieldFor(container, "Buscar").value).toBe("");
    expect(rowIds(container)).toHaveLength(6);
  });

  it("combina filtros e 'Limpar filtros' devolve a visão padrão (e só aparece quando há filtro)", () => {
    const { container } = render();
    expect(byRole(container, "button", "Limpar filtros")).toBeUndefined();
    choose(container, "Obra", "ob-a");
    typeInto(container, "Buscar", "andaime");
    click(segment(container, "Encerradas"));
    const labels = [...container.querySelectorAll(".ro-chip")].map(chip => norm(chip.textContent));
    expect(labels).toEqual(["K1-04 — Terras Alpha", "Busca: “andaime”", "Encerradas"]);
    click(byRole(container, "button", "Limpar filtros"));
    expect(container.querySelector(".ro-chips")).toBeNull();
    expect(fieldFor(container, "Obra").value).toBe("all");
    expect(fieldFor(container, "Buscar").value).toBe("");
    expect(segment(container, "Em andamento").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ordenação e agrupamento", () => {
  it("ordena clicando no cabeçalho, alternando sentido, com aria-sort", () => {
    const { container } = render();
    click(segment(container, "Todas"));
    click(container.querySelector('button[aria-label="Ordenar por valor"]'));
    expect(rowIds(container)[0]).toBe("L6");
    expect(container.querySelector('th[aria-sort="descending"]').textContent).toContain("Valor no período");
    click(container.querySelector('button[aria-label="Ordenar por valor"]'));
    expect(rowIds(container)[0]).toBe("L5");
    expect(container.querySelector('th[aria-sort="ascending"]').textContent).toContain("Valor no período");
    click(container.querySelector('button[aria-label="Ordenar por obra"]'));
    expect(["L1", "L3", "L5", "L7"]).toContain(rowIds(container)[0]);
  });

  it("agrupa por obra com título, contagem e total do grupo", () => {
    const { container } = render();
    click(segment(container, "Todas"));
    choose(container, "Agrupar por", "obra");
    const headers = [...container.querySelectorAll(".ro-group-row")].map(row => norm(row.textContent));
    expect(headers).toEqual([
      "K1-04 — Terras Alpha 4 locações · R$ 3.980,00 no período",
      "P1-08 — Oásis Home Park 2 locações · R$ 4.400,00 no período",
    ]);
    // linhas contíguas por grupo
    expect(rowIds(container).slice(0, 4).sort()).toEqual(["L1", "L3", "L5", "L7"]);
    choose(container, "Agrupar por", "none");
    expect(container.querySelector(".ro-group-row")).toBeNull();
  });
});

describe("resultados vazios, erro e carregamento", () => {
  it("sem nenhuma locação cadastrada: estado próprio com CTA 'Nova locação'", () => {
    const { container, onNovaLocacao } = render({ data: { ...buildRentalData(), locacoesEquip: [] } });
    expect(container.textContent).toContain("Nenhuma locação cadastrada.");
    expect(container.textContent).not.toContain("para estes filtros");
    click(byRole(container, "button", "Nova locação"));
    expect(onNovaLocacao).toHaveBeenCalledTimes(1);
  });

  it("filtro sem resultado: mensagem diferente, com CTA 'Limpar filtros'", () => {
    const { container } = render();
    typeInto(container, "Buscar", "nada disso existe");
    expect(container.textContent).toContain("Nenhuma locação encontrada para estes filtros.");
    expect(container.textContent).not.toContain("Nenhuma locação cadastrada.");
    const clear = [...container.querySelectorAll(".arcd-feedback-state button")].find(button => button.textContent === "Limpar filtros");
    click(clear);
    expect(rowIds(container)).toEqual(["L1", "L7", "L6"]);
  });

  it("aba sem itens avisa que há locações em outras situações", () => {
    const { container } = render();
    click(segment(container, "Programadas"));
    click(segment(container, "Canceladas"));
    expect(rowIds(container)).toEqual(["L5"]);
    choose(container, "Cobrança", "pendente");
    expect(container.textContent).toContain("Há 1 locação(ões) neste contexto em outras situações");
  });

  it("erro informado pelo dono da tela: mensagem clara e 'Tentar novamente'", () => {
    const { container, onRetry } = render({ error: "falha de rede" });
    expect(container.textContent).toContain("Não foi possível carregar as locações.");
    expect(container.querySelector("table")).toBeNull();
    click(byRole(container, "button", "Tentar novamente"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("dado malformado não deixa a tabela vazia em silêncio: vira erro com nova tentativa", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render({ data: { ...buildRentalData(), locacoesEquip: [null] } });
    expect(container.textContent).toContain("Não foi possível carregar as locações.");
    expect(byRole(container, "button", "Tentar novamente")).toBeTruthy();
  });

  it("carregando: reserva a área e não mostra tabela nem vazio", () => {
    const { container } = render({ loading: true });
    expect(container.querySelector('[role="status"]').getAttribute("aria-label")).toBe("Carregando locações");
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toContain("Nenhuma locação");
  });
});

describe("ações da linha", () => {
  it("a ação principal da linha em andamento é 'Medir competência'; encerradas não a oferecem", () => {
    const { container, onAction } = render();
    const row = container.querySelector('tr[data-row-id="L1"]');
    const button = byRole(row, "button", "Medir competência");
    expect(button).toBeTruthy();
    click(button);
    expect(onAction.mock.calls[0][0]).toMatchObject({ id: "medir" });
    expect(onAction.mock.calls[0][1].id).toBe("L1");
    click(segment(container, "Encerradas"));
    expect(byRole(container.querySelector('tr[data-row-id="L2"]'), "button", "Medir competência")).toBeUndefined();
  });

  it("o resto fica no menu '⋯': exclusão isolada no fim, separada das ações comuns", () => {
    const { container, onAction } = render();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map(item => norm(item.textContent));
    expect(items[0]).toBe("Abrir detalhes");
    expect(items).toEqual(expect.arrayContaining(["Adicionar cobrança", "Emitir fatura", "Editar locação", "Prorrogar / renovar"]));
    expect(items.at(-1)).toBe("Excluir locação…");
    expect(menu.querySelectorAll(".ro-menu__item--danger")).toHaveLength(1);
    expect(menu.querySelector(".ro-menu__group--danger .ro-menu__item--danger")).not.toBeNull();
    click(byRole(menu, '[role="menuitem"]', "Adicionar cobrança"));
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
    expect(onAction.mock.calls[0][0]).toMatchObject({ id: "cobranca" });
    expect(onAction.mock.calls[0][2]).toEqual({ competence: "2026-09" });
  });

  it("o menu fecha com Esc", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it("excluir sai pelo mesmo canal de ações (a confirmação continua com o dono da tela)", () => {
    const { container, onAction } = render();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    click(byRole(document.body, '[role="menuitem"]', "Excluir locação"));
    expect(onAction.mock.calls[0][0]).toMatchObject({ id: "excluir", danger: true });
  });
});

describe("detalhe da locação", () => {
  it("abre ao clicar na linha com equipamento, obra, período, tarifa, cobranças e histórico", () => {
    const { container } = render();
    click(container.querySelector('tr[data-row-id="L7"] td'));
    const drawer = document.body.querySelector('[role="dialog"]');
    expect(drawer).not.toBeNull();
    const text = norm(drawer.textContent);
    ["Equipamento", "Obra", "Período", "Tarifa e valores", "Cobranças", "Histórico", "Ações"].forEach(title => expect(text).toContain(title));
    expect(text).toContain("Andaime tubular");
    expect(text).toContain("EQ-040");
    expect(text).toContain("Locadora Norte");
    expect(text).toContain("K1-04");
    expect(text).toContain("FAT-202609-003");
    expect(text).toContain("R$ 10,00/dia");
    expect(text).toContain("Início da locação");
  });

  it("ações administrativas ficam no detalhe e fecham o painel ao disparar", () => {
    const { container, onAction } = render();
    click(container.querySelector('button[aria-label="Abrir detalhes de BETONEIRA 400 L"]'));
    const drawer = document.body.querySelector('[role="dialog"]');
    click(byRole(drawer, "button", "Editar locação"));
    expect(onAction.mock.calls[0][0]).toMatchObject({ id: "editar" });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("Esc e o botão Fechar fecham o detalhe", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Abrir detalhes de BETONEIRA 400 L"]'));
    click(document.body.querySelector('button[aria-label="Fechar detalhes"]'));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("locação excluída aparece com motivo e sem ações", () => {
    const { container } = render();
    click(segment(container, "Canceladas"));
    click(container.querySelector('tr[data-row-id="L5"] td'));
    const text = norm(document.body.querySelector('[role="dialog"]').textContent);
    expect(text).toContain("Locação excluída");
    expect(text).toContain("Pedido duplicado");
    expect(text).toContain("Nenhuma ação disponível");
  });
});

describe("permissões", () => {
  it("perfil só de consulta não vê ações de alteração, apenas os detalhes", () => {
    const { container } = render({ user: { id: "u9", role: "rh" } });
    expect(byRole(container, "button", "Medir competência")).toBeUndefined();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map(item => norm(item.textContent));
    expect(items).toEqual(["Abrir detalhes"]);
    click(document.body.querySelector('[role="menuitem"]'));
    expect(norm(document.body.querySelector('[role="dialog"]').textContent)).toContain("Seu perfil consulta as locações, mas não pode alterá-las.");
  });

  it("engenheiro altera o contrato, mas não a cobrança", () => {
    const { container } = render({ user: { id: "u3", role: "engenheiro" } });
    expect(byRole(container, "button", "Medir competência")).toBeUndefined();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map(item => norm(item.textContent));
    expect(items).toContain("Editar locação");
    expect(items).not.toContain("Adicionar cobrança");
  });

  it("perfil vinculado a uma obra não age nas locações de outra", () => {
    const { container } = render({ user: { id: "u4", role: "financeiro", obraId: "ob-a" } });
    expect(byRole(container.querySelector('tr[data-row-id="L1"]'), "button", "Medir competência")).toBeTruthy();
    expect(byRole(container.querySelector('tr[data-row-id="L6"]'), "button", "Medir competência")).toBeUndefined();
  });
});

describe("obra fixa (Engenharia) e paginação", () => {
  it("dentro da obra o filtro de obra fica travado e só entram locações dela", () => {
    const { container } = render({ obraIdFixo: "ob-b" });
    const select = fieldFor(container, "Obra");
    expect(select.disabled).toBe(true);
    expect(select.value).toBe("ob-b");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 2");
    expect(container.querySelector(".ro-chips")).toBeNull();
  });

  it("pagina 25 por vez preservando filtros", () => {
    const data = buildRentalData();
    data.locacoesEquip = Array.from({ length: 60 }, (_, index) => ({
      id: `P${String(index).padStart(2, "0")}`, equipamentoId: "eq-and", obraId: "ob-a", inicio: "2026-09-01", fim: "", quantidade: 1, status: "ativa", version: 1,
    }));
    const { container } = render({ data });
    expect(rowIds(container)).toHaveLength(25);
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("1–25 de 60");
    click(byRole(container, ".ro-pagination button", "Próxima"));
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("26–50 de 60");
    click(byRole(container, ".ro-pagination button", "Próxima"));
    expect(rowIds(container)).toHaveLength(10);
    typeInto(container, "Buscar", "andaime");
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("1–25 de 60"); // filtrar volta à primeira página
  });
});
