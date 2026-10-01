// Diagnóstico do aparelho (modo Encarregado → Diagnóstico). Puro.
//
// Mostra o necessário para o suporte entender o estado do aparelho SEM
// nenhum dado pessoal ou biométrico: nada de vetor facial, foto, CPF, PIN,
// token do aparelho ou chave do banco. A lista de campos é fechada aqui -
// o teste confere que nada sensível escapa.

const fmt = ms => (Number.isFinite(ms) ? new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Recife" }) : "nunca");

// hora = saída de relogio.agora() (horaDaMarcacao).
export function estadoReferenciaHora(hora) {
  if (!hora) return "desconhecido";
  if (hora.horaConfiavel) return hora.relogioAlterado ? "sincronizada (relógio do celular diferente do servidor)" : "sincronizada";
  return hora.motivo || "não confiável";
}

export function montarDiagnostico({ app = {}, aparelho = {}, sessao = null, contagem = {}, ultimaSincronizacao = null, modelos = {}, hora = null, gps = {} }) {
  const sinc = ultimaSincronizacao;
  const itens = [
    ["Versão do app", app.versao || "-"],
    ["Build (versionCode)", app.build || "-"],
    ["Commit", app.commit || "-"],
    ["Plataforma", aparelho.plataforma || "android"],
    ["Android", aparelho.android || "-"],
    ["Aparelho", [aparelho.marca, aparelho.modelo].filter(Boolean).join(" ") || "-"],
    ["Aparelho no ARCD", sessao?.nome || "não pareado"],
    ["Obra", sessao?.obra?.nome || "-"],
    ["Última sincronização", sinc ? `${fmt(sinc.em)}${sinc.ok ? "" : ` (falhou: ${sinc.erro || "erro"})`}` : "nunca"],
    ["Último envio com sucesso", fmt(sinc?.ultimoOkEm)],
    ["Batidas a enviar", String(contagem.pendentes ?? 0)],
    ["Fotos a enviar", String(contagem.fotos ?? 0)],
    ["Fotos com problema", String(contagem.fotosComProblema ?? 0)],
    ["Reconhecimento facial", modelos.estado === "ok" ? "carregado" : modelos.estado === "erro" ? `indisponível (${modelos.erro || "erro"})` : "carregando"],
    ["Referência de hora", estadoReferenciaHora(hora)],
    ["GPS", gps.estado || "desconhecido"],
  ];
  return itens.map(([rotulo, valor]) => ({ rotulo, valor: String(valor) }));
}
