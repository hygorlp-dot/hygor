import { describe, expect, it } from "vitest";
import {
  amendmentIdFromChangeId, decisoesDoClientePorAditivo, evidenciaDoPortal, PORTAL_AMENDMENT_EVENT, validarDecisaoDoCliente,
} from "./portal-amendment-decisions.js";
import { AMENDMENT_COMMAND, applyAmendmentCommand, valorContratoVigente } from "./contract-amendments.js";
import { buildClientPortalPublicationRows } from "../../../server/client-portal-publication.js";
import { projectClientPortalData } from "../../../server/client-portal-projection.js";

const NOW = "2026-10-28T12:00:00.000Z";
const data = () => applyAmendmentCommand({
  obras:[{ id:"o1", name:"Casa", contractValue:100000, portalCliente:{ publicarFinanceiro:true } }],
}, { type:AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED, payload:{ obraId:"o1", amendment:{ id:"a1", descricao:"Porcelanato", valor:8000, justificativa:"interno" } } }, NOW).data;

describe("cliente aprova aditivo pelo portal", () => {
  it("o aditivo proposto é publicado aguardando o cliente, sem dado interno", () => {
    const rows = buildClientPortalPublicationRows({ data:data(), projectId:"o1", publishedAt:NOW });
    const change = rows.find(r => r.domain === "change_order").payload;
    expect(change).toMatchObject({ id:"aditivo-a1", status:"Aguardando sua aprovação", pendingClient:true, financialImpact:8000 });
    expect(JSON.stringify(change)).not.toMatch(/interno/);
    expect(rows.find(r => r.domain === "financial_summary").payload.contractCurrent).toBe(100000);
  });

  it("só quem tem approveChanges pode decidir no portal", () => {
    const change = { id:"aditivo-a1", obraId:"o1", status:"published", visibility:"project_users", pendingClient:true, title:"Aditivo 1" };
    const portal = permissions => projectClientPortalData({
      user:{ id:"c1", projectIds:["o1"], permissions:Object.keys(permissions) }, permissions,
      project:{ id:"o1", name:"Casa" }, sourceData:{ changeOrders:[change] },
    });
    expect(portal({ viewChanges:true, approveChanges:true }).approvedChanges[0]).toMatchObject({ pendingClient:true, canDecide:true });
    expect(portal({ viewChanges:true }).approvedChanges[0]).toMatchObject({ pendingClient:true, canDecide:false });
  });

  it("valida a decisão e lê a mais recente de cada aditivo", () => {
    expect(validarDecisaoDoCliente({ decision:"talvez" })).toMatch(/aprovar ou recusar/);
    expect(validarDecisaoDoCliente({ decision:"aprovado", comment:"x".repeat(501) })).toMatch(/500/);
    expect(validarDecisaoDoCliente({ decision:"recusado" })).toBe("");
    expect(amendmentIdFromChangeId("aditivo-a1")).toBe("a1");
    expect(amendmentIdFromChangeId("outra-coisa")).toBe("");
    const decisoes = decisoesDoClientePorAditivo([
      { event_type:PORTAL_AMENDMENT_EVENT, created_at:"2026-10-28T10:00:00Z", correlation_id:"aaaa1111", metadata:{ amendmentId:"a1", decision:"recusado", email:"c@x" } },
      { event_type:PORTAL_AMENDMENT_EVENT, created_at:"2026-10-28T11:00:00Z", correlation_id:"bbbb2222", metadata:{ amendmentId:"a1", decision:"aprovado", email:"c@x", comment:"ok" } },
      { event_type:"project_opened", created_at:"2026-10-28T12:00:00Z", metadata:{ amendmentId:"a1", decision:"recusado" } },
    ]);
    expect(decisoes.get("a1")).toMatchObject({ decision:"aprovado", email:"c@x", reference:"bbbb2222" });
    expect(evidenciaDoPortal(decisoes.get("a1"))).toBe('Portal do cliente · c@x · 2026-10-28 11:00 · ref. bbbb2222 · "ok"');
  });

  it("efetivar a decisão do portal atualiza o contrato vigente com origem portal", () => {
    const decidido = applyAmendmentCommand(data(), {
      type:AMENDMENT_COMMAND.CONTRACT_AMENDMENT_DECIDED, actorId:"adm", actorName:"Admin",
      payload:{ obraId:"o1", amendmentId:"a1", decision:"aprovado", origem:"portal", evidencia:"Portal do cliente · c@x" },
    }, NOW).data.obras[0];
    expect(decidido.aditivosContrato[0]).toMatchObject({ status:"aprovado", origemDecisao:"portal" });
    expect(valorContratoVigente(decidido)).toBe(108000);
  });
});
