// Desempenho do reconhecimento no aparelho (para medir em aparelhos de
// referência). Puro, testado no Node (desempenho.test.js).
//
// O que é guardado (estado local "desempenho_reconhecimento", nunca sai do
// aparelho inteiro - só o p95 do reconhecimento vai na sincronização):
//   - por etapa: contagem total de medições e as últimas N durações em ms;
//   - contagens de resultado da prova de vida e do reconhecimento.
// NADA pessoal ou biométrico: sem nome, id de funcionário, similaridade,
// vetor, foto ou horário da batida. Só números de duração e contadores.
//
// As medições vêm de um relógio MONOTÔNICO (performance.now no app): ajuste
// de hora do celular não distorce as durações.

export const CHAVE_DESEMPENHO = "desempenho_reconhecimento";
// Janela das estatísticas (p50, p95, máximo): as últimas N medições de cada etapa.
export const AMOSTRAS_POR_ETAPA = 50;
// Duração acima disto é truncada (câmera/modelo travado não estoura o gráfico).
export const DURACAO_MAXIMA_MS = 10 * 60_000;

// Ordem = ordem da tela. "reconhecimento" = do toque até saber quem é
// (captura + análise + identificação); "total" = do toque ao comprovante,
// incluindo a espera proposital antes de pedir para virar o rosto.
// "provaDeVida" mede a 2ª captura + análise + comparação, SEM essa espera.
export const ETAPAS_DESEMPENHO = Object.freeze([
  ["captura", "Captura da foto"],
  ["deteccao", "Detecção do rosto (BlazeFace)"],
  ["embedding", "Identidade do rosto (MobileFaceNet)"],
  ["analise", "Análise (detecção + identidade)"],
  ["identificacao", "Identificação"],
  ["reconhecimento", "Reconhecimento (toque até identificar)"],
  ["provaDeVida", "Prova de vida"],
  ["gravacao", "Gravação da batida"],
  ["total", "Total (toque até o comprovante)"],
]);
const NOMES_ETAPAS = ETAPAS_DESEMPENHO.map(([e]) => e);

export const RESULTADOS_PROVA_DE_VIDA = Object.freeze(["aprovada", "reprovada"]);
export const RESULTADOS_RECONHECIMENTO = Object.freeze(["reconhecido", "nao_reconhecido", "incerto"]);

const contadoresZerados = nomes => Object.fromEntries(nomes.map(n => [n, 0]));
const inteiroNaoNegativo = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
const duracaoValida = v => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), DURACAO_MAXIMA_MS) : null);

export function desempenhoVazio() {
  return {
    versao: 1,
    etapas: Object.fromEntries(NOMES_ETAPAS.map(e => [e, { contagem: 0, amostras: [] }])),
    provaDeVida: contadoresZerados(RESULTADOS_PROVA_DE_VIDA),
    reconhecimento: contadoresZerados(RESULTADOS_RECONHECIMENTO),
  };
}

// Estado lido do banco pode ser de outra versão ou estar corrompido: tudo que
// não for número válido é descartado (nunca lança).
export function normalizarDesempenho(bruto, n = AMOSTRAS_POR_ETAPA) {
  const base = desempenhoVazio();
  if (!bruto || typeof bruto !== "object") return base;
  for (const e of NOMES_ETAPAS) {
    const x = bruto.etapas?.[e];
    if (!x || typeof x !== "object") continue;
    const amostras = (Array.isArray(x.amostras) ? x.amostras : []).map(duracaoValida).filter(v => v !== null).slice(-n);
    base.etapas[e] = { contagem: Math.max(inteiroNaoNegativo(x.contagem), amostras.length), amostras };
  }
  for (const r of RESULTADOS_PROVA_DE_VIDA) base.provaDeVida[r] = inteiroNaoNegativo(bruto.provaDeVida?.[r]);
  for (const r of RESULTADOS_RECONHECIMENTO) base.reconhecimento[r] = inteiroNaoNegativo(bruto.reconhecimento?.[r]);
  return base;
}

