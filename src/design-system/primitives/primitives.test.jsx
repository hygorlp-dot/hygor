import React, { useRef, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Dialog, Input, Select } from "./index.js";

const mounted = [];
function render(ui) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  mounted.push({ container, root });
  return container;
}

afterEach(() => {
  while (mounted.length) {
    const { container, root } = mounted.pop();
    act(() => root.unmount());
    container.remove();
  }
  document.body.querySelectorAll(".arcd-dialog-backdrop").forEach(node => node.remove());
});

describe("Button", () => {
  it("renderiza texto, mantém nome acessível e executa onClick", () => {
    const onClick = vi.fn();
    const container = render(<Button onClick={onClick}>Salvar</Button>);
    const button = container.querySelector("button");
    expect(button.textContent).toContain("Salvar");
    expect(button.getAttribute("aria-label") || button.textContent).toContain("Salvar");
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("não executa quando desabilitado e sinaliza carregamento", () => {
    const onClick = vi.fn();
    const container = render(<Button loading onClick={onClick}>Salvar</Button>);
    const button = container.querySelector("button");
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    act(() => button.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("expõe a variante semântica de sucesso", () => {
    const container = render(<Button variant="success">Confirmado</Button>);
    expect(container.querySelector("button").className).toContain("arcd-button--success");
  });
});

describe("Input", () => {
  it("associa label, mostra erro e respeita estados nativos", () => {
    const container = render(<Input id="empresa" label="Empresa" error="Informe a empresa" defaultValue="ARCD" readOnly />);
    const label = container.querySelector("label");
    const input = container.querySelector("input");
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Informe a empresa");
    expect(input.readOnly).toBe(true);
  });

  it("permite digitação e respeita disabled", () => {
    const onChange = vi.fn();
    const container = render(<Input label="Nome" onChange={onChange} />);
    const input = container.querySelector("input");
    act(() => { input.value = "ARCD"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(input.value).toBe("ARCD");
    const disabledContainer = render(<Input label="Bloqueado" disabled />);
    expect(disabledContainer.querySelector("input").disabled).toBe(true);
  });
});

describe("Select", () => {
  it("expõe opções, seleciona valor e informa erro", () => {
    function Example() {
      const [value, setValue] = useState("");
      return <Select label="Estado" value={value} onChange={event => setValue(event.target.value)} error="Obrigatório" placeholder="Selecione" options={[{ value: "PE", label: "Pernambuco" }]} />;
    }
    const container = render(<Example />);
    const select = container.querySelector("select");
    expect(select.options).toHaveLength(2);
    expect(select.getAttribute("aria-invalid")).toBe("true");
    act(() => { select.value = "PE"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(select.value).toBe("PE");
  });
});

describe("Dialog", () => {
  it("abre, fecha por botão e por Escape e devolve foco ao gatilho", async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef(null);
      return <><Button ref={triggerRef} onClick={() => setOpen(true)}>Abrir editor</Button><Dialog open={open} onOpenChange={setOpen} triggerRef={triggerRef} title="Editar fornecedor">Conteúdo</Dialog></>;
    }
    const container = render(<Example />);
    const trigger = container.querySelector("button");
    trigger.focus();
    act(() => trigger.click());
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    act(() => document.querySelector('[aria-label="Fechar"]').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    act(() => trigger.click());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
