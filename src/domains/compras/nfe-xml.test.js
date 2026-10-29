import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { divergenciasDoItem, casarItensNota, fornecedorPorDocumento, lerXmlNfe, sugerirPedidosParaNota, validarItensNota } from "./nfe-xml.js";
import { applyInvoiceCommand, INVOICE_COMMAND } from "../financeiro/invoice-commands.js";

const xml=readFileSync(`${process.cwd()}/src/domains/compras/__fixtures__/nfe-teste.xml`,"utf8");
const CHAVE="26261012345678000190550010000045671000045675";
const data=()=>({
  obras:[{id:"o-1",name:"Alameda"}],
  fornecedores:[{id:"f-1",nome:"Casa dos Materiais",cnpj:"12.345.678/0001-90"},{id:"f-2",nome:"Outro",cnpj:"11.111.111/0001-11"}],
  materiais:[{id:"m-cim",descricao:"CIMENTO CP II 50 KG",unidade:"SC"},{id:"m-are",descricao:"AREIA MÉDIA",unidade:"M3"}],
  pedidos:[
    {id:"p-12",numero:"PC-0012",obraId:"o-1",fornecedorId:"f-1",status:"recebido",version:2,
      itens:[{id:"i-cim",materialId:"m-cim",qtd:100,precoUnit:35,qtdRecebida:100},{id:"i-are",materialId:"m-are",qtd:10,precoUnit:125,qtdRecebida:10}]},
    {id:"p-09",numero:"PC-0009",obraId:"o-1",fornecedorId:"f-1",status:"enviado",version:1,itens:[{id:"x",materialId:"m-are",qtd:2,precoUnit:120}]},
    {id:"p-07",numero:"PC-0007",obraId:"o-1",fornecedorId:"f-2",status:"enviado",version:1,itens:[{id:"y",materialId:"m-cim",qtd:100,precoUnit:35}]},
  ],
  notasFiscais:[],fechamentosFinanceiros:[],
});

describe("importação do XML da NF-e (C3.1)",()=>{
  it("preenche número, série, chave, emissão, vencimento, fornecedor e itens",()=>{
    const nota=lerXmlNfe(xml);
    expect(nota).toMatchObject({numero:"4567",serie:"1",chave:CHAVE,emissao:"2026-10-20",vencimento:"2026-11-19",
      fornecedorNome:"CASA DOS MATERIAIS LTDA",documentoFornecedor:"12345678000190",valorBruto:5080});
    expect(nota.itens).toHaveLength(3);
    expect(nota.itens[1]).toEqual({nItem:2,codigo:"ARE-M",descricao:"AREIA MEDIA LAVADA",ncm:"25059000",unidade:"M3",qtd:12,precoUnit:125,valorTotal:1500});
    expect(fornecedorPorDocumento(data().fornecedores,nota.documentoFornecedor)?.id).toBe("f-1");
    expect(lerXmlNfe("<html></html>").erro).toMatch(/não é o XML de uma NF-e/);
  });

  it("sugere o pedido do fornecedor e liga os itens, apontando divergências e sobras",()=>{
    const nota=lerXmlNfe(xml);
    const sugestoes=sugerirPedidosParaNota(data(),{fornecedorId:"f-1",obraId:"o-1",valorBruto:nota.valorBruto,itens:nota.itens});
    expect(sugestoes.map(s=>s.pedido.id)).toEqual(["p-12","p-09"]);
    const casados=casarItensNota(nota.itens,data().pedidos[0],data().materiais);
    expect(casados.map(c=>c.pedidoItemId)).toEqual(["i-cim","i-are",""]);
    expect(casados[0].divergencias).toEqual([]);
    expect(casados[1].divergencias[0]).toMatch(/Quantidade da nota \(12\) acima do pedido \(10\)/);
    expect(casados[2].divergencias[0]).toMatch(/vincule manualmente/);
  });

  it("o servidor grava os itens e as divergências, sem levar a chave a log",()=>{
    const spies=["log","info","warn","error","debug"].map(m=>vi.spyOn(console,m).mockImplementation(()=>{}));
    const nota=lerXmlNfe(xml);
    const casados=casarItensNota(nota.itens,data().pedidos[0],data().materiais);
    const invoice={id:"nf-1",tipo:"nfe",numero:nota.numero,serie:nota.serie,chave:nota.chave,emissao:nota.emissao,vencimento:nota.vencimento,
      obraId:"o-1",pedidoId:"p-12",fornecedorId:"f-1",fornecedorNome:nota.fornecedorNome,valorBruto:nota.valorBruto,retencoes:{},
      itensNota:casados.map(c=>({...c.xmlItem,pedidoItemId:c.pedidoItemId}))};
    const result=applyInvoiceCommand(data(),{type:INVOICE_COMMAND.INVOICE_SAVED,expectedVersion:0,actorId:"u-1",actorName:"Ana",
      idempotencyKey:"invoice-xml-000000001",payload:{invoice}},"2026-10-23T12:00:00.000Z");
    expect(result.ok).toBe(true);
    const salva=result.data.notasFiscais[0];
    expect(salva.chave).toBe(CHAVE);
    expect(salva.itensNota).toHaveLength(3);
    expect(Object.keys(salva.itensNota[0]).sort()).toEqual(["codigo","descricao","ncm","nItem","pedidoItemId","precoUnit","qtd","unidade","valorTotal"].sort());
    expect(salva.divergencias.some(d=>/AREIA MEDIA LAVADA: Quantidade da nota/.test(d))).toBe(true);
    expect(salva.divergencias.some(d=>/TAXA DE ENTREGA: sem item correspondente/.test(d))).toBe(true);
    expect(salva.divergencias.some(d=>/Notas fiscais acima do valor contratado/.test(d))).toBe(true);
    for(const spy of spies){
      expect(spy.mock.calls.flat().map(String).join(" ")).not.toContain(CHAVE);
      spy.mockRestore();
    }
    // Vínculo para item de outro pedido ou repetido é recusado.
    expect(validarItensNota([{qtd:1,precoUnit:1,pedidoItemId:"y"}],data().pedidos[0])).toMatch(/outro pedido/);
    expect(validarItensNota([{qtd:1,precoUnit:1,pedidoItemId:"i-cim"},{qtd:1,precoUnit:1,pedidoItemId:"i-cim"}],data().pedidos[0])).toMatch(/mesmo item/);
  });
});

it("confere preço do XML contra preço cotado antes do rateio de frete e desconto",()=>{
  expect(divergenciasDoItem({qtd:1,precoUnit:100},{qtd:1,precoUnit:90,precoUnitCotado:100})).toEqual([]);
  expect(divergenciasDoItem({qtd:1,precoUnit:110},{qtd:1,precoUnit:130,precoUnitCotado:100})).toHaveLength(1);
});
