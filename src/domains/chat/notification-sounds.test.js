import { describe, expect, it } from "vitest";
import {
  CHAT_TONES,
  playChatMentionSound,
  playChatMessageSound,
} from "./notification-sounds";

describe("sons do chat", () => {
  it("usa assinatura distinta para mensagem e menção", () => {
    expect(CHAT_TONES.message.map(tone => tone.frequency)).toEqual([880, 660]);
    expect(CHAT_TONES.mention.map(tone => tone.frequency)).toEqual([660, 880, 1046]);
  });

  it("degrada silenciosamente quando o navegador não suporta áudio", () => {
    expect(playChatMessageSound(null)).toBe(false);
    expect(playChatMentionSound(null)).toBe(false);
  });

  it("não propaga falha de inicialização do contexto", () => {
    class BrokenAudioContext { constructor() { throw new Error("bloqueado"); } }
    expect(playChatMessageSound(BrokenAudioContext)).toBe(false);
    expect(playChatMentionSound(BrokenAudioContext)).toBe(false);
  });
});
