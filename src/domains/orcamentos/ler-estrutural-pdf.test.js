import { describe, expect, it, vi } from "vitest";
import { lerPdfEmWorker } from "./ler-estrutural-pdf";

class WorkerFalso {
  constructor() { WorkerFalso.instancias.push(this); }
  postMessage() { this.ultimaMensagem = true; }
  terminate() { this.terminado = true; }
}
WorkerFalso.instancias = [];

const arquivoFalso = texto => ({ arrayBuffer: () => Promise.resolve(new TextEncoder().encode(texto).buffer) });

describe("lerPdfEmWorker", () => {
  it("resolve com o texto extraído quando o worker conclui", async () => {
    WorkerFalso.instancias = [];
    const promessa = lerPdfEmWorker(arquivoFalso("pdf"), () => {}, { workerUrl: "x", WorkerClass: WorkerFalso });
    await vi.waitFor(() => expect(WorkerFalso.instancias[0]).toBeDefined());
    const worker = WorkerFalso.instancias[0];
    worker.onmessage({ data: { tipo: "concluido", texto: "TEXTO EXTRAÍDO" } });
    await expect(promessa).resolves.toBe("TEXTO EXTRAÍDO");
    expect(worker.terminado).toBe(true);
  });

  it("rejeita com a mensagem de erro do worker", async () => {
    WorkerFalso.instancias = [];
    const promessa = lerPdfEmWorker(arquivoFalso("pdf"), () => {}, { workerUrl: "x", WorkerClass: WorkerFalso });
    await vi.waitFor(() => expect(WorkerFalso.instancias[0]).toBeDefined());
    const worker = WorkerFalso.instancias[0];
    worker.onmessage({ data: { tipo: "erro", mensagem: "PDF corrompido." } });
    await expect(promessa).rejects.toThrow("PDF corrompido.");
  });

  it("rejeita em onerror do worker", async () => {
    WorkerFalso.instancias = [];
    const promessa = lerPdfEmWorker(arquivoFalso("pdf"), () => {}, { workerUrl: "x", WorkerClass: WorkerFalso });
    await vi.waitFor(() => expect(WorkerFalso.instancias[0]).toBeDefined());
    const worker = WorkerFalso.instancias[0];
    worker.onerror({ message: "Falha geral." });
    await expect(promessa).rejects.toThrow("Falha geral.");
  });

  it("lança erro claro se o navegador não suporta Worker", () => {
    expect(() => lerPdfEmWorker(arquivoFalso("pdf"), () => {}, { workerUrl: "x", WorkerClass: undefined }))
      .toThrow(/não suporta/i);
  });
});
