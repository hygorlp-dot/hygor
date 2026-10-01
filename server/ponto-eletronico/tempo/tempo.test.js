// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, TOLERANCIA_HLB_MS, avaliarVerificacao, criarFonteHora } from "./fonte-hora.js";
import { SERVIDORES_HLB, calcularOffsetNtp, lerRespostaNtp, montarPedidoNtp, verificarHora } from "./ntp.js";

const AGORA = Date.parse("2026-10-01T12:00:00.000Z");

// Resposta NTP de um servidor cujo relógio está `adiantadoMs` à frente.
function respostaNtp(pedido, { adiantadoMs = 0, estrato = 1, modo = 4, dispersao = 0 } = {}) {
  const b = Buffer.alloc(48);
  b[0] = (0 << 6) | (4 << 3) | modo; b[1] = estrato;
  b.writeUInt32BE(Math.round(dispersao / 1000 * 65536), 8);
  pedido.copy(b, 24, 40, 48);                                  // originate = transmit do pedido
  const t = ms => { const seg = Math.floor(ms / 1000) + 2_208_988_800; return [seg, Math.round(((ms % 1000) / 1000) * 2 ** 32) >>> 0]; };
  const t0 = (pedido.readUInt32BE(40) - 2_208_988_800) * 1000 + Math.round(pedido.readUInt32BE(44) / 2 ** 32 * 1000);
  const [s1, f1] = t(t0 + 10 + adiantadoMs), [s2, f2] = t(t0 + 11 + adiantadoMs);
  b.writeUInt32BE(s1, 32); b.writeUInt32BE(f1, 36); b.writeUInt32BE(s2, 40); b.writeUInt32BE(f2, 44);
  return b;
}

describe("NTP (medição contra a HLB)", () => {
  it("fórmula de desvio e atraso da RFC 4330", () => {
    expect(calcularOffsetNtp(0, 60, 61, 21)).toEqual({ offsetMs: 50, atrasoMs: 20 });
  });

  it("lê a resposta e mede o desvio do relógio local", () => {
    const pedido = montarPedidoNtp(AGORA);
    const r = lerRespostaNtp(respostaNtp(pedido, { adiantadoMs: 250, dispersao: 2 }), AGORA, AGORA + 21);
    expect(r.offsetMs).toBeCloseTo(250, 0);
    expect(r.atrasoMs).toBeCloseTo(20, 0);
    expect(r.estrato).toBe(1);
    expect(r.incertezaMs).toBeCloseTo(12, 0);                  // dispersão 2 + metade do atraso
  });

  it("recusa resposta sem sincronismo, de outro pedido ou de modo errado", () => {
    const pedido = montarPedidoNtp(AGORA);
    expect(() => lerRespostaNtp(respostaNtp(pedido, { estrato: 0 }), AGORA, AGORA)).toThrow(/sem sincronismo/);
    expect(() => lerRespostaNtp(respostaNtp(pedido, { modo: 3 }), AGORA, AGORA)).toThrow(/modo/);
    expect(() => lerRespostaNtp(respostaNtp(montarPedidoNtp(AGORA - 5000)), AGORA, AGORA)).toThrow(/não corresponde/);
  });

  it("usa os servidores stratum 1 do NTP.br e fica com a medição de menor atraso; falha de todos vira ok=false", async () => {
    expect(SERVIDORES_HLB).toEqual(["a.st1.ntp.br", "b.st1.ntp.br", "c.st1.ntp.br", "d.st1.ntp.br"]);
    let relogio = AGORA;
    const enviarUdp = async ({ host, pacote }) => {
      if (host === "a.st1.ntp.br") throw new Error("tempo esgotado");
      const atraso = host === "b.st1.ntp.br" ? 80 : 20;
      const resp = respostaNtp(pacote, { adiantadoMs: 100 });
      relogio += atraso;
      return resp;
    };
    const v = await verificarHora({ enviarUdp, relogio: () => relogio });
    expect(v).toMatchObject({ ok: true, servidor: "c.st1.ntp.br" });
    expect(v.erro).toMatch(/a\.st1\.ntp\.br: tempo esgotado/);
    const falhou = await verificarHora({ enviarUdp: async () => { throw new Error("UDP bloqueado"); }, relogio: () => AGORA });
    expect(falhou).toMatchObject({ ok: false });
    expect(falhou.erro).toMatch(/UDP bloqueado/);
  });
});

describe("fonte de hora oficial (TimeAuthority)", () => {
  const verif = (extra = {}) => ({ ok: true, servidor: "a.st1.ntp.br", verificadoEm: new Date(AGORA - 3_600_000).toISOString(), offsetMs: 12, incertezaMs: 5, ...extra });

  it("política: verificada, dentro da tolerância, fora da tolerância, vencida e sem verificação", () => {
    expect(avaliarVerificacao(verif(), AGORA)).toMatchObject({ status: "verificada", confiavel: true });
    expect(avaliarVerificacao(verif({ offsetMs: 5000 }), AGORA)).toMatchObject({ status: "dentro_da_tolerancia", confiavel: true });
    expect(avaliarVerificacao(verif({ offsetMs: TOLERANCIA_HLB_MS + 1 }), AGORA)).toMatchObject({ status: "fora_da_tolerancia", confiavel: false });
    expect(avaliarVerificacao(verif({ verificadoEm: new Date(AGORA - 2 * 86_400_000).toISOString() }), AGORA)).toMatchObject({ status: "verificacao_vencida", confiavel: true });
    expect(avaliarVerificacao(null, AGORA)).toMatchObject({ status: "nao_verificada", confiavel: true });
    expect(avaliarVerificacao(null, AGORA, { ...POLITICA_PADRAO, exigirVerificacao: true })).toMatchObject({ confiavel: false });
  });

  it("evidência: hora do host + origem, desvio, incerteza e última verificação", async () => {
    const fonte = criarFonteHora({ relogioHost: () => AGORA, ultimaVerificacao: async () => verif() });
    expect(await fonte.evidencia()).toEqual({
      serverTimeMs: AGORA, serverTime: "2026-10-01T12:00:00.000Z", source: "host+ntp:a.st1.ntp.br", observedAt: "2026-10-01T12:00:00.000Z",
      offsetMs: 12, uncertaintyMs: 5, lastVerifiedAt: verif().verificadoEm, status: "verificada", confiavel: true, toleranciaMs: TOLERANCIA_HLB_MS,
    });
  });

  it("sem verificação (ou leitura falhando) a evidência diz 'host' e 'nao_verificada' - nunca inventa HLB", async () => {
    const fonte = criarFonteHora({ relogioHost: () => AGORA, ultimaVerificacao: async () => { throw new Error("banco fora"); } });
    expect(await fonte.evidencia()).toMatchObject({ source: "host", status: "nao_verificada", offsetMs: null, lastVerifiedAt: null });
  });

  it("cache da última verificação e limpeza depois de uma medição nova", async () => {
    let leituras = 0;
    const fonte = criarFonteHora({ relogioHost: () => AGORA, ultimaVerificacao: async () => { leituras++; return verif(); } });
    await fonte.evidencia(); await fonte.evidencia();
    expect(leituras).toBe(1);
    fonte.limparCache();
    await fonte.evidencia();
    expect(leituras).toBe(2);
  });
});
