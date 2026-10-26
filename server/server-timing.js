// Cronômetro por fases, devolvido ao navegador no cabeçalho `Server-Timing`.
//
// Sem isso não há como saber onde um salvamento gasta tempo: o plano atual da
// Vercel guarda só 1 h de logs e o código não media nada. Cada `marcar(nome)`
// registra o tempo desde a marca anterior; `total` é o tempo da requisição.
// O cabeçalho só carrega nomes de fases e milissegundos - nenhum dado do
// usuário - e é lido pelo cliente em src/domains/sync/call-timing.js.
export const criarCronometro = (agora = () => performance.now()) => {
  const inicio = agora();
  let ultimo = inicio;
  const fases = [];
  return {
    marcar(nome) {
      const t = agora();
      fases.push([String(nome).replace(/[^a-z0-9_]/gi, "_"), t - ultimo]);
      ultimo = t;
    },
    cabecalho() {
      const total = agora() - inicio;
      return [...fases, ["total", total]].map(([nome, ms]) => `${nome};dur=${ms.toFixed(1)}`).join(", ");
    },
  };
};

// Injeta o cabeçalho no momento em que a resposta JSON é enviada, sem tocar
// nas dezenas de `return res.status(...).json(...)` do handler. Fecha a fase
// "acao" (tudo o que ainda não tinha marca) antes de medir o total. Seguro
// para `res` simulados em teste, que não têm setHeader.
export const anexarCronometro = (res, cronometro) => {
  if (typeof res?.json !== "function" || typeof res?.setHeader !== "function") return;
  const enviar = res.json.bind(res);
  res.json = corpo => {
    try {
      if (!res.headersSent) {
        cronometro.marcar("acao");
        res.setHeader("Server-Timing", cronometro.cabecalho());
      }
    } catch { /* medir nunca pode derrubar a resposta */ }
    return enviar(corpo);
  };
};
