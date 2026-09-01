import { describe,expect,it } from "vitest";
import { findAggregateConflicts,findSectionConflicts,findValueConflicts } from "./three-way-conflicts.js";

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

  // Bug real corrigido em 31/08/2026 ("orçamento não salva quando lanço um
  // item"): antes desta correção, este detector comparava o REGISTRO
  // INTEIRO (JSON completo) por id. Duas pessoas editando o MESMO
  // orçamento em CAMPOS ou ITENS diferentes (ex.: uma mexe em itens,
  // outra em memoriaCalculo - ou até duas mexendo em itens[], mas em
  // ITENS DIFERENTES do mesmo array) faziam `proposed` e `persisted`
  // divergirem como objetos completos, mesmo sem colisão real de campo -
  // e por isso ERA sinalizado como conflito, mesmo o mergeThreeWay (ver
  // three-way-merge.test.js) sabendo reconciliar os dois lados sem perder
  // nada. Agora `findValueConflicts` desce pela mesma árvore que o merge
  // desce, e só sinaliza onde o merge teria mesmo que escolher um lado.
  it("NÃO sinaliza mais quando duas pessoas mudam CAMPOS DIFERENTES do mesmo orçamento (era over-conservador, agora o merge fino resolve)",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10}],memoriaCalculo:{terreo:{pilares:[]}}};
    const base=[orcamentoBase];
    const proposedDeA=[{...orcamentoBase,itens:[{id:"i1",qtd:20}]}];
    const persistedDeB=[{...orcamentoBase,memoriaCalculo:{terreo:{pilares:[{id:"p1"}]}}}];
    expect(findAggregateConflicts(base,proposedDeA,persistedDeB,"orcamentos")).toEqual([]);
  });

  // Caso real que motivou a correção: duas pessoas lançando/editando ITENS
  // DIFERENTES no mesmo orçamento, no MESMO array `itens`.
  it("NÃO sinaliza conflito quando duas pessoas mexem em itens DIFERENTES do mesmo array itens[]",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10},{id:"i2",qtd:5}]};
    const base=[orcamentoBase];
    // A adiciona um item novo (i3) sem tocar em i1/i2.
    const propostoDeA=[{...orcamentoBase,itens:[...orcamentoBase.itens,{id:"i3",qtd:1}]}];
    // B, ao mesmo tempo, editou a quantidade de i2 (um item diferente).
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:10},{id:"i2",qtd:99}]}];
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([]);
  });

  it("AINDA sinaliza conflito quando os dois mudam o MESMO campo do MESMO item para valores diferentes",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10}]};
    const base=[orcamentoBase];
    const propostoDeA=[{...orcamentoBase,itens:[{id:"i1",qtd:20}]}];
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:30}]}];
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([{section:"orcamentos",id:"orc-1"}]);
  });

  it("AINDA sinaliza conflito quando um exclui um item e o outro edita esse MESMO item",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10}]};
    const base=[orcamentoBase];
    const propostoDeA=[{...orcamentoBase,itens:[]}]; // A excluiu o item
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:99}]}]; // B editou o mesmo item
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([{section:"orcamentos",id:"orc-1"}]);
  });

  it("NÃO sinaliza quando um exclui um item que o outro nunca tocou (exclusão respeitada em silêncio, igual ao merge)",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10},{id:"i2",qtd:5}]};
    const base=[orcamentoBase];
    const propostoDeA=[{...orcamentoBase,itens:[{id:"i2",qtd:5}]}]; // A excluiu i1
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:10},{id:"i2",qtd:99}]}]; // B editou i2, nunca tocou i1
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([]);
  });

  // Achado real ao verificar o cenário do bug (31/08/2026): salvarOrc()
  // (OrcamentoView.jsx) carimba `updatedAt:new Date().toISOString()` a
  // CADA edição, inclusive quando o campo de negócio mudado é outro
  // completamente diferente - mesmo padrão em dezenas de domínios deste
  // app. Sem excluir esse metadado da comparação, DUAS pessoas editando
  // itens DIFERENTES do mesmo orçamento ainda colidiriam - não mais no
  // conteúdo, mas no timestamp em si (sempre diferente entre dois saves
  // reais). Este é o cenário mais comum de verdade (a maioria das edições
  // de orçamento passa por salvarOrc), não só um caso de borda.
  it("NÃO sinaliza conflito por causa só do carimbo updatedAt divergindo (metadado, não dado de negócio)",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10},{id:"i2",qtd:5}],updatedAt:"2026-08-31T10:00:00.000Z"};
    const base=[orcamentoBase];
    // A editou i1 e salvou primeiro (salvarOrc carimba um updatedAt novo).
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:20},{id:"i2",qtd:5}],updatedAt:"2026-08-31T10:05:00.000Z"}];
    // B, com a base ANTIGA (antes do save de A), editou i2 - um item
    // diferente - e também carimba seu PRÓPRIO updatedAt ao salvar.
    const propostoDeA=[{...orcamentoBase,itens:[{id:"i1",qtd:10},{id:"i2",qtd:99}],updatedAt:"2026-08-31T10:06:00.000Z"}];
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([]);
  });

  it("mesmo excluindo updatedAt, AINDA sinaliza conflito se o campo de negócio real colide",()=>{
    const orcamentoBase={id:"orc-1",itens:[{id:"i1",qtd:10}],updatedAt:"2026-08-31T10:00:00.000Z"};
    const base=[orcamentoBase];
    const persistidoDeB=[{...orcamentoBase,itens:[{id:"i1",qtd:20}],updatedAt:"2026-08-31T10:05:00.000Z"}];
    const propostoDeA=[{...orcamentoBase,itens:[{id:"i1",qtd:30}],updatedAt:"2026-08-31T10:06:00.000Z"}];
    expect(findAggregateConflicts(base,propostoDeA,persistidoDeB,"orcamentos")).toEqual([{section:"orcamentos",id:"orc-1"}]);
  });
});

describe("findValueConflicts (função interna, testada diretamente para os casos de fronteira)",()=>{
  it("não sinaliza quando um lado simplesmente não mudou nada",()=>{
    expect(findValueConflicts({a:1},{a:1},{a:2},[])).toEqual([]);
    expect(findValueConflicts({a:1},{a:2},{a:1},[])).toEqual([]);
  });
  it("sinaliza um valor-folha simples mudado dos dois lados para coisas diferentes",()=>{
    expect(findValueConflicts(1,2,3,[])).toEqual([[]]);
    expect(findValueConflicts({a:1},{a:2},{a:3},[])).toEqual([["a"]]);
  });
  it("desce por objetos aninhados e só sinaliza o caminho exato da colisão",()=>{
    const base={x:{y:1},z:{w:1}};
    const incoming={x:{y:2},z:{w:1}};
    const current={x:{y:1},z:{w:2}};
    // x.y só mudou do lado do incoming; z.w só mudou do lado do current -
    // nenhum dos dois é uma colisão real.
    expect(findValueConflicts(base,incoming,current,[])).toEqual([]);
  });
  it("registro novo, sem existir em base nem current, nunca é conflito",()=>{
    expect(findValueConflicts([],[{id:"novo",v:1}],[],[])).toEqual([]);
  });
  it("registro que só existe em current (nunca visto pelo requerente) nunca é conflito",()=>{
    expect(findValueConflicts([{id:"a",v:1}],[{id:"a",v:2}],[{id:"a",v:1},{id:"b",v:1}],[])).toEqual([]);
  });
});
