import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientPortalApp from "../app/ClientPortalApp.jsx";
import { ClientPortalBottomNav } from "../app/ClientPortalBottomNav.jsx";
import { ClientPortalRouter } from "../app/ClientPortalRouter.jsx";
import { readClientPortalByLink } from "../services/clientPortalApi.js";

const mounted = [];
function render(ui) { const container=document.createElement("div"); document.body.append(container); const root=createRoot(container); act(() => root.render(ui)); mounted.push({container,root}); return container; }
afterEach(() => { while(mounted.length){ const {container,root}=mounted.pop(); act(() => root.unmount()); container.remove(); } vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

const portalData = { project:{name:"Residência Monte Verde",progress:48,currentPhase:"Instalações",estimatedCompletion:"18 de dezembro de 2026"}, decisions:[{id:"d"}], measurements:[{id:"m"}], publishedMedia:[{id:"photo"}], weeklyUpdates:[{id:"w",period:"14–20 jul",summary:"Instalações concluídas",nextSteps:["Revestimentos"]}] };

describe("ClientPortalApp", () => {
  it("keeps the portal protected until an individual portal session exists", () => {
    const container=render(<ClientPortalApp />);
    expect(container.textContent).toContain("Acesso protegido");
    expect(container.textContent).not.toContain("Residência Monte Verde");
  });

  it("renders only supplied portal projection information", () => {
    const container=render(<ClientPortalApp session={{permissions:{viewFinancial:true}}} portalData={portalData} />);
    expect(container.textContent).toContain("Residência Monte Verde");
    expect(container.textContent).toContain("48%");
    expect(container.textContent).toContain("decisão(ões) aguardando você");
    expect(container.textContent).not.toContain("salário");
  });

  it("does not enable financial navigation without permission", () => {
    const onNavigate=vi.fn();
    const container=render(<ClientPortalBottomNav permissions={{}} onNavigate={onNavigate} />);
    const financial=[...container.querySelectorAll("button")].find(button => button.textContent.includes("Financeiro"));
    expect(financial.disabled).toBe(true);
    act(() => financial.click());
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("converte o link revogável sem login para a projeção segura do portal novo", async () => {
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue({
      ok:true,status:200,json:async()=>({portal:{obra:{id:"obra-a",nome:"Residência Monte Verde"},progresso:48,cronograma:[{id:"t",nome:"Fundação",progresso:35}],fotos:[],medicoes:[],documentos:[{id:"doc",nome:"Boletim",url:"https://cliente/boletim.pdf"}],atualizacoes:[],caixaResumo:{id:"cx",balance:7500},caixaMovimentacoes:[{id:"mov",description:"Aporte julho",amount:10000}],notasFiscais:[{id:"nf",number:"124"}],compras:[{id:"pc",number:"PC-001"}],cotacoes:[{id:"ct",material:"Cimento"}]}}),
    });
    const result=await readClientPortalByLink("obra-a","token-seguro");
    expect(result.project).toMatchObject({id:"obra-a",name:"Residência Monte Verde",progress:48});
    expect(result.timeline[0]).toMatchObject({phase:"Fundação",progress:35});
    expect(result.publishedDocuments[0]).toMatchObject({title:"Boletim",url:"https://cliente/boletim.pdf"});
    expect(result.projectCashSummary[0]).toMatchObject({balance:7500});
    expect(result.purchaseOrders[0]).toMatchObject({number:"PC-001"});
    expect(result.quotations[0]).toMatchObject({material:"Cimento"});
    expect(fetchMock).toHaveBeenCalledWith("/api/data",expect.objectContaining({method:"POST"}));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({action:"client-portal",obraId:"obra-a",token:"token-seguro"});
  });

  it("renders published progress, decisions and financial content instead of placeholders", () => {
    const richPortal={...portalData,
      timeline:[{id:"t",phase:"Fundação",status:"Em andamento",progress:35,plannedStart:"2026-07-01",plannedEnd:"2026-07-30"}],
      approvedChanges:[{id:"c",title:"Aditivo aprovado",status:"Aprovado"}],
      financialSummary:[{id:"f",contractOriginal:100000,contractCurrent:110000,approvedChanges:10000,measured:40000,approved:38000,paid:25000,openAmount:13000,balanceToMeasure:70000,asOf:"2026-07-26"}],
      payments:[{id:"p",description:"Parcela 1",amount:25000,status:"Recebido"}],
      projectCashSummary:[{id:"cash",totalContributions:10000,totalExpenses:2500,balance:7500,asOf:"2026-07-26"}],
      projectCashMovements:[{id:"movement",date:"2026-07-20",type:"Aporte",category:"Aporte",description:"Aporte julho",amount:10000,balance:10000}],
      invoices:[{id:"invoice",type:"NFE",number:"124",supplierName:"Casa dos Materiais",netAmount:2400,status:"Aprovada"}],
      purchaseOrders:[{id:"purchase",number:"PC-001",supplierName:"Casa dos Materiais",status:"Recebido",total:250,items:[{description:"Cimento",quantity:10,receivedQuantity:10,unit:"SC",unitPrice:25}]}],
      quotations:[{id:"quotation",material:"Cimento",quantity:10,unit:"SC",status:"Decidida",proposals:[{supplierName:"Casa dos Materiais",total:250,selected:true}]}],
    };
    window.history.replaceState({}, "", "/cliente/obra/obra-a/progresso");
    const progress=render(<ClientPortalRouter portalData={richPortal} permissions={{viewFinancial:true}} />);
    expect(progress.textContent).toContain("Fundação");
    expect(progress.textContent).not.toContain("Esta área aparecerá");
    window.history.replaceState({}, "", "/cliente/obra/obra-a/decisoes");
    const decisions=render(<ClientPortalRouter portalData={richPortal} permissions={{viewFinancial:true}} />);
    expect(decisions.textContent).toContain("Aditivo aprovado");
    window.history.replaceState({}, "", "/cliente/obra/obra-a/financeiro");
    const financial=render(<ClientPortalRouter portalData={richPortal} permissions={{viewFinancial:true}} />);
    expect(financial.textContent).toContain("R$ 110.000,00");
    expect(financial.textContent).not.toContain("salário");
    window.history.replaceState({}, "", "/cliente/obra/obra-a/documentos");
    const documents=render(<ClientPortalRouter portalData={{...richPortal,publishedDocuments:[{id:"doc",title:"Boletim de medição",url:"https://cliente/boletim.pdf"}]}} permissions={{downloadDocuments:true}} />);
    expect(documents.textContent).toContain("Boletim de medição");
    expect(documents.querySelector("a")?.href).toBe("https://cliente/boletim.pdf");
    window.history.replaceState({}, "", "/cliente/obra/obra-a/transparencia");
    const transparency=render(<ClientPortalRouter portalData={richPortal} permissions={{viewProjectCash:true,viewProcurement:true}} />);
    expect(transparency.textContent).toContain("Caixa e suprimentos");
    expect(transparency.textContent).toContain("Aporte julho");
    const purchases=[...transparency.querySelectorAll("button")].find(button=>button.textContent==="Compras");
    act(()=>purchases.click());
    expect(transparency.textContent).toContain("PC-001");
    window.history.replaceState({}, "", "/");
  });
});
