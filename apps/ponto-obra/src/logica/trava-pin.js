import { proximaEsperaPin } from "./pin.js";

// Trava PERSISTENTE do PIN do encarregado (só contadores e horários - o PIN
// nunca entra aqui). Separada de pin.js, que segura o PIN em memória e não
// pode tocar em disco (trava em codigo-fonte.test.js). O App cria a trava com
// o armazém e entrega pronta à TelaEncarregado.
//
// Antes a trava ficava só na memória da tela:
// fechar e abrir o app zerava o contador. Agora o estado mora no banco local
// (armazem.lerEstado/gravarEstado, chave CHAVE_TRAVA_PIN) e sobrevive a
// reinício. A espera continua a de proximaEsperaPin. Contador por aparelho
// (vale para qualquer responsável escolhido), como antes.
export const CHAVE_TRAVA_PIN = "trava_pin_encarregado";
// Sem errar por 24 h, o contador volta a zero (o erro de digitação de hoje
// não herda a espera de semanas atrás).
export const ESQUECER_ERROS_MS = 24 * 60 * 60_000;
const ESPERA_MAXIMA_MS = 15 * 60_000;
const TRAVA_LIVRE = Object.freeze({ erros: 0, bloqueadoAte: 0, ultimaFalhaEm: 0 });

// Lido do banco: aceita null/lixo sem quebrar e nunca deixa uma espera maior
// que a máxima a partir da última falha.
export function normalizarTravaPin(bruto) {
  if (!bruto || typeof bruto !== "object") return TRAVA_LIVRE;
  const n = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  const erros = n(bruto.erros), ultimaFalhaEm = n(bruto.ultimaFalhaEm);
  if (!erros) return TRAVA_LIVRE;
  return { erros, ultimaFalhaEm, bloqueadoAte: Math.min(n(bruto.bloqueadoAte), ultimaFalhaEm + ESPERA_MAXIMA_MS) };
}

// Situação agora + a trava ajustada (gravar quando mudou = true):
// - relógio do aparelho voltou para antes da última falha: a espera recomeça
//   de agora (não some por mexer no relógio e também não vira eterna);
// - ESQUECER_ERROS_MS sem errar: contador zerado.
export function conferirTravaPin(bruto, agoraMs) {
  const t = normalizarTravaPin(bruto);
  let trava = t;
  if (t.erros && agoraMs < t.ultimaFalhaEm) {
    const espera = proximaEsperaPin(t.erros);
    trava = { ...t, ultimaFalhaEm: agoraMs, bloqueadoAte: espera ? agoraMs + espera : 0 };
  } else if (t.erros && agoraMs - t.ultimaFalhaEm >= ESQUECER_ERROS_MS) trava = TRAVA_LIVRE;
  const esperaMs = Math.max(0, trava.bloqueadoAte - agoraMs);
  return { trava, mudou: trava !== t, bloqueado: esperaMs > 0, esperaMs };
}

export function registrarFalhaPin(bruto, agoraMs) {
  const { trava: atual } = conferirTravaPin(bruto, agoraMs);
  const erros = atual.erros + 1;
  const esperaMs = proximaEsperaPin(erros);
  return { trava: { erros, ultimaFalhaEm: agoraMs, bloqueadoAte: esperaMs ? agoraMs + esperaMs : 0 }, esperaMs };
}

export const registrarAcertoPin = () => TRAVA_LIVRE;

export const textoEsperaPin = ms => (ms < 120_000 ? `${Math.max(1, Math.ceil(ms / 1000))} s` : `${Math.ceil(ms / 60_000)} min`);

// Liga a regra ao banco local. A falha é gravada ANTES de a tela mostrar o
// resultado: fechar o app no meio não devolve a tentativa. Banco local com
// erro impede autenticação: não permite reiniciar para zerar tentativas.
export function criarTravaPin({ armazem, agora = () => Date.now() }) {
  let memoria = TRAVA_LIVRE, leitura = null;
  const carregar = () => {
    if (!leitura) leitura = (async () => {
      memoria = normalizarTravaPin(await armazem.lerEstado(CHAVE_TRAVA_PIN));
      return memoria;
    })();
    return leitura;
  };
  const gravar = async trava => {
    memoria = trava;
    await armazem.gravarEstado(CHAVE_TRAVA_PIN, trava);
  };
  return {
    async situacao() {
      await carregar();
      const c = conferirTravaPin(memoria, agora());
      if (c.mudou) await gravar(c.trava);
      return { bloqueado: c.bloqueado, esperaMs: c.esperaMs };
    },
    async falhou() {
      await carregar();
      const r = registrarFalhaPin(memoria, agora());
      await gravar(r.trava);
      return { esperaMs: r.esperaMs };
    },
    async acertou() {
      await carregar();
      await gravar(registrarAcertoPin());
    },
  };
}
