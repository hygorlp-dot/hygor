import { describe, expect, it } from "vitest";
import { metricasDaFila, montarCorpoSincronizacao } from "./sincronizacao.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";

describe("métricas de fila na sincronização (sem dado pessoal)", () => {
  const agoraMs = Date.parse("2026-10-12T12:00:00.000Z");

  it("pendentes, fotos, idade da pendente mais antiga, minutos desde o último envio ok e p95 do reconhecimento", () => {
    const m = metricasDaFila({
      contagem: { pendentes: 4, fotos: 2, fotosComProblema: 1 },
      pendenteMaisAntiga: { eventId: "x", employeeId: "e1", cpf: "12345678909", marcadoEm: "2026-10-12T10:29:00.000Z" },
      ultimaSincronizacao: { ultimoOkEm: agoraMs - 95 * 60_000, erro: "x" },
      reconhecimentoP95Ms: 1234.4, agoraMs,
    });
    expect(m).toEqual({ batidasPendentes: 4, fotosPendentes: 2, pendenteMaisAntigaMin: 91, minDesdeEnvioOk: 95, reconhecimentoP95Ms: 1234 });
  });

  it("valor desconhecido fica de fora; relógio do celular atrasado não gera idade negativa", () => {
    expect(metricasDaFila({ contagem: { pendentes: 0, fotos: 0 }, agoraMs })).toEqual({ batidasPendentes: 0, fotosPendentes: 0 });
    expect(metricasDaFila({ contagem: {}, ultimaSincronizacao: { ultimoOkEm: null }, agoraMs })).toEqual({});
    expect(metricasDaFila({ contagem: { pendentes: 1, fotos: 0 }, pendenteMaisAntiga: { marcadoEm: "2026-10-12T12:30:00.000Z" }, agoraMs }).pendenteMaisAntigaMin).toBe(0);
    expect(metricasDaFila({ contagem: { pendentes: 1 }, pendenteMaisAntiga: { marcadoEm: "lixo" }, agoraMs })).toEqual({ batidasPendentes: 1 });
    expect(metricasDaFila()).toEqual({});
  });

  it("lê a fila de um armazém real sem alterá-la", async () => {
    const armazem = criarArmazemMemoria();
    await armazem.transacao(tx => tx.inserirEvento({ formatVersion: 2, eventId: "ev-1", localSequence: 1, marcadoEm: "2026-10-12T11:00:00.000Z", fotoSha256: "a".repeat(64) }, { caminhoFoto: "file:///f.jpg" }));
    const antes = JSON.stringify(armazem.eventos);
    const [maisAntiga] = await armazem.eventosPendentes(1);
    const m = metricasDaFila({ contagem: await armazem.contagem(), pendenteMaisAntiga: maisAntiga, agoraMs });
    expect(m).toEqual({ batidasPendentes: 1, fotosPendentes: 1, pendenteMaisAntigaMin: 60 });
    expect(JSON.stringify(armazem.eventos)).toBe(antes);
  });

  it("montarCorpoSincronizacao manda as métricas DENTRO de `aparelho`, só os campos do contrato", () => {
    const corpo = montarCorpoSincronizacao({
      app: { versao: "1.2.0", build: "3", commit: "7a5b73c", ambiente: "producao" }, aparelho: { marca: "samsung", modelo: "A15", android: "15" },
      metricas: { batidasPendentes: 3, fotosPendentes: 1, pendenteMaisAntigaMin: 70, minDesdeEnvioOk: 72, reconhecimentoP95Ms: 900, nome: "Zé", cpf: "123", vetor: [0.1] },
      agoraMs,
    });
    expect(corpo.aparelho).toEqual({
      marca: "samsung", modelo: "A15", android: "15", build: "3", commit: "7a5b73c", ambiente: "producao",
      batidasPendentes: 3, fotosPendentes: 1, pendenteMaisAntigaMin: 70, minDesdeEnvioOk: 72, reconhecimentoP95Ms: 900,
    });
    expect(JSON.stringify(corpo)).not.toMatch(/Zé|cpf|vetor/);
    // Sem métricas, o corpo é o de antes.
    expect(Object.keys(montarCorpoSincronizacao({ app: {}, aparelho: {}, agoraMs }).aparelho)).toEqual(["marca", "modelo", "android", "build", "commit", "ambiente"]);
  });
});
