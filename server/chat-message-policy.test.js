import { describe, expect, it } from "vitest";
import {
  deletedChatMessage,
  MAX_CHAT_MENTIONS,
  sanitizeChatAttachment,
  sanitizeChatMentions,
} from "./chat-message-policy";

describe("política de mensagens do chat", () => {
  it("limita e sanitiza menções", () => {
    const mentions = Array.from({ length: 12 }, (_, index) => ({
      id: `u-${index}\u0000`,
      nome: index === 0 ? "" : `Pessoa ${index}`,
    }));
    const result = sanitizeChatMentions(mentions);
    expect(result).toHaveLength(MAX_CHAT_MENTIONS - 1);
    expect(result[0]).toEqual({ id: "u-1", nome: "Pessoa 1" });
  });

  it("aceita apenas referência HTTPS e normaliza metadados", () => {
    expect(sanitizeChatAttachment({ url: "javascript:alert(1)" })).toBeNull();
    expect(sanitizeChatAttachment({ url: "http://inseguro.test/a.pdf" })).toBeNull();
    expect(sanitizeChatAttachment({
      url: "https://storage.test/chat/a.pdf",
      name: "nota\u0000.pdf",
      type: "application/pdf",
      size: -20,
    })).toEqual({
      url: "https://storage.test/chat/a.pdf",
      name: "nota.pdf",
      type: "application/pdf",
      size: 0,
    });
  });

  it("remove conteúdo e anexo ao apagar sem perder a evidência original", () => {
    const original = { id: "m-1", text: "mensagem", attachment: { url: "https://a" } };
    const deleted = deletedChatMessage(original, {
      at: "2026-07-31T15:00:00.000Z",
      by: "Administrador",
    });
    expect(deleted).toMatchObject({
      id: "m-1",
      text: "",
      mentions: [],
      attachment: null,
      deletedBy: "Administrador",
    });
    expect(original.text).toBe("mensagem");
  });
});
