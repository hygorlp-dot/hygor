// Relatório de calibração do reconhecimento facial (homologação de campo).
// Puro e testável no Node. Mede, sobre tentativas rotuladas:
// - falso aceite: o app aceitou e atribuiu a batida a outra pessoa (inclui
//   pessoa não cadastrada aceita como alguém);
// - falsa rejeição: pessoa cadastrada não reconhecida;
// - distribuição do score do 1º candidato, da diferença para o 2º e da
//   qualidade da detecção.
//
// Privacidade: a amostra guarda SÓ números e ids. Vetor facial e foto nunca
// entram (amostraDeCalibracao descarta qualquer outro campo).
import { PARAMETROS_FACIAIS } from "./calibracao.js";

const numero = v => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);

// esperado: employeeId de quem realmente estava na frente da câmera, ou null
// para pessoa não cadastrada (teste de impostor). resultado: saída de
// identificar(). deteccao: { score, larguraRosto, giro } de analisarFoto.
export function amostraDeCalibracao({ esperado = null, resultado = {}, deteccao = {} }) {
  return {
    esperado: esperado === null || esperado === undefined || esperado === "" ? null : String(esperado),
    aceito: resultado.reconhecido ? String(resultado.employeeId) : null,
    top1Id: resultado.melhor?.employeeId != null ? String(resultado.melhor.employeeId) : null,
    top1: numero(resultado.melhor?.similaridade),
    top2: numero(resultado.segundo?.similaridade),
    scoreDeteccao: numero(deteccao.score),
    larguraRosto: numero(deteccao.larguraRosto),
    giro: numero(deteccao.giro),
  };
}

function resumoNumerico(valores) {
  const v = valores.filter(x => x !== null).sort((a, b) => a - b);
  if (!v.length) return { n: 0, min: null, p05: null, mediana: null, p95: null, max: null };
  const q = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  const arred = x => Number(x.toFixed(4));
  return { n: v.length, min: arred(v[0]), p05: arred(q(0.05)), mediana: arred(q(0.5)), p95: arred(q(0.95)), max: arred(v.at(-1)) };
}

// Decide de novo com outro limiar/margem (mesma regra de identificar()).
export function decidir(amostra, { limiar, margem }) {
  if (amostra.top1 === null || amostra.top1 < limiar) return null;
  if (amostra.top2 !== null && amostra.top1 - amostra.top2 < margem) return null;
  return amostra.top1Id;
}

function taxas(amostras, decisao) {
  const genuinas = amostras.filter(a => a.esperado !== null);
  const impostoras = amostras.filter(a => a.esperado === null);
  let falsoAceite = 0, falsaRejeicao = 0, acertos = 0;
  for (const a of amostras) {
    const aceito = decisao(a);
    if (aceito !== null && aceito !== a.esperado) falsoAceite++;
    if (a.esperado !== null && aceito === null) falsaRejeicao++;
    if (a.esperado !== null && aceito === a.esperado) acertos++;
  }
  const t = (n, d) => (d ? Number((n / d).toFixed(4)) : null);
  return {
    tentativas: amostras.length, genuinas: genuinas.length, impostoras: impostoras.length,
    falsoAceite, falsaRejeicao, acertos,
    taxaFalsoAceite: t(falsoAceite, amostras.length),
    taxaFalsaRejeicao: t(falsaRejeicao, genuinas.length),
  };
}

export function relatorioCalibracao(amostrasBrutas, parametros = PARAMETROS_FACIAIS) {
  const amostras = amostrasBrutas.map(a => ("top1" in a ? a : amostraDeCalibracao(a)));
  const margemDe = a => (a.top1 !== null && a.top2 !== null ? a.top1 - a.top2 : null);
  const porGrupo = grupo => ({
    top1: resumoNumerico(grupo.map(a => a.top1)),
    margemSobreSegundo: resumoNumerico(grupo.map(margemDe)),
    scoreDeteccao: resumoNumerico(grupo.map(a => a.scoreDeteccao)),
    larguraRosto: resumoNumerico(grupo.map(a => a.larguraRosto)),
  });
  return {
    parametros: { limiarReconhecimento: parametros.limiarReconhecimento, margemSobreSegundo: parametros.margemSobreSegundo },
    // Taxas pela decisão que o app tomou de fato no campo.
    noCampo: taxas(amostras, a => a.aceito),
    distribuicao: {
      genuinas: porGrupo(amostras.filter(a => a.esperado !== null)),
      impostoras: porGrupo(amostras.filter(a => a.esperado === null)),
    },
  };
}

// Simula outros limiares sobre as mesmas tentativas (curva de troca entre
// falso aceite e falsa rejeição) - só para decidir a calibração, nunca muda
// o app sozinho.
export function varrerLimiares(amostrasBrutas, combinacoes) {
  const amostras = amostrasBrutas.map(a => ("top1" in a ? a : amostraDeCalibracao(a)));
  return combinacoes.map(c => ({ ...c, ...taxas(amostras, a => decidir(a, c)) }));
}
