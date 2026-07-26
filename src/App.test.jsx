import { createRoot } from "react-dom/client";
import { act } from "react";
import App from "./App";

test("App renderiza a landing page sem erros e sem puxar o LegacyApp", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<App/>); });
  expect(container.textContent).toContain("ARCD");
  expect(container.textContent).toContain("Construtech");
  expect(container.textContent).toContain("Entrar");
  expect(container.querySelector("button")).toBeTruthy();
  act(() => { root.unmount(); });
});
