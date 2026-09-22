import {describe,expect,it} from "vitest";
import {reconcileOptimisticSnapshot} from "./optimistic-merge.js";

describe("reconciliação de cadastros otimistas",()=>{
  it("salva arraste no orçamento sem perder edição concorrente nem vínculos por ID",()=>{
    const itens=[{id:"a",quantidade:1},{id:"b",quantidade:2},{id:"c",quantidade:3}];
    const rendered={orcamentos:[{id:"orc",itens,memoriaCalculo:{vinculosEstruturais:{"pavimento1-vigas.forma":"c"}}}]};
    const intended={orcamentos:[{...rendered.orcamentos[0],itens:[itens[2],itens[0],itens[1]]}]};
    expect(reconcileOptimisticSnapshot({rendered,intended,latest:rendered})).toEqual(intended);
    const latest={orcamentos:[{...rendered.orcamentos[0],itens:[{...itens[0],quantidade:9},{id:"new"},itens[1],itens[2]]}]};
    const saved=reconcileOptimisticSnapshot({rendered,intended,latest});
    expect(saved.orcamentos[0].itens).toEqual([itens[2],{id:"new"},{...itens[0],quantidade:9},itens[1]]);
    expect(saved.orcamentos[0].memoriaCalculo).toEqual(rendered.orcamentos[0].memoriaCalculo);
  });
  it("preserva cadastro anterior quando outro módulo salva antes do rerender",()=>{
    const rendered={materiais:[{id:"m1"}],fornecedores:[]};
    const latest={materiais:[{id:"m1"},{id:"m2"}],fornecedores:[]};
    const intended={...rendered,fornecedores:[{id:"f1"}]};
    expect(reconcileOptimisticSnapshot({latest,rendered,intended})).toEqual({
      materiais:[{id:"m1"},{id:"m2"}],fornecedores:[{id:"f1"}],
    });
  });

  it("combina dois cadastros rápidos na mesma coleção",()=>{
    const rendered={materiais:[{id:"m1",nome:"A"}]};
    const latest={materiais:[{id:"m1",nome:"A"},{id:"m2",nome:"B"}]};
    const intended={materiais:[{id:"m1",nome:"A"},{id:"m3",nome:"C"}]};
    expect(reconcileOptimisticSnapshot({latest,rendered,intended}).materiais.map(item=>item.id))
      .toEqual(["m1","m2","m3"]);
  });

  it("preserva edição mais nova em item que o render antigo não modificou",()=>{
    const rendered={fornecedores:[{id:"f1",nome:"Antigo"},{id:"f2",nome:"Dois"}]};
    const latest={fornecedores:[{id:"f1",nome:"Novo"},{id:"f2",nome:"Dois"}]};
    const intended={fornecedores:[{id:"f1",nome:"Antigo"},{id:"f2",nome:"Segundo"}]};
    expect(reconcileOptimisticSnapshot({latest,rendered,intended}).fornecedores).toEqual([
      {id:"f1",nome:"Novo"},{id:"f2",nome:"Segundo"},
    ]);
  });

  it("mantém exclusão explicitamente solicitada sem apagar item recém-criado",()=>{
    const rendered={unidades:[{id:"u1"},{id:"u2"}]};
    const latest={unidades:[{id:"u1"},{id:"u2"},{id:"u3"}]};
    const intended={unidades:[{id:"u2"}]};
    expect(reconcileOptimisticSnapshot({latest,rendered,intended}).unidades.map(item=>item.id))
      .toEqual(["u2","u3"]);
  });

  it("reaplica uma edição local mais nova sobre a resposta mesclada do servidor",()=>{
    const enviado={leads:[{id:"l1",etapa:"novo"}]};
    const confirmado={
      leads:[{id:"l1",etapa:"novo"},{id:"l2",etapa:"qualificacao"}],
    };
    const localMaisNovo={leads:[{id:"l1",etapa:"proposta"},{id:"l2",etapa:"qualificacao"}]};
    expect(reconcileOptimisticSnapshot({
      latest:confirmado,rendered:enviado,intended:localMaisNovo,
    })).toEqual({
      leads:[{id:"l1",etapa:"proposta"},{id:"l2",etapa:"qualificacao"}],
    });
  });
});
