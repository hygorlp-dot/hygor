import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryCombobox from "./CategoryCombobox.jsx";

let root, container;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
const options = [
  { id: "salario", label: "Salários administrativos", groupLabel: "Pessoal e benefícios" },
  { id: "energia", label: "Energia elétrica", groupLabel: "Ocupação e infraestrutura" },
];
const mount = props => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<CategoryCombobox label="Categoria" options={options} onChange={vi.fn()} {...props}/>));
  return container.querySelector('[role="combobox"]');
};
const type = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const key = (input, value) => act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));

describe("busca de categorias", () => {
  it("pesquisa nome e grupo sem acento e só escolhe a categoria com confirmação", () => {
    const change = vi.fn(); const input = mount({ onChange: change });
    act(() => input.focus()); type(input, "BENEFICIOS salarios");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(change).not.toHaveBeenCalled();
    key(input, "Enter");
    expect(change).toHaveBeenCalledWith("salario");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("suporta navegação por teclado, Escape e texto sem correspondência sem criar categoria", () => {
    const change = vi.fn(); const input = mount({ onChange: change });
    act(() => input.focus()); key(input, "ArrowDown");
    const active = document.getElementById(input.getAttribute("aria-activedescendant"));
    expect(active.textContent).toContain("Energia");
    key(input, "Enter"); expect(change).toHaveBeenLastCalledWith("energia");
    key(input, "ArrowDown"); type(input, "categoria inexistente"); key(input, "Enter");
    expect(change).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]').textContent).toContain("Nenhuma categoria");
    key(input, "Escape"); expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("limpa um filtro sem persistir o texto digitado como categoria", () => {
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    function Harness() {
      const [value, setValue] = useState("energia");
      return <CategoryCombobox label="Filtrar categoria" options={options} value={value} onChange={setValue} clearable/>;
    }
    act(() => root.render(<Harness/>));
    expect(container.querySelector("input").value).toBe("Energia elétrica");
    act(() => container.querySelector('button[aria-label="Limpar filtrar categoria"]').click());
    expect(container.querySelector("input").value).toBe("");
    expect(container.querySelector("input").placeholder).toBe("Todas as categorias");
  });
});
