import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierEditor } from "../SupplierEditor.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } document.body.querySelectorAll(".arcd-dialog-backdrop").forEach(node => node.remove()); });

describe("SupplierEditor", () => {
  it("edita categorias sem perder campos legados desconhecidos", async () => {
    const onSave = vi.fn();
    render(<SupplierEditor open supplier={{ id: "f-1", nome: "Depósito", categorias: ["cimento"], campoAntigo: "preservar" }} onOpenChange={vi.fn()} onSave={onSave} />);
    const category = [...document.querySelectorAll("button")].find(button => button.textContent === "Cimento e argamassas");
    expect(category.getAttribute("aria-pressed")).toBe("true");
    act(() => category.click());
    expect(category.getAttribute("aria-pressed")).toBe("false");
    await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Salvar").click());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "f-1", nome: "Depósito", categorias: [], campoAntigo: "preservar" }));
  });

  it("bloqueia a edição em modo somente leitura", () => {
    render(<SupplierEditor open supplier={{ id: "f-1", nome: "Depósito" }} onOpenChange={vi.fn()} onSave={vi.fn()} readOnly />);
    expect(document.querySelector("input").readOnly).toBe(true);
    expect(document.querySelector('button[type="submit"]').disabled).toBe(true);
  });
});
