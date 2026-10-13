// Diagnóstico do aparelho (modo Encarregado → Diagnóstico). Puro.
//
// Mostra o necessário para o suporte entender o estado do aparelho SEM
// nenhum dado pessoal ou biométrico: nada de vetor facial, foto, CPF, PIN,
// token do aparelho ou chave do banco. A lista de campos é fechada aqui -
// o teste confere que nada sensível escapa.

const fmt = ms => (Number.isFinite(ms) ? new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Recife" }) : "nunca");

// hora = saída de relogio.agora() (horaDaMarcacao).
// Não diz "sincronizada com a HLB": isso ainda não é comprovável (ver
// docs/REP-P-TEMPO-CONFIAVEL.md). Diz se a referência temporal é válida.
export function estadoReferenciaHora(hora) {
  if (!hora) return "desconhecido";
  if (hora.horaConfiavel) return hora.relogioAlterado ? "referência temporal válida (relógio do celular diferente)" : "referência temporal válida";
  return hora.motivo || "referência temporal não confiável";
}

const ROTULO_ESTADO_REFERENCIA = {
  nunca_validada: "nunca validada", invalida_apos_reinicio: "aparelho reiniciou - aguardando sincronizar",
  valida: "válida", proxima_do_vencimento: "próxima do vencimento", expirada: "expirada (batidas saem como hora não confiável)",
};
const duracao = ms => (ms === null || ms === undefined ? "-" : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : ms < 172_800_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} dias`);

// referencia = estadoDaReferencia() (relogio.js).
export function montarDiagnostico({ app = {}, aparelho = {}, sessao = null, contagem = {}, ultimaSincronizacao = null, modelos = {}, hora = null, gps = {}, fiscal = {}, referencia = null }) {
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
    ["Estabelecimento", fiscal.estabelecimento || (sinc?.aguardandoEstabelecimento ? "obra sem estabelecimento no ARCD" : "-")],
    ["Sequência local (último registro)", fiscal.ultimaSequenciaLocal ?? "-"],
    ["Último NSR recebido da ARP", fiscal.ultimoNsr ?? "-"],
    ["Cadeia local", sinc?.cadeiaDivergente ? "DIVERGENTE do servidor - chame o suporte" : "ok"],
    ["Registro fiscal", sinc?.fiscalDivergente ? "ARP respondeu NSR/hash diferente do guardado - chame o suporte" : "ok"],
    ["Batidas a enviar", String(contagem.pendentes ?? 0)],
    ["Fotos a enviar", String(contagem.fotos ?? 0)],
    ["Fotos com problema", String(contagem.fotosComProblema ?? 0)],
    ["Reconhecimento facial", modelos.estado === "ok" ? "carregado" : modelos.estado === "erro" ? `indisponível (${modelos.erro || "erro"})` : "carregando"],
    ["Referência de hora", estadoReferenciaHora(hora)],
    ["Estado da referência", referencia ? ROTULO_ESTADO_REFERENCIA[referencia.estado] || referencia.estado : "desconhecido"],
    ["Última validação da hora", referencia?.ultimaValidacao ? fmt(Date.parse(referencia.ultimaValidacao)) : "nunca"],
    ["Idade da referência", duracao(referencia?.idadeMs)],
    ["Fonte de hora do servidor", fiscal.fonteHora ? `${fiscal.fonteHora}${fiscal.statusHora ? ` (${fiscal.statusHora})` : ""}` : "-"],
    ["GPS", gps.estado || "desconhecido"],
  ];
  return itens.map(([rotulo, valor]) => ({ rotulo, valor: String(valor) }));
}
