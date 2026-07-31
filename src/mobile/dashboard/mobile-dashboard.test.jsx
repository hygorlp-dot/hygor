import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileDashboard } from "./MobileDashboard.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

describe("MobileDashboard", () => {
  it("prioritizes the active project, essential metrics, pending work and field actions", () => {
    const onSelectAction = vi.fn();
    const container = render(<MobileDashboard project={{ name: "Residência Monte Verde", address: "Recife" }} metrics={{ progress: "48%", deadline: "12 dias", cost: "R$ 482.300,00" }} pending={[{ id: "compras", value: "3", label: "compras para aprovar" }]} quickActions={[{ id: "attendance", label: "Registrar ponto", primary: true }, { id: "photo", label: "Adicionar foto" }]} onSelectAction={onSelectAction} />);
    expect(container.textContent).toContain("Residência Monte Verde");
    expect(container.textContent).toContain("48%");
    expect(container.textContent).toContain("compras para aprovar");
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Registrar ponto").click());
    expect(onSelectAction).toHaveBeenCalledWith("attendance");
  });

  it("states empty, loading and error without making financial inferences", () => {
    expect(render(<MobileDashboard loading />).textContent).toContain("Carregando visão da obra");
    expect(render(<MobileDashboard error="Não foi possível carregar agora." />).textContent).toContain("Não foi possível carregar agora.");
    expect(render(<MobileDashboard />).textContent).toContain("Selecione uma obra");
  });
});
