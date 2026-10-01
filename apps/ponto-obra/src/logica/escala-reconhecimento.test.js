// @vitest-environment node
//
// ESCALA do reconhecimento 1:N com a base GLOBAL de funcionários: todo
// aparelho compara o rosto com TODOS os ativos da empresa. Mede o tempo do
// identificar() e o tamanho da lista de vetores para 50, 100, 250 e 500
// pessoas. Limiares NÃO mudam aqui (calibracao.js). Resultado documentado em
// docs/REP-P-ARQUITETURA.md ("Escala do reconhecimento").
//
// Vetores aleatórios medem custo, não acerto: falso aceite com rostos reais
// só se mede em campo (relatorio-calibracao.js).
import { describe, expect, it } from "vitest";
import { identificar, normalizarL2 } from "./rosto.js";
import { MOBILEFACENET } from "./rosto.js";

// Gerador determinístico (os números do relatório não variam entre execuções).
function gerador(semente) {
  let x = semente >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32 - 0.5; };
}
const base = (n, aleatorio) => Array.from({ length: n }, (_, i) => ({ employeeId: `e${i}`, vetor: normalizarL2(Array.from({ length: MOBILEFACENET.dimensao }, aleatorio)) }));

describe("escala do reconhecimento 1:N com a base global", () => {
  it("50 / 100 / 250 / 500 funcionários: tempo por identificação e tamanho da base no aparelho", () => {
    const aleatorio = gerador(42);
    const resultados = [];
    for (const n of [50, 100, 250, 500]) {
      const cadastros = base(n, aleatorio);
      const consultas = Array.from({ length: 40 }, (_, k) => {
        const alvo = cadastros[(k * 7) % n].vetor;
        return normalizarL2(alvo.map(v => v + aleatorio() * 0.02));            // o mesmo rosto, foto um pouco diferente
      });
      identificar(consultas[0], cadastros);                                    // aquece
      const t0 = performance.now();
      let acertos = 0;
      for (const [k, q] of consultas.entries()) if (identificar(q, cadastros).employeeId === `e${(k * 7) % n}`) acertos++;
      const msPorIdentificacao = (performance.now() - t0) / consultas.length;
      const kbBase = JSON.stringify(cadastros).length / 1024;
      resultados.push({ funcionarios: n, msPorIdentificacao: Number(msPorIdentificacao.toFixed(3)), kbBase: Math.round(kbBase), acertos: `${acertos}/${consultas.length}` });
      expect(acertos).toBe(consultas.length);
      // Folga larga para a CI: no Node leva bem menos de 1 ms; no aparelho o
      // gargalo é o TFLite (centenas de ms), não esta comparação.
      expect(msPorIdentificacao).toBeLessThan(25);
    }
    // eslint-disable-next-line no-console
    console.table(resultados);
    // A base cresce linear: 500 pessoas ≈ 10x 50 pessoas.
    expect(resultados[3].kbBase / resultados[0].kbBase).toBeGreaterThan(8);
  });
});
