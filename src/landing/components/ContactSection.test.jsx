import { createRoot } from "react-dom/client";
import { act } from "react";
import ContactSection from "./ContactSection";

const mountedRoots = [];

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<ContactSection/>); });
  mountedRoots.push({container, root});
  return { container, root };
}

afterEach(() => {
  while (mountedRoots.length) {
    const {container, root} = mountedRoots.pop();
    act(() => { root.unmount(); });
    container.remove();
  }
});

const setValue = (input, value) => {
  act(() => {
    const prototype = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

test("bloqueia o envio e mostra erros quando os campos obrigatórios estão inválidos", async () => {
  const { container } = await render();
  const form = container.querySelector("form");
  act(() => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });

  expect(container.textContent).toContain("Informe seu nome completo.");
  expect(container.textContent).toContain("Informe um telefone válido, com DDD.");
  expect(container.textContent).toContain("Informe um e-mail válido.");
  expect(container.textContent).toContain("Selecione o tipo de serviço.");
  expect(container.textContent).toContain("Conte um pouco mais sobre o seu projeto.");
});

test("envia com sucesso quando todos os campos são válidos", async () => {
  const { container } = await render();
  setValue(container.querySelector("#contato-nome"), "Maria Silva");
  setValue(container.querySelector("#contato-telefone"), "(81) 99999-9999");
  setValue(container.querySelector("#contato-email"), "maria@example.com");

  const select = container.querySelector("#contato-tipo-servico");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(select, "reforma");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const textarea = container.querySelector("#contato-mensagem");
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "Gostaria de reformar minha cozinha e sala.");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const form = container.querySelector("form");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
  });

  expect(container.textContent).toContain("Mensagem enviada!");
});
