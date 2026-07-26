import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityEditor } from "./EntityEditor.jsx";
import { validateSchema } from "./validation/validateSchema.js";

const schema = { entity: "supplier", title: { create: "Novo fornecedor", edit: "Editar fornecedor" }, sections: [{ id: "main", title: "Dados principais" }], fields: [{ name: "name", label: "Nome", type: "text", required: true, section: "main" }, { name: "email", label: "E-mail", type: "text", section: "main", validate: value => value && !value.includes("@") ? "Informe um e-mail válido." : null }] };
const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
function changeNativeValue(element, value) { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } document.body.querySelectorAll(".arcd-dialog-backdrop").forEach(node => node.remove()); });

describe("validação do editor", () => {
  it("valida obrigatório, campo e regra geral", async () => {
    const errors = await validateSchema({ fields: [{ name: "name", required: true }], validate: values => values.end < values.start ? { end: "A data final não pode ser anterior." } : {} }, { name: "", start: "2026-02-01", end: "2026-01-01" });
    expect(errors.name).toBe("Este campo é obrigatório.");
    expect(errors.end).toContain("não pode");
  });
});

describe("EntityEditor", () => {
  it("inicia com valores, identifica validação e salva valores alterados", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = render(<EntityEditor schema={schema} initialValues={{ name: "Fornecedor inicial", email: "" }} onSubmit={onSubmit} />);
    const [name, email] = container.querySelectorAll("input");
    expect(name.value).toBe("Fornecedor inicial");
    await act(async () => { changeNativeValue(email, "invalido"); container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain("Informe um e-mail válido.");
    await act(async () => { changeNativeValue(name, "Fornecedor atualizado"); changeNativeValue(email, "compras@arcd.com"); container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(onSubmit).toHaveBeenCalledWith({ name: "Fornecedor atualizado", email: "compras@arcd.com" });
  });

  it("mostra erro devolvido pelo servidor e respeita readonly e forbidden", async () => {
    const error = Object.assign(new Error("Não foi possível salvar."), { fieldErrors: { name: "Já cadastrado." } });
    const failingSubmit = vi.fn().mockRejectedValue(error);
    const container = render(<EntityEditor schema={schema} initialValues={{ name: "Duplicado" }} onSubmit={failingSubmit} />);
    await act(async () => { container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain("Já cadastrado.");
    const readonly = render(<EntityEditor schema={schema} initialValues={{ name: "Somente leitura" }} readOnly onSubmit={vi.fn()} />);
    expect(readonly.querySelector("input").readOnly).toBe(true);
    expect(readonly.querySelector("button[type=submit]").disabled).toBe(true);
    const forbidden = render(<EntityEditor schema={schema} initialValues={{ name: "Bloqueado" }} forbidden onSubmit={vi.fn()} />);
    expect(forbidden.textContent).toContain("não possui permissão");
  });

  it("solicita confirmação ao cancelar uma edição alterada", () => {
    const onRequestClose = vi.fn();
    const container = render(<EntityEditor schema={schema} initialValues={{ name: "Fornecedor" }} onSubmit={vi.fn()} onRequestClose={onRequestClose} />);
    const input = container.querySelector("input");
    act(() => changeNativeValue(input, "Fornecedor alterado"));
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Cancelar").click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
