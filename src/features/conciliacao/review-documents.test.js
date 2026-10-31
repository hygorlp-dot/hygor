import { expect, it } from "vitest";
import { reviewDocumentContext } from "./review-documents.js";
it("reúne nota, comprovante do pagamento correto e referência da compra sem inventar anexos",()=>{
  const data={notasFiscais:[{id:"n",pedidoId:"p",documentos:[{nome:"NF",url:"https://example.test/nf.pdf"},{url:"javascript:alert(1)"}],pagamentos:[{id:"pg",comprovantes:[{nome:"Comprovante",url:"/api/microsoft/onedrive?action=file&driveId=d&itemId=i"}]},{id:"outro",comprovantes:[{url:"https://example.test/outro.pdf"}]}]}]};
  const context=reviewDocumentContext(data,{}, {candidate:{tipo:"nota",entidadeId:"n",pagamentoId:"pg",titulo:"NF"}});
  expect(context.pedidoId).toBe("p");expect(context.documents.map(d=>d.nome)).toEqual(["NF","Comprovante"]);
});
it("consulta somente documentos do banco quando não há lançamento selecionado",()=>{
  const transaction={descricao:"PIX",documentos:[{nome:"Extrato",url:"https://example.test/extrato.pdf"}]};
  expect(reviewDocumentContext({notasFiscais:[{id:"x",documentos:[{url:"https://example.test/outra.pdf"}]}]},transaction,{bank:true}).documents).toEqual(transaction.documentos);
});
