import { describe, expect, test } from "vitest";
import { resolveMentionsInText, splitMentionText } from "./mentions";

const users = [
  { id: "u1", nome: "Ana" },
  { id: "u2", nome: "Ana Paula" },
  { id: "u3", nome: "Carlos" },
];

describe("resolveMentionsInText", () => {
  test("resolve uma única menção simples", () => {
    expect(resolveMentionsInText("Oi @Carlos, tudo bem?", users)).toEqual([
      { id: "u3", nome: "Carlos" },
    ]);
  });

  test("prefere o nome mais longo e não marca os dois quando é um prefixo do outro", () => {
    expect(resolveMentionsInText("@Ana Paula chegou na obra", users)).toEqual([
      { id: "u2", nome: "Ana Paula" },
    ]);
  });

  test("ainda resolve o nome curto quando o longo não aparece no texto", () => {
    expect(resolveMentionsInText("@Ana, confere isso", users)).toEqual([
      { id: "u1", nome: "Ana" },
    ]);
  });

  test("resolve múltiplas menções distintas na mesma mensagem", () => {
    const result = resolveMentionsInText("@Carlos e @Ana Paula, olhem isso", users);
    expect(result).toEqual(expect.arrayContaining([
      { id: "u3", nome: "Carlos" },
      { id: "u2", nome: "Ana Paula" },
    ]));
    expect(result).toHaveLength(2);
  });

  test("retorna vazio quando não há @ no texto", () => {
    expect(resolveMentionsInText("mensagem qualquer", users)).toEqual([]);
  });

  test("segmenta somente menções resolvidas para destaque visual", () => {
    expect(splitMentionText("Oi @Ana Paula e @Carlos", [
      { id: "u2", nome: "Ana Paula" },
      { id: "u3", nome: "Carlos" },
    ])).toEqual([
      { text: "Oi ", mentioned: false },
      { text: "@Ana Paula", mentioned: true },
      { text: " e ", mentioned: false },
      { text: "@Carlos", mentioned: true },
    ]);
  });

  test("não destaca arroba sem vínculo estruturado", () => {
    expect(splitMentionText("Envie para @Suporte", [])).toEqual([
      { text: "Envie para @Suporte", mentioned: false },
    ]);
  });
});
