import { describe, expect, it } from "vitest";
import { FILA_ATRASADA_MIN, FILA_PARADA_MIN, detalheFila, horaLocal, intervaloDoDia, resumoDoDia, situacaoAparelho, situacaoFila } from "./painel.js";
import { METRICAS_APARELHO, limparMetricasAparelho } from "./metricas-aparelho.js";

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

describe("fila do aparelho no painel (métricas informadas pelo app)", () => {
  const ativo = fila => ({ status: "ativo", fila });

  it("sem métricas (app antigo) ou aparelho desativado: sem selo de fila", () => {
    expect(situacaoFila({ status: "ativo", fila: null })).toBeNull();
    expect(situacaoFila({ status: "revogado", fila: { batidasPendentes: 9, pendenteMaisAntigaMin: 999 } })).toBeNull();
    expect(detalheFila({ fila: null })).toBe("");
  });

  it("batida pendente há 1 h ou mais = fila parada (crítico); há 15 min = atrasada; senão em dia", () => {
    expect(situacaoFila(ativo({ batidasPendentes: 3, pendenteMaisAntigaMin: FILA_PARADA_MIN }))).toEqual({ rotulo: "Fila parada: 3 batidas sem enviar há 1 h", tom: "critico" });
    expect(situacaoFila(ativo({ batidasPendentes: 1, pendenteMaisAntigaMin: 4320 })).rotulo).toBe("Fila parada: 1 batida sem enviar há 3 dias");
    expect(situacaoFila(ativo({ batidasPendentes: 2, pendenteMaisAntigaMin: FILA_ATRASADA_MIN }))).toEqual({ rotulo: "Fila atrasada: 2 batidas sem enviar há 15 min", tom: "atencao" });
    expect(situacaoFila(ativo({ batidasPendentes: 2, pendenteMaisAntigaMin: 3 })).tom).toBe("ok");
    expect(situacaoFila(ativo({ batidasPendentes: 0, fotosPendentes: 4, minDesdeEnvioOk: 90 }))).toEqual({ rotulo: "4 fotos sem enviar", tom: "atencao" });
    expect(situacaoFila(ativo({ batidasPendentes: 0, fotosPendentes: 0 }))).toEqual({ rotulo: "Fila em dia", tom: "ok" });
  });

  it("detalhe curto com fila, último envio ok e p95 do reconhecimento", () => {
    expect(detalheFila(ativo({ batidasPendentes: 1, fotosPendentes: 0, minDesdeEnvioOk: 125, reconhecimentoP95Ms: 1460 })))
      .toBe("fila: 1 batida, 0 fotos · último envio ok há 2 h · reconhecimento p95 1,5 s");
    expect(detalheFila(ativo({ batidasPendentes: 0, fotosPendentes: 1, reconhecimentoP95Ms: 640 }))).toBe("fila: 0 batidas, 1 foto · reconhecimento p95 640 ms");
  });

  it("contrato das métricas (app e servidor): só os 5 campos, número finito >= 0, inteiro e limitado", () => {
    expect(Object.keys(METRICAS_APARELHO)).toEqual(["batidasPendentes", "fotosPendentes", "pendenteMaisAntigaMin", "minDesdeEnvioOk", "reconhecimentoP95Ms"]);
    expect(limparMetricasAparelho({ batidasPendentes: 2.5, reconhecimentoP95Ms: 700_000, nome: "Zé" })).toEqual({ batidasPendentes: 3, reconhecimentoP95Ms: 600_000 });
    for (const lixo of [null, undefined, "x", 3, [1, 2]]) expect(limparMetricasAparelho(lixo)).toEqual({});
    expect(limparMetricasAparelho({ batidasPendentes: "2", fotosPendentes: -1, minDesdeEnvioOk: NaN })).toEqual({});
  });
});
