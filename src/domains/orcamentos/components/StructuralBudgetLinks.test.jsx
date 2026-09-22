import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import StructuralBudgetLinks, { compatibleMemoryUnit, memoryBudgetItems } from "./StructuralBudgetLinks";

const budget = {
  etapas: [{ id: "stage", nome: "Estrutura" }],
  itens: [
    { id: "concrete", etapaId: "stage", descricao: "Concretagem", unidade: "m3", quantidade: 0 },
    { id: "form", etapaId: "stage", descricao: "Fôrma", unidade: "m²", quantidade: 10 },
    { id: "title", etapaId: "stage", tipo: "titulo", descricao: "Título" },
  ],
  memoriaCalculo: { vinculosEstruturais: { "terreo.concreto": "concrete" } },
};
let root, container;
const render = (value = budget, onChange = vi.fn(), readOnly = false) => {
  if (!container) { container = document.createElement("div"); document.body.append(container); root = createRoot(container); }
  act(() => root.render(<StructuralBudgetLinks scope="terreo" rows={[{ key: "concreto", label: "Concreto", value: 1.06, unit: "m³" }]} budget={value} onChange={onChange} readOnly={readOnly}/>));
  return container;
};
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); container = root = null; });

it("acompanha a renumeração sem perder o destino estável", () => {
  expect(render().textContent).toContain("Item 1.1 · Quantidade");
  const reordered = { ...budget, etapas: [{ id: "before", nome: "Preliminares" }, ...budget.etapas] };
  expect(render(reordered).textContent).toContain("Item 2.1 · Quantidade");
  expect(memoryBudgetItems(reordered).map(item => item.id)).toEqual(["concrete", "form"]);
});
it("informa destino removido e unidade alterada", () => {
  expect(render({ ...budget, itens: [] }).textContent).toContain("Item removido");
  expect(render({ ...budget, itens: [{ ...budget.itens[0], unidade: "kg" }] }).textContent).toContain("Unidade do destino (kg) diferente de m³");
});
it("filtra por unidade e salva apenas o vínculo, permitindo desvincular", () => {
  const save = vi.fn();
  render(budget, save);
  act(() => container.querySelector("button").click());
  const select = container.querySelector("select");
  expect([...select.options].map(option => option.value)).toEqual(["", "concrete"]);
  act(() => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(save).toHaveBeenCalledWith("terreo.concreto", "");
  expect(budget.itens[0].quantidade).toBe(0);
});
it("mantém leitura sem permitir redefinir destinos em orçamento bloqueado", () => {
  expect(render(budget, vi.fn(), true).querySelector("button")).toBeNull();
  expect(container.textContent).toContain("Item 1.1");
  expect(compatibleMemoryUnit(" M³ ", "m3")).toBe(true);
  expect(compatibleMemoryUnit("m²", "m3")).toBe(false);
  expect(compatibleMemoryUnit("", "")).toBe(false);
});
