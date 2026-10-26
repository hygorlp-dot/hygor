// Calibração de CAMPO (modo técnico, Encarregado → Diagnóstico). Puro.
//
// Enquanto ligada, cada tentativa de reconhecimento na tela de ponto vira
// UMA LINHA DE NÚMEROS: score do 1º, score do 2º, margem, confiança do
// detector, largura do rosto, luminância média do recorte, resultado e
// duração. Nada de vetor, imagem, nome, id ou CPF: a sessão nem aceita esses
// campos (lista fechada). Fica só na memória do app; o relatório é anônimo.
//
// Para FAR/FRR com rótulo (quem estava na frente da câmera) continue usando
// relatorio-calibracao.js na homologação assistida.
import { PARAMETROS_FACIAIS } from "./calibracao.js";

export const RESULTADO = Object.freeze({
  RECONHECIDO: "reconhecido", NAO_CADASTRADO: "nao_cadastrado", AMBIGUO: "ambiguo",
  SEM_ROSTO: "sem_rosto", FORA_DE_POSE: "fora_de_pose", PROVA_DE_VIDA: "prova_de_vida_falhou", ERRO: "erro",
});
const LIMITE_PADRAO = 500;
const numero = v => (typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(4)) : null);

export function criarSessaoCalibracao({ limite = LIMITE_PADRAO } = {}) {
  const linhas = [];
  return {
    // Só os campos abaixo entram; qualquer outro (vetor, foto, id) é ignorado.
    registrar({ top1, top2, confiancaDeteccao, larguraRosto, luminancia, capturasUsadas, resultado, duracaoMs } = {}) {
      if (!Object.values(RESULTADO).includes(resultado)) return;
      linhas.push({
        top1: numero(top1), top2: numero(top2),
        margem: numero(top1) !== null && numero(top2) !== null ? numero(top1 - top2) : null,
        confiancaDeteccao: numero(confiancaDeteccao), larguraRosto: numero(larguraRosto),
        luminancia: numero(luminancia), capturasUsadas: Number.isInteger(capturasUsadas) && capturasUsadas > 0 ? capturasUsadas : null,
        resultado, duracaoMs: Number.isFinite(duracaoMs) ? Math.round(duracaoMs) : null,
      });
      if (linhas.length > limite) linhas.shift();
    },
    linhas: () => linhas.map(l => ({ ...l })),
    limpar() { linhas.length = 0; },
    get total() { return linhas.length; },
  };
}

function distribuicao(valores) {
  const v = valores.filter(x => x !== null).sort((a, b) => a - b);
  if (!v.length) return { n: 0, p05: null, mediana: null, p95: null };
  const q = p => v[Math.min(v.length - 1, Math.round(p * (v.length - 1)))];
  return { n: v.length, p05: q(0.05), mediana: q(0.5), p95: q(0.95) };
}

// Relatório anônimo: contagens por resultado, distribuições e quantas
// tentativas aceitas ficaram PERTO do limiar (sinal de calibração apertada).
export function relatorioDeCampo(linhas, parametros = PARAMETROS_FACIAIS, { faixa = 0.05 } = {}) {
  const porResultado = Object.fromEntries(Object.values(RESULTADO).map(r => [r, linhas.filter(l => l.resultado === r).length]));
  const aceitas = linhas.filter(l => l.resultado === RESULTADO.RECONHECIDO);
  const tentativasComRosto = linhas.filter(l => l.top1 !== null);
  return {
    tentativas: linhas.length,
    porResultado,
    taxaReconhecimento: tentativasComRosto.length ? Number((aceitas.length / tentativasComRosto.length).toFixed(4)) : null,
    top1Aceitas: distribuicao(aceitas.map(l => l.top1)),
    top1Recusadas: distribuicao(linhas.filter(l => l.resultado === RESULTADO.NAO_CADASTRADO || l.resultado === RESULTADO.AMBIGUO).map(l => l.top1)),
    margem: distribuicao(linhas.map(l => l.margem)),
    confiancaDeteccao: distribuicao(linhas.map(l => l.confiancaDeteccao)),
    luminancia: distribuicao(linhas.map(l => l.luminancia)),
    duracaoMs: distribuicao(linhas.map(l => l.duracaoMs)),
    capturasUsadas: distribuicao(linhas.map(l => l.capturasUsadas)),
    aceitasPertoDoLimiar: aceitas.filter(l => l.top1 < parametros.limiarReconhecimento + faixa).length,
    parametros: { limiarReconhecimento: parametros.limiarReconhecimento, margemSobreSegundo: parametros.margemSobreSegundo },
  };
}

// Resumo em linhas para a tela (Diagnóstico), sem nada pessoal.
export function resumoDeCampo(rel) {
  const f = d => (d.n ? `${d.mediana} (p05 ${d.p05} · p95 ${d.p95})` : "-");
  return [
    ["Tentativas registradas", String(rel.tentativas)],
    ["Reconhecidas", `${rel.porResultado.reconhecido}${rel.taxaReconhecimento !== null ? ` (${Math.round(rel.taxaReconhecimento * 100)}%)` : ""}`],
    ["Não cadastrado / ambíguo", `${rel.porResultado.nao_cadastrado} / ${rel.porResultado.ambiguo}`],
    ["Sem rosto / fora de pose / prova de vida", `${rel.porResultado.sem_rosto} / ${rel.porResultado.fora_de_pose} / ${rel.porResultado.prova_de_vida_falhou}`],
    ["Score aceitas (mediana)", f(rel.top1Aceitas)],
    ["Aceitas perto do limiar", String(rel.aceitasPertoDoLimiar)],
    ["Margem sobre o 2º (mediana)", f(rel.margem)],
    ["Luminância do rosto (mediana)", f(rel.luminancia)],
    ["Capturas frontais usadas (mediana)", rel.capturasUsadas.n ? String(rel.capturasUsadas.mediana) : "-"],
    ["Duração (mediana)", rel.duracaoMs.n ? `${rel.duracaoMs.mediana} ms` : "-"],
  ].map(([rotulo, valor]) => ({ rotulo, valor }));
}
