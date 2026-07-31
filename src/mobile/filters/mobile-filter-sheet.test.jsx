import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveFilterChips } from "./ActiveFilterChips.jsx";
import { MobileFilterSheet } from "./MobileFilterSheet.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } document.body.querySelectorAll('[role="dialog"]').forEach(node => node.remove()); });

describe("MobileFilterSheet", () => {
  it("opens with active count and applies or clears filters", () => {
    const onApply = vi.fn(); const onClear = vi.fn(); const onOpenChange = vi.fn();
    render(<MobileFilterSheet open activeCount={2} onApply={onApply} onClear={onClear} onOpenChange={onOpenChange}><label>Obra <input /></label></MobileFilterSheet>);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("2 filtros ativos");
    act(() => [...dialog.querySelectorAll("button")].find(button => button.textContent === "Limpar").click());
    act(() => [...dialog.querySelectorAll("button")].find(button => button.textContent === "Aplicar filtros").click());
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps active filters removable and supports clearing all", () => {
    const onRemove = vi.fn(); const onClear = vi.fn();
    const container = render(<ActiveFilterChips filters={[{ id: "obra", label: "Obra: Monte Verde" }]} onRemove={onRemove} onClear={onClear} />);
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent.includes("Monte Verde")).click());
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Limpar filtros").click());
    expect(onRemove).toHaveBeenCalledWith({ id: "obra", label: "Obra: Monte Verde" });
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
