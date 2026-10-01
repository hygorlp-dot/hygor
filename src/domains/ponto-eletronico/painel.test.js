import { describe, expect, it } from "vitest";
import { horaLocal, intervaloDoDia, resumoDoDia, situacaoAparelho } from "./painel.js";

const m = (employeeId, marcadoEm, extra = {}) => ({ employeeId, marcadoEm, tipoRegistro: "ponto", horaConfiavel: true, metodo: "facial", ...extra });

describe("painel do ponto eletrônico", () => {
  it("o dia civil da obra (UTC-3) vira o intervalo UTC certo", () => {
    expect(intervaloDoDia("2026-10-01")).toEqual({ de: "2026-10-01T03:00:00.000Z", ate: "2026-10-02T02:59:59.999Z" });
    expect(horaLocal("2026-10-01T10:05:09.000Z")).toBe("07:05:09");
  });

  it("resume o dia por funcionário: em jornada primeiro, depois fechada, depois sem batida", () => {
    const funcionarios = [{ id: "e1", nome: "Ana" }, { id: "e2", nome: "Bruno" }, { id: "e3", nome: "Carlos" }];
    const r = resumoDoDia([
      m("e2", "2026-10-01T10:00:00Z"), m("e2", "2026-10-01T15:00:00Z"),
      m("e1", "2026-10-01T10:30:00Z", { metodo: "encarregado" }),
    ], funcionarios);
    expect(r.map(l => [l.nome, l.situacao, l.batidas.length, l.alertas])).toEqual([
      ["Ana", "em_jornada", 1, 1], ["Bruno", "fechada", 2, 0], ["Carlos", "sem_batida", 0, 0],
    ]);
  });

  it("marcação de quem saiu da equipe da obra não some da tela", () => {
    const r = resumoDoDia([m("e9", "2026-10-01T10:00:00Z")], [{ id: "e1", nome: "Ana" }]);
    expect(r.find(l => l.employeeId === "e9")).toMatchObject({ foraDaObra: true, situacao: "em_jornada" });
  });

  it("acesso de terceiro não entra no resumo de ponto", () => {
    expect(resumoDoDia([{ tipoRegistro: "acesso_terceiro", terceiroId: "t1", marcadoEm: "2026-10-01T10:00:00Z" }], [])).toEqual([]);
  });

  it("situação do aparelho pela última conexão", () => {
    const agora = Date.parse("2026-10-01T12:00:00Z");
    expect(situacaoAparelho({ status: "ativo", ultimoContatoEm: "2026-10-01T11:50:00Z" }, agora).rotulo).toBe("Online");
    expect(situacaoAparelho({ status: "ativo", ultimoContatoEm: "2026-10-01T11:20:00Z" }, agora)).toEqual({ rotulo: "Sem contato há 40 min", tom: "atencao" });
    expect(situacaoAparelho({ status: "ativo", ultimoContatoEm: "2026-09-28T12:00:00Z" }, agora)).toEqual({ rotulo: "Sem contato há 3 dias", tom: "critico" });
    expect(situacaoAparelho({ status: "revogado" }, agora).rotulo).toBe("Desativado");
  });
});
