import { describe, expect, it } from "vitest";
import { AMENDMENT_COMMAND, applyAmendmentCommand, fimContratoVigente, valorContratoVigente } from "./contract-amendments.js";
import { calculateContractProjection } from "../dre/calculations.js";
import { buildClientPortalPublicationRows } from "../../../server/client-portal-publication.js";
import { applyOperationalCommand } from "../sync/operational-commands.js";

const NOW = "2026-10-28T12:00:00.000Z";
const base = () => ({
  obras:[{ id:"o1", name:"Casa", contractType:"fixed_labor", contractValue:100000, contractEnd:"2026-12-20", portalCliente:{ publicarFinanceiro:true } }],
});
const run = (data, type, payload, extra = {}) => applyAmendmentCommand(data, { type, payload, actorId:"u1", actorName:"Admin", ...extra }, NOW);
const propor = (data, amendment = {}) => run(data, AMENDMENT_COMMAND.CONTRACT_AMENDMENT_SAVED, { obraId:"o1", amendment:{ id:"a1", descricao:"Porcelanato na sala", valor:8000, prazoDias:10, ...amendment } });
const decidir = (data, decision = "aprovado", evidencia = "E-mail de 28/10") => run(data, AMENDMENT_COMMAND.CONTRACT_AMENDMENT_DECIDED, { obraId:"o1", amendmentId:"a1", decision, evidencia });

describe("aditivos do contrato do cliente", () => {
  it("proposto não muda o contrato; aprovado soma valor e prazo", () => {
    const proposto = propor(base()).data;
    expect(proposto.obras[0].aditivosContrato[0]).toMatchObject({ numero:1, status:"proposto", version:1 });
    expect(valorContratoVigente(proposto.obras[0])).toBe(100000);
    const aprovado = decidir(proposto).data.obras[0];
    expect(aprovado.aditivosContrato[0]).toMatchObject({ status:"aprovado", origemDecisao:"interno", evidenciaDecisao:"E-mail de 28/10" });
    expect(valorContratoVigente(aprovado)).toBe(108000);
    expect(fimContratoVigente(aprovado)).toBe("2026-12-30");
  });

  it("valida descrição, mudança real, evidência da decisão e supressão", () => {
    expect(propor(base(), { descricao:"" }).reason).toMatch(/Descreva/);
    expect(propor(base(), { valor:0, prazoDias:0 }).reason).toMatch(/valor, o prazo/);
    expect(propor(base(), { valor:-200000 }).reason).toMatch(/negativo/);
    expect(decidir(propor(base()).data, "aprovado", "").reason).toMatch(/como o cliente/);
    const aprovado = decidir(propor(base()).data).data;
    expect(decidir(aprovado).reason).toMatch(/já foi decidido/);
    expect(propor(aprovado, { valor:1 }).reason).toMatch(/ainda proposto/);
  });

  it("cancelar exige motivo e tira o aditivo do contrato vigente", () => {
    const aprovado = decidir(propor(base()).data).data;
    const cancelar = reason => run(aprovado, AMENDMENT_COMMAND.CONTRACT_AMENDMENT_CANCELLED, { obraId:"o1", amendmentId:"a1", reason });
    expect(cancelar("").ok).toBe(false);
    const cancelado = cancelar("Cliente desistiu").data.obras[0];
    expect(cancelado.aditivosContrato[0]).toMatchObject({ status:"cancelado", statusAnterior:"aprovado" });
    expect(valorContratoVigente(cancelado)).toBe(100000);
  });

  it("a receita projetada da empreitada usa o contrato vigente", () => {
    const aprovado = decidir(propor(base()).data).data.obras[0];
    expect(calculateContractProjection(aprovado, 0).revenue).toBe(108000);
  });

  it("o portal publica o contrato vigente e o aditivo aprovado, sem dado interno", () => {
    const data = decidir(propor(base(), { justificativa:"pedido interno" }).data).data;
    const rows = buildClientPortalPublicationRows({ data, projectId:"o1", publishedAt:NOW });
    expect(rows.find(r => r.domain === "financial_summary").payload).toMatchObject({ contractOriginal:100000, approvedChanges:8000, contractCurrent:108000 });
    const change = rows.find(r => r.domain === "change_order").payload;
    expect(change).toMatchObject({ title:"Aditivo 1", status:"Aprovado", financialImpact:8000, scheduleImpactDays:10 });
    expect(JSON.stringify(change)).not.toMatch(/pedido interno|Admin/);
  });

  it("salvar o cadastro da obra com dados antigos não apaga aditivos", () => {
    const comAditivo = propor(base()).data;
    const saved = applyOperationalCommand(comAditivo, {
      type:"OBRA_SALVA", idempotencyKey:"obra-salva-1", now:NOW, actorId:"u1", actorRole:"admin",
      expectedVersion:0, payload:{ project:{ ...base().obras[0], aditivosContrato:[] } },
    });
    expect(saved.ok).toBe(true);
    expect(saved.data.obras[0].aditivosContrato).toHaveLength(1);
  });
});
