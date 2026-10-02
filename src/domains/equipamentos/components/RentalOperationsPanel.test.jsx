import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import RentalOperationsPanel from "./RentalOperationsPanel.jsx";
import { buildRentalData, HOJE } from "../rental-operations.fixture.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rentalCss = readFileSync(resolve(process.cwd(), "src/domains/equipamentos/components/rental-operations.css"), "utf8");

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
    expect(kpiText(container, "Receita contratual no período")).toContain("R$ 8.380,00");
    expect(kpiText(container, "Receita contratual no período")).toContain("Setembro 2026 · todas as obras · todas as situações");
    expect(kpiText(container, "Taxa de ocupação")).toContain("28%");
    expect(kpiText(container, "Faturas a receber")).toContain("R$ 880,00");
    expect(norm(container.querySelector(".ro-summary").textContent)).toBe("3 locações em andamento 2 obras R$ 5.980,00 no período");
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
    expect(kpiText(container, "Receita contratual no período")).toContain("Agosto 2026 · todas as obras · todas as situações");
    // L2 (10/08 a 05/09) está em agosto: 22 dias x 4 un. x R$ 10
    expect(kpiText(container, "Receita contratual no período")).toContain("R$ 880,00");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 1");
    expect(rowIds(container)).toEqual([]); // nenhuma em andamento em agosto -> aba vazia, mas as outras mostram o contexto
    click(segment(container, "Todas"));
    expect(rowIds(container)).toEqual(["L2"]);
  });

  it("navega mês a mês com ‹ ›", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Mês anterior"]'));
    expect(kpiText(container, "Receita contratual no período")).toContain("Agosto 2026");
    click(container.querySelector('button[aria-label="Próximo mês"]'));
    click(container.querySelector('button[aria-label="Próximo mês"]'));
    expect(kpiText(container, "Receita contratual no período")).toContain("Outubro 2026");
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
    expect(kpiText(container, "Receita contratual no período")).toContain("R$ 4.400,00");
    expect(kpiText(container, "Receita contratual no período")).toContain("Setembro 2026 · P1-08 — Oásis Home Park · todas as situações");
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

describe("nomenclatura financeira: receita contratual x faturas a receber", () => {
  it("o primeiro indicador diz que é contratual e de onde vem; não promete DRE", () => {
    const { container } = render();
    const text = kpiText(container, "Receita contratual no período");
    expect(text).toContain("R$ 8.380,00");
    expect(text).toContain("Conforme tarifas das locações");
    expect(text).not.toMatch(/DRE/);
    const label = [...container.querySelectorAll(".arcd-summary-card__label span")].find(item => item.textContent === "Receita contratual no período");
    expect(label.getAttribute("title")).toMatch(/tarifa e pelos dias/);
    // o nome antigo, ambíguo, não existe mais
    expect(container.textContent).not.toContain("Receita no período");
  });

  it("o segundo indicador é de faturas (conta faturas, não locações) e avisa que está fora do DRE", () => {
    const { container } = render();
    const text = kpiText(container, "Faturas a receber");
    expect(text).toContain("R$ 880,00");
    expect(text).toContain("2 faturas pendentes");
    expect(text).toContain("R$ 1.500,00 medidos, ainda sem fatura");
    expect(text).toContain("Controle interno, ainda fora do DRE");
    const label = [...container.querySelectorAll(".arcd-summary-card__label span")].find(item => item.textContent === "Faturas a receber");
    expect(label.getAttribute("title")).toMatch(/faturas emitidas/);
    expect(container.textContent).not.toMatch(/A receber(?! )/);
  });

  it("sem fatura com saldo, o indicador diz isso em vez de mostrar uma contagem vazia", () => {
    const data = buildRentalData();
    data.rentalInvoices = []; data.rentalChargeItems = [];
    const { container } = render({ data });
    const text = kpiText(container, "Faturas a receber");
    expect(text).toContain("R$ 0,00");
    expect(text).toContain("Nenhuma fatura com saldo");
  });

  it("o aviso do DRE continua recolhido e discreto (não é alerta nem botão de ação)", () => {
    const { container } = render();
    const notice = container.querySelector(".ro-notice");
    expect(notice.tagName).toBe("DETAILS");
    expect(notice.hasAttribute("open")).toBe(false);
    expect(notice.getAttribute("role")).toBeNull();
    expect(notice.querySelector('[role="alert"], button')).toBeNull();
    click(notice.querySelector("summary"));
    expect(notice.textContent).toContain("ainda não entram no DRE");
  });
});

describe("situação da locação x situação da cobrança", () => {
  it("as colunas têm nomes distintos e o mesmo estado não vira o mesmo rótulo", () => {
    const { container } = render();
    click(segment(container, "Encerradas"));
    const headers = [...container.querySelectorAll("thead th")].map(item => norm(item.textContent));
    expect(headers.some(text => text.startsWith("Situação da locação"))).toBe(true);
    expect(headers.some(text => text.startsWith("Situação da cobrança"))).toBe(true);
    const row = container.querySelector('tr[data-row-id="L2"]');
    const cells = [...row.querySelectorAll("td")];
    const situacao = norm(cells[3].textContent);
    const cobranca = norm(cells[5].textContent);
    expect(situacao).toContain("Encerrada");
    expect(cobranca).toContain("Ciclo encerrado");
    expect(cobranca).not.toMatch(/^Encerrada/);
  });

  it("o filtro de cobrança usa o vocabulário financeiro (inclui 'Ciclo encerrado')", () => {
    const { container } = render();
    const options = [...fieldFor(container, "Cobrança").options].map(option => option.textContent);
    expect(options).toContain("Ciclo encerrado");
    expect(options).not.toContain("Encerrada");
  });
});

describe("em andamento sem ação de ciclo", () => {
  const scheduledEnd = () => {
    const data = buildRentalData();
    Object.assign(data.locacoesEquip[0], { fim: "2026-09-30", plannedEndDate: "" });
    return data;
  };

  it("a linha explica o motivo, sem alerta, e o menu/detalhe repetem a nota", () => {
    const { container } = render({ data: scheduledEnd() });
    const row = container.querySelector('tr[data-row-id="L1"]');
    expect(row).not.toBeNull(); // continua "Em andamento"
    const note = "Ciclo indisponível — término programado em 30/09/2026";
    expect(norm(row.textContent)).toContain(note);
    expect(row.querySelector(".ro-flag")).toBeNull(); // informação operacional, não alerta
    click(row.querySelector('button[aria-label^="Mais ações"]'));
    const menu = document.body.querySelector('[role="menu"]');
    expect(norm(menu.textContent)).toContain(note);
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map(item => norm(item.textContent));
    expect(items.some(label => label.startsWith("Avançar") || label.startsWith("Checklist"))).toBe(false);
    expect(items).toContain("Medir competência"); // a cobrança continua à mão
    click(byRole(menu, '[role="menuitem"]', "Abrir detalhes"));
    expect(norm(document.body.querySelector('[role="dialog"]').textContent)).toContain(note);
  });

  it("quem não opera o contrato não vê a nota (não perdeu nenhuma ação)", () => {
    const { container } = render({ data: scheduledEnd(), user: { id: "u9", role: "rh" } });
    expect(norm(container.querySelector('tr[data-row-id="L1"]').textContent)).not.toContain("Ciclo indisponível");
  });
});

describe("filtros combinados: indicadores, contagens e tabela falam do mesmo universo", () => {
  it("Setembro + Terras Alpha + cobrança pendente + 'andaime'", () => {
    const { container } = render();
    choose(container, "Obra", "ob-a");
    choose(container, "Cobrança", "pendente");
    typeInto(container, "Buscar", "andaime");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 1");
    expect(norm(segment(container, "Em andamento").textContent)).toBe("Em andamento 1");
    expect(rowIds(container)).toEqual(["L7"]);
    expect(kpiText(container, "Receita contratual no período")).toContain("R$ 280,00");
    expect(kpiText(container, "Faturas a receber")).toContain("R$ 280,00");
    expect(kpiText(container, "Faturas a receber")).toContain("1 fatura pendente");
    expect(kpiText(container, "Equipamentos locados")).toContain("1 locação(ões)");
    expect(norm(container.querySelector(".ro-summary").textContent)).toContain("1 locação em andamento");
    expect(kpiText(container, "Receita contratual no período")).toContain("Setembro 2026 · K1-04 — Terras Alpha · todas as situações · filtros ativos");
  });

  it("trocar a situação muda só a lista: as contagens e os indicadores continuam os do recorte", () => {
    const { container } = render();
    const before = kpiText(container, "Receita contratual no período");
    click(segment(container, "Encerradas"));
    expect(rowIds(container)).toEqual(["L2"]);
    expect(kpiText(container, "Receita contratual no período")).toBe(before);
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 6");
  });
});

describe("'Todo o período' e persistência do contexto", () => {
  it("mostra locações antigas, atuais e programadas; a programada não tem valor nem dias", () => {
    const data = buildRentalData();
    data.locacoesEquip.push({ id: "OLD", equipamentoId: "eq-bet", obraId: "ob-b", inicio: "2025-01-10", fim: "2025-01-31", quantidade: 1, status: "ativa", version: 1 });
    const { container } = render({ data });
    choose(container, "Período", "tudo");
    click(segment(container, "Todas"));
    expect(rowIds(container)).toEqual(expect.arrayContaining(["OLD", "L1", "L2", "L3", "L5"]));
    expect(norm(container.querySelector('tr[data-row-id="L3"]').textContent)).toContain("inicia em 20/09/26");
    expect(norm(container.querySelector('tr[data-row-id="OLD"]').textContent)).toContain("R$ 1.500,00");
    expect(kpiText(container, "Receita contratual no período")).toContain("Todo o período · todas as obras");
    expect(kpiText(container, "Receita contratual no período")).not.toMatch(/Setembro|Agosto/);
  });

  it("alterar outro filtro não devolve o período ao mês atual", () => {
    const { container } = render();
    choose(container, "Período", "tudo");
    choose(container, "Obra", "ob-a");
    typeInto(container, "Buscar", "eq");
    click(segment(container, "Encerradas"));
    choose(container, "Cobrança", "pendente");
    expect(fieldFor(container, "Período").value).toBe("tudo");
    expect(kpiText(container, "Receita contratual no período")).toContain("Todo o período");
  });

  it("'Todo o período' pagina corretamente com muitos registros antigos", () => {
    const data = buildRentalData();
    data.locacoesEquip = Array.from({ length: 60 }, (_, index) => ({
      id: `H${String(index).padStart(2, "0")}`, equipamentoId: "eq-and", obraId: "ob-a", inicio: `2025-0${1 + (index % 9)}-01`, fim: `2025-0${1 + (index % 9)}-20`, quantidade: 1, status: "ativa", version: 1,
    }));
    const { container } = render({ data });
    choose(container, "Período", "tudo");
    click(segment(container, "Encerradas"));
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("1–25 de 60");
    click(byRole(container, ".ro-pagination button", "Próxima"));
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("26–50 de 60");
    choose(container, "Agrupar por", "mes");
    expect(norm(container.querySelector(".ro-pagination").textContent)).toContain("1–25 de 60");
  });
});

describe("aba padrão", () => {
  it("sem locações em andamento no contexto, continua em 'Em andamento' com estado vazio contextual", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Mês anterior"]'));
    click(container.querySelector('button[aria-label="Mês anterior"]'));
    expect(kpiText(container, "Receita contratual no período")).toContain("Julho 2026");
    expect(segment(container, "Em andamento").getAttribute("aria-pressed")).toBe("true");
    expect(norm(segment(container, "Todas").textContent)).toBe("Todas 1");
    expect(rowIds(container)).toEqual([]);
    expect(container.textContent).toContain("Nenhuma locação encontrada para estes filtros.");
    expect(container.textContent).toContain("Há 1 locação(ões) neste contexto em outras situações");
    expect(segment(container, "Todas").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("menu de ações: posição, scroll e foco", () => {
  const rectOf = (top, bottom = top + 36) => ({ top, bottom, left: 900, right: 940, width: 40, height: bottom - top, x: 900, y: top });
  const spyRects = initial => {
    const state = { trigger: initial };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
      return this.getAttribute?.("aria-haspopup") === "menu" ? state.trigger : rectOf(0, 0);
    });
    return state;
  };
  const openMenu = container => click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
  const menuEl = () => document.body.querySelector('[role="menu"]');

  it("acompanha o botão quando a página rola e não fecha por isso", () => {
    const state = spyRects(rectOf(200));
    const { container } = render();
    openMenu(container);
    const top = Number.parseFloat(menuEl().style.top);
    state.trigger = rectOf(150);
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(menuEl()).not.toBeNull();
    expect(Number.parseFloat(menuEl().style.top)).toBe(top - 50);
  });

  it("fecha se o botão sair da tela, ao clicar fora e depois de escolher uma ação", () => {
    const state = spyRects(rectOf(200));
    const { container } = render();
    openMenu(container);
    state.trigger = rectOf(-120, -84);
    act(() => { window.dispatchEvent(new Event("scroll")); });
    expect(menuEl()).toBeNull();
    state.trigger = rectOf(200);
    openMenu(container);
    act(() => { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); });
    expect(menuEl()).toBeNull();
    openMenu(container);
    click(byRole(menuEl(), '[role="menuitem"]', "Editar locação"));
    expect(menuEl()).toBeNull();
  });

  it("fica dentro da janela (sem criar rolagem horizontal) e vira para cima perto do rodapé", () => {
    spyRects({ ...rectOf(700, 736), left: 1250, right: 1290 });
    const { container } = render();
    openMenu(container);
    const style = menuEl().style;
    expect(Number.parseFloat(style.left) + 256).toBeLessThanOrEqual(window.innerWidth - 8 + 0.5);
    expect(Number.parseFloat(style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(style.top)).toBeLessThan(700); // abriu acima do botão
  });

  it("acessibilidade do menu: botão com aria-haspopup/expanded, itens navegáveis por setas, Esc devolve o foco", () => {
    const { container } = render();
    const trigger = container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]');
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = [...menuEl().querySelectorAll('[role="menuitem"]')];
    act(() => { items[0].focus(); });
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(document.activeElement).toBe(items[1]);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
    expect(document.activeElement).toBe(items[0]);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(menuEl()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("acessibilidade e teclado", () => {
  it("todo filtro tem rótulo associado ao controle", () => {
    const { container } = render();
    ["Período", "Obra", "Cobrança", "Buscar", "Agrupar por"].forEach(label => {
      const field = fieldFor(container, label);
      expect(field, label).not.toBeNull();
      expect(field.id).toBeTruthy();
    });
  });

  it("cabeçalhos ordenáveis são botões com nome e aria-sort; só a coluna ativa é anunciada como ordenada", () => {
    const { container } = render();
    const sorted = [...container.querySelectorAll("th[aria-sort]")].filter(th => th.getAttribute("aria-sort") !== "none");
    expect(sorted).toHaveLength(1); // padrão de "Em andamento": por término (coluna Período, botão "Fim")
    expect(sorted[0].textContent).toContain("Período");
    expect(container.querySelector('button[aria-label="Ordenar por situação da locação"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Ordenar por situação da cobrança"]')).not.toBeNull();
    click(container.querySelector('button[aria-label="Ordenar por valor"]'));
    expect(container.querySelector('th[aria-sort="descending"]').textContent).toContain("Valor no período");
  });

  it("chips removíveis são botões com nome descritivo; 'Limpar filtros' só existe com filtro ativo", () => {
    const { container } = render();
    expect(byRole(container, "button", "Limpar filtros")).toBeUndefined();
    choose(container, "Cobrança", "pendente");
    const chip = container.querySelector(".ro-chip");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("aria-label")).toBe("Remover filtro Cobrança: Pendente");
  });

  it("a linha é operável só com teclado: o nome do equipamento e o '⋯' são botões", () => {
    const { container } = render();
    const row = container.querySelector('tr[data-row-id="L1"]');
    expect(row.querySelector("button.ro-link").getAttribute("aria-label")).toBe("Abrir detalhes de BETONEIRA 400 L");
    expect(row.querySelector('button[aria-haspopup="menu"]')).not.toBeNull();
    expect(container.querySelector("table caption").textContent).toBe("Locações de equipamentos");
  });

  it("o foco volta ao nome do equipamento ao fechar o detalhe aberto pelo menu", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Mais ações de BETONEIRA 400 L"]'));
    click(byRole(document.body, '[role="menuitem"]', "Abrir detalhes"));
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    click(document.body.querySelector('button[aria-label="Fechar detalhes"]'));
    expect(document.activeElement).toBe(container.querySelector('tr[data-row-id="L1"] .ro-link'));
  });

  it("estados vazios têm título e ação nomeada", () => {
    const { container } = render({ data: { ...buildRentalData(), locacoesEquip: [] } });
    expect(container.querySelector(".arcd-feedback-state__title").textContent).toBe("Nenhuma locação cadastrada.");
    expect(byRole(container, "button", "Nova locação")).toBeTruthy();
  });
});

describe("detalhe: ordem de leitura e sem cartões aninhados", () => {
  it("seções na ordem pedida, separadas por divisores (nenhuma seção é um cartão)", () => {
    const { container } = render();
    click(container.querySelector('button[aria-label="Abrir detalhes de BETONEIRA 400 L"]'));
    const dialog = document.body.querySelector('[role="dialog"]');
    const titles = [...dialog.querySelectorAll(".ro-detail h3")].map(item => item.textContent);
    expect(titles).toEqual(["Equipamento", "Obra", "Período", "Situação", "Tarifa e valores", "Cobranças", "Faturas", "Histórico", "Ações"]);
    expect(dialog.querySelectorAll(".arcd-summary-card, .ro-context, [class*='card']")).toHaveLength(0);
    expect(norm(dialog.textContent)).toContain("Contratual em Setembro 2026");
  });
});

describe("responsividade pelo modelo (sem depender de pixels)", () => {
  it("nenhuma informação some sem ser recolocada: proprietário e período existem em cada linha para as larguras estreitas", () => {
    const { container } = render();
    container.querySelectorAll("tbody tr[data-row-id]").forEach(row => {
      expect(norm(row.querySelector(".ro-inline-owner").textContent), row.dataset.rowId).not.toBe("");
      expect(row.querySelector(".ro-inline-period").textContent).toContain("→");
    });
    const venceRow = container.querySelector('tr[data-row-id="L1"]');
    expect(norm(venceRow.querySelector(".ro-inline-period").textContent)).toContain("Vence em 3 dia(s)"); // o alerta de prazo também acompanha
  });

  it("o CSS responde à largura do painel (container query) e não à da janela", () => {
    expect(rentalCss).toMatch(/container-type:\s*inline-size/);
    expect(rentalCss).toMatch(/@container ro \(max-width:/);
    expect(rentalCss).not.toMatch(/@media[^{]*(max|min)-width/);
  });
});
