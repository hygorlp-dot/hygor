import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveProjectSwitcher, MobileAppShell, MobileBottomNavigation } from "./index.js";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
function changeNativeValue(element, value) { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value").set.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

describe("MobileBottomNavigation", () => {
  it("indica item ativo, navega e respeita acesso limitado", () => {
    const onNavigate = vi.fn();
    const container = render(<MobileBottomNavigation active="home" allowed={["home", "more"]} onNavigate={onNavigate} />);
    const home = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Início"));
    const finance = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Financeiro"));
    expect(home.getAttribute("aria-current")).toBe("page");
    act(() => home.click());
    act(() => finance.click());
    expect(onNavigate).toHaveBeenCalledWith("home");
    expect(onNavigate).not.toHaveBeenCalledWith("finance");
  });
});

describe("MobileAppShell", () => {
  it("mantém obra ativa na sessão e abre o menu Mais", () => {
    const onNavigate = vi.fn();
    const container = render(<MobileAppShell title="ARCD" active="home" projects={[{ id: "o1", name: "Residência Monte Verde" }, { id: "o2", name: "Casa Lago" }]} moreItems={[{ id: "supplies", label: "Suprimentos" }]} onNavigate={onNavigate}>Conteúdo</MobileAppShell>);
    const select = container.querySelector("select");
    expect(select.value).toBe("o1");
    act(() => changeNativeValue(select, "o2"));
    expect(select.value).toBe("o2");
    const more = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Mais"));
    act(() => more.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => [...document.querySelectorAll("button")].find(button => button.textContent === "Suprimentos").click());
    expect(onNavigate).toHaveBeenCalledWith("supplies");
  });

  it("fecha Mais por toque fora e por Escape", () => {
    const container = render(<MobileAppShell title="ARCD" active="home" moreItems={[{ id: "supplies", label: "Suprimentos" }]} onNavigate={vi.fn()}>Conteúdo</MobileAppShell>);
    const more = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Mais"));
    act(() => more.click());
    act(() => document.querySelector(".arcd-mobile-more-menu__backdrop").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    act(() => more.click());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("orienta quando não há obra disponível", () => {
    const container = render(<ActiveProjectSwitcher value="" projects={[]} onChange={vi.fn()} />);
    expect(container.textContent).toContain("Selecione uma obra para continuar.");
  });
});
