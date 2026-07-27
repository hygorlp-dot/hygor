import { describe, expect, it } from "vitest";
import { projectClientFinancialSummary, projectClientPortalData } from "./client-portal-projection.js";
import { CLIENT_PORTAL_DATA_INVENTORY } from "./client-portal-inventory.js";

const user = { id:"client-a", projectIds:["obra-a"], permissions:["viewProgress", "viewMedia", "viewFinancial", "viewProjectCash", "viewProcurement", "downloadDocuments", "viewWeeklyUpdates", "viewDecisions", "viewChanges", "sendMessages", "viewTeam"] };
const project = { id:"obra-a", name:"Residência Monte Verde", portalCoverImage:"https://media/capa.webp", portalProgress:48, internalCost:900000, margin:0.25, bankAccounts:["segredo"] };
const sourceData = {
  weeklyUpdates:[{ id:"weekly-public", obraId:"obra-a", status:"published", period:"14–20 jul", summary:"Instalações concluídas", internalNotes:"não publicar" }, { id:"weekly-draft", obraId:"obra-a", status:"draft", summary:"rascunho" }, { id:"weekly-other", obraId:"obra-b", status:"published", summary:"outra obra" }],
  timeline:[{ id:"timeline", obraId:"obra-a", status:"published", phase:"Instalações", progress:48, resources:["equipe interna"] }],
  media:[{ id:"media-public", obraId:"obra-a", status:"published", clientUrl:"https://media/foto.webp", caption:"Banheiro social", pix:"chave-proibida" }, { id:"media-draft", obraId:"obra-a", status:"approved", clientUrl:"https://media/nao-publicar.webp" }],
  decisions:[{ id:"decision", obraId:"obra-a", status:"published", title:"Porcelanato", options:[{id:"a",label:"A",financialImpact:0,scheduleImpactDays:0,internalMargin:1}] }],
  changeOrders:[{ id:"change", obraId:"obra-a", status:"published", title:"Aditivo aprovado", financialImpact:4850, salary:999 }],
  measurements:[{ id:"measurement", obraId:"obra-a", status:"published", codigo:"M-01", clientAmount:25000, valorPrevisto:25000, valorRecebido:10000, reconciliation:{id:"interno"} }],
  clientPayments:[{ id:"payment", obraId:"obra-a", status:"published", amount:10000, bankAccount:"não publicar" }],
  projectCashSummaries:[{id:"cash",obraId:"obra-a",status:"published",totalContributions:10000,totalExpenses:2500,balance:7500,bankAccount:"não publicar"}],
  projectCashMovements:[{id:"cash-movement",obraId:"obra-a",status:"published",date:"2026-07-12",type:"Despesa",category:"Material",description:"Cimento",amount:2500,balance:7500,transacaoId:"não publicar"}],
  clientInvoices:[{id:"invoice",obraId:"obra-a",status:"published",number:"124",supplierName:"Casa dos Materiais",netAmount:2400,chave:"não publicar"}],
  clientPurchaseOrders:[{id:"purchase",obraId:"obra-a",status:"published",number:"PC-001",total:250,items:[{description:"Cimento",quantity:10,unitPrice:25}],payments:[{pix:"não publicar"}]}],
  clientQuotations:[{id:"quotation",obraId:"obra-a",status:"published",material:"Cimento",quantity:10,proposals:[{supplierName:"Casa dos Materiais",total:250,selected:true,cnpj:"não publicar"}]}],
  documents:[{ id:"document", obraId:"obra-a", status:"published", nome:"Medição", clientUrl:"https://signed/document", internalUrl:"https://interno" }],
  messages:[{ id:"message", obraId:"obra-a", status:"published", subject:"Reunião", body:"Confirmada", senderName:"Equipe", internalNotes:"nunca" }],
  team:[{ id:"team", obraId:"obra-a", status:"published", nome:"Ana", funcao:"Arquiteta", cpf:"000", salario:1000 }],
  employees:[{ id:"employee", obraId:"obra-a", salary:5000, pix:"x" }], payroll:[{ id:"payroll", obraId:"obra-a", salary:5000 }], bankTransactions:[{ id:"bank", obraId:"obra-a" }],
};

