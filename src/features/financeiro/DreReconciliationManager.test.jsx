import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import DreReconciliationManager from "./DreReconciliationManager.jsx";

const mocks = vi.hoisted(() => ({ load: vi.fn(), command: vi.fn() }));
vi.mock("../../api.js", () => ({ consultarGestaoDre: mocks.load, executarComandoConciliacao: mocks.command }));
let root, container;
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); });
const field = label => [...container.querySelectorAll("label")].find(item => item.textContent.trim().startsWith(label))?.querySelector("input,select");
const change = (element, value) => act(() => {
  const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});

it("filtra entradas/saídas e categorias do DRE e vincula mantendo a competência do registro", async () => {
  mocks.load.mockResolvedValue({ ok: true, banks: [
    { id: "incoming", direction: "in", status: "pendente", remainingCents: 50000, amountCents: 50000, description: "Recebimento", date: "2026-10-15" },
    { id: "outgoing", direction: "out", status: "pendente", remainingCents: 50000, amountCents: 50000, description: "PIX da equipe", date: "2026-10-15" },
  ], entries: [
    { id: "salary", category: "mao_obra", description: "Folha mensal", obraId: "obra", effect: "cash_out", date: "2026-10-15", competence: "2026-09", remainingCents: 50000 },
    { id: "energy", category: "energia", description: "Conta de energia", effect: "cash_out", date: "2026-10-15", remainingCents: 40000 },
    { id: "revenue", category: "receita_servicos", description: "Serviço de projeto", effect: "cash_in", date: "2026-10-15", remainingCents: 50000 },
  ], allocations: [] });
  mocks.command.mockResolvedValue({ ok: true, data: {} });
  const update = vi.fn().mockResolvedValue({ ok: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  act(() => root.render(<DreReconciliationManager data={{ obras: [{ id: "obra", name: "Obra Oásis" }] }} currentUser={{ role: "financeiro" }} update={update}/>));
  await act(async () => container.querySelector("button").click());
  change(field("Tipo de movimento"), "out");
  expect(field("1. Movimento bancário").textContent).not.toContain("Recebimento");
  change(field("1. Movimento bancário"), "outgoing");
  const combo = container.querySelector('[role="combobox"]');
  act(() => combo.focus()); change(combo, "salarios");
  expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
  act(() => container.querySelector('[role="option"]').click());
  expect(field("2. Registro existente").textContent).toContain("Folha mensal");
  expect(field("2. Registro existente").textContent).not.toContain("Conta de energia");
  change(field("2. Registro existente"), "salary");
  expect(container.querySelector(".dre-reconciliation__preview").textContent).toContain("competência 2026-09");
  change(field("3. Valor a vincular"), "500");
  await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ type: "LINK_PARTIAL_CASH", payload: { transactionId: "outgoing", eventId: "salary", amount: 500 } }));
});
