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

it("groups keep every destination available on desktop and mobile with the selected area", () => {
  const onChange = vi.fn();
  render(<WorkspaceNavigation label="Financeiro" active="visao" onChange={onChange}
    groups={[{label:"Rotina",items:[{id:"hoje",label:"Hoje"}]},{label:"Análises",items:[{id:"visao",label:"Visão financeira"}]},{label:"Sem acesso",items:[]}]}
    toolsLabel="Ferramentas" tools={[{id:"ia",label:"Modo IA"}]}/>);
  const selector = container.querySelector("select");
  expect([...selector.querySelectorAll("optgroup")].map(group=>group.label)).toEqual(["Rotina","Análises","Ferramentas"]);
  expect(selector.value).toBe("visao");
  expect(container.querySelector('[aria-current="page"]').textContent).toBe("Visão financeira");
  act(()=>container.querySelector('button[aria-label="Hoje"]').click());
  act(()=>{selector.value="ia";selector.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(onChange.mock.calls).toEqual([["hoje"],["ia"]]);
});
