import { describe, expect, it } from "vitest";
import { supplierOrderEvidence, supplierQuoteSamples } from "./supplier-ranking-evidence.js";

describe("amostra do ranking de fornecedores", () => {
  const quote = {
    id: "cot-a", obraId: "a", itens: [{id: "cimento"}, {id: "aco"}],
    propostas: [
      {id: "a", fornecedorId: "central", precos: {cimento: 20, aco: 40}, prazoDias: 3},
      {id: "b", fornecedorId: "outro", precos: {cimento: 25, aco: 35}, prazoDias: 2},
      {id: "pendente", fornecedorId: "terceiro", precos: {cimento: 2}, prazoDias: 1},
    ],
    respostasFornecedor: [{proposalId: "pendente", status: "pendente"}],
    decisoes: {aco: {propostaId: "b", pedidoId: "op"}},
  };

  it("compara preços e prazos somente entre propostas válidas do mesmo item", () => {
    const samples = supplierQuoteSamples([quote]);
    expect(samples.map(({id,itemId,menorPreco,menorPrazo,vitoria}) =>
      [id,itemId,menorPreco,menorPrazo,vitoria])).toEqual([
      ["a","cimento",20,2,false],["b","cimento",20,2,false],["a","aco",35,2,false],["b","aco",35,2,true],
    ]);
  });

  it("mantém a cotação antiga com preço no cabeçalho", () => {
    const samples = supplierQuoteSamples([{id: "legado", escolhida: "p", propostas: [
      {id: "p", fornecedorId: "central", preco: "100", prazo: 4},
      {id: "invalida", fornecedorId: "outro", precoUnit: Infinity},
    ]}]);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({preco: 100, menorPreco: 100, menorPrazo: 4, vitoria: true});
  });

  it("rastreia a entrega pela remessa e exige cotação vinculada à mesma obra", () => {
    const samples = supplierQuoteSamples([quote]).filter(sample => sample.fornecedorId === "central");
    const order = {id:"order", obraId:"a", fornecedorId:"central", cotacaoId:"cot-a", status:"parcial", previsao:"2026-10-24",
      itens:[{id:"i",qtd:4,precoUnit:20,remessas:[{data:"2026-10-10",qtd:2}],recebimentos:[{data:"2026-10-11",qtd:2}]}]};
    const evidence = supplierOrderEvidence([order,{...order,id:"b",obraId:"b"}],samples);
    expect(evidence[0]).toMatchObject({quote:{id:"cot-a"},promisedDays:[3],total:80,
      deliveries:[{data:"2026-10-10",recebidaEm:"2026-10-11",atraso:1}]});
    expect(evidence[1]).toMatchObject({quote:null,promisedDays:[]});
  });
});
