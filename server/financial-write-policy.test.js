import { describe, expect, it } from "vitest";
import { hasLegacyFinancialWrite, validateFinancialWritePath } from "./financial-write-policy.js";

describe("gate FIN-003 de persistência",()=>{
  it("mantém o legado disponível enquanto o motor estiver em sombra",()=>{
    expect(validateFinancialWritePath({engineEnforced:false,sections:{medicoes:[]}})).toEqual({ok:true});
  });

  it("recusa snapshot financeiro quando o motor é oficial",()=>{
    expect(hasLegacyFinancialWrite({pedidos:[]})).toBe(true);
    expect(validateFinancialWritePath({engineEnforced:true,sections:{pedidos:[]}})).toMatchObject({ok:false});
  });

  it("não bloqueia seções não financeiras",()=>{
    expect(validateFinancialWritePath({engineEnforced:true,sections:{preferencias:{tema:"claro"}}})).toEqual({ok:true});
  });
});
