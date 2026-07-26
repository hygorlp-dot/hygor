import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable.jsx";

const rows = [
  { id: "1", nome: "Constrular", cidade: "Recife", pedidos: 12 },
  { id: "2", nome: "Areia Forte", cidade: "Olinda", pedidos: 3 },
  { id: "3", nome: "Cimento Sul", cidade: "Recife", pedidos: 8 },
];
const columns = [{ key: "nome", header: "Fornecedor" }, { key: "cidade", header: "Cidade" }, { key: "pedidos", header: "Pedidos" }];
const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
function changeNativeValue(element, value) { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }
afterEach(() => { while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); } vi.unstubAllGlobals(); });

describe("DataTable", () => {
  it("renderiza colunas, registros e estado vazio", () => {
    const container = render(<DataTable data={rows} columns={columns} search={{ fields: ["nome"], placeholder: "Buscar fornecedores" }} />);
    expect(container.querySelectorAll("th")).toHaveLength(3);
    expect(container.textContent).toContain("Constrular");
    const empty = render(<DataTable data={[]} columns={columns} />);
    expect(empty.textContent).toContain("Nenhum registro encontrado.");
  });

  it("filtra, ordena e pagina localmente", () => {
    const container = render(<DataTable data={rows} columns={columns} search={{ fields: ["nome", "cidade"], placeholder: "Buscar" }} pagination={{ pageSize: 1 }} />);
    const search = container.querySelector("input");
    act(() => changeNativeValue(search, "recife"));
    expect(container.textContent).toContain("Constrular");
    expect(container.textContent).not.toContain("Areia Forte");
    act(() => container.querySelectorAll("th button")[0].click());
    expect(container.querySelector("tbody tr").textContent).toContain("Cimento Sul");
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Próxima").click());
    expect(container.querySelector("tbody tr").textContent).toContain("Constrular");
  });

  it("executa clique da linha e exibe carregamento", () => {
    const onRowClick = vi.fn();
    const container = render(<DataTable data={rows} columns={columns} onRowClick={onRowClick} />);
    act(() => container.querySelector("tbody tr").click());
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    const loading = render(<DataTable data={rows} columns={columns} loading />);
    expect(loading.querySelector('[role="status"]').textContent).toContain("Carregando");
  });

  it("troca para cartões quando o viewport é mobile", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const container = render(<DataTable data={rows} columns={columns} />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelectorAll(".arcd-record-card")).toHaveLength(3);
    expect(container.textContent).toContain("Fornecedor");
  });

  it("prioriza o cartão mobile configurado e mantém ações separadas", () => {
    const onArchive = vi.fn();
    const onRowClick = vi.fn();
    const container = render(<DataTable mobile data={rows} columns={columns} onRowClick={onRowClick} mobileConfig={{ title: "nome", subtitle: "cidade", status: row => `${row.pedidos} pedidos`, primaryFields: ["cidade", "pedidos"], actions: [{ id: "archive", label: "Arquivar", tone: "danger", onSelect: onArchive }] }} />);
    expect(container.querySelectorAll(".arcd-mobile-record-card")).toHaveLength(3);
    expect(container.textContent).toContain("12 pedidos");
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Ver detalhes").click());
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Mais").click());
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Mais").click());
    act(() => [...document.querySelectorAll('[role="menuitem"]')].find(button => button.textContent === "Arquivar").click());
    expect(onArchive).toHaveBeenCalledWith(rows[0]);
  });
});
