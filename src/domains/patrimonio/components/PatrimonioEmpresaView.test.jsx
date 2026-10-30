import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PatrimonioEmpresaView from "./PatrimonioEmpresaView.jsx";

vi.mock("../../../api", () => ({
  extrairNotaPatrimonioIA: vi.fn(), obterDocumentoPatrimonio: vi.fn(), subirDocumentoPatrimonio: vi.fn(),
}));

let root, container;
const asset = { id: "a1", assetTag: "PAT-000001", name: "Serra mármore 110mm", category: "Ferramentas", status: "ativo", active: true,
  acquisitionValue: 1500, location: { label: "Sede" }, invoice: { number: "471827" }, version: 1 };
const botoes = () => [...container.querySelectorAll("button")];
const porRotulo = rotulo => botoes().find(b => (b.getAttribute("aria-label") || b.textContent).trim() === rotulo);

beforeEach(async () => {
  // A tela usa matchMedia para o layout; o teste simula um computador.
  window.matchMedia ??= query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<PatrimonioEmpresaView data={{ companyAssets: [asset] }} showToast={vi.fn()} dispatchCommand={vi.fn()} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it("cada bem tem uma ação direta e as demais num menu", async () => {
  expect(porRotulo("Editar")).toBeTruthy();
  expect(porRotulo("Histórico")).toBeUndefined();
  const gatilho = porRotulo("Mais ações de Serra mármore 110mm");
  expect(gatilho.getAttribute("aria-expanded")).toBe("false");
  await act(async () => gatilho.click());
  expect(gatilho.getAttribute("aria-expanded")).toBe("true");
  const itens = [...container.querySelectorAll("[role=menuitem]")].map(i => i.textContent);
  expect(itens).toEqual(["Histórico", "Mover…", "Alterar status…"]);
  expect(document.activeElement.textContent).toBe("Histórico");
});

it("Esc fecha o menu e devolve o foco ao botão que o abriu", async () => {
  const gatilho = porRotulo("Mais ações de Serra mármore 110mm");
  await act(async () => gatilho.click());
  await act(async () => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(container.querySelector("[role=menu]")).toBeNull();
  expect(document.activeElement).toBe(gatilho);
});

it("fecha quando o foco sai do menu", async () => {
  await act(async () => porRotulo("Mais ações de Serra mármore 110mm").click());
  const fora = document.createElement("button"); document.body.append(fora);
  await act(async () => fora.focus());
  expect(container.querySelector("[role=menu]")).toBeNull();
  fora.remove();
});

it("mostra o valor de aquisição alinhado na linha", () => {
  expect(container.querySelector(".patrimonio-lista__linha .patrimonio-lista__num").textContent).toMatch(/1\.500,00/);
});
