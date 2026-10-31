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

it("expõe titular divergente mesmo com valor e data coincidentes, sem executar baixa",()=>{
  const link=vi.fn();mount(link);
  const transaction={id:"bank",valor:-100,data:"2026-10-20",status:"pendente",descricao:"PIX enviado",contraparteNome:"Pessoa do extrato",contraparteDocumento:"123",chavePix:"pix-do-banco"};
  const data={transacoes:[transaction],fornecedores:[{id:"supplier",nome:"Fornecedor do ERP",cpf:"456",chavePix:"pix-do-erp"}]};
  const candidate={tipo:"notaFiscal",entidadeId:"nf",titulo:"NF 10",contraparte:"Fornecedor do ERP",saldoCentavos:10000,dataPrevista:"2026-10-20",motivos:[],alertas:["Confira o titular"],bloqueios:[]};
  act(()=>root.render(<ReconciliationReview data={data} transaction={transaction} analysis={{melhorCandidata:candidate}} fmt={String} canOperate onLink={link} onSaving={()=>{}}/>));
  const rows=[...container.querySelectorAll('.reconciliation-evidence [role="row"]')];
  expect(rows.find(row=>row.textContent.startsWith("Valor")).dataset.evidence).toBe("match");
  for(const label of ["Favorecido / pagador","CPF/CNPJ","Chave PIX"]){
    expect(rows.find(row=>row.textContent.startsWith(label)).dataset.evidence).toBe("different");
  }
  expect(container.textContent).toContain("Identificar a pessoa não confirma o lançamento financeiro");
  expect(link).not.toHaveBeenCalled();
});

it("não apresenta evidência ausente como coincidência",()=>{
  mount(vi.fn());
  const transaction={id:"bank",valor:-100,status:"pendente",descricao:"Sem identificação"};
  act(()=>root.render(<ReconciliationReview data={{transacoes:[transaction]}} transaction={transaction} analysis={{melhorCandidata:{titulo:"Título",saldoCentavos:10000}}} fmt={String} canOperate onSaving={()=>{}}/>));
  const rows=[...container.querySelectorAll('.reconciliation-evidence [role="row"]')];
  expect(rows.find(row=>row.textContent.startsWith("CPF/CNPJ")).dataset.evidence).toBe("missing");
  expect(rows.find(row=>row.textContent.startsWith("Favorecido / pagador")).dataset.evidence).toBe("missing");
});
