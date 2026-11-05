// Evidência coletada pela conexão com o REP, não pelo ícone de Wi-Fi nem
// pelo horário em que uma batida antiga foi finalmente sincronizada.
export async function verificarModoCaptura({ api, dispositivoId, gerarId, limiteMs = 1200 }) {
  const offline = { versaoCaptura: 1, offline: true };
  let timer;
  try {
    const desafio = gerarId();
    const limite = Math.min(1200, Math.max(100, limiteMs));
    const response = await Promise.race([
      Promise.resolve().then(() => api("ponto-coletor-conectividade", { desafio }, { tempoLimiteMs: limite })),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), limite); }),
    ]);
    const conectado = response?.ok === true && response.conectado === true
      && response.desafio === desafio && response.dispositivoId === dispositivoId;
    return { versaoCaptura: 1, offline: !conectado };
  } catch { return offline; }
  finally { clearTimeout(timer); }
}
