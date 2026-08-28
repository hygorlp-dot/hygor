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

  it("não ressuscita um registro em array já excluído por outro cliente",()=>{
    // Usuário B cancela/exclui o pedido "p1" (current não o contém mais).
    // Usuário A, trabalhando com a cópia antiga (base), edita um campo não
    // relacionado do mesmo pedido. O merge não deve trazer o pedido de volta.
    const base=[{id:"p1",obraId:"obra-a",status:"aprovado",valor:1000}];
    const incoming=[{id:"p1",obraId:"obra-a",status:"aprovado",valor:1000,obs:"nf anexada"}];
    const current=[];
    expect(mergeThreeWay(base,incoming,current)).toEqual([]);
  });

  it("ainda cria um item novo que não existia em base nem em current",()=>{
    const base=[];
    const incoming=[{id:"novo",obraId:"obra-a",status:"aberto"}];
    const current=[];
    expect(mergeThreeWay(base,incoming,current)).toEqual([
      {id:"novo",obraId:"obra-a",status:"aberto"},
    ]);
  });

  it("não ressuscita uma chave de objeto já excluída por outro cliente",()=>{
    // Ex.: lançamento de ponto de um dia específico removido por outro
    // usuário, enquanto o cliente atual ainda envia sua cópia desatualizada.
    const base={emp1:{"2026-01-05":{horas:8}}};
    const incoming={emp1:{"2026-01-05":{horas:9}}};
    const current={emp1:{}};
    expect(mergeThreeWay(base,incoming,current)).toEqual({emp1:{}});
  });

  // Investigação de 27/08/2026 (relato de "orçamento não salva com mais de
  // uma pessoa no app"): confirma que o merge de um ÚNICO registro (mesmo
  // `id` dentro de uma lista, ex.: `orcamentos`) é feito CAMPO A CAMPO, não
  // "o objeto inteiro de um lado vence". Duas pessoas no MESMO orçamento,
  // cada uma mexendo numa seção diferente (itens vs. memoriaCalculo -
  // Pilares/Vigas/Sapatas), não podem perder a mudança da outra em silêncio.
  it("mescla campo a campo dentro do mesmo registro de uma lista (ex.: orçamentos)",()=>{
    const orcamentoBase={
      id:"orc-1",nome:"Obra X",
      itens:[{id:"i1",qtd:10,preco:5}],
      memoriaCalculo:{terreo:{pilares:[]}},
    };
    const base=[orcamentoBase];
    // Pessoa A só mudou os itens (preço/quantidade).
    const incomingDeA=[{
      ...orcamentoBase,
      itens:[{id:"i1",qtd:20,preco:5}],
    }];
    // Pessoa B já salvou primeiro, mudando só a memória de cálculo
    // (Pilares/Vigas/Sapatas) - é o que já está no servidor quando o pedido
    // de A chega.
    const currentAposSalvarDeB=[{
      ...orcamentoBase,
      memoriaCalculo:{terreo:{pilares:[{id:"p1",tipo:"P1",concretoUnit:1}]}},
    }];
    // O resultado tem que ter as DUAS mudanças - a de A (itens) e a de B
    // (memoriaCalculo) - dentro do MESMO orçamento, sem que nenhuma pise na
    // outra.
    expect(mergeThreeWay(base,incomingDeA,currentAposSalvarDeB)).toEqual([{
      id:"orc-1",nome:"Obra X",
      itens:[{id:"i1",qtd:20,preco:5}],
      memoriaCalculo:{terreo:{pilares:[{id:"p1",tipo:"P1",concretoUnit:1}]}},
    }]);
  });
});
