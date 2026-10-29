import { expect,it } from "vitest";
import { fichaDaCompra,urlDocumentoCompra } from "./purchase-dossier";
it("reúne pedidos da cotação sem misturar compras do fornecedor ou de outra obra",()=>{
  const data={cotacoes:[{id:"c",obraId:"o",solicitacaoId:"s",propostas:[{documentos:[{id:"cot"}]}]}],
    solicitacoesCompra:[{id:"s",obraId:"o",aprovacaoInstanciaId:"ap"}],instanciasAprovacao:[{id:"ap",status:"aprovada"}],
    pedidos:[{id:"p1",numero:"1",cotacaoId:"c",obraId:"o",documentos:[{id:"pedido"}]},{id:"p2",cotacaoId:"c",obraId:"o"},{id:"p3",cotacaoId:"outro",obraId:"o"},{id:"p4",cotacaoId:"c",obraId:"outra"}],
    notasFiscais:[{id:"n1",pedidoId:"p1",obraId:"o",documentos:[{id:"nf"}]},{id:"n2",pedidoId:"p2",obraId:"o"},{id:"n3",pedidoId:"p3",obraId:"o"},{id:"n4",pedidoId:"p1",obraId:"outra"}]};
  const f=fichaDaCompra(data,{pedidoId:"p1"});
  expect(f.orders.map(p=>p.id)).toEqual(["p1","p2"]);
  expect(f.invoices.map(n=>n.id)).toEqual(["n1","n2"]);
  expect(f.documents.map(d=>d.id)).toEqual(["cot","pedido","nf"]);
  expect(f.approval.status).toBe("aprovada");
});
it("pedido sem cotação não reúne todos os registros sem origem",()=>{
  expect(fichaDaCompra({pedidos:[{id:"1",obraId:"o"},{id:"2",obraId:"o"}]},{pedidoId:"1"}).orders).toHaveLength(1);
});
it("só abre anexos com endereços HTTPS válidos",()=>{
  expect(urlDocumentoCompra({url:"javascript:alert(1)"})).toBe("");
  expect(urlDocumentoCompra({url:"https://drive.google.com/file/d/abc/view"})).toContain("drive.google.com");
});
