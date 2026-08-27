import { describe, expect, it, vi } from "vitest";
import { readOrseInWorker } from "./orse-import";
import { classificarArquivoOrse } from "./orse-parser";

function workerHarness() {
  let instance;
  class WorkerMock {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.terminate = vi.fn();
      this.postMessage = vi.fn();
      instance = this;
    }
  }
  return { WorkerMock, get instance() { return instance; } };
}

function arquivoFake(bytes = new ArrayBuffer(4)) {
  return { arrayBuffer: vi.fn().mockResolvedValue(bytes) };
}

const cincoArquivos = () => ({
  insumo: arquivoFake(), insumoPreco: arquivoFake(), servico: arquivoFake(),
  servicoPreco: arquivoFake(), composicao: arquivoFake(),
});

describe("importador ORSE em worker", () => {
  it("transfere os 5 arquivos e devolve a extração sem bloquear a interface", async () => {
    const worker = workerHarness();
    const result = readOrseInWorker(cincoArquivos(), vi.fn(), { WorkerClass: worker.WorkerMock, workerUrl: "worker.js" });
    await vi.waitFor(() => expect(worker.instance.postMessage).toHaveBeenCalled());
    const [payload] = worker.instance.postMessage.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(["composicao", "insumo", "insumoPreco", "servico", "servicoPreco"]);
    worker.instance.onmessage({ data: { tipo: "concluido", extraida: { itens: [], insumos: [], componentes: [], dataBase: "2026-06" } } });
    await expect(result).resolves.toEqual({ itens: [], insumos: [], componentes: [], dataBase: "2026-06" });
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("rejeita antes de abrir o worker se faltar algum dos 5 arquivos", () => {
    const worker = workerHarness();
    const incompleto = cincoArquivos();
    delete incompleto.composicao;
    expect(() => readOrseInWorker(incompleto, vi.fn(), { WorkerClass: worker.WorkerMock, workerUrl: "worker.js" }))
      .toThrow(/composicao/);
  });

  it("propaga progresso e encerra o worker quando a leitura falha", async () => {
    const worker = workerHarness();
    const onProgress = vi.fn();
    const result = readOrseInWorker(cincoArquivos(), onProgress, { WorkerClass: worker.WorkerMock, workerUrl: "worker.js" });
    await vi.waitFor(() => expect(worker.instance).toBeTruthy());
    worker.instance.onmessage({ data: { tipo: "etapa", mensagem: "Lendo TB_SERVICO...", progresso: 40 } });
    expect(onProgress).toHaveBeenCalledWith("Lendo TB_SERVICO...", 40);
    worker.instance.onerror({ message: "arquivo inválido" });
    await expect(result).rejects.toThrow("arquivo inválido");
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("aborta uma importação que fica sem progresso", async () => {
    vi.useFakeTimers();
    const worker = workerHarness();
    const result = readOrseInWorker(cincoArquivos(), vi.fn(), { WorkerClass: worker.WorkerMock, workerUrl: "worker.js", inactivityTimeoutMs: 10 });
    const rejection = expect(result).rejects.toThrow("sem avançar");
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe("classificarArquivoOrse", () => {
  it("classifica os 5 nomes reais entregues pelo CEHOP", () => {
    expect(classificarArquivoOrse("TB_INSUMO .TXT")).toBe("insumo");
    expect(classificarArquivoOrse("TB_INSUMO_PRECO .TXT")).toBe("insumoPreco");
    expect(classificarArquivoOrse("TB_SERVICO .TXT")).toBe("servico");
    expect(classificarArquivoOrse("TB_SERVICO_PRECO .TXT")).toBe("servicoPreco");
    expect(classificarArquivoOrse("TB_COMPOSICAO .TXT")).toBe("composicao");
  });
  it("ignora de proposito os dois arquivos de detalhamento de equipamento (fora de escopo)", () => {
    expect(classificarArquivoOrse("TB_INSUMO_PRECO_EQUIPAMENTO .TXT")).toBeNull();
    expect(classificarArquivoOrse("TB_INSUMO_PRECO_EQUIPAMENTO_MAODEOBRA .TXT")).toBeNull();
  });
  it("devolve null para um nome que nao reconhece", () => {
    expect(classificarArquivoOrse("relatorio_qualquer.txt")).toBeNull();
    expect(classificarArquivoOrse("")).toBeNull();
  });
});
