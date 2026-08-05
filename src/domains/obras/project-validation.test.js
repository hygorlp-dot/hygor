import {describe,expect,it} from "vitest";
import {projectAlertAction,validateProjectForm} from "./project-validation.js";

const valid={name:"B2-04",contractType:"fixed_labor",contractStart:"2026-08-01",contractEnd:"2027-08-01",contractValue:100000,entrada:10000,entradaDate:"2026-08-01",totalParcelas:12,billingFrequency:"mensal",diaVenc1:15};

describe("validação do cadastro da obra",()=>{
  it("aceita um contrato coerente",()=>expect(validateProjectForm(valid)).toEqual({}));
  it("recusa fim anterior ao início",()=>expect(validateProjectForm({...valid,contractEnd:"2026-07-01"}).contractEnd).toBeTruthy());
  it("recusa entrada superior ao contrato",()=>expect(validateProjectForm({...valid,entrada:120000}).entrada).toContain("superar"));
  it("recusa parcelas fracionárias e vencimentos duplicados",()=>{
    const errors=validateProjectForm({...valid,totalParcelas:1.5,billingFrequency:"quinzenal",diaVenc1:15,diaVenc2:15});
    expect(errors.totalParcelas).toBeTruthy();expect(errors.diaVenc2).toBeTruthy();
  });
  it("exige percentual e base nos contratos por administração",()=>{
    const errors=validateProjectForm({...valid,contractType:"admin_only",adminPercentage:0,adminBaseMateriais:false,adminBaseMaoDeObra:false,adminBaseTerceirizados:false});
    expect(errors.adminPercentage).toBeTruthy();expect(errors.adminBases).toBeTruthy();
  });
  it("transforma pendência em ação contextual",()=>expect(projectAlertAction("Engenheiro não definido")).toEqual({label:"Definir engenheiro",field:"engineerId"}));
});
