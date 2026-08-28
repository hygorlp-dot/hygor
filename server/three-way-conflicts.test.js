import { describe,expect,it } from "vitest";
import { findAggregateConflicts,findSectionConflicts } from "./three-way-conflicts.js";

describe("DATA-003 · conflitos por agregado",()=>{
  it("permite alterações em registros diferentes da mesma coleção",()=>{
    const base=[{id:"a",valor:1},{id:"b",valor:1}],requested=[{id:"a",valor:2},{id:"b",valor:1}],current=[{id:"a",valor:1},{id:"b",valor:2}];
    expect(findAggregateConflicts(base,requested,current,"pedidos")).toEqual([]);
  });
  it("bloqueia duas mudanças concorrentes no mesmo fato",()=>{
    const base=[{id:"a",valor:1}],requested=[{id:"a",valor:2}],current=[{id:"a",valor:3}];
    expect(findAggregateConflicts(base,requested,current,"pedidos")).toEqual([{section:"pedidos",id:"a"}]);
  });
  it("identifica o conflito dentro da seção correta",()=>{
    expect(findSectionConflicts({pedidos:[{id:"p",status:"aberto"}]},{pedidos:[{id:"p",status:"aprovado"}]},{pedidos:[{id:"p",status:"cancelado"}]},["pedidos"])).toEqual([{section:"pedidos",id:"p"}]);
  });

  // Investigação de 27/08/2026 ("orçamento não salva com mais de uma pessoa
  // no app"): ao contrário de mergeThreeWay (que reconcilia campo a campo -
  // ver three-way-merge.test.js), este detector compara o REGISTRO INTEIRO
  // (JSON completo). Duas pessoas editando o MESMO orçamento em seções
  // diferentes (itens vs. memoriaCalculo) fazem `proposed` e `persisted`
  // divergirem como objetos completos, mesmo sem colisão real de campo -
  // e por isso É sinalizado como conflito aqui. Isso é conservador demais
  // (gera um 409/banner que um merge fino resolveria sozinho), mas o
  // resultado prático é pedir confirmação ao usuário, nunca perder dado
  // silenciosamente - a API (api/data.js) sempre chama findSectionConflicts
  // antes de aceitar qualquer gravação concorrente.
  it("sinaliza conflito quando duas pessoas mudam CAMPOS DIFERENTES do mesmo orçamento (over-conservador, não perde dado em silêncio)",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10}],memoriaCalculo:{terreo:{pilares:[]}}};
    const base=[orcamentoBase];
    const proposedDeA=[{...orcamentoBase,itens:[{id:"i1",qtd:20}]}];
    const persistedDeB=[{...orcamentoBase,memoriaCalculo:{terreo:{pilares:[{id:"p1"}]}}}];
    expect(findAggregateConflicts(base,proposedDeA,persistedDeB,"orcamentos")).toEqual([{section:"orcamentos",id:"orc-1"}]);
  });
});
