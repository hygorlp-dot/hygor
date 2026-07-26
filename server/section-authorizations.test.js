import { describe,expect,it } from "vitest";
import { authorizeSectionChanges,validateBudgetBaselinePolicy,validateNoPhysicalDeletes,validatePlanningBaselinePolicy } from "./section-authorizations.js";
describe("autorização de produção",()=>{
  it("permite planejamento somente ao perfil previsto",()=>{
    expect(authorizeSectionChanges({role:"planejamento"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toMatch(/permissão/);
  });
  it("não permite criar registro global por perfil restrito a obra",()=>{
    expect(authorizeSectionChanges({role:"financeiro",obraId:"o1"},{payments:[{id:"p1",valor:100}]})).toMatch(/precisam estar vinculados/);
    expect(authorizeSectionChanges({role:"financeiro",obraId:"o1"},{payments:[{id:"p1",obraId:"o1",valor:100}]})).toBe("");
  });
  it("não aceita exclusão física de baseline",()=>expect(validateNoPhysicalDeletes({scheduleBaselines:[{id:"b"}]},{scheduleBaselines:[]})).toMatch(/excluir fisicamente/));
  it("impede alteração ou remoção de versão orçamentária aprovada",()=>{
    const anterior={orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:10}]}]};
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:11}]}]})).toMatch(/imutáveis/);
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[]})).toMatch(/não podem ser excluídas/);
  });
  it("exige motivo também para estorno e exclusão lógica",()=>{
    const anterior={payments:[{id:"p1",valor:100}]};
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,status:"estornada"}]})).toMatch(/exige um motivo/);
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,deletedAt:"2026-07-26"}]})).toMatch(/exclusão lógica/);
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,status:"estornada",motivoEstorno:"Duplicidade"}]})).toBe("");
  });
  it("reserva aprovação e adoção de baseline ao administrador",()=>{
    const draft={id:"o1",obraId:"obra-1",versionStatus:"rascunho"};
    const approved={...draft,versionStatus:"aprovado",lockedAt:"2026-07-26T10:00:00Z",approvedById:"admin"};
    expect(validateBudgetBaselinePolicy({orcamentos:[draft]},{orcamentos:[approved]},{role:"engenheiro"})).toMatch(/administrador/);
    expect(validateBudgetBaselinePolicy({orcamentos:[draft],budgetBaselines:[]},{orcamentos:[approved],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",tipo:"controle",ativo:true}]},{role:"admin"})).toBe("");
  });
  it("recusa baseline ambígua ou vinculada a rascunho",()=>{
    const draft={id:"o1",obraId:"obra-1",versionStatus:"rascunho"};
    expect(validateBudgetBaselinePolicy({budgetBaselines:[]},{orcamentos:[draft],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",ativo:true}]},{role:"admin"})).toMatch(/aprovada/);
    const approved={...draft,versionStatus:"aprovado",lockedAt:"x",approvedById:"a"};
    expect(validateBudgetBaselinePolicy({budgetBaselines:[]},{orcamentos:[approved],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",ativo:true},{id:"b2",obraId:"obra-1",budgetId:"o1",ativo:true}]},{role:"admin"})).toMatch(/mais de uma baseline/);
  });
  it("mantém baseline de cronograma imutável e revisável por vínculo explícito",()=>{
    const baseline={id:"p1",status:"aprovada",approvedAt:"2026-07-26",approvedById:"d1",tarefas:["a"]};
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[baseline]},{scheduleBaselines:[{...baseline,tarefas:["b"]}]},{role:"diretoria"})).toMatch(/imutável/);
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[baseline]},{scheduleBaselines:[{...baseline,status:"substituida"},{id:"p2",status:"rascunho",revisionOf:"p1",reason:"Aditivo aprovado"}]},{role:"diretoria"})).toBe("");
  });
  it("não permite aprovação de cronograma por perfil operacional",()=>{
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[]},{scheduleBaselines:[{id:"p1",status:"aprovada",approvedAt:"2026-07-26",approvedById:"d1"}]},{role:"planejamento"})).toMatch(/administrador ou diretoria/);
  });
});
