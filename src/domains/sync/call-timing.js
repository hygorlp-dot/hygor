// Tempo das chamadas ao servidor, do clique à resposta, com as fases que o
// servidor informa em `Server-Timing` (ver server/server-timing.js).
//
// Serve para responder, com número e não com palpite, "por que salvar demora":
// `clienteMs` é o que o usuário espera; `servidorMs` é o tempo dentro da função;
// a diferença é rede. No DevTools: `arcdTemposResumo()` mostra p50/p95 por ação
// e as fases mais lentas. Só guarda nomes de ação, status e milissegundos.

// "auth;dur=12.3, leitura;dur=80.1, total;dur=210.4" -> { auth:12.3, leitura:80.1, total:210.4 }
export const lerServerTiming = header => {
  const fases = {};
  String(header || "").split(",").forEach(parte => {
    const [nome, ...atributos] = parte.trim().split(";");
    const dur = atributos.map(a => a.trim()).find(a => a.startsWith("dur="));
    const ms = dur ? Number(dur.slice(4)) : NaN;
    if (nome && Number.isFinite(ms)) fases[nome] = ms;
  });
  return fases;
};

const percentil = (valores, p) => {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil(p / 100 * ordenados.length) - 1)];
};
const arredondar = n => Math.round(n * 10) / 10;

export const resumirTempos = registros => {
  const porAcao = new Map();
  (registros || []).forEach(r => {
    if (!porAcao.has(r.acao)) porAcao.set(r.acao, []);
    porAcao.get(r.acao).push(r);
  });
  return [...porAcao.entries()].map(([acao, lista]) => {
    const cliente = lista.map(r => r.clienteMs);
    const comServidor = lista.filter(r => Number.isFinite(r.servidor?.total));
    const nomesDeFase = [...new Set(comServidor.flatMap(r => Object.keys(r.servidor)))].filter(f => f !== "total");
    const fases = Object.fromEntries(nomesDeFase.map(f => [f, arredondar(percentil(comServidor.map(r => r.servidor[f] ?? 0), 50))]));
    return {
      acao, chamadas: lista.length,
      clienteP50: arredondar(percentil(cliente, 50)), clienteP95: arredondar(percentil(cliente, 95)),
      servidorP50: comServidor.length ? arredondar(percentil(comServidor.map(r => r.servidor.total), 50)) : null,
      fasesP50: fases,
    };
  }).sort((a, b) => b.clienteP95 - a.clienteP95);
};

export const criarRegistroDeTempos = ({ limite = 200 } = {}) => {
  const registros = [];
  return {
    registrar({ acao, status, clienteMs, servidor = {} }) {
      registros.push({ acao: String(acao || "desconhecida"), status: Number(status || 0), clienteMs: Number(clienteMs) || 0, servidor });
      if (registros.length > limite) registros.splice(0, registros.length - limite);
    },
    ultimos: () => [...registros],
    resumo: () => resumirTempos(registros),
  };
};
