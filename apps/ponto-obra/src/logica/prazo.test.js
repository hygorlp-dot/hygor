import { afterEach, describe, expect, it, vi } from "vitest";
import { PRAZO_CAPTURA_MS, comPrazo } from "./prazo.js";

afterEach(() => { vi.useRealTimers(); });

describe("comPrazo (captura da câmera que nunca responde)", () => {
  it("promessa que NUNCA resolve (takePictureAsync antes de a câmera ligar) rejeita no prazo - a tela não trava", async () => {
    vi.useFakeTimers();
    const nunca = new Promise(() => {});
    const r = comPrazo(nunca, PRAZO_CAPTURA_MS, "câmera sem resposta");
    vi.advanceTimersByTime(PRAZO_CAPTURA_MS);
    await expect(r).rejects.toThrow("câmera sem resposta");
  });

  it("resposta a tempo passa direto; erro da câmera passa como está; o timer é limpo", async () => {
    vi.useFakeTimers();
    await expect(comPrazo(Promise.resolve({ uri: "file://x" }), 1000)).resolves.toEqual({ uri: "file://x" });
    await expect(comPrazo(Promise.reject(new Error("câmera em uso")), 1000)).rejects.toThrow("câmera em uso");
    expect(vi.getTimerCount()).toBe(0);
  });
});
