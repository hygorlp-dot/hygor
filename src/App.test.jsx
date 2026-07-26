import { createRoot } from "react-dom/client";
import { act } from "react";

const mountedRoots = [];

// LegacyApp é pesado (Supabase, ExcelJS, Recharts...) e não deve ser
// montado de verdade num teste de roteamento - só precisamos confirmar
// que a rota /sistema resolve para ele, não testar o app operacional aqui.
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

test("rota '/' renderiza a landing page pública sem tocar o app operacional", async () => {
  const { container } = await renderApp("/");
  expect(container.textContent).toContain("ARCD Construtech");
  expect(container.textContent).toContain("Do primeiro traço à entrega das chaves.");
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeNull();
});

test("rota '/sistema' carrega o app operacional (via lazy loading)", async () => {
  const { container } = await renderApp("/sistema");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});

test("rota '/app' redireciona para '/sistema'", async () => {
  const { container } = await renderApp("/app");
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  expect(window.location.pathname).toBe("/sistema");
  expect(container.querySelector('[data-testid="operational-app-stub"]')).toBeTruthy();
});

test("rota desconhecida volta para a landing", async () => {
  const { container } = await renderApp("/rota-que-nao-existe");
  expect(window.location.pathname).toBe("/");
  expect(container.textContent).toContain("ARCD Construtech");
});
