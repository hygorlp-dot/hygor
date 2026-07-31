import { createRoot } from "react-dom/client";
import { act } from "react";

const mountedRoots = [];

// LegacyApp é pesado (Supabase, ExcelJS, Recharts...) e não deve ser
// montado de verdade neste teste de entrada - só precisamos confirmar
// que qualquer URL resolve diretamente para o ambiente operacional.
vi.mock("./LegacyApp", () => ({
  default: () => <div data-testid="operational-app-stub">Sistema operacional (stub)</div>,
}));

async function renderApp(path) {
  window.history.pushState({}, "", path);
  const { default: App } = await import("./App");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<App/>); });
  mountedRoots.push({container, root});
  return { container, root };
}

afterEach(() => {
  while (mountedRoots.length) {
    const {container, root} = mountedRoots.pop();
    act(() => { root.unmount(); });
    container.remove();
  }
  window.history.pushState({}, "", "/");
});

test("rota '/' abre diretamente o app operacional", async () => {
  const { container } = await renderApp("/");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});

test("rota '/sistema' mantém acesso ao app operacional", async () => {
  const { container } = await renderApp("/sistema");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});

test("rota '/app' abre o app sem redirecionamento intermediário", async () => {
  const { container } = await renderApp("/app");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(window.location.pathname).toBe("/app");
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});

test("rota desconhecida também abre o login operacional", async () => {
  const { container } = await renderApp("/rota-que-nao-existe");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});
