import { describe, expect, it } from "vitest";
import { isExactPixLaborMatch } from "./pix-card";

const candidate={emp:{name:"Antônio Lourenço",pixHolder:"Maria da Silva",pixKey:"123e4567-e89b",obra:"obra-1"},divergencia:0};

describe("cartão PIX de mão de obra",()=>{
  it("pré-seleciona somente nome/titular/chave com valor exato e obra conhecida",()=>{
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX enviado Antônio Lourenço"},candidate)).toBe(true);
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX Maria da Silva"},candidate)).toBe(true);
  });
  it("mantém divergências para confirmação explícita",()=>{
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX Antônio Lourenço"},{...candidate,divergencia:12})).toBe(false);
    expect(isExactPixLaborMatch({valor:-1000,data:"2026-07-20",descricao:"PIX desconhecido"},candidate)).toBe(false);
    expect(isExactPixLaborMatch({valor:-1000,descricao:"PIX Antônio Lourenço"},candidate)).toBe(false);
  });
});
