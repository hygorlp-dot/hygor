import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./LegacyApp.jsx";
import CategoryCombobox from "./features/conciliacao/CategoryCombobox.jsx";

vi.mock("./hooks/useBreakpoint", () => ({ useBreakpoint: () => ({ isDesktop: true }) }));

let root, container, opener;
beforeEach(() => {
  vi.useFakeTimers();
  opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  opener.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("foco inicial do modal", () => {
  it("leva o foco ao painel quando ainda não houve interação e o devolve ao fechar", () => {
    act(() => root.render(<Modal title="Conferir lançamento" onClose={vi.fn()}><input aria-label="Observação"/></Modal>));
    const dialog = container.querySelector('[role="dialog"]');
    act(() => vi.advanceTimersByTime(0));
    expect(document.activeElement).toBe(dialog);
    act(() => root.render(null));
    expect(document.activeElement).toBe(opener);
  });

  it("não rouba o foco nem fecha a busca de categoria iniciada antes do foco agendado", () => {
    const change = vi.fn();
    act(() => root.render(<Modal title="Apropriar transação" onClose={vi.fn()}>
      <CategoryCombobox label="Categoria de entrada" value="receita" onChange={change} options={[
        { id: "receita", label: "Recebimento de cliente a vincular", groupLabel: "Recebimentos a vincular" },
        { id: "receita_servicos", label: "Receita de serviços", groupLabel: "Receitas no DRE" },
      ]}/>
    </Modal>));
    const input = container.querySelector('[role="combobox"]');
    act(() => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "servicos");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(0));
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("servicos");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const option = container.querySelector('[role="option"]');
    expect(option?.textContent).toContain("Receita de serviços");
    act(() => option.click());
    expect(change).toHaveBeenCalledWith("receita_servicos");
  });
});
