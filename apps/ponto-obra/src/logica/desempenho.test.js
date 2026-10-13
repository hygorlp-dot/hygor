import { describe, expect, it } from "vitest";
import {
  AMOSTRAS_POR_ETAPA, CHAVE_DESEMPENHO, DURACAO_MAXIMA_MS, ETAPAS_DESEMPENHO, categoriaDoReconhecimento, criarCronometro,
  desempenhoVazio, estatisticasDesempenho, linhasDoDesempenho, normalizarDesempenho, p95DoReconhecimento, percentil, registrarTentativa,
} from "./desempenho.js";
import { identificar } from "./rosto.js";
import { montarDiagnostico, secoesDoDiagnostico, ORDEM_SECOES_DIAGNOSTICO } from "./diagnostico.js";

const comTempos = (tempos, extra = {}) => ({ tempos, ...extra });

describe("desempenho do reconhecimento (agregação local, sem dado pessoal)", () => {
  it("percentil pelo posto mais próximo devolve sempre um valor medido", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);   // 1..100
    expect(percentil(v, 0.5)).toBe(50);
    expect(percentil(v, 0.95)).toBe(95);
    expect(percentil([7], 0.95)).toBe(7);
    expect(percentil([300, 100, 200], 0.5)).toBe(200);
    expect(percentil([], 0.5)).toBeNull();
  });

  it("acumula contagem, p50, p95 e máximo por etapa, sem mudar o estado recebido", () => {
    let d = desempenhoVazio();
    const inicial = JSON.stringify(d);
    for (let i = 1; i <= 20; i++) d = registrarTentativa(d, comTempos({ captura: i * 10, analise: 200 }));
    expect(JSON.stringify(desempenhoVazio())).toBe(inicial);
    const s = estatisticasDesempenho(d);
    expect(s.etapas.captura).toEqual({ contagem: 20, amostras: 20, p50: 100, p95: 190, maximo: 200 });
    expect(s.etapas.analise).toMatchObject({ contagem: 20, p50: 200, p95: 200, maximo: 200 });
    expect(s.etapas.gravacao).toEqual({ contagem: 0, amostras: 0, p50: null, p95: null, maximo: null });
  });

  it("guarda só as últimas N amostras por etapa; a contagem é o total histórico", () => {
    let d = null;
    for (let i = 1; i <= AMOSTRAS_POR_ETAPA + 30; i++) d = registrarTentativa(d, comTempos({ reconhecimento: i }));
    expect(d.etapas.reconhecimento.amostras).toHaveLength(AMOSTRAS_POR_ETAPA);
    expect(d.etapas.reconhecimento.amostras[0]).toBe(31);
    expect(d.etapas.reconhecimento.contagem).toBe(AMOSTRAS_POR_ETAPA + 30);
    expect(p95DoReconhecimento(d)).toBe(78);   // 31..80: posto 48 de 50
    // N menor (parâmetro) também é respeitado.
    expect(registrarTentativa(d, {}, 5).etapas.reconhecimento.amostras).toEqual([76, 77, 78, 79, 80]);
  });

  it("descarta etapa desconhecida, duração inválida e resultado fora da lista; trunca duração absurda", () => {
    const d = registrarTentativa(null, {
      tempos: { captura: -5, analise: NaN, identificacao: "12", gravacao: 12.6, total: DURACAO_MAXIMA_MS * 3, nome: 999, vetor: 1 },
      provaDeVida: "talvez", reconhecimento: "Zé",
    });
    expect(d.etapas.captura.contagem).toBe(0);
    expect(d.etapas.analise.contagem).toBe(0);
    expect(d.etapas.identificacao.contagem).toBe(0);
    expect(d.etapas.gravacao.amostras).toEqual([13]);
    expect(d.etapas.total.amostras).toEqual([DURACAO_MAXIMA_MS]);
    expect(Object.keys(d.etapas)).toEqual(ETAPAS_DESEMPENHO.map(([e]) => e));
    expect(d.provaDeVida).toEqual({ aprovada: 0, reprovada: 0 });
    expect(d.reconhecimento).toEqual({ reconhecido: 0, nao_reconhecido: 0, incerto: 0 });
  });

  it("estado corrompido ou de outra versão no banco vira estado válido (nunca lança)", () => {
    for (const lixo of [null, undefined, "x", 42, [], { etapas: "x" }, { etapas: { captura: { amostras: "x", contagem: -3 } }, provaDeVida: { aprovada: "dez" } }]) {
      const d = normalizarDesempenho(lixo);
      expect(d.etapas.captura).toEqual({ contagem: 0, amostras: [] });
      expect(d.provaDeVida.aprovada).toBe(0);
    }
    expect(normalizarDesempenho({ etapas: { captura: { contagem: 1, amostras: [10, "x", 20] } } }).etapas.captura).toEqual({ contagem: 2, amostras: [10, 20] });
  });

  it("conta resultados da prova de vida e do reconhecimento (só contagens)", () => {
    let d = null;
    d = registrarTentativa(d, { provaDeVida: "aprovada", reconhecimento: "reconhecido" });
    d = registrarTentativa(d, { provaDeVida: "reprovada", reconhecimento: "reconhecido" });
    d = registrarTentativa(d, { reconhecimento: "nao_reconhecido" });
    d = registrarTentativa(d, { reconhecimento: "incerto" });
    expect(d.provaDeVida).toEqual({ aprovada: 1, reprovada: 1 });
    expect(d.reconhecimento).toEqual({ reconhecido: 2, nao_reconhecido: 1, incerto: 1 });
  });

  it("classifica o resultado de identificar(): reconhecido, não reconhecido, incerto", () => {
    const a = [1, 0, 0], b = [0.999, 0.0447, 0];
    expect(categoriaDoReconhecimento(identificar(a, [{ employeeId: "e1", vetor: a }]))).toBe("reconhecido");
    expect(categoriaDoReconhecimento(identificar(a, [{ employeeId: "e1", vetor: [0, 1, 0] }]))).toBe("nao_reconhecido");
    expect(categoriaDoReconhecimento(identificar(a, []))).toBe("nao_reconhecido");
    expect(categoriaDoReconhecimento(identificar(a, [{ employeeId: "e1", vetor: a }, { employeeId: "e2", vetor: b }]))).toBe("incerto");
    expect(categoriaDoReconhecimento(null)).toBeNull();
  });

  it("o estado guardado tem só números: nada de nome, id, similaridade ou vetor", () => {
    const d = registrarTentativa(null, { tempos: { captura: 100 }, reconhecimento: "reconhecido", provaDeVida: "aprovada", employeeId: "e1", nome: "Zé", confianca: 0.93, vetor: [0.1] });
    const texto = JSON.stringify(d);
    for (const proibido of ["e1", "Zé", "0.93", "0.1", "vetor", "employee", "nome"]) expect(texto).not.toContain(proibido);
    expect(CHAVE_DESEMPENHO).toBe("desempenho_reconhecimento");
  });

  it("cronômetro sobre relógio monotônico injetado: mede etapa mesmo quando ela lança; relógio indisponível (NaN) não gera medição", async () => {
    let t = 1000;
    const c = criarCronometro(() => t);
    await c.medir("captura", async () => { t += 250; return "foto"; });
    await expect(c.medir("analise", async () => { t += 40; throw new Error("modelo"); })).rejects.toThrow("modelo");
    c.anotar("deteccao", 12);
    c.anotar("deteccao", 15);            // substitui: uma medição por etapa
    c.anotar("embedding", undefined);
    expect(c.tempos).toEqual({ captura: 250, analise: 40, deteccao: 15 });
    expect(c.desdeOInicio()).toBe(290);
    const semRelogio = criarCronometro(() => NaN);
    await semRelogio.medir("captura", async () => 1);
    semRelogio.anotar("total", semRelogio.desdeOInicio());
    expect(semRelogio.tempos).toEqual({});
  });
});

