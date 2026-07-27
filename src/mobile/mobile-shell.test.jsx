import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveProjectSwitcher, LegacyMobileNavigation, MobileAppShell, MobileBottomNavigation, selectMobilePrimaryGroups } from "./index.js";

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

describe("navegação móvel do app legado", () => {
  const groups = [
    { id:"admin_grp", label:"Administração" },
    { id:"painel", label:"Painel" },
    { id:"eng_grp", label:"Engenharia" },
    { id:"compras_grp", label:"Compras" },
    { id:"fin_grp", label:"Financeiro" },
    { id:"rh_grp", label:"Recursos humanos" },
  ];

  it("limita a barra a quatro setores e mantém o setor atual visível", () => {
    const layout = selectMobilePrimaryGroups(groups, "rh_grp");
    expect(layout.primary).toHaveLength(4);
    expect(layout.primary.map(group => group.id)).toContain("rh_grp");
    expect(layout.overflow.map(group => group.id)).not.toContain("rh_grp");
    expect([...layout.primary, ...layout.overflow]).toHaveLength(groups.length);
  });

  it("oferece no máximo cinco alvos na barra e abre os demais em Mais", async () => {
    const onSelectGroup = vi.fn();
    const container = render(<LegacyMobileNavigation
      groups={groups}
      activeGroupId="painel"
      onSelectGroup={onSelectGroup}
      renderIcon={() => <span aria-hidden="true">i</span>}
    />);
    expect(container.querySelectorAll(".mobile-primary-nav > button")).toHaveLength(5);
    const more = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Mais"));
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { more.click(); await Promise.resolve(); });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#arcd-mobile-modules-menu")).toBeTruthy();
    act(() => [...document.querySelectorAll(".arcd-mobile-more-menu__item")][0].click());
    expect(onSelectGroup).toHaveBeenCalledTimes(1);
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
    expect(document.body.classList.contains("no-scroll")).toBe(true);
    act(() => [...document.querySelectorAll("button")].find(button => button.textContent === "Suprimentos").click());
    expect(onNavigate).toHaveBeenCalledWith("supplies");
    expect(document.body.classList.contains("no-scroll")).toBe(false);
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
