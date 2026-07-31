import { describe,expect,it } from "vitest";
import {
  podeCriarRegra,
  podeDesfazerConciliacao,
  podeOperarConciliacao,
  podeOperarConciliacaoTrabalhista,
  podeVerConciliacao,
} from "./permissions.js";

describe("permissões da conciliação",()=>{
  it("permite ao RH somente a operação trabalhista",()=>{
    expect(podeVerConciliacao("rh")).toBe(true);
    expect(podeOperarConciliacaoTrabalhista("rh")).toBe(true);
    expect(podeOperarConciliacao("rh")).toBe(false);
    expect(podeCriarRegra("rh")).toBe(false);
    expect(podeDesfazerConciliacao("rh")).toBe(false);
  });
});
