import { describe,expect,it } from "vitest";
import { authorizeSectionChanges,validateNoPhysicalDeletes } from "./section-authorizations.js";
describe("autorização de produção",()=>{
  it("permite planejamento somente ao perfil previsto",()=>{
    expect(authorizeSectionChanges({role:"planejamento"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toMatch(/permissão/);
  });
  it("não aceita exclusão física de baseline",()=>expect(validateNoPhysicalDeletes({scheduleBaselines:[{id:"b"}]},{scheduleBaselines:[]})).toMatch(/excluir fisicamente/));
  it("impede alteração ou remoção de versão orçamentária aprovada",()=>{
    const anterior={orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:10}]}]};
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:11}]}]})).toMatch(/imutáveis/);
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[]})).toMatch(/não podem ser excluídas/);
  });
});
