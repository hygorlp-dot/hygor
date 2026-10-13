// Limite de tentativas do "ponto-parear" (ação SEM login): o código tem 8
// dígitos e vale 30 min, e quem acerta recebe o cadastro da obra. Dois
// contadores, ambos no limite persistente já usado pelo login do ARCD
// (auth_rate_limits via applyPersistentAuthRateLimit - serverless não tem
// memória compartilhada entre instâncias):
// - por ORIGEM (IP do cabeçalho que a Vercel preenche): segura quem tenta
//   em sequência de um mesmo lugar; acerto zera o contador dessa origem;
// - GLOBAL (todas as origens somadas): segura tentativa distribuída por
//   muitos IPs. Não zera com acerto - só a janela o libera.
// O bloqueio é sempre temporário (janela): um código certo pode esperar por
// causa de falha alheia, mas nunca fica barrado para sempre.
// O IP nunca é gravado nem registrado em log: vira hash (company|sujeito)
// dentro de applyPersistentAuthRateLimit antes de ir ao banco.
import { applyPersistentAuthRateLimit } from "../app-auth-security.js";

export const LIMITE_PAREAMENTO = Object.freeze({
  porOrigem: Object.freeze({ falhas: 5, janelaSegundos: 15 * 60 }),
  global: Object.freeze({ falhas: 30, janelaSegundos: 15 * 60 }),
});

const texto = v => String(v ?? "").trim();

// Mesmo critério de api/data.js (primeiro IP de x-forwarded-for).
export const origemDaRequisicao = headers =>
  texto(String(headers?.["x-forwarded-for"] || "").split(",")[0]) || texto(headers?.["x-real-ip"]) || "desconhecido";

export const sujeitosDoPareamento = headers => ({
  porOrigem: `ponto-parear|origem:${origemDaRequisicao(headers)}`,
  global: "ponto-parear|global",
});

// Falha do banco do limite (RPC indisponível) = não bloqueia, igual ao login
// do ARCD: o pareamento continua exigindo o código de uso único.
export function criarLimitePareamento({ db, company, limites = LIMITE_PAREAMENTO }) {
  const chamar = (subject, action, regra) => applyPersistentAuthRateLimit(db, {
    company, subject, action, limit: regra?.falhas, windowSeconds: regra?.janelaSegundos,
  });
  return {
    async conferir(headers) {
      const s = sujeitosDoPareamento(headers);
      const resultados = await Promise.all([chamar(s.porOrigem, "status"), chamar(s.global, "status")]);
      const bloqueios = resultados.filter(r => r?.blocked);
      if (!bloqueios.length) return { bloqueado: false, tentarDeNovoEmSegundos: 0 };
      return { bloqueado: true, tentarDeNovoEmSegundos: Math.max(1, ...bloqueios.map(r => Number(r.retryAfter) || 0)) };
    },
    async falhou(headers) {
      const s = sujeitosDoPareamento(headers);
      await Promise.all([chamar(s.porOrigem, "failure", limites.porOrigem), chamar(s.global, "failure", limites.global)]);
    },
    async acertou(headers) {
      await chamar(sujeitosDoPareamento(headers).porOrigem, "success");
    },
  };
}
