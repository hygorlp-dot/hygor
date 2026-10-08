// @vitest-environment node
// Feedback é opcional: aparelho sem vibrador, sem voz ou que recusa o brilho
// não pode derrubar a batida. Nenhuma função lança.
import { describe, expect, it, vi } from "vitest";

const falha = () => { throw new Error("indisponível"); };
vi.mock("expo-haptics", () => ({ impactAsync: falha, notificationAsync: () => Promise.reject(new Error("x")), ImpactFeedbackStyle: { Light: "l" }, NotificationFeedbackType: { Success: "s", Error: "e" } }));
vi.mock("expo-speech", () => ({ stop: () => Promise.reject(new Error("sem tts")), speak: falha }));
vi.mock("expo-brightness", () => ({ setBrightnessAsync: falha, restoreSystemBrightnessAsync: () => Promise.reject(new Error("x")) }));

describe("feedback do aparelho", () => {
  it("vibração, voz e brilho com falha nativa resolvem sem lançar", async () => {
    const f = await import("./feedback.js");
    await expect(Promise.all([f.vibrar("leve"), f.vibrar("registro"), f.vibrar("falha"), f.vibrar("outro"), f.falar("Ponto registrado."), f.brilhoMaximo(), f.brilhoNormal()])).resolves.toBeDefined();
  });
});
