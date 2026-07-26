import { describe,expect,it } from "vitest";import { buildQualityProjection,canReleaseForMeasurement } from "./calculations.js";import { transitionNonconformity } from "./mutations.js";
describe("qualidade",()=>{
  it("impede medição com não conformidade impeditiva",()=>expect(canReleaseForMeasurement({obraId:"o",serviceId:"s",nonconformities:[{obraId:"o",serviceId:"s",impeditiva:true,status:"aberta"}]}).ok).toBe(false));
  it("trata não conformidade sem serviço como bloqueio da obra",()=>expect(canReleaseForMeasurement({obraId:"o",serviceId:"s",nonconformities:[{obraId:"o",impeditiva:true,status:"aberta"}]}).ok).toBe(false));
  it("projeta FVS/FVM legada sem perder reprovação",()=>{
    const projection=buildQualityProjection({qualidadeRegistros:[{id:"q-1",obraId:"o",status:"reprovada",itens:[{status:"nao_conforme"}],naoConformidade:{status:"aberta"}}]});
    expect(projection.inspections[0]).toMatchObject({resultado:"nao_conforme",source:"qualidadeRegistros"});
    expect(projection.nonconformities[0]).toMatchObject({impeditiva:true,status:"aberta"});
  });
  it("exige justificativa e sequência na não conformidade",()=>{expect(transitionNonconformity({status:"aberta"},"contencao").ok).toBe(true);expect(transitionNonconformity({status:"verificacao"},"encerrada").ok).toBe(false);});
});
