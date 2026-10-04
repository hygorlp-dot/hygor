// Diagnóstico do aparelho (modo Encarregado → Diagnóstico). Puro.
//
// Mostra o necessário para o suporte entender o estado do aparelho SEM
// nenhum dado pessoal ou biométrico: nada de vetor facial, foto, CPF, PIN,
// token do aparelho ou chave do banco. A lista de campos é fechada aqui -
// o teste confere que nada sensível escapa.

import { formatarDataHora } from "./apresentacao.js";

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
// app = infoDoApp() (versão, versionCode, commit e metadados do build);
// rep = { versao, situacao } do software REP (rep-p.js) - versão TÉCNICA,
// não registrada; modelos = { estado, erro, detector, identidade, cargaMs };
// desempenho = medições anônimas da sessão (ms). fuso = do estabelecimento.
export function montarDiagnostico({ app = {}, rep = {}, aparelho = {}, sessao = null, contagem = {}, ultimaSincronizacao = null, modelos = {}, hora = null, gps = {}, fiscal = {}, referencia = null, desempenho = {}, fuso }) {
  const sinc = ultimaSincronizacao;
  const fmt = ms => formatarDataHora(ms, fuso);
  const ms = v => (Number.isFinite(v) ? `${Math.round(v)} ms` : "-");
  const modeloCarregado = nome => (modelos.estado === "ok" ? `${nome || "carregado"} · SHA-256 conferido` : modelos.estado === "erro" ? "indisponível" : "carregando");
  const arp = sinc?.cadeiaDivergente ? "cadeia divergente - chame o suporte"
    : sinc?.aguardandoEstabelecimento ? "aguardando vínculo da obra a um estabelecimento"
      : fiscal.ultimoNsr !== null && fiscal.ultimoNsr !== undefined ? "aceitando eventos" : "sem eventos confirmados ainda";
  const itens = [
    ["Versão do app", app.versao || "-"],
    ["Versão do software REP", rep.versao ? `${rep.versao} (técnica, não registrada)` : "-"],
    ["Build (versionCode)", app.build || "-"],
    ["Commit", app.commit || "-"],
    ["Perfil do build", app.perfil || "-"],
    ["Data do build", app.buildEm ? fmt(Date.parse(app.buildEm)) : "-"],
    ["Plataforma", aparelho.plataforma || "android"],
    ["Android", aparelho.android || "-"],
    ["Aparelho", [aparelho.marca, aparelho.modelo].filter(Boolean).join(" ") || "-"],
    ["Aparelho no ARCD", sessao?.nome || "não pareado"],
    ["Obra", sessao?.obra?.nome || "-"],
    ["GPS", gps.estado || "desconhecido"],
    ["Última sincronização", sinc ? `${fmt(sinc.em)}${sinc.ok ? "" : ` (falhou: ${sinc.erro || "erro"})`}` : "nunca"],
    ["Último envio com sucesso", fmt(sinc?.ultimoOkEm)],
    ["Batidas a enviar", String(contagem.pendentes ?? 0)],
    ["Fotos a enviar", String(contagem.fotos ?? 0)],
    ["Fotos com problema", String(contagem.fotosComProblema ?? 0)],
    ["Estabelecimento", fiscal.estabelecimento || (sinc?.aguardandoEstabelecimento ? "obra sem estabelecimento no ARCD" : "-")],
    ["Sequência local (último registro)", fiscal.ultimaSequenciaLocal ?? "-"],
    ["Último NSR recebido da ARP", fiscal.ultimoNsr ?? "-"],
    ["ARP", arp],
    ["Cadeia local", sinc?.cadeiaDivergente ? "DIVERGENTE do servidor - chame o suporte" : "ok"],
    ["Situação formal REP-P", rep.situacao || "em desenvolvimento - não é REP-P registrado"],
    ["Referência de hora", estadoReferenciaHora(hora)],
    ["Estado da referência", referencia ? ROTULO_ESTADO_REFERENCIA[referencia.estado] || referencia.estado : "desconhecido"],
    ["Última validação da hora", referencia?.ultimaValidacao ? fmt(Date.parse(referencia.ultimaValidacao)) : "nunca"],
    ["Idade da referência", duracao(referencia?.idadeMs)],
    ["Fonte de hora do servidor", fiscal.fonteHora ? `${fiscal.fonteHora}${fiscal.statusHora ? ` (${fiscal.statusHora})` : ""}` : "-"],
    ["Fuso horário", fuso || "-"],
    ["Reconhecimento facial", modelos.estado === "ok" ? "carregado" : modelos.estado === "erro" ? `indisponível (${modelos.erro || "erro"})` : "carregando"],
    ["Modelo detector", modeloCarregado(modelos.detector)],
    ["Modelo de identidade", modeloCarregado(modelos.identidade)],
    ["Carga dos modelos", ms(modelos.cargaMs)],
    ["Última identificação", ms(desempenho.identificacaoMs)],
    ["Última batida (total)", ms(desempenho.batidaMs)],
  ];
  return itens.map(([rotulo, valor]) => ({ rotulo, valor: String(valor) }));
}

