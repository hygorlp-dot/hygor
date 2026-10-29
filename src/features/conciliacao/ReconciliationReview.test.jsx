import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import ReconciliationReview from "./ReconciliationReview.jsx";
let root, container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
function mount(onLink) {
  const transaction={id:"bank",valor:100,data:"2026-10-20",status:"pendente",descricao:"PIX teste"};
  const data={transacoes:[transaction],obras:[],caixaObra:[{id:"a",tipo:"aporte",valor:60,data:"2026-10-20"},{id:"b",tipo:"aporte",valor:40,data:"2026-10-20"}]};
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  act(()=>root.render(<ReconciliationReview data={data} transaction={transaction} fmt={value=>String(value)} canOperate onLink={onLink} onSaving={()=>{}}/>));
  return [...container.querySelectorAll('input[type="checkbox"]')];
}
it("seleciona dois registros e envia valores individuais sem criar novos pagamentos",async()=>{
  const link=vi.fn().mockResolvedValue(true);
  const boxes=mount(link);expect(boxes).toHaveLength(2);
  act(()=>boxes[0].click());act(()=>boxes[1].click());
  expect(container.textContent).toContain("Selecionado: 100");
  const button=[...container.querySelectorAll("button")].find(item=>item.textContent==="Confirmar vínculos selecionados");
  await act(async()=>button.click());
  expect(link.mock.calls.map(call=>call[1])).toEqual([60,40]);
  expect(container.textContent).toContain("Movimento totalmente vinculado");
});
it("interrompe lote na falha e informa que confirmações anteriores foram preservadas",async()=>{
  const link=vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const boxes=mount(link);act(()=>boxes[0].click());act(()=>boxes[1].click());
  await act(async()=>[...container.querySelectorAll("button")].find(item=>item.textContent==="Confirmar vínculos selecionados").click());
  expect(link).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("A operação parou");
});
