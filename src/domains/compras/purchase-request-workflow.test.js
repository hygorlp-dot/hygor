import {describe,expect,it} from "vitest";
import {changePurchaseRequestProject,purchaseRequestSummary,validatePurchaseRequest} from "./purchase-request-workflow";

const validForm=()=>({obraId:"obra-1",necessidade:"2026-08-10",prioridade:"normal",observacao:"",itens:[{
  id:"item-1",descricaoRef:"Aço CA-50",unidadeRef:"KG",unidadeCompra:"BR",fatorConversao:12.3,quantidade:20,orcNivel1Id:"etapa-1",
}]});

describe("fluxo formal de solicitação de materiais",()=>{
  it("não permite descartar silenciosamente uma linha incompleta",()=>{
    const form=validForm();form.itens.push({id:"item-2",descricaoRef:"Cimento",unidadeRef:"SC",quantidade:""});
    const result=validatePurchaseRequest(form);
    expect(result.valid).toBe(false);
    expect(result.firstInvalidItem.id).toBe("item-2");
    expect(result.firstInvalidItem.errors.quantidade).toMatch(/maior que zero/i);
  });

  it("exige conversão quando unidade de compra difere da referência",()=>{
    const form=validForm();form.itens[0].fatorConversao="";
    expect(validatePurchaseRequest(form).items[0].errors.fatorConversao).toBeTruthy();
  });

  it("exige justificativa para solicitação urgente",()=>{
    const form=validForm();form.prioridade="urgente";
    expect(validatePurchaseRequest(form).fieldErrors.observacao).toMatch(/urgência/i);
  });

  it("limpa apropriações incompatíveis quando a obra muda",()=>{
    const changed=changePurchaseRequestProject(validForm(),"obra-2");
    expect(changed.obraId).toBe("obra-2");
    expect(changed.itens[0].orcNivel1Id).toBe("");
  });

  it("resume exatamente o que será formalizado",()=>{
    expect(purchaseRequestSummary(validForm())).toEqual({itemCount:1,totalQuantity:20,urgent:false});
  });
});
