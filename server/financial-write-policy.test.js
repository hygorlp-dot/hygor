import { describe, expect, it } from "vitest";
import {
  FINANCIAL_LEGACY_SECTIONS,
  FINANCIAL_MODULE_SECTION_MATRIX,
  FINANCIAL_OPERATIONAL_SOURCE_SECTIONS,
  FINANCIAL_SNAPSHOT_WRITER_SECTIONS,
  financialEnforcementReadiness,
  hasLegacyFinancialWrite,
  validateFinancialWritePath,
} from "./financial-write-policy.js";

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

  it("mantém o ponto como fonte operacional auditada do razão",()=>{
    const sections={attendance:{e1:{"2026-07-28":{status:"P",obraId:"o1"}}}};
    expect(hasLegacyFinancialWrite(sections)).toBe(true);
    expect(validateFinancialWritePath({engineEnforced:true,sections})).toEqual({ok:true});
  });

  it("valida a matriz completa de módulos no modo sombra usado em produção",()=>{
    for(const section of FINANCIAL_SNAPSHOT_WRITER_SECTIONS){
      expect(hasLegacyFinancialWrite({[section]:{}}),section).toBe(true);
      expect(
        validateFinancialWritePath({engineEnforced:false,sections:{[section]:{}}}),
        section
      ).toEqual({ok:true});
    }
  });

  it("não declara FIN-003 pronto enquanto existir módulo bloqueável com escritor legado",()=>{
    const readiness=financialEnforcementReadiness();
    const expected=[...FINANCIAL_SNAPSHOT_WRITER_SECTIONS]
      .filter(section=>!FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section))
      .sort();
    for(const section of FINANCIAL_SNAPSHOT_WRITER_SECTIONS)expect(FINANCIAL_LEGACY_SECTIONS.has(section),section).toBe(true);
    expect(readiness.ready).toBe(false);
    expect(readiness.pending).toEqual(expected);
    expect(Object.keys(readiness.modules).sort()).toEqual(Object.keys(FINANCIAL_MODULE_SECTION_MATRIX).sort());
    expect(readiness.pending).toContain("medicoes");
    expect(readiness.pending).toContain("pedidos");
    expect(readiness.pending).toContain("obras");
    expect(readiness.pending).not.toContain("comercial");
    expect(readiness.pending).not.toContain("equipamentos");
    expect(readiness.pending).not.toContain("locacoesEquip");
    expect(readiness.pending).not.toContain("manutencoesEquip");
  });

  it("mantém todos os escritores associados a um módulo funcional",()=>{
    const mapped=new Set(Object.values(FINANCIAL_MODULE_SECTION_MATRIX).flat());
    expect(mapped).toEqual(new Set(FINANCIAL_SNAPSHOT_WRITER_SECTIONS));
  });
});
