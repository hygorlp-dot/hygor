import { describe, expect, it } from "vitest";
import { CONFERENCE_COMMAND, applyConferenceCommand } from "./conference-commands.js";

const BASE = {
  obras: [{ id: "obra1", name: "Obra 1" }],
  usuarios: [
    { id: "aud1", nome: "Ana Auditora", role: "engenheiro_auditor", active: true },
    { id: "eng1", nome: "Bruno Engenheiro", role: "engenheiro", active: true },
  ],
  conferencias: [],
};

const withConference = (overrides = {}) => ({
  ...BASE,
  conferencias: [{
    id: "conf1", obraId: "obra1", data: "2026-08-20", codigo: 1,
    responsavelId: "aud1", responsavel: "Ana Auditora", status: "em_andamento",
    notaGeral: null, observacoesGerais: "", pendencias: [], version: 1,
    auditTrail: [], ...overrides,
  }],
});

describe("comandos de conferência técnica", () => {
  it("ignora comandos de outro domínio", () => {
    expect(applyConferenceCommand(BASE, { type: "OUTRO_COMANDO" })).toBeNull();
  });

  describe("CONFERENCE_CREATED", () => {
    it("cria a conferência com código sequencial por obra", () => {
      const command = {
        type: CONFERENCE_COMMAND.CONFERENCE_CREATED, idempotencyKey: "conf-0001", expectedVersion: 0,
        payload: { conference: { id: "conf1", obraId: "obra1", data: "2026-08-26", responsavelId: "aud1" } },
      };
      const result = applyConferenceCommand(BASE, command, "2026-08-26T10:00:00.000Z");
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0]).toMatchObject({ id: "conf1", codigo: 1, responsavel: "Ana Auditora", status: "nao_iniciada", version: 1 });
    });

    it("rejeita responsável que não é admin nem auditor", () => {
      const command = {
        type: CONFERENCE_COMMAND.CONFERENCE_CREATED, idempotencyKey: "conf-0002", expectedVersion: 0,
        payload: { conference: { id: "conf1", obraId: "obra1", data: "2026-08-26", responsavelId: "eng1" } },
      };
      expect(applyConferenceCommand(BASE, command).ok).toBe(false);
    });
  });

  describe("CONFERENCE_CANCELLED", () => {
    it("cancela a conferência e propaga para pendências abertas, preservando as resolvidas", () => {
      const data = withConference({ pendencias: [
        { id: "p1", descricao: "x", status: "aberta" },
        { id: "p2", descricao: "y", status: "resolvida" },
      ] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_CANCELLED, idempotencyKey: "canc-0001", expectedVersion: 1, payload: { conferenceId: "conf1", reason: "Obra suspensa" } };
      const result = applyConferenceCommand(data, command, "2026-08-26T10:00:00.000Z");
      expect(result.ok).toBe(true);
      const conf = result.data.conferencias[0];
      expect(conf.status).toBe("cancelada");
      expect(conf.pendencias[0].status).toBe("cancelada");
      expect(conf.pendencias[1].status).toBe("resolvida");
    });

    it("recusa sem motivo", () => {
      const data = withConference();
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_CANCELLED, idempotencyKey: "canc-0002", expectedVersion: 1, payload: { conferenceId: "conf1", reason: "" } };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });

    it("recusa com versão desatualizada (concorrência)", () => {
      const data = withConference({ version: 3 });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_CANCELLED, idempotencyKey: "canc-0003", expectedVersion: 1, payload: { conferenceId: "conf1", reason: "x" } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/alterada por outra pessoa/);
    });
  });

  describe("CONFERENCE_METADATA_UPDATED", () => {
    it("atualiza data e observações", () => {
      const data = withConference();
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_METADATA_UPDATED, idempotencyKey: "meta-0001", expectedVersion: 1, payload: { conferenceId: "conf1", patch: { data: "2026-08-27", observacoesGerais: "Revisado" } } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0]).toMatchObject({ data: "2026-08-27", observacoesGerais: "Revisado", version: 2 });
    });

    it("é idempotente quando nada muda", () => {
      const data = withConference();
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_METADATA_UPDATED, idempotencyKey: "meta-0002", expectedVersion: 1, payload: { conferenceId: "conf1", patch: { data: "2026-08-20", observacoesGerais: "" } } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0].version).toBe(1);
    });
  });

  describe("CONFERENCE_FINDING_SAVED", () => {
    it("cria um achado e move a conferência para em_andamento", () => {
      const data = withConference({ status: "nao_iniciada" });
      const command = {
        type: CONFERENCE_COMMAND.CONFERENCE_FINDING_SAVED, idempotencyKey: "find-0001", expectedVersion: 1,
        payload: { conferenceId: "conf1", finding: { id: "p1", descricao: "Trinca na viga", ajusteNecessario: "Reforçar", responsavelAjusteId: "eng1", responsavelAjusteNome: "Bruno Engenheiro", impacto: "alto", categoria: "inconformidade", status: "aberta" } },
      };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0].status).toBe("em_andamento");
      expect(result.data.conferencias[0].pendencias[0]).toMatchObject({ id: "p1", descricao: "Trinca na viga" });
    });

    it("rejeita achado sem responsável pelo ajuste", () => {
      const data = withConference();
      const command = {
        type: CONFERENCE_COMMAND.CONFERENCE_FINDING_SAVED, idempotencyKey: "find-0002", expectedVersion: 1,
        payload: { conferenceId: "conf1", finding: { id: "p1", descricao: "x", ajusteNecessario: "y" } },
      };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });
  });

  describe("CONFERENCE_FINDING_CANCELLED", () => {
    it("cancela um achado específico sem afetar os demais", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "aberta" }, { id: "p2", descricao: "b", status: "aberta" }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_FINDING_CANCELLED, idempotencyKey: "fc-0001", expectedVersion: 1, payload: { conferenceId: "conf1", findingId: "p1", reason: "Duplicado" } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0].pendencias[0].status).toBe("cancelada");
      expect(result.data.conferencias[0].pendencias[1].status).toBe("aberta");
    });
  });

  describe("CONFERENCE_FINDING_EVIDENCE_ADDED", () => {
    it("anexa evidência e reabre para validação quando resetValidation=true", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "em_ajuste", fotos: [], validacaoStatus: "nao_conforme" }] });
      const command = {
        type: CONFERENCE_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED, idempotencyKey: "ev-0001", expectedVersion: 1,
        payload: { conferenceId: "conf1", findingId: "p1", resetValidation: true, fotos: [{ id: "f1", url: "https://x/f1.jpg", tipo: "ajuste" }] },
      };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      const finding = result.data.conferencias[0].pendencias[0];
      expect(finding.status).toBe("aguardando_validacao");
      expect(finding.fotos).toHaveLength(1);
      expect(finding.validacaoStatus).toBe("");
    });

    it("rejeita pendência já resolvida", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "resolvida", fotos: [] }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED, idempotencyKey: "ev-0002", expectedVersion: 1, payload: { conferenceId: "conf1", findingId: "p1", fotos: [{ id: "f1", url: "x" }] } };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });
  });

  describe("CONFERENCE_FINDING_VALIDATED", () => {
    it("aprova a correção e resolve a pendência", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "aguardando_validacao", fotos: [{ id: "f1", tipo: "ajuste" }], validacoes: [] }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_FINDING_VALIDATED, idempotencyKey: "val-0001", expectedVersion: 1, payload: { conferenceId: "conf1", findingId: "p1", resultado: "conforme", observacao: "Reforço confirmado in loco" } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0].pendencias[0].status).toBe("resolvida");
    });

    it("reprova e devolve para em_ajuste", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "aguardando_validacao", fotos: [{ id: "f1", tipo: "ajuste" }], validacoes: [] }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_FINDING_VALIDATED, idempotencyKey: "val-0002", expectedVersion: 1, payload: { conferenceId: "conf1", findingId: "p1", resultado: "nao_conforme", observacao: "Ainda visível" } };
      const result = applyConferenceCommand(data, command);
      expect(result.data.conferencias[0].pendencias[0].status).toBe("em_ajuste");
    });

    it("exige foto de ajuste antes de validar", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "aguardando_validacao", fotos: [], validacoes: [] }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_FINDING_VALIDATED, idempotencyKey: "val-0003", expectedVersion: 1, payload: { conferenceId: "conf1", findingId: "p1", resultado: "conforme", observacao: "x" } };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });
  });

  describe("CONFERENCE_COMPLETED / CONFERENCE_REOPENED", () => {
    it("conclui a vistoria sem pendências abertas e calcula a nota", () => {
      const data = withConference({ pendencias: [] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_COMPLETED, idempotencyKey: "comp-0001", expectedVersion: 1, payload: { conferenceId: "conf1", declaration: { scopeReviewed: true, notes: "Estrutura e instalações inspecionadas sem inconformidades." } } };
      const result = applyConferenceCommand(data, command, "2026-08-26T12:00:00.000Z");
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0]).toMatchObject({ status: "concluida", notaGeral: 10 });
    });

    it("recusa concluir com pendência aberta", () => {
      const data = withConference({ pendencias: [{ id: "p1", descricao: "a", status: "aberta" }] });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_COMPLETED, idempotencyKey: "comp-0002", expectedVersion: 1, payload: { conferenceId: "conf1", declaration: { scopeReviewed: true, notes: "x" } } };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });

    it("reabre uma vistoria concluída", () => {
      const data = withConference({ status: "concluida", concluidoEm: "2026-08-25T00:00:00.000Z" });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_REOPENED, idempotencyKey: "reo-0001", expectedVersion: 1, payload: { conferenceId: "conf1" } };
      const result = applyConferenceCommand(data, command);
      expect(result.ok).toBe(true);
      expect(result.data.conferencias[0]).toMatchObject({ status: "em_andamento", concluidoEm: "" });
    });

    it("recusa reabrir vistoria que não está concluída", () => {
      const data = withConference({ status: "em_andamento" });
      const command = { type: CONFERENCE_COMMAND.CONFERENCE_REOPENED, idempotencyKey: "reo-0002", expectedVersion: 1, payload: { conferenceId: "conf1" } };
      expect(applyConferenceCommand(data, command).ok).toBe(false);
    });
  });
});
