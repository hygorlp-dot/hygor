import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import ReconciliationReview from "./ReconciliationReview.jsx";
import {applyCashAllocation,buildDreCashManagement} from '../../domains/conciliacao/cash-allocations.js';
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
it('expõe saldo indisponível e impede confirmar sem uma posição bancária válida',()=>{
 const link=vi.fn();mount(link);
 act(()=>root.render(<ReconciliationReview data={{transacoes:[]}} transaction={{id:'missing',valor:100,descricao:'Ausente',status:'pendente'}} fmt={String} canOperate onLink={link} onSaving={()=>{}}/>));
 expect(container.querySelector('[aria-label="Posição da revisão"]').textContent).toContain('Não disponível');
 expect([...container.querySelectorAll('button')].find(button=>button.textContent==='Confirmar vínculos selecionados').disabled).toBe(true);
 expect(link).not.toHaveBeenCalled();
});
it('compara a sugestão com o restante bancário após um vínculo parcial',()=>{
 mount(vi.fn());
 const transaction={id:'bank',valor:100,data:'2026-10-20',status:'pendente',descricao:'Recebimento parcial'};
 const original={transacoes:[transaction],caixaObra:[{id:'cash',tipo:'aporte',valor:100,data:'2026-10-20'}]};
 const event=buildDreCashManagement(original).entries[0];
 const result=applyCashAllocation(original,{idempotencyKey:'partial',transactionId:'bank',eventId:event.id,amount:40},{id:'qa'});
 expect(result.resumo.ok).toBe(true);
 act(()=>root.render(<ReconciliationReview data={result.data} transaction={transaction} analysis={{melhorCandidata:{titulo:'Saldo de aporte',saldoCentavos:6000}}} fmt={String} canOperate onSaving={()=>{}}/>));
 const values=[...container.querySelectorAll('.reconciliation-review__comparison dd')].map(node=>node.textContent);
 expect(values).toEqual(['60','60','0']);
});
it('apresenta a restrição do período fechado já existente no motor',()=>{
 mount(vi.fn());const transaction={id:'bank',valor:100,data:'2026-10-20',status:'pendente',descricao:'Período fechado'};
 act(()=>root.render(<ReconciliationReview data={{transacoes:[transaction],fechamentosFinanceiros:[{competencia:'2026-10',status:'fechado',dataInicio:'2026-10-01',dataFim:'2026-10-31'}]}} transaction={transaction} fmt={String} canOperate onSaving={()=>{}}/>));
 expect(container.textContent).toContain('Período financeiro fechado');
 expect([...container.querySelectorAll('button')].find(button=>button.textContent==='Confirmar vínculos selecionados').disabled).toBe(true);
});
