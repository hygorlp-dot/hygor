import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetTextCell } from "./BudgetTextCell";

const mounted = [];
function typeText(input, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,text);
  input.dispatchEvent(new Event("input",{bubbles:true}));
}
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
  it("não salva a pesquisa ao sair sem selecionar uma composição", () => {
    const onCommit = vi.fn();
    const input = render({ value:"CONCRETO MAGRO PARA LASTRO, TRAÇO 1:4,5:4,5", searchOnly:true, onCommit });
    act(() => { input.focus(); typeText(input,"CONCRETO MAGRO"); });
    act(() => input.blur());
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("CONCRETO MAGRO PARA LASTRO, TRAÇO 1:4,5:4,5");
  });

  it("mostra a referência selecionada mesmo com o campo focado e não sobrescreve no blur", () => {
    const onCommit = vi.fn();
    const input = render({ value:"Antiga", searchOnly:true, onCommit, resetKey:0 });
    act(() => { input.focus(); typeText(input,"concreto magro"); });
    act(() => mounted.at(-1).root.render(<BudgetTextCell value="Descrição completa selecionada" searchOnly onCommit={onCommit} resetKey={1}/>));
    expect(input.value).toBe("Descrição completa selecionada");
    act(() => input.blur());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("repor a mesma composição também descarta o texto pesquisado", () => {
    const input = render({ value:"Original", searchOnly:true, resetKey:0 });
    act(() => { input.focus(); typeText(input,"busca"); });
    act(() => mounted.at(-1).root.render(<BudgetTextCell value="Original" searchOnly resetKey={1}/>));
    expect(input.value).toBe("Original");
  });

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