// Acrescenta UMA tentativa de batida. Não muda o estado recebido.
// tentativa = { tempos: { etapa: ms }, provaDeVida?: "aprovada"|"reprovada",
//               reconhecimento?: "reconhecido"|"nao_reconhecido"|"incerto" }
// Etapa desconhecida, duração inválida e resultado fora da lista são ignorados.
export function registrarTentativa(estado, tentativa = {}, n = AMOSTRAS_POR_ETAPA) {
  const proximo = normalizarDesempenho(estado, n);
  const tempos = tentativa?.tempos && typeof tentativa.tempos === "object" ? tentativa.tempos : {};
  for (const e of NOMES_ETAPAS) {
    const ms = duracaoValida(tempos[e]);
    if (ms === null) continue;
    const atual = proximo.etapas[e];
    proximo.etapas[e] = { contagem: atual.contagem + 1, amostras: [...atual.amostras, ms].slice(-n) };
  }
  if (RESULTADOS_PROVA_DE_VIDA.includes(tentativa?.provaDeVida)) proximo.provaDeVida[tentativa.provaDeVida]++;
  if (RESULTADOS_RECONHECIMENTO.includes(tentativa?.reconhecimento)) proximo.reconhecimento[tentativa.reconhecimento]++;
  return proximo;
}

// Percentil pelo método do posto mais próximo (nearest-rank): sempre um
// valor que foi de fato medido. Lista vazia = null.
export function percentil(valores, p) {
  const ordenados = (valores || []).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!ordenados.length) return null;
  const posto = Math.min(ordenados.length, Math.max(1, Math.ceil(p * ordenados.length)));
  return ordenados[posto - 1];
}

// { etapa: { contagem, amostras, p50, p95, maximo } } - p50/p95/máximo nas
// últimas N amostras; contagem = total de medições desde a instalação.
export function estatisticasDesempenho(estado) {
  const d = normalizarDesempenho(estado);
  const etapas = Object.fromEntries(NOMES_ETAPAS.map(e => {
    const { contagem, amostras } = d.etapas[e];
    return [e, { contagem, amostras: amostras.length, p50: percentil(amostras, 0.5), p95: percentil(amostras, 0.95), maximo: amostras.length ? Math.max(...amostras) : null }];
  }));
  return { etapas, provaDeVida: d.provaDeVida, reconhecimento: d.reconhecimento };
}

// p95 do reconhecimento (toque até identificar) em ms, ou null sem medição.
export const p95DoReconhecimento = estado => estatisticasDesempenho(estado).etapas.reconhecimento.p95;

const ms = v => (v === null ? "-" : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1).replace(".", ",")} s`);

// Linhas do Diagnóstico (seção "Desempenho"): [rotulo, valor].
export function linhasDoDesempenho(estado) {
  const s = estatisticasDesempenho(estado);
  const linhas = ETAPAS_DESEMPENHO.map(([e, rotulo]) => {
    const x = s.etapas[e];
    return [rotulo, x.amostras ? `p50 ${ms(x.p50)} · p95 ${ms(x.p95)} · máx ${ms(x.maximo)} (${x.contagem} medições)` : "sem medições"];
  });
  const pv = s.provaDeVida, r = s.reconhecimento;
  linhas.push(["Resultado da prova de vida", `${pv.aprovada} aprovada(s) · ${pv.reprovada} reprovada(s)`]);
  linhas.push(["Resultado do reconhecimento", `${r.reconhecido} reconhecido(s) · ${r.nao_reconhecido} não reconhecido(s) · ${r.incerto} incerto(s)`]);
  return linhas;
}

// Resultado de identificar() (rosto.js) → categoria contada. "incerto" =
// rosto parecido com mais de um cadastro (margem insuficiente).
export function categoriaDoReconhecimento(id) {
  if (!id) return null;
  if (id.reconhecido) return "reconhecido";
  return id.motivo === "rosto parecido com mais de um cadastro" ? "incerto" : "nao_reconhecido";
}

// Cronômetro de etapas sobre um relógio monotônico injetado (agora() em ms).
// medir(etapa, fn) devolve o resultado de fn e anota a duração mesmo se fn
// lançar (a duração até a falha também é informação de desempenho).
// anotar() de uma etapa já anotada substitui o valor (uma medição por etapa
// por tentativa).
export function criarCronometro(agora) {
  const tempos = {};
  const inicio = agora();
  const anotar = (etapa, duracao) => { if (Number.isFinite(duracao)) tempos[etapa] = duracao; };
  const medir = async (etapa, fn) => {
    const t0 = agora();
    try { return await fn(); } finally { anotar(etapa, agora() - t0); }
  };
  return { tempos, anotar, medir, desdeOInicio: () => agora() - inicio };
}
