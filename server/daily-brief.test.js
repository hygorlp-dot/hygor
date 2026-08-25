import { describe, expect, test } from "vitest";
import { comOrcamento, cubCacheFresco } from "./daily-brief.js";

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o CUB-PE
// sumia do Dashboard de forma intermitente porque nada limitava o tempo
// TOTAL da coleta - uma chamada externa lenta podia arrastar o daily-brief
// inteiro para além do tempo de execução da função na Vercel. comOrcamento
// é o que agora garante um teto de tempo, devolvendo o fallback em vez de
// esperar indefinidamente.
const espera = (ms, valor) => new Promise(resolve => setTimeout(() => resolve(valor), ms));

describe("comOrcamento - teto de tempo para uma coleta externa lenta", () => {
  test("devolve o valor real quando a promise termina dentro do orçamento", async () => {
    const resultado = await comOrcamento(espera(5, "valor real"), 200, "fallback");
    expect(resultado).toBe("valor real");
  });

  test("devolve o fallback quando a promise não termina a tempo, sem lançar erro", async () => {
    const resultado = await comOrcamento(espera(200, "valor real"), 5, "fallback");
    expect(resultado).toBe("fallback");
  });

  test("devolve o fallback se a promise rejeitar, sem propagar o erro (nunca deixa o daily-brief inteiro cair)", async () => {
    const resultado = await comOrcamento(Promise.reject(new Error("falha de rede")), 200, "fallback");
    expect(resultado).toBe("fallback");
  });
});

// Achado de 25/08/2026 (pedido do usuário): o CUB-PE só muda quando o
// Sinduscon-PE publica um mês novo - raspar o site a cada carregamento do
// Dashboard era trabalho repetido sem necessidade. cubCacheFresco é a
// decisão pura (sem rede, sem banco) de quando reaproveitar o valor já
// coletado em vez de raspar de novo.
describe("cubCacheFresco - TTL de 24h para não raspar o Sinduscon-PE a cada carregamento", () => {
  test("cache de poucos minutos atrás é considerado fresco", () => {
    const cache = { dados: { serie: [] }, atualizadoEm: new Date(Date.now() - 5 * 60 * 1000).toISOString() };
    expect(cubCacheFresco(cache)).toBe(true);
  });

  test("cache de mais de 24h é considerado vencido", () => {
    const cache = { dados: { serie: [] }, atualizadoEm: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
    expect(cubCacheFresco(cache)).toBe(false);
  });

  test("ausência de cache (null) nunca é considerada fresca", () => {
    expect(cubCacheFresco(null)).toBe(false);
  });

  test("cache sem dados nunca é considerado fresco, mesmo com atualizadoEm recente", () => {
    expect(cubCacheFresco({ dados: null, atualizadoEm: new Date().toISOString() })).toBe(false);
  });
});
