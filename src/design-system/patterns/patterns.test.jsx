import React, { useRef, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../primitives/index.js";
import { ConfirmDialog, EmptyState, ErrorState, PageHeader, StatusBadge, SummaryCard } from "./index.js";

const mounted = [];
function changeNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
function render(ui) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  mounted.push({ container, root });
  return container;
}
afterEach(() => { while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); } document.body.querySelectorAll(".arcd-dialog-backdrop").forEach(node => node.remove()); });

describe("padrões de página", () => {
  it("renderiza título, breadcrumb e ações", () => {
    const container = render(<PageHeader title="Fornecedores" description="Cadastros" breadcrumb={["Compras", "Fornecedores"]} primaryAction={<Button>Novo fornecedor</Button>} secondaryActions={<Button variant="secondary">Exportar</Button>} />);
    expect(container.querySelector("h1").textContent).toBe("Fornecedores");
    expect(container.textContent).toContain("Compras / Fornecedores");
    expect(container.textContent).toContain("Novo fornecedor");
    expect(container.textContent).toContain("Exportar");
  });

  it("expõe estados vazio e de erro", () => {
    const container = render(<><EmptyState title="Sem fornecedores" description="Cadastre o primeiro fornecedor." /><ErrorState title="Não foi possível carregar" description="Tente novamente." /></>);
    expect(container.textContent).toContain("Sem fornecedores");
    expect(container.textContent).toContain("Não foi possível carregar");
  });

  it("mapeia status conhecido e mantém fallback para valor desconhecido", () => {
    const container = render(<><StatusBadge status="pending" /><StatusBadge status="legacy-status" /></>);
    expect(container.textContent).toContain("Pendente");
    expect(container.textContent).toContain("legacy-status");
  });

  it("usa o contrato visual do dashboard nos resumos interativos",()=>{
    const onClick=vi.fn();
    const container=render(<SummaryCard label="Obras ativas" value="12" detail="Operação acompanhada" icon={<svg/>} tone="success" onClick={onClick}/>);
    const card=container.querySelector(".arcd-summary-card");
    expect(card.tagName).toBe("BUTTON");
    expect(card.dataset.tone).toBe("success");
    expect(card.querySelector(".arcd-summary-card__icon")).toBeTruthy();
    act(()=>card.click());
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ConfirmDialog", () => {
  it("exige motivo para confirmação destrutiva", () => {
    const onConfirm = vi.fn();
    function Example() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef(null);
      return <><Button ref={triggerRef} onClick={() => setOpen(true)}>Excluir</Button><ConfirmDialog open={open} onOpenChange={setOpen} triggerRef={triggerRef} title="Excluir fornecedor" description="Esta ação será registrada." tone="danger" requireReason onConfirm={onConfirm} /></>;
    }
    const container = render(<Example />);
    act(() => container.querySelector("button").click());
    const confirm = [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent.includes("Confirmar"));
    expect(confirm.disabled).toBe(true);
    const input = document.querySelector('[role="dialog"] textarea');
    act(() => changeNativeValue(input, "Cadastro duplicado"));
    expect(confirm.disabled).toBe(false);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledWith("Cadastro duplicado");
  });
});
