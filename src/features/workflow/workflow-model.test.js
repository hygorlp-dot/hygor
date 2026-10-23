import {describe,it,expect} from "vitest";
import {MODULE_FLOWS,visibleModuleFlow,normalizeWorkflowScope,dreImpactMetrics} from "./workflow-model.js";
import {ROLE_TABS,allowedTabsForUser} from "../../domains/administracao/abas-acesso.js";

describe("fluxos internos do ERP",()=>{
  it("organiza os oito módulos com destinos existentes",()=>{
    expect(Object.keys(MODULE_FLOWS)).toHaveLength(8);
    for(const flow of Object.values(MODULE_FLOWS)){
      for(const id of [...flow.steps.map(([id])=>id),...(flow.tools||[])])expect(ROLE_TABS.admin).toContain(id);
    }
  });
  it.each(Object.keys(ROLE_TABS))("filtra etapas e ferramentas para %s",role=>{
    const allowed=allowedTabsForUser({role,id:"operator"});
    for(const id of Object.keys(MODULE_FLOWS)){
      const flow=visibleModuleFlow(id,allowed);
      for(const tab of [...flow.steps.map(([tab])=>tab),...flow.tools])expect(allowed).toContain(tab);
    }
  });
  it("não inclui destinos fora da permissão personalizada",()=>{
    const allowed=allowedTabsForUser({role:"engenheiro",id:"restricted",accessTabs:["orc"]});
    expect(visibleModuleFlow("eng_grp",allowed).steps.map(([id])=>id)).toEqual(["orc"]);
    expect(visibleModuleFlow("fin_grp",allowed).steps).toEqual([]);
  });
  it("preserva obra e competência e impede ampliar o escopo fixo",()=>{
    expect(normalizeWorkflowScope({obraId:"b",year:2026,month:0,period:"q1"},{obraId:"a"})).toEqual({obraId:"a",year:2026,month:0,period:"q1"});
    expect(normalizeWorkflowScope({year:"",month:null})).toEqual({obraId:"",period:"mes"});
    expect(normalizeWorkflowScope({year:1999,month:12,period:"invalid"})).toEqual({obraId:"",period:"mes"});
  });
  it("não confunde projeção ausente, campo ausente e zero confirmado",()=>{
    expect(dreImpactMetrics("purchases",null)).toBeNull();
    expect(dreImpactMetrics("purchases",{})[0].value).toBeNull();
    expect(dreImpactMetrics("purchases",{comprasCost:0})[0].value).toBe(0);
    expect(dreImpactMetrics("rentals",{equipReceita:900,equipCost:100},true)).toEqual([{label:"Equipamentos apropriados à obra",value:100}]);
    expect(dreImpactMetrics("payroll",{laborCost:900,moData:{laborCost:120,benefitCost:20}},true).map(x=>x.value)).toEqual([120,20]);
  });
});
