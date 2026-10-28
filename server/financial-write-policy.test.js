import { describe, expect, it } from "vitest";
import {
  FINANCIAL_LEGACY_SECTIONS,
  FINANCIAL_MODULE_SECTION_MATRIX,
  FINANCIAL_OPERATIONAL_SOURCE_SECTIONS,
  FINANCIAL_SNAPSHOT_WRITER_SECTIONS,
  financialPersistenceMode,
  financialEnforcementReadiness,
  financialActivationEvidenceGate,
  hasLegacyFinancialWrite,
  validateProjectFinancialSnapshotPolicy,
  validateFinancialWritePath,
} from "./financial-write-policy.js";

describe("gate FIN-003 de persistência",()=>{
  it("mantém o legado disponível enquanto o motor estiver em sombra",()=>{
    expect(validateFinancialWritePath({engineEnforced:false,sections:{medicoes:[]}})).toEqual({ok:true});
    expect(financialPersistenceMode(false)).toBe("audited_shadow");
    expect(financialPersistenceMode(true)).toBe("transactional_ledger");
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

  it("declara FIN-003 pronto quando não resta escritor financeiro por snapshot",()=>{
    const readiness=financialEnforcementReadiness();
    const expected=[...FINANCIAL_SNAPSHOT_WRITER_SECTIONS]
      .filter(section=>!FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section))
      .sort();
    for(const section of FINANCIAL_SNAPSHOT_WRITER_SECTIONS)expect(FINANCIAL_LEGACY_SECTIONS.has(section),section).toBe(true);
    expect(readiness.ready).toBe(true);
    expect(readiness.pending).toEqual(expected);
    expect(Object.keys(readiness.modules).sort()).toEqual(Object.keys(FINANCIAL_MODULE_SECTION_MATRIX).sort());
    expect(readiness.pending).not.toContain("medicoes");
    expect(readiness.pending).not.toContain("caixaObra");
    expect(readiness.pending).not.toContain("pedidos");
    expect(readiness.pending).not.toContain("obras");
    expect(readiness.pending).not.toContain("comercial");
    expect(readiness.pending).not.toContain("equipamentos");
    expect(readiness.pending).not.toContain("locacoesEquip");
    expect(readiness.pending).not.toContain("manutencoesEquip");
  });

  it("não contabiliza seções já migradas para comandos transacionais como escritores de snapshot",()=>{
    const readiness=financialEnforcementReadiness();
    for(const section of [
      "reconciliationLinks","archivedLaborCosts","payments","medicoes",
      "outrasDesp","despesasEmpresa","caixaObra","transacoes",
      "pagsTerceiros","medicoesTerc",
      "notasFiscais","pedidos","rescisoes","pagamentosFolha","titulosFolha",
      "attendance","employees","config",
    ]){
      expect(FINANCIAL_LEGACY_SECTIONS.has(section),section).toBe(true);
      expect(FINANCIAL_SNAPSHOT_WRITER_SECTIONS.has(section),section).toBe(false);
      expect(readiness.pending,section).not.toContain(section);
    }
    expect(readiness.pending).toHaveLength(0);
  });

  it("mantém todos os escritores associados a um módulo funcional",()=>{
    const mapped=new Set(Object.values(FINANCIAL_MODULE_SECTION_MATRIX).flat());
    expect(mapped).toEqual(new Set(FINANCIAL_SNAPSHOT_WRITER_SECTIONS));
  });

  it("só libera FIN-003 quando todas as evidências operacionais estão verdes",()=>{
    const ready=financialActivationEvidenceGate({
      factsCount:12,
      shadowRun:{id:"run-1"},
      divergences:[],
      dreDivergences:[],
      procurementDreDivergences:[],
      missingLegacyLinks:[],
      openQualityCases:[],
    });
    expect(ready.ready).toBe(true);
    expect(ready.blockers).toEqual([]);
    expect(ready.checks.every(check=>check.ok)).toBe(true);
  });

  it("bloqueia ativação quando falta carga, vínculo, qualidade ou existe divergência",()=>{
    const blocked=financialActivationEvidenceGate({
      factsCount:4,
      shadowRun:null,
      divergences:[{scope:"obra-1",metric:"expenses"}],
      dreDivergences:[{sourceId:"2026-10"}],
      procurementDreDivergences:[{orderId:"p-1"}],
      missingLegacyLinks:[{legacyType:"pedido",legacyId:"p-1"}],
      openQualityCases:[{id:"dq-1",category:"financial_shadow_divergence"}],
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toEqual([
      "shadow_run",
      "ledger_divergence",
      "dre_divergence",
      "procurement_dre_divergence",
      "legacy_links",
      "quality_cases",
    ]);
  });

  it("bloqueia ativação sem fatos mesmo que as listas de divergência estejam vazias",()=>{
    const blocked=financialActivationEvidenceGate({
      factsCount:0,
      shadowRun:{id:"run-vazia"},
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toContain("shadow_has_facts");
  });

  it("permite dados operacionais da obra, mas bloqueia contrato por snapshot",()=>{
    const before={obras:[{
      id:"o-1",name:"B2-04",faseId:"f-1",contractValue:100000,
      contractType:"fixed_labor",hasCaixa:false,
    }]};
    expect(validateProjectFinancialSnapshotPolicy({
      engineEnforced:true,
      before,
      after:{obras:[{...before.obras[0],faseId:"f-2"}]},
    })).toEqual({ok:true});
    expect(validateProjectFinancialSnapshotPolicy({
      engineEnforced:true,
      before,
      after:{obras:[{...before.obras[0],contractValue:120000}]},
    })).toMatchObject({ok:false});
    expect(validateProjectFinancialSnapshotPolicy({
      engineEnforced:true,
      before,
      after:{obras:[]},
    })).toMatchObject({ok:false});
  });
});
