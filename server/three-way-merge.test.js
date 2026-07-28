import {describe,expect,it} from "vitest";
import {mergeThreeWay} from "./three-way-merge.js";

describe("mescla autoritativa de projeções",()=>{
  it("preserva registros de outra obra ausentes da projeção do cliente",()=>{
    const base=[{id:"a",obraId:"obra-a",status:"aberto"}];
    const incoming=[{id:"a",obraId:"obra-a",status:"concluido"}];
    const current=[
      {id:"a",obraId:"obra-a",status:"aberto"},
      {id:"b",obraId:"obra-b",status:"aberto"},
    ];
    expect(mergeThreeWay(base,incoming,current)).toEqual([
      {id:"a",obraId:"obra-a",status:"concluido"},
      {id:"b",obraId:"obra-b",status:"aberto"},
    ]);
  });

  it("remove somente o registro visível explicitamente removido",()=>{
    const base=[{id:"a",obraId:"obra-a"}];
    const current=[{id:"a",obraId:"obra-a"},{id:"b",obraId:"obra-b"}];
    expect(mergeThreeWay(base,[],current)).toEqual([{id:"b",obraId:"obra-b"}]);
  });

  it("preserva seções completas que não existiam na projeção",()=>{
    const base={obras:[{id:"a"}]};
    const incoming={obras:[{id:"a",status:"ativa"}]};
    const current={obras:[{id:"a"}],financeiro:[{id:"f1"}]};
    expect(mergeThreeWay(base,incoming,current)).toEqual({
      obras:[{id:"a",status:"ativa"}],
      financeiro:[{id:"f1"}],
    });
  });
});