describe("projectClientPortalData", () => {
  it("projects only explicit published fields for the authorized project", () => {
    const result = projectClientPortalData({ user, project, sourceData });
    expect(result.project).toEqual({ id:"obra-a", name:"Residência Monte Verde", coverImage:"https://media/capa.webp", currentPhase:"", progress:48, estimatedCompletion:"", lastUpdate:"" });
    expect(result.weeklyUpdates).toHaveLength(1);
    expect(result.publishedMedia).toEqual([expect.objectContaining({ id:"media-public", caption:"Banheiro social" })]);
    expect(result.measurements).toEqual([expect.objectContaining({ id:"measurement", amount:25000 })]);
    expect(result.publishedDocuments[0]).toEqual(expect.objectContaining({ url:"https://signed/document" }));
    expect(result.projectCashSummary[0]).toMatchObject({balance:7500});
    expect(result.invoices[0]).toMatchObject({number:"124",netAmount:2400});
    expect(result.purchaseOrders[0]).toMatchObject({number:"PC-001",total:250});
    expect(result.quotations[0].proposals[0]).toMatchObject({selected:true,total:250});
    expect(JSON.stringify(result)).not.toContain("não publicar");
  });

  it("never exposes workforce, payroll, payment keys or internal fields", () => {
    const result = projectClientPortalData({ user, project, sourceData });
    const serialized = JSON.stringify(result).toLowerCase();
    ["employees", "attendance", "payroll", "salary", "pix", "cpf", "bankaccounts", "banktransactions", "reconciliation", "dre", "internalcost", "margin", "internalnotes", "servicerole", "tokens"].forEach(forbidden => expect(serialized).not.toContain(forbidden));
    expect(result).not.toHaveProperty("employees");
    expect(result).not.toHaveProperty("bankTransactions");
  });

  it("rejects a client attempting to access another project", () => {
    try {
      projectClientPortalData({ user, project:{ id:"obra-b", name:"Outra obra" }, sourceData });
      throw new Error("Acesso indevido deveria ter sido bloqueado.");
    } catch (error) {
      expect(error).toMatchObject({ status:403 });
    }
  });

  it("requires each optional portal capability", () => {
    const result = projectClientPortalData({ user:{ id:"client-a", projectIds:["obra-a"] }, project, sourceData });
    expect(result.timeline).toEqual([]);
    expect(result.measurements).toEqual([]);
    expect(result.publishedDocuments).toEqual([]);
    expect(result.publishedMedia).toEqual([]);
    expect(result.projectCashMovements).toEqual([]);
    expect(result.purchaseOrders).toEqual([]);
  });

  it("respeita visibilidade editorial e nunca reaproveita URL interna de mídia", () => {
    const restricted={...sourceData,media:[
      {id:"for-owner",obraId:"obra-a",status:"published",visibility:"owners",clientUrl:"https://media/owner.webp"},
      {id:"selected",obraId:"obra-a",status:"published",visibility:"selected_users",visibleToUserIds:["client-b"],clientUrl:"https://media/selected.webp"},
      {id:"internal-url",obraId:"obra-a",status:"published",url:"https://internal/private.webp"},
    ]};
    const result=projectClientPortalData({user:{...user,profile:"financial"},project,sourceData:restricted});
    expect(result.publishedMedia).toEqual([]);
  });

  it("exibe o financeiro somente a partir de resumo contratual publicado", () => {
    const result=projectClientFinancialSummary({user,project,sourceData:{
      financialSummaries:[{id:"fs-1",obraId:"obra-a",status:"published",contractOriginal:100000,approvedChanges:5000,contractCurrent:105000,measured:40000,approved:38000,paid:30000,openAmount:8000,balanceToMeasure:65000,asOf:"2026-07-26",internalMargin:0.4}],
      medicoes:[{id:"m-internal",obraId:"obra-a",valorPrevisto:999999}],
    }});
    expect(result).toEqual([expect.objectContaining({contractCurrent:105000,paid:30000})]);
    expect(JSON.stringify(result)).not.toContain("internalMargin");
  });

  it("mantém inventário explícito para domínios publicáveis e proibidos", () => {
    expect(CLIENT_PORTAL_DATA_INVENTORY.some(item=>item.domain==="obra")).toBe(true);
    expect(CLIENT_PORTAL_DATA_INVENTORY.find(item=>item.domain==="proibido").classification).toBe("prohibited");
  });
});
