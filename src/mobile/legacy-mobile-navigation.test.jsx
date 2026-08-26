// Extraído de mobile-shell.test.jsx (26/08/2026) quando o restante da
// fundação mobile (MobileAppShell, MobileBottomNavigation,
// ActiveProjectSwitcher, dashboard/editing/field/filters/connectivity) foi
// arquivado em archive/mobile-foundation-2026-08 - só LegacyMobileNavigation
// segue em uso real (nav inferior do app legado). Ver docs/ARCD_MOBILE.md.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LegacyMobileNavigation, selectMobilePrimaryGroups } from "./LegacyMobileNavigation.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

// MobileMoreMenu é lazy-carregado dentro de LegacyMobileNavigation. Ao
// contrário de mobile-shell.test.jsx (que importava tudo de ./index.js, cujo
// barrel já importava MobileMoreMenu de forma eager antes de qualquer teste
// rodar), este arquivo importa LegacyMobileNavigation direto - então o
// import() dinâmico só resolve de verdade na primeira vez que o menu abre.
// Poll em vez de um delay fixo: robusto independente de quanto o bundler
// leva para resolver o módulo pela primeira vez.
async function waitFor(check, { timeout = 1000, interval = 10 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = check();
    if (result) return result;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, interval)); });
  }
  throw new Error("waitFor: condição não satisfeita a tempo");
}

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
    act(() => more.click());
    await waitFor(() => document.querySelector("#arcd-mobile-modules-menu"));
    expect(more.getAttribute("aria-expanded")).toBe("true");
    act(() => [...document.querySelectorAll(".arcd-mobile-more-menu__item")][0].click());
    expect(onSelectGroup).toHaveBeenCalledTimes(1);
  });
});
