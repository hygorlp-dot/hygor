import {it,expect} from "vitest";
import {materialPriceHistory,priceHistorySummary} from "./material-price-history";
const cost={frete:20,desconto:0,impostos:0,despesas:0};
const line={id:"i",materialId:"m",qtd:2,qtdRecebida:2,unidadeRef:"UN",unidadeCompra:"CX",fatorConversao:10,precoUnitCotado:100,precoUnit:110,recebimentos:[{data:"2026-10-01",qtd:2}]};
const order={id:"p",obraId:"a",numero:"PC1",fornecedorId:"f",status:"enviado",data:"2026-09-30",custoFinal:cost,itens:[line]};
const fixture=()=>({materiais:[{id:"m",descricao:"Material",unidade:"UN"}],pedidos:[structuredClone(order)]});
const options={workIds:["a"],materialId:"m"};
it("normaliza embalagem e distingue preço original de custo final sem mutar dados",()=>{
 const data=fixture(),before=JSON.stringify(data),rows=materialPriceHistory(data,options);
 expect(rows[0]).toMatchObject({rawPrice:10,finalPrice:11,referenceQuantity:20,price:11});expect(JSON.stringify(data)).toBe(before);
});
it("pondera pela quantidade normalizada e calcula variação cronológica",()=>{
 const data=fixture();data.pedidos.push({...order,id:"p2",itens:[{...line,unidadeCompra:"UN",fatorConversao:1,qtdRecebida:10,precoUnit:20,precoUnitCotado:19,recebimentos:[{data:"2026-10-02",qtd:10}]}]});
 const summary=priceHistorySummary(materialPriceHistory(data,options));expect(summary.weighted).toBe(14);expect(summary.last).toBe(20);expect(summary.change).toBeCloseTo(81.818,2);
});
it("não mistura unidade incompatível, material homônimo ou obra não autorizada",()=>{
 const data=fixture();data.pedidos.push({...order,id:"b",obraId:"b"},{...order,id:"kg",itens:[{...line,unidadeRef:"KG",unidadeCompra:"KG"}]},{...order,id:"other",itens:[{...line,materialId:"other"}]});
 const rows=materialPriceHistory(data,options);expect(rows).toHaveLength(2);expect(priceHistorySummary(rows)).toBeNull();expect(materialPriceHistory(data,{...options,referenceUnit:"UN"})).toHaveLength(1);
});
it("exclui rascunhos, cancelados e recebimentos revertidos sem recriar pelo saldo legado",()=>{
 const data=fixture();data.pedidos.push({...order,id:"draft",status:"rascunho"},{...order,id:"cancel",status:"cancelado"},{...order,id:"rev",itens:[{...line,recebimentos:[{data:"2026-10-01",qtd:2,status:"estornado"}]}]});expect(materialPriceHistory(data,options)).toHaveLength(1);
});
it("preserva legado e conversão ausente na lista, fora da média de custo final",()=>{
 const data=fixture();delete data.pedidos[0].custoFinal;delete data.pedidos[0].itens[0].precoUnitCotado;
 expect(materialPriceHistory(data,options)[0].issue).toBe("Custo final não documentado");expect(priceHistorySummary(materialPriceHistory(data,options))).toBeNull();expect(materialPriceHistory(data,{...options,price:"raw"})[0].price).toBe(11);
 delete data.pedidos[0].itens[0].fatorConversao;expect(materialPriceHistory(data,{...options,price:"raw"})[0].issue).toContain("Conversão");
});
it("filtra por data do recebimento ou do pedido sem duplicar entregas",()=>{
 const data=fixture();data.pedidos[0].itens[0].recebimentos.push({data:"2026-10-03",qtd:1});expect(materialPriceHistory(data,{...options,start:"2026-10-02",end:"2026-10-04"})).toHaveLength(1);expect(materialPriceHistory(data,{...options,basis:"orders"})).toHaveLength(1);expect(materialPriceHistory(data,{...options,supplierId:"outro"})).toHaveLength(0);
});
