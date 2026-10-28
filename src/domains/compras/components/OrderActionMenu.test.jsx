import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderActionMenu } from "./OrderActionMenu.jsx";

const comuns = [{ id: "editar", label: "Editar pedido" }, { id: "enviar", label: "Reenviar ao fornecedor" }, { id: "whatsapp", label: "Conversar no WhatsApp", href: "https://wa.me/5511999990000" }];
const destrutivas = [{ id: "cancelar", label: "Cancelar pedido" }, { id: "excluir", label: "Excluir definitivamente" }];

const mounted = [];
function montar(props = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSelect = vi.fn();
  act(() => root.render(<OrderActionMenu label="Mais ações do pedido PC-001" comuns={comuns} destrutivas={destrutivas} onSelect={onSelect} {...props} />));
  mounted.push({ container, root });
  return { container, onSelect, trigger: container.querySelector("button.purchase-order-menu__trigger") };
}
const itens = () => [...document.querySelectorAll('[role="menuitem"]')];
const item = nome => itens().find(el => el.textContent.startsWith(nome));
const press = key => act(() => { document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
const click = el => act(() => { el.click(); });

afterEach(() => {
  while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); }
});

describe("menu ⋯ do pedido (R4)", () => {
  it("fica fechado até abrir e as destrutivas ficam num grupo separado, depois das comuns", () => {
    const { trigger } = montar();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(itens().map(el => el.textContent)).toEqual(["Editar pedido", "Reenviar ao fornecedor", "Conversar no WhatsApp", "Cancelar pedido…", "Excluir definitivamente…"]);
    const grupo = document.querySelector('[role="group"][aria-label="Ações irreversíveis"]');
    expect([...grupo.querySelectorAll('[role="menuitem"]')].map(el => el.textContent)).toEqual(["Cancelar pedido…", "Excluir definitivamente…"]);
  });

  it("abre no primeiro item, navega com as setas, Home e End, e Esc fecha devolvendo o foco ao botão", () => {
    const { trigger } = montar();
    trigger.focus();
    press("ArrowDown");
    expect(document.activeElement).toBe(item("Editar pedido"));
    press("ArrowDown");
    expect(document.activeElement).toBe(item("Reenviar"));
    press("End");
    expect(document.activeElement).toBe(item("Excluir"));
    press("ArrowDown");
    expect(document.activeElement).toBe(item("Editar pedido"));
    press("ArrowUp");
    expect(document.activeElement).toBe(item("Excluir"));
    press("Home");
    expect(document.activeElement).toBe(item("Editar pedido"));
    press("Escape");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("ArrowUp no botão abre no último item", () => {
    const { trigger } = montar();
    trigger.focus();
    press("ArrowUp");
    expect(document.activeElement).toBe(item("Excluir"));
  });

  it("escolher a ação fecha o menu e avisa qual foi", () => {
    const { trigger, onSelect } = montar();
    click(trigger);
    click(item("Reenviar"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("enviar");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("clicar fora e Tab fecham; ação de link vira âncora que abre em outra aba", () => {
    const { trigger } = montar();
    click(trigger);
    const link = item("Conversar no WhatsApp");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://wa.me/5511999990000");
    expect(link.getAttribute("target")).toBe("_blank");
    act(() => { document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    click(trigger);
    press("Tab");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("ocupado: as ações não disparam", () => {
    const { trigger, onSelect } = montar({ busy: true });
    click(trigger);
    click(item("Cancelar"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("sem nenhuma ação, nada é desenhado", () => {
    const { container } = montar({ comuns: [], destrutivas: [] });
    expect(container.querySelector("button")).toBeNull();
  });
});
