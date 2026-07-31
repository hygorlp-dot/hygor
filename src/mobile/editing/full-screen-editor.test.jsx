import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullScreenEditor } from "./FullScreenEditor.jsx";

const schema = { entity: "supplier", title: { create: "Novo fornecedor", edit: "Editar fornecedor" }, sections: [{ id: "main", title: "Dados" }], fields: [{ name: "name", label: "Nome", type: "text", required: true, section: "main" }] };
const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
function changeNativeValue(element, value) { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } document.body.querySelectorAll('[role="dialog"]').forEach(node => node.remove()); });

describe("FullScreenEditor", () => {
  it("opens as a mobile dialog with persistent save actions", () => {
    render(<FullScreenEditor open schema={schema} initialValues={{ name: "Fornecedor" }} onSubmit={vi.fn()} onOpenChange={vi.fn()} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.className).toContain("arcd-mobile-editor");
    expect(dialog.querySelector('[data-sticky-actions="true"]')).toBeTruthy();
    expect(dialog.textContent).toContain("Cancelar");
    expect(dialog.textContent).toContain("Salvar");
  });

  it("asks before discarding a dirty edit", () => {
    const onOpenChange = vi.fn();
    render(<FullScreenEditor open schema={schema} initialValues={{ name: "Fornecedor" }} onSubmit={vi.fn()} onOpenChange={onOpenChange} />);
    const dialog = document.querySelector('[role="dialog"]');
    act(() => changeNativeValue(dialog.querySelector("input"), "Fornecedor alterado"));
    act(() => dialog.querySelector('button[aria-label="Fechar editor"]').click());
    expect(document.body.textContent).toContain("Existem alterações não salvas");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the same protection when Escape is used after an edit", () => {
    const onOpenChange = vi.fn();
    render(<FullScreenEditor open schema={schema} initialValues={{ name: "Fornecedor" }} onSubmit={vi.fn()} onOpenChange={onOpenChange} />);
    const dialog = document.querySelector('[role="dialog"]');
    act(() => changeNativeValue(dialog.querySelector("input"), "Fornecedor alterado"));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.body.textContent).toContain("Existem alterações não salvas");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("saves through the same edit-engine submission contract", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FullScreenEditor open schema={schema} initialValues={{ name: "Fornecedor" }} onSubmit={onSubmit} onOpenChange={vi.fn()} />);
    const dialog = document.querySelector('[role="dialog"]');
    await act(async () => { changeNativeValue(dialog.querySelector("input"), "Atualizado"); [...dialog.querySelectorAll("button")].find(button => button.textContent === "Salvar").click(); });
    expect(onSubmit).toHaveBeenCalledWith({ name: "Atualizado" });
  });
});
