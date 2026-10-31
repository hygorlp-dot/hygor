import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceNavigation, WorkspaceFilters } from "./WorkspaceNavigation.jsx";

let root, container;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
function render(element) {
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container); act(() => root.render(element));
}

it("desktop and mobile destinations dispatch the same stable area id", () => {
  const onChange = vi.fn();
  render(<WorkspaceNavigation label="Fluxo" active="fila" onChange={onChange}
    items={[{ id:"fila", label:"Fila", count:3 }, { id:"pedidos", label:"Pedidos", count:1 }]}
    tools={[{ id:"historico", label:"Histórico" }]}/>);
  const selector = container.querySelector("select");
  act(() => { selector.value = "historico"; selector.dispatchEvent(new Event("change", { bubbles:true })); });
  act(() => container.querySelector('button[aria-label="Pedidos"]').click());
  expect(onChange.mock.calls).toEqual([["historico"], ["pedidos"]]);
  expect(container.querySelector('[aria-current="page"]').textContent).toContain("Fila");
});

it("collapsing advanced filters preserves the controls and their entered values", () => {
  render(<WorkspaceFilters activeCount={1}><input aria-label="Prazo" defaultValue="vencidos"/></WorkspaceFilters>);
  const control = container.querySelector("input"), toggle = container.querySelector("button");
  expect(toggle.textContent).toContain("Filtros (1)");
  act(() => toggle.click()); expect(toggle.getAttribute("aria-expanded")).toBe("true");
  act(() => toggle.click()); expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelector("input")).toBe(control);
  expect(control.value).toBe("vencidos");
});
