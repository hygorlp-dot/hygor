import {expect,it} from "vitest";
import {supplierResponseQueue,quotePriceReferences} from "./quote-review";
import {purchaseDossierPending} from "./purchase-dossier-status";
import {planilhaHistoricoMaterial} from "./export-sheets";
const costs={frete:0,desconto:0,impostos:0,despesas:0};
const quote=()=>({id:"q",obraId:"a",status:"aberta",data:"2026-10-20",materialId:"m",qtd:2,unidadeRef:"UN",unidadeCompra:"CX",fatorConversao:10,propostas:[{id:"p",fornecedorId:"f",precoUnit:120,custoFinal:costs}]});
const fixture=()=>({materiais:[{id:"m",descricao:"Material",unidade:"UN"}],pedidos:[{id:"old",numero:"PC-1",obraId:"a",status:"enviado",data:"2026-10-01",custoFinal:costs,itens:[{id:"i",materialId:"m",qtd:10,qtdRecebida:10,unidadeRef:"UN",unidadeCompra:"UN",precoUnit:10,precoUnitCotado:10,recebimentos:[{data:"2026-10-02",qtd:10}]}]}]});
it("prioriza revisão e distingue propostas cadastradas de retorno pelo portal",()=>{
 const q=quote();q.propostas.push({id:"waiting",fornecedorId:"w"});q.respostasFornecedor=[{proposalId:"p",fornecedorId:"f",status:"pendente",recebidaEm:"2026-10-19"}];
 expect(supplierResponseQueue([q]).map(r=>r.status)).toEqual(["pendente","nao_enviado"]);
 delete q.respostasFornecedor;expect(supplierResponseQueue([q])[1]).toMatchObject({status:"cadastrada",receivedAt:null});
 expect(supplierResponseQueue([{...q,status:"decidida"}])).toEqual([]);
});
it("não atribui resposta antiga ao novo fornecedor nem muta os dados",()=>{
 const q=quote();q.respostasFornecedor=[{proposalId:"p",fornecedorId:"outro",status:"pendente"}];const before=JSON.stringify(q);
 expect(supplierResponseQueue([q])[0].status).toBe("cadastrada");expect(JSON.stringify(q)).toBe(before);
});
it("compara custo final na mesma unidade e preserva origem",()=>{
 const [r]=quotePriceReferences(fixture(),quote(),["a"]);
 expect(r.last.orderId).toBe("old");expect(r.offers[0]).toMatchObject({price:12,change:20});
});
it("exclui a própria cotação, outra obra, data futura e material homônimo",()=>{
 const d=fixture();d.pedidos=[{...d.pedidos[0],cotacaoId:"q"},{...d.pedidos[0],id:"other",obraId:"b"},{...d.pedidos[0],id:"future",itens:[{...d.pedidos[0].itens[0],recebimentos:[{data:"2026-10-21",qtd:2}]}]}];
 expect(quotePriceReferences(d,quote(),["a"])[0].last).toBeUndefined();
 expect(quotePriceReferences(fixture(),{...quote(),materialId:"homonym"},["a"])[0].last).toBeUndefined();
 expect(quotePriceReferences(fixture(),quote(),[])[0].last).toBeUndefined();
});
it("não inventa conversão ou custo final e não compara proposta em revisão",()=>{
 const q=quote();delete q.fatorConversao;expect(quotePriceReferences(fixture(),q,["a"])[0].last).toBeNull();
 q.fatorConversao=10;q.respostasFornecedor=[{proposalId:"p",status:"pendente"}];expect(quotePriceReferences(fixture(),q,["a"])[0].offers).toEqual([]);
 q.respostasFornecedor=[];delete q.propostas[0].custoFinal;expect(quotePriceReferences(fixture(),q,["a"])[0].offers[0].price).toBeNull();
});
it("pendências ignoram pedidos cancelados e notas canceladas não resolvem a conferência",()=>{
 const f={orders:[{id:"p",itens:[{qtd:10,qtdRecebida:4}]},{id:"cancel",status:"cancelado",itens:[{qtd:10}]}],invoices:[{pedidoId:"p",status:"cancelada"}],documents:[{url:"javascript:alert(1)"}],quote:{respostasFornecedor:[{status:"pendente"}]},approval:{status:"bloqueada"}};
 const s=purchaseDossierPending(f);expect(s).toMatchObject({orders:1,deliveries:1,missingInvoices:1});expect(s.pending).toHaveLength(5);
});
it("conferência resolvida não produz pendências artificiais",()=>{
 expect(purchaseDossierPending({orders:[{id:"p",itens:[{qtd:10,qtdRecebida:10}]}],invoices:[{pedidoId:"p",status:"aprovada"}],documents:[],approval:{status:"aprovada"}}).pending).toEqual([]);
});
it("exporta só as linhas recebidas, valores numéricos e base explícita",()=>{
 const row={description:"Material",orderNumber:"PC-1",date:"2026-10-01",referenceUnit:"UN",referenceQuantity:2,rawPrice:10.1234,finalPrice:null,issue:"Custo final não documentado"};
 const t=planilhaHistoricoMaterial({},[row],{basis:"orders",price:"raw"});expect(t.linhas).toHaveLength(1);expect(t.linhas[0]).toContain("Pedidos emitidos");expect(t.linhas[0]).toContain(10.1234);expect(t.linhas[0][4]).toBeInstanceOf(Date);
});
