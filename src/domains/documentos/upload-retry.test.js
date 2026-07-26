import { describe, expect, it, vi } from "vitest";
import { isRetryableUploadFailure, uploadWithRetry } from "./upload-retry";

describe("repetição de upload de evidências", () => {
  it("repete falha transitória e preserva o resultado do envio", async () => {
    const upload = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, error: "Serviço temporariamente indisponível" })
      .mockResolvedValueOnce({ ok: true, url: "/arquivo/1" });
    const delay = vi.fn().mockResolvedValue();

    await expect(uploadWithRetry(upload, { delay })).resolves.toEqual({ ok: true, url: "/arquivo/1", uploadAttempts: 2 });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(250);
  });

  it("não repete falha definitiva de autorização ou tamanho", async () => {
    const upload = vi.fn().mockResolvedValue({ ok: false, status: 413, error: "Arquivo maior que 6 MB." });

    await expect(uploadWithRetry(upload, { delay: vi.fn() })).resolves.toMatchObject({ ok: false, status: 413, uploadAttempts: 1 });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("reconhece apenas indisponibilidades transitórias como repetíveis", () => {
    expect(isRetryableUploadFailure({ status: 429 })).toBe(true);
    expect(isRetryableUploadFailure({ error: "Failed to fetch" })).toBe(true);
    expect(isRetryableUploadFailure({ status: 403, error: "Sem acesso" })).toBe(false);
  });
});
