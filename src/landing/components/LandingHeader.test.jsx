import { createRoot } from "react-dom/client";
import { act } from "react";
import LandingHeader from "./LandingHeader";

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<LandingHeader/>); });
  return { container, root };
}

test("menu mobile abre e fecha ao clicar no botão", () => {
  const { container } = render();
  const botaoMenu = container.querySelector('button[aria-label="Abrir menu"]');
  expect(botaoMenu).toBeTruthy();
  expect(container.querySelector("#landing-mobile-menu")).toBeNull();

  act(() => { botaoMenu.click(); });
  expect(container.querySelector("#landing-mobile-menu")).toBeTruthy();
  expect(container.querySelector('button[aria-label="Fechar menu"]')).toBeTruthy();

  act(() => { container.querySelector('button[aria-label="Fechar menu"]').click(); });
  expect(container.querySelector("#landing-mobile-menu")).toBeNull();
});

test("fecha o menu mobile ao pressionar Escape", () => {
  const { container } = render();
  act(() => { container.querySelector('button[aria-label="Abrir menu"]').click(); });
  expect(container.querySelector("#landing-mobile-menu")).toBeTruthy();

  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(container.querySelector("#landing-mobile-menu")).toBeNull();
});
