// Consulta periódica ao servidor que desacelera quando a aba está oculta.
//
// O chat consultava o servidor a cada 8 s MESMO com a aba em segundo plano:
// ~3.600 chamadas por usuário por dia (cada uma com autenticação e consultas ao
// banco), sem ninguém olhando. Aqui o ritmo curto vale só com a aba visível; oculta,
// usa um intervalo longo; ao voltar a ficar visível, consulta na hora.
//
// Usa setTimeout encadeado (não setInterval): o próximo intervalo é escolhido
// no momento de agendar, e uma consulta lenta nunca se sobrepõe à seguinte.
export const criarPollingAdaptativo = ({
  tarefa, visivelMs, ocultoMs,
  documento = typeof document !== "undefined" ? document : null,
  agendar = (funcao, ms) => setTimeout(funcao, ms),
  cancelar = id => clearTimeout(id),
}) => {
  let timer = null;
  let ativo = false;
  let rodando = false;

  const proximoIntervalo = () => (documento?.hidden ? ocultoMs : visivelMs);
  const agendarProximo = () => { if (ativo && timer === null) timer = agendar(rodar, proximoIntervalo()); };

  async function rodar() {
    timer = null;
    if (!ativo || rodando) return;
    rodando = true;
    try { await tarefa(); } catch { /* uma falha não encerra o polling; a próxima segue o ritmo normal */ }
    finally { rodando = false; }
    agendarProximo();
  }

  const aoMudarVisibilidade = () => {
    if (!ativo || documento?.hidden) return;
    if (timer !== null) { cancelar(timer); timer = null; }
    rodar();
  };

  return {
    iniciar() {
      if (ativo) return;
      ativo = true;
      documento?.addEventListener?.("visibilitychange", aoMudarVisibilidade);
      rodar();
    },
    parar() {
      ativo = false;
      if (timer !== null) { cancelar(timer); timer = null; }
      documento?.removeEventListener?.("visibilitychange", aoMudarVisibilidade);
    },
  };
};
