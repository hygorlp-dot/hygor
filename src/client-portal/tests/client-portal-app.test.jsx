import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientPortalApp from "../app/ClientPortalApp.jsx";
import { ClientPortalBottomNav } from "../app/ClientPortalBottomNav.jsx";
import { ClientPortalRouter } from "../app/ClientPortalRouter.jsx";

const mounted = [];
function render(ui) { const container=document.createElement("div"); document.body.append(container); const root=createRoot(container); act(() => root.render(ui)); mounted.push({container,root}); return container; }
afterEach(() => { while(mounted.length){ const {container,root}=mounted.pop(); act(() => root.unmount()); container.remove(); } });

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

  it("renders published progress, decisions and financial content instead of placeholders", () => {
    const richPortal={...portalData,
      timeline:[{id:"t",phase:"Fundação",status:"Em andamento",progress:35,plannedStart:"2026-07-01",plannedEnd:"2026-07-30"}],
      approvedChanges:[{id:"c",title:"Aditivo aprovado",status:"Aprovado"}],
      financialSummary:[{id:"f",contractOriginal:100000,contractCurrent:110000,approvedChanges:10000,measured:40000,approved:38000,paid:25000,openAmount:13000,balanceToMeasure:70000,asOf:"2026-07-26"}],
      payments:[{id:"p",description:"Parcela 1",amount:25000,status:"Recebido"}],
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
    window.history.replaceState({}, "", "/");
  });
});
