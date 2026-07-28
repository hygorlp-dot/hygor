import { describe,expect,it } from "vitest";
import { projectReconciliationPatch, reconciliationChangedSections } from "./reconciliation-response.js";

describe("resposta enxuta da conciliação",()=>{
  it("retorna somente as seções alteradas",()=>{
    const sharedWorks=[{id:"obra"}];
    const before={obras:sharedWorks,transacoes:[{id:"pix",status:"pendente"}],materiais:[{id:"m1"}]};
    const after={...before,transacoes:[{id:"pix",status:"conciliado"}],historicoConc:[{transacaoId:"pix"}]};
    expect(reconciliationChangedSections(before,after)).toEqual(["transacoes","historicoConc"]);
    expect(projectReconciliationPatch(before,after,{id:"admin",role:"admin"})).toEqual({
      transacoes:after.transacoes,
      historicoConc:after.historicoConc,
    });
  });

  it("não expõe uma seção que o perfil não pode ler",()=>{
    const before={obras:[],despesasEmpresa:[]};
    const after={...before,despesasEmpresa:[{id:"d1",valor:100}]};
    expect(projectReconciliationPatch(before,after,{id:"comercial",role:"comercial"})).toEqual({});
  });
});
