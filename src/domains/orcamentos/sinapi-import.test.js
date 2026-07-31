import { describe, expect, it, vi } from "vitest";
import { readSinapiInWorker } from "./sinapi-import";

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

describe("importador SINAPI em worker", () => {
  it("transfere o arquivo e devolve a extração sem bloquear a interface", async () => {
    const worker = workerHarness();
    const bytes = new ArrayBuffer(8);
    const result = readSinapiInWorker(
      { arrayBuffer: vi.fn().mockResolvedValue(bytes) },
      "PE",
      vi.fn(),
      { WorkerClass: worker.WorkerMock, workerUrl: "worker.js" },
    );
    await vi.waitFor(() => expect(worker.instance.postMessage).toHaveBeenCalledWith({ bytes, uf: "PE" }, [bytes]));
    worker.instance.onmessage({ data: { tipo: "concluido", extraida: { itens: 12 } } });
    await expect(result).resolves.toEqual({ itens: 12 });
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("propaga progresso e encerra o worker quando a leitura falha", async () => {
    const worker = workerHarness();
    const onProgress = vi.fn();
    const result = readSinapiInWorker(
      { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)) },
      "PE",
      onProgress,
      { WorkerClass: worker.WorkerMock, workerUrl: "worker.js" },
    );
    await vi.waitFor(() => expect(worker.instance).toBeTruthy());
    worker.instance.onmessage({ data: { tipo: "etapa", mensagem: "Lendo CSD", progresso: 25 } });
    expect(onProgress).toHaveBeenCalledWith("Lendo CSD", 25);
    worker.instance.onerror({ message: "arquivo inválido" });
    await expect(result).rejects.toThrow("arquivo inválido");
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("aborta uma importação que fica sem progresso", async () => {
    vi.useFakeTimers();
    const worker = workerHarness();
    const result = readSinapiInWorker(
      { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)) },
      "PE",
      vi.fn(),
      { WorkerClass: worker.WorkerMock, workerUrl: "worker.js", inactivityTimeoutMs: 10 },
    );
    const rejection = expect(result).rejects.toThrow("sem avançar");
    await vi.advanceTimersByTimeAsync(11);
    await rejection;
    expect(worker.instance.terminate).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
