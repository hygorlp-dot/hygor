import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetTextCell } from "./BudgetTextCell";

const mounted = [];
function render(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<BudgetTextCell {...props}/>));
  mounted.push({ container, root });
  return container.querySelector("input");
}
afterEach(() => mounted.splice(0).forEach(({ container, root }) => {
  act(() => root.unmount());
  container.remove();
}));

describe("célula editável do orçamento", () => {
  it("só confirma o valor ao sair do campo", () => {
    const onCommit = vi.fn();
    const input = render({ value:"10", onCommit });
    act(() => {
      input.focus();
      input.value = "12";
      input.dispatchEvent(new Event("input", { bubbles:true }));
    });
    expect(onCommit).not.toHaveBeenCalled();
    act(() => input.blur());
    expect(onCommit).toHaveBeenCalledWith("12");
  });

  it("descarta a edição ao pressionar Escape", () => {
    const onCommit = vi.fn();
    const onEscape = vi.fn();
    const input = render({ value:"original", onCommit, onEscape });
    act(() => {
      input.focus();
      input.value = "alterado";
      input.dispatchEvent(new Event("input", { bubbles:true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key:"Escape", bubbles:true }));
    });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
