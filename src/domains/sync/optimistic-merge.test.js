import {describe,expect,it} from "vitest";
import {reconcileOptimisticSnapshot} from "./optimistic-merge.js";

describe("reconciliação de cadastros otimistas",()=>{
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
});