// Agrupa a lista fechada em seções (página de Ajustes, não dashboard). Item
// sem seção conhecida cai em "Outros" - nada some da tela.
const SECAO_DO_ITEM = {
  "Versão do app": "Aplicativo", "Versão do software REP": "Aplicativo", "Build (versionCode)": "Aplicativo", "Commit": "Aplicativo", "Perfil do build": "Aplicativo", "Data do build": "Aplicativo",
  "Plataforma": "Aparelho", "Android": "Aparelho", "Aparelho": "Aparelho", "Aparelho no ARCD": "Aparelho", "Obra": "Aparelho", "GPS": "Aparelho",
  "Última sincronização": "Sincronização", "Último envio com sucesso": "Sincronização", "Batidas a enviar": "Sincronização", "Fotos a enviar": "Sincronização", "Fotos com problema": "Sincronização",
  "Estabelecimento": "REP-P", "Sequência local (último registro)": "REP-P", "Último NSR recebido da ARP": "REP-P", "ARP": "REP-P", "Cadeia local": "REP-P", "Situação formal REP-P": "REP-P",
  "Referência de hora": "Hora", "Estado da referência": "Hora", "Última validação da hora": "Hora", "Idade da referência": "Hora", "Fonte de hora do servidor": "Hora", "Fuso horário": "Hora",
  "Reconhecimento facial": "Modelos", "Modelo detector": "Modelos", "Modelo de identidade": "Modelos", "Carga dos modelos": "Modelos",
  "Última identificação": "Desempenho", "Última batida (total)": "Desempenho",
};
export const ORDEM_SECOES_DIAGNOSTICO = Object.freeze(["Aplicativo", "Aparelho", "Sincronização", "REP-P", "Hora", "Modelos", "Desempenho", "Outros"]);
// Valores técnicos (números, códigos) em fonte mono.
const MONO = new Set(["Versão do app", "Versão do software REP", "Build (versionCode)", "Commit", "Android", "Sequência local (último registro)", "Último NSR recebido da ARP", "Batidas a enviar", "Fotos a enviar", "Fotos com problema", "Carga dos modelos", "Última identificação", "Última batida (total)"]);
// Valores que pedem atenção (texto + ícone na tela, não só cor).
const atencao = ({ rotulo, valor }) =>
  (rotulo === "Cadeia local" && valor !== "ok")
  || (rotulo === "Fotos com problema" && valor !== "0")
  || (rotulo === "Reconhecimento facial" && valor.startsWith("indisponível"))
  || (rotulo === "ARP" && /divergente|aguardando/.test(valor))
  || (rotulo === "Estado da referência" && /expirada|aguardando|nunca/.test(valor));

export function secoesDoDiagnostico(itens) {
  const porSecao = new Map(ORDEM_SECOES_DIAGNOSTICO.map(t => [t, []]));
  for (const item of itens) {
    porSecao.get(SECAO_DO_ITEM[item.rotulo] || "Outros").push({ ...item, mono: MONO.has(item.rotulo), atencao: atencao(item) });
  }
  return ORDEM_SECOES_DIAGNOSTICO.map(titulo => ({ titulo, itens: porSecao.get(titulo) })).filter(s => s.itens.length);
}
