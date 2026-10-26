import { describe, expect, it } from "vitest";
import { criarRegistroDeTempos, lerServerTiming, resumirTempos } from "./call-timing.js";

describe("tempo das chamadas ao servidor", () => {
  it("lê as fases do cabeçalho Server-Timing", () => {
    expect(lerServerTiming("auth;dur=12.3, leitura;dur=80.1, total;dur=210.4"))
      .toEqual({ auth: 12.3, leitura: 80.1, total: 210.4 });
  });

  it("ignora partes sem duração, vazias ou inválidas", () => {
    expect(lerServerTiming("")).toEqual({});
    expect(lerServerTiming(null)).toEqual({});
    expect(lerServerTiming("cache;desc=hit, total;dur=abc, ok;dur=5")).toEqual({ ok: 5 });
  });

  it("resume p50/p95 por ação, com a mediana de cada fase, da mais lenta para a mais rápida", () => {
    const r = criarRegistroDeTempos();
    [100, 200, 300, 400, 1000].forEach(ms => r.registrar({
      acao: "save-sections", status: 200, clienteMs: ms,
      servidor: { auth: 10, locks: ms / 10, total: ms - 50 },
    }));
    r.registrar({ acao: "load", status: 200, clienteMs: 50, servidor: { total: 20 } });
    const resumo = r.resumo();
    expect(resumo.map(x => x.acao)).toEqual(["save-sections", "load"]);
    expect(resumo[0]).toMatchObject({
      chamadas: 5, clienteP50: 300, clienteP95: 1000, servidorP50: 250,
      fasesP50: { auth: 10, locks: 30 },
    });
    expect(resumo[1]).toMatchObject({ chamadas: 1, clienteP50: 50, servidorP50: 20, fasesP50: {} });
  });

  it("chamadas sem Server-Timing entram no tempo do cliente e não quebram o resumo", () => {
    const resumo = resumirTempos([{ acao: "x", status: 0, clienteMs: 120, servidor: {} }]);
    expect(resumo[0]).toMatchObject({ acao: "x", clienteP50: 120, servidorP50: null });
  });

  it("guarda só as últimas chamadas", () => {
    const r = criarRegistroDeTempos({ limite: 3 });
    [1, 2, 3, 4, 5].forEach(ms => r.registrar({ acao: "a", status: 200, clienteMs: ms }));
    expect(r.ultimos().map(x => x.clienteMs)).toEqual([3, 4, 5]);
  });
});
