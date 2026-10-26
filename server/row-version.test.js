import { describe, expect, it } from "vitest";
import { mesmoCarimboExato } from "./row-version.js";

describe("comparação exata de carimbos de linha", () => {
  it("trata PostgREST (T e +00:00) e Postgres ::text (espaço e +00) como o mesmo instante", () => {
    expect(mesmoCarimboExato("2026-10-26T19:38:33.421305+00:00", "2026-10-26 19:38:33.421305+00")).toBe(true);
    expect(mesmoCarimboExato("2026-10-26T19:38:33.421305+00:00", "2026-10-26T19:38:33.421305Z")).toBe(true);
  });

  it("enxerga diferença de microssegundos, que um Date perderia", () => {
    expect(mesmoCarimboExato("2026-10-26T19:38:33.421305+00:00", "2026-10-26T19:38:33.421306+00:00")).toBe(false);
    expect(new Date("2026-10-26T19:38:33.421305Z").getTime()).toBe(new Date("2026-10-26T19:38:33.421306Z").getTime());
  });

  it("completa a fração com zeros e respeita fusos diferentes", () => {
    expect(mesmoCarimboExato("2026-10-26T19:38:33.42Z", "2026-10-26 19:38:33.420000+00")).toBe(true);
    expect(mesmoCarimboExato("2026-10-26T19:38:33Z", "2026-10-26T16:38:33-03:00")).toBe(true);
    expect(mesmoCarimboExato("2026-10-26T19:38:33Z", "2026-10-26T16:38:33-03")).toBe(true);
    expect(mesmoCarimboExato("2026-10-26T19:38:33Z", "2026-10-26T16:38:33+03:00")).toBe(false);
  });

  it("nunca considera igual um Date, valor ausente ou formato desconhecido", () => {
    const data = new Date("2026-10-26T19:38:33.421Z");
    expect(mesmoCarimboExato(data, "2026-10-26T19:38:33.421Z")).toBe(false);
    expect(mesmoCarimboExato(data, data)).toBe(false);
    expect(mesmoCarimboExato(null, null)).toBe(false);
    expect(mesmoCarimboExato(undefined, "2026-10-26T19:38:33Z")).toBe(false);
    expect(mesmoCarimboExato("ontem", "ontem")).toBe(false);
  });
});
