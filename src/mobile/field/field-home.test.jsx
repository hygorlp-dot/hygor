import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldHome } from "./FieldHome.jsx";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

describe("FieldHome", () => {
  it("prioriza contexto da obra e ações operacionais", () => {
    const container = render(<FieldHome project={{ name: "Residência Monte Verde", address: "Recife" }} userName="Ana" onSelectAction={vi.fn()} />);
    expect(container.textContent).toContain("Residência Monte Verde");
    expect(container.textContent).toContain("Registrar ponto");
    expect(container.textContent).toContain("Adicionar foto");
  });

  it("aciona somente ações permitidas", () => {
    const onSelectAction = vi.fn();
    const container = render(<FieldHome project={{ name: "Obra" }} allowedActions={["photo"]} onSelectAction={onSelectAction} />);
    const photo = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Adicionar foto"));
    const attendance = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Registrar ponto"));
    expect(attendance.disabled).toBe(true);
    act(() => attendance.click());
    act(() => photo.click());
    expect(onSelectAction).toHaveBeenCalledWith("photo");
    expect(onSelectAction).not.toHaveBeenCalledWith("attendance");
  });
});
