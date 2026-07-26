import { describe, expect, it } from "vitest";
import { createExactPixLaborCandidate, findRegisteredEmployeePix, isExactPixLaborMatch } from "./pix-card";

const candidate={emp:{id:"e1",name:"Antônio Lourenço",pixHolder:"Maria da Silva",pixKey:"123e4567-e89b",obra:"obra-1"},divergencia:0};

describe("cartão PIX de mão de obra",()=>{
  it("identifica na fila uma chave PIX de funcionário, sem conciliar o movimento",()=>{
    const hit=findRegisteredEmployeePix({valor:-500,descricao:"Pix enviado: Cp :18236120-Antonio Pereira"},[
      {id:"e1",name:"Antonio Pereira",pixKey:"18236120",active:true},
    ]);
    expect(hit).toMatchObject({employee:{id:"e1"},match:"chave_documento"});
    expect(findRegisteredEmployeePix({valor:500,descricao:"Pix recebido 18236120"},[{id:"e1",pixKey:"18236120"}])).toBeNull();
  });
  it("pré-seleciona somente nome/titular/chave com valor exato e obra conhecida",()=>{
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX enviado Antônio Lourenço"},candidate)).toBe(true);
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX Maria da Silva"},candidate)).toBe(true);
  });
  it("mantém divergências para confirmação explícita",()=>{
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX Antônio Lourenço"},{...candidate,divergencia:12})).toBe(false);
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX desconhecido"},candidate)).toBe(false);
    expect(isExactPixLaborMatch({valor:-1000,descricao:"PIX Antônio Lourenço"},candidate)).toBe(false);
  });
  it("promove a correspondência inequívoca para candidata da fila, sem baixá-la",()=>{
    const result=createExactPixLaborCandidate(
      {id:"t1",valor:-1000,data:"2026-07-20",descricao:"PIX Maria da Silva"},
      {...candidate,esperado:1000,diasTrabalhados:10,periodoPonto:"06/07/2026 a 20/07/2026",motivos:["valor exato do ponto"]},
    );
    expect(result).toMatchObject({
      tipo:"maoObraPonto", entidadeId:"e1", obraId:"obra-1", score:100, confianca:"forte",
      podeVincular:false, podeRegistrarPagamento:false,
    });
    expect(result.titulo).toContain("Antônio Lourenço");
    expect(result.motivos).toContain("titular/chave PIX e obra confirmados");
  });
  it("não cria candidata de fila quando a evidência não é inequívoca",()=>{
    expect(createExactPixLaborCandidate({valor:-1000,data:"2026-07-20",descricao:"PIX desconhecido"},candidate)).toBeNull();
  });
});