describe("Diagnóstico: seção Desempenho", () => {
  const base = { app: { versao: "1.0.0" }, contagem: { pendentes: 0 }, modelos: { estado: "ok" } };

  it("mostra p50/p95/máximo por etapa e as contagens de resultado, na seção Desempenho", () => {
    let d = null;
    for (const ms of [800, 900, 1000, 1200, 2500]) d = registrarTentativa(d, { tempos: { reconhecimento: ms, captura: ms / 4 }, reconhecimento: "reconhecido", provaDeVida: "aprovada" });
    d = registrarTentativa(d, { reconhecimento: "incerto" });
    d = registrarTentativa(d, { provaDeVida: "reprovada", reconhecimento: "nao_reconhecido" });
    const secoes = secoesDoDiagnostico(montarDiagnostico({ ...base, desempenho: d }));
    expect(secoes.map(s => s.titulo)).toEqual(ORDEM_SECOES_DIAGNOSTICO.filter(t => secoes.some(s => s.titulo === t)));
    expect(secoes.find(s => s.titulo === "Outros")).toBeUndefined();
    const desempenho = secoes.find(s => s.titulo === "Desempenho");
    const itens = Object.fromEntries(desempenho.itens.map(i => [i.rotulo, i.valor]));
    expect(itens["Reconhecimento (toque até identificar)"]).toBe("p50 1,0 s · p95 2,5 s · máx 2,5 s (5 medições)");
    expect(itens["Captura da foto"]).toBe("p50 250 ms · p95 625 ms · máx 625 ms (5 medições)");
    expect(itens["Gravação da batida"]).toBe("sem medições");
    expect(itens["Resultado da prova de vida"]).toBe("5 aprovada(s) · 1 reprovada(s)");
    expect(itens["Resultado do reconhecimento"]).toBe("5 reconhecido(s) · 1 não reconhecido(s) · 1 incerto(s)");
    expect(desempenho.itens).toHaveLength(ETAPAS_DESEMPENHO.length + 2);
  });

  it("aparelho sem nenhuma medição: a seção aparece com 'sem medições' e contagens zeradas", () => {
    const itens = montarDiagnostico(base).filter(i => secoesDoDiagnostico([i])[0].titulo === "Desempenho");
    expect(itens.filter(i => i.valor === "sem medições")).toHaveLength(ETAPAS_DESEMPENHO.length);
    expect(itens.find(i => i.rotulo === "Resultado da prova de vida").valor).toBe("0 aprovada(s) · 0 reprovada(s)");
  });
});
