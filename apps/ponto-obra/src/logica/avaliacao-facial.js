// Avaliação SINTÉTICA do reconhecimento 1:N (fase de engenharia). Puro.
//
// O que isto mede: a REGRA DE DECISÃO do app (identificar() com limiar e
// margem sobre o 2º candidato) contra distribuições de similaridade
// controladas - FAR, FRR, recusa por ambiguidade e o efeito da margem.
// O que isto NÃO mede: a qualidade do MobileFaceNet com rostos reais, luz de
// obra, óculos, barba ou pele. Isso só a medição de campo dá
// (calibracao-campo.js + relatorio-calibracao.js). Nenhum dado real entra
// aqui: os "rostos" são vetores gerados por semente fixa.
//
// Modelo dos vetores: cada pessoa = componente comum da população (rostos
// reais se parecem entre si: impostores têm cosseno ~0,3-0,4 no MobileFaceNet)
// + componente individual. Cada captura = pessoa + ruído (luz, pose,
// câmera). "Gêmeos" = duas pessoas com o mesmo componente individual quase
// igual (o caso que a margem sobre o 2º existe para pegar).
import { identificar, normalizarL2, vetorDoCadastro, similaridadeCosseno } from "./rosto.js";
import { amostraDeCalibracao, relatorioCalibracao, varrerLimiares } from "./relatorio-calibracao.js";
import { PARAMETROS_FACIAIS } from "./calibracao.js";

const DIMENSAO = 192;

// Gerador determinístico com distribuição ~normal (Box-Muller).
export function gerador(semente) {
  let x = semente >>> 0;
  const uniforme = () => { x = (x * 1664525 + 1013904223) >>> 0; return (x + 0.5) / 2 ** 32; };
  return () => Math.sqrt(-2 * Math.log(uniforme())) * Math.cos(2 * Math.PI * uniforme());
}
const aleatorioUnitario = normal => normalizarL2(Array.from({ length: DIMENSAO }, normal));
const somar = (...termos) => termos[0][1].map((_, i) => termos.reduce((s, [peso, v]) => s + peso * v[i], 0));

// Cenários: pesos escolhidos para reproduzir faixas de similaridade típicas
// (documentadas no relatório gerado). ruido = variação entre capturas.
export const CENARIOS = Object.freeze({
  // luz boa, de frente: genuíno ~0,8; impostor ~0,35
  favoravel: { populacao: 0.75, individual: 1, ruido: 0.55 },
  // obra: luz variando, boné, ângulo - genuíno ~0,7; impostor ~0,35
  obra: { populacao: 0.75, individual: 1, ruido: 0.75 },
  // condição ruim (contraluz forte, rosto pequeno): genuíno ~0,6
  adverso: { populacao: 0.75, individual: 1, ruido: 1.0 },
});

// Gera cadastros (média de 3 capturas, como o app) e tentativas rotuladas.
export function conjuntoSintetico({ pessoas = 60, impostores = 60, tentativasPorPessoa = 6, gemeos = 0, cenario = CENARIOS.obra, semente = 7 } = {}) {
  const normal = gerador(semente);
  const comum = aleatorioUnitario(normal);
  const rostoDe = individual => normalizarL2(somar([cenario.populacao, comum], [cenario.individual, individual]));
  // Ruído com norma ~cenario.ruido (componentes N(0,1) têm norma ~sqrt(192)).
  const captura = rosto => normalizarL2(somar([1, rosto], [cenario.ruido / Math.sqrt(DIMENSAO), Array.from({ length: DIMENSAO }, normal)]));
  const individuais = Array.from({ length: pessoas }, () => aleatorioUnitario(normal));
  // Gêmeos: a pessoa 2k+1 recebe o componente da 2k com 15% de diferença.
  for (let k = 0; k < gemeos; k++) individuais[2 * k + 1] = normalizarL2(somar([1, individuais[2 * k]], [0.15, aleatorioUnitario(normal)]));
  const rostos = individuais.map(rostoDe);
  const cadastros = rostos.map((r, i) => ({ employeeId: `p${i}`, vetor: vetorDoCadastro([captura(r), captura(r), captura(r)]) }));
  const tentativas = [];
  rostos.forEach((r, i) => { for (let t = 0; t < tentativasPorPessoa; t++) tentativas.push({ esperado: `p${i}`, vetor: captura(r) }); });
  for (let k = 0; k < impostores; k++) tentativas.push({ esperado: null, vetor: captura(rostoDe(aleatorioUnitario(normal))) });
  return { cadastros, tentativas };
}

// Roda identificar() em todas as tentativas e devolve amostras SEM vetor.
export function avaliar({ cadastros, tentativas }, parametros = {}) {
  return tentativas.map(t => amostraDeCalibracao({ esperado: t.esperado, resultado: identificar(t.vetor, cadastros, parametros) }));
}

export function relatorioSintetico(conjunto, parametros = PARAMETROS_FACIAIS) {
  const amostras = avaliar(conjunto, { limiar: parametros.limiarReconhecimento, margem: parametros.margemSobreSegundo });
  const rel = relatorioCalibracao(amostras, parametros);
  const ambiguas = amostras.filter(a => a.esperado !== null && a.aceito === null && a.top1 !== null && a.top1 >= parametros.limiarReconhecimento).length;
  return { ...rel, recusasPorAmbiguidade: ambiguas, amostras };
}

// Taxa de erro igual (EER) aproximada na varredura de limiar (margem fixa).
export function varreduraELimiarEquilibrado(amostras, { margem = PARAMETROS_FACIAIS.margemSobreSegundo, de = 0.3, ate = 0.9, passo = 0.05 } = {}) {
  const limiares = []; for (let l = de; l <= ate + 1e-9; l += passo) limiares.push(Number(l.toFixed(2)));
  const curva = varrerLimiares(amostras, limiares.map(limiar => ({ limiar, margem })));
  const eer = curva.reduce((m, c) => (Math.abs(c.taxaFalsoAceite - c.taxaFalsaRejeicao) < Math.abs(m.taxaFalsoAceite - m.taxaFalsaRejeicao) ? c : m), curva[0]);
  return { curva, limiarEquilibrado: eer.limiar };
}

export const similaridade = similaridadeCosseno;
