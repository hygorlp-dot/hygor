// Limites de tentativas do ponto, no limite persistente já usado pelo login
// do ARCD (auth_rate_limits via applyPersistentAuthRateLimit - serverless não
// tem memória compartilhada entre instâncias).
//
// 1) "ponto-parear" (ação SEM login): o código tem 8 dígitos e vale 30 min, e
//    quem acerta recebe o cadastro da obra. Dois contadores:
//    - por ORIGEM (IP do cabeçalho que a Vercel preenche): segura quem tenta
//      em sequência de um mesmo lugar; acerto zera o contador dessa origem;
//    - GLOBAL (todas as origens somadas): segura tentativa distribuída por
//      muitos IPs. Não zera com acerto - só a janela o libera.
// 2) PIN do responsável no cadastro facial (PONTO_EXIGIR_PIN_NO_SERVIDOR):
//    por APARELHO. Quem tem o token de um aparelho não testa PINs em série
//    (e cada teste custa um PBKDF2 no servidor).
//
// A TENTATIVA é contada no banco ANTES de olhar o código/PIN (a RPC de falha
// incrementa de forma atômica e devolve se passou do limite). Só "ler o
// estado e contar depois" deixaria uma rajada paralela inteira passar pela
// leitura antes de qualquer falha ser contada. Acerto zera o contador
// (menos o global). O estado "bloqueado" é lido antes, para que tentativas
// durante o bloqueio não o estendam.
//
// O bloqueio é sempre temporário (janela): um código certo pode esperar por
// causa de falha alheia, mas nunca fica barrado para sempre.
// O IP nunca é gravado nem registrado em log: vira hash (company|sujeito)
// dentro de applyPersistentAuthRateLimit antes de ir ao banco.
import { applyPersistentAuthRateLimit } from "../app-auth-security.js";

export const LIMITE_PAREAMENTO = Object.freeze({
  porOrigem: Object.freeze({ falhas: 5, janelaSegundos: 15 * 60 }),
  global: Object.freeze({ falhas: 30, janelaSegundos: 15 * 60 }),
});
export const LIMITE_PIN_RESPONSAVEL = Object.freeze({ falhas: 5, janelaSegundos: 15 * 60 });

const texto = v => String(v ?? "").trim();

// Mesmo critério de api/data.js (primeiro IP de x-forwarded-for).
export const origemDaRequisicao = headers =>
  texto(String(headers?.["x-forwarded-for"] || "").split(",")[0]) || texto(headers?.["x-real-ip"]) || "desconhecido";

export const sujeitosDoPareamento = headers => ({
  porOrigem: `ponto-parear|origem:${origemDaRequisicao(headers)}`,
  global: "ponto-parear|global",
});
export const sujeitoDoPin = dispositivoId => `ponto-pin|dispositivo:${texto(dispositivoId)}`;

// contadores: [{ sujeito, regra: { falhas, janelaSegundos } }]. A tentativa
// N+1 dentro da janela é a recusada (p_limit = falhas + 1: a RPC marca o
// bloqueio quando o contador ALCANÇA o limite, contando a tentativa atual).
// Falha do limitador impede novos pareamentos; não interrompe captura offline.
function criarContadores({ db, company }) {
  const chamar = (subject, action, regra) => applyPersistentAuthRateLimit(db, {
    company, subject, action, limit: regra ? regra.falhas + 1 : undefined, windowSeconds: regra?.janelaSegundos,
  });
  const bloqueio = resultados => {
    if (resultados.some(r => !r)) return { indisponivel: true, bloqueado: true };
    const b = resultados.filter(r => r?.blocked);
    return b.length
      ? { bloqueado: true, tentarDeNovoEmSegundos: Math.max(1, ...b.map(r => Number(r.retryAfter) || 0)) }
      : { bloqueado: false, tentarDeNovoEmSegundos: 0 };
  };
  return {
    async tentar(contadores) {
      const antes = bloqueio(await Promise.all(contadores.map(c => chamar(c.sujeito, "status"))));
      if (antes.bloqueado) return antes;
      return bloqueio(await Promise.all(contadores.map(c => chamar(c.sujeito, "failure", c.regra))));
    },
    async acertou(sujeitos) {
      await Promise.all(sujeitos.map(s => chamar(s, "success")));
    },
  };
}

export function criarLimitePareamento({ db, company, limites = LIMITE_PAREAMENTO }) {
  const c = criarContadores({ db, company });
  return {
    // Chamar ANTES de olhar o código; bloqueado = responder 429 sem olhar.
    tentar(headers) {
      const s = sujeitosDoPareamento(headers);
      return c.tentar([{ sujeito: s.porOrigem, regra: limites.porOrigem }, { sujeito: s.global, regra: limites.global }]);
    },
    // Código certo: zera só a origem (o global só a janela libera).
    acertou(headers) {
      return c.acertou([sujeitosDoPareamento(headers).porOrigem]);
    },
  };
}

export function criarLimitePinResponsavel({ db, company, regra = LIMITE_PIN_RESPONSAVEL }) {
  const c = criarContadores({ db, company });
  return {
    tentar: dispositivoId => c.tentar([{ sujeito: sujeitoDoPin(dispositivoId), regra }]),
    acertou: dispositivoId => c.acertou([sujeitoDoPin(dispositivoId)]),
  };
}
