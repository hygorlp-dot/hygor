// Sincronização do aparelho com o ARCD - JavaScript puro, testável no Node.
// `api(acao, corpo)` faz o POST em /api/data com o token do aparelho e
// devolve { ok, status, ...json } (nunca lança - ver servicos/conexao.js).
//
// Modelo REP-P (docs/REP-P-ARQUITETURA.md):
//   aparelho: evento -> sequência local -> hash local -> SQLCipher -> fila
//   ARP:      eventId -> estabelecimento -> idempotência -> NSR -> hash fiscal
//   aparelho: guarda NSR e hash fiscal AO LADO do evento e marca sincronizado
// O aparelho nunca muda o evento para acomodar o servidor e nunca renumera.
//
// Garantias (testadas em regressao.test.js e armazem-sqlite.test.js):
// - evento só sai da fila quando a ARP responde ESTE eventId como gravado;
// - foto só é apagada do aparelho depois que o servidor confirma o upload;
// - falha de rede deixa evento e foto para a próxima rodada.
import { novaReferencia } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { gpsParaMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";
import { LIMITE_FOTO_BYTES, bytesDoBase64 } from "../../../../src/domains/ponto-eletronico/foto.js";
import { enviarLegado } from "./legado-v1.js";

const LOTE = 200;
const HEX64 = /^[0-9a-f]{64}$/i;
// Status da ARP em que o evento está definitivamente gravado.
export const STATUS_GRAVADO = Object.freeze(["registrado", "ja_registrado", "acesso_registrado", "acesso_ja_registrado"]);
// GPS mais velho que isto não é mandado (nem na sincronização, nem na batida):
// melhor sem localização do que com uma localização antiga.
export const GPS_IDADE_MAXIMA_MS = 15 * 60_000;

// Último GPS válido e recente, no formato da marcação ({lat, lng, precisao}),
// ou null. gps = { lat, lng, precisao, em } (em = Date.now() da leitura).
export function gpsRecente(gps, agoraMs, idadeMaximaMs = GPS_IDADE_MAXIMA_MS) {
  const valido = gpsParaMarcacao(gps);
  if (!valido) return null;
  const em = Number(gps.em);
  if (!Number.isFinite(em) || agoraMs - em > idadeMaximaMs || em - agoraMs > 60_000) return null;
  return valido;
}

const textoCurto = (v, max = 80) => (v === null || v === undefined ? "" : String(v).slice(0, max));

// Corpo de "ponto-sincronizar": versão do app e identificação do aparelho
// (sem nada pessoal) + último GPS válido. Sem GPS a sincronização segue.
export function montarCorpoSincronizacao({ app = {}, aparelho = {}, gps = null, agoraMs = Date.now() } = {}) {
  const versao = textoCurto(app.versao, 20), build = textoCurto(app.build, 20);
  const corpo = {
    appVersao: versao ? (build ? `${versao} (${build})` : versao) : "",
    aparelho: {
      marca: textoCurto(aparelho.marca), modelo: textoCurto(aparelho.modelo), android: textoCurto(aparelho.android, 20),
      build, commit: textoCurto(app.commit, 12),
    },
  };
  const g = gpsRecente(gps, agoraMs);
  if (g) corpo.gps = g;
  return corpo;
}

// Resposta da ARP para um evento é coerente? (ponto precisa de NSR inteiro
// e hash fiscal; acesso de terceiro não tem NSR.)
function fiscalValido(evento, r) {
  if (!STATUS_GRAVADO.includes(r?.status)) return false;
  if (evento.tipoRegistro === "acesso_terceiro") return r.nsr === null || r.nsr === undefined;
  return Number.isInteger(Number(r.nsr)) && Number(r.nsr) >= 1 && HEX64.test(String(r.fiscalHash || ""));
}

// Envia os eventos pendentes em ordem de sequência local. Cada evento só é
// confirmado pela resposta que cita o SEU eventId. Para no primeiro que a
// ARP não gravou (os seguintes dependem dele na cadeia local).
// lote/maxRodadas: só os testes mudam (para intercalar aparelhos).
export async function enviarPendentes({ armazem, api, lote = LOTE, maxRodadas = 50 }) {
  let enviadas = 0;
  for (let rodada = 0; rodada < maxRodadas; rodada++) {
    const pendentes = await armazem.eventosPendentes(lote);
    if (!pendentes.length) return { enviadas, pendentes: 0, erro: null };

    // Batidas antigas (formato 1) vêm antes na sequência: caminho legado.
    const legados = [];
    for (const e of pendentes) { if (e.formatVersion === 2) break; legados.push(e); }
    if (legados.length) {
      const l = await enviarLegado({ armazem, api, eventos: legados });
      enviadas += l.enviadas;
      if (l.erro) return { enviadas, pendentes: pendentes.length, ...l };
      continue;
    }

    const r = await api("ponto-enviar-marcacoes", { eventos: pendentes });
    if (!r.ok) return { enviadas, pendentes: pendentes.length, erro: r.error || `HTTP ${r.status}`, semRede: r.status === 0, status: r.status, codigo: r.code || null };
    const porEvento = new Map((r.resultados || []).map(x => [String(x.eventId), x]));
    let nesta = 0, parada = null;
    for (const e of pendentes) {
      const resultado = porEvento.get(String(e.eventId));
      if (!fiscalValido(e, resultado)) { parada = { evento: e, resultado }; break; }
      await armazem.confirmarEvento(e.eventId, {
        nsr: resultado.nsr ?? null, fiscalHash: resultado.fiscalHash ?? null,
        estabelecimentoId: resultado.estabelecimentoId ?? null, gravadoEm: resultado.gravadoEm ?? null,
      });
      nesta++;
    }
    enviadas += nesta;
    if (parada) {
      const status = parada.resultado?.status || "sem_resposta";
      return {
        enviadas, pendentes: pendentes.length - nesta, status,
        erro: parada.resultado?.motivo || `evento ${parada.evento.localSequence} não foi gravado pela ARP (${status})`,
        aguardandoEstabelecimento: status === "aguardando_estabelecimento",
      };
    }
  }
  return { enviadas, pendentes: (await armazem.eventosPendentes(1)).length, erro: null };
}

// Fotos só depois do evento gravado (o servidor confere a foto pelo hash que
// já está no evento). Regras:
// - arquivo sumiu do aparelho: marcada "sem arquivo" (aparece no diagnóstico)
//   e a fila segue;
// - foto acima do limite: não é enviada (o servidor recusaria), fica
//   "recusada" com o arquivo preservado;
// - servidor recusou de vez (4xx): "recusada", arquivo preservado;
// - sem rede / servidor fora / erro de leitura: continua pendente.
// O arquivo local só é apagado (aposEnviar) depois do OK do servidor.
export async function enviarFotos({ armazem, api, lerFotoBase64, aposEnviar = async () => {}, limite = 20 }) {
  const fila = await armazem.fotosPendentes(limite);
  let enviadas = 0, falhas = 0, semArquivo = 0, recusadas = 0;
  for (const item of fila) {
    let foto;
    try {
      foto = await lerFotoBase64(item.caminhoFoto);
    } catch {
      falhas++; continue;               // leitura falhou agora: tenta na próxima rodada
    }
    if (!foto) { await armazem.fotoSemArquivo(item.id); semArquivo++; continue; }
    if (bytesDoBase64(foto) > LIMITE_FOTO_BYTES) { await armazem.fotoRecusada(item.id, "acima do limite do servidor"); recusadas++; continue; }
    const r = await api("ponto-enviar-foto", { marcacaoId: item.id, foto });
    if (r.ok) {
      await armazem.fotoEnviada(item.id);
      try { await aposEnviar(item); } catch { /* apagar o arquivo local não pode travar a fila */ }
      enviadas++;
      continue;
    }
    falhas++;
    if (r.status === 0 || r.status >= 500 || r.status === 401 || r.status === 403 || r.status === 408 || r.status === 429) break;
    await armazem.fotoRecusada(item.id, String(r.error || `HTTP ${r.status}`).slice(0, 200));
    recusadas++;
  }
  return { enviadas, falhas, semArquivo, recusadas };
}

// Baixa a base única da obra (funcionários, biometrias, responsáveis,
// terceirizados, estabelecimento), acerta a referência de hora com a
// evidência da fonte oficial e informa versão do app, aparelho e GPS.
// `monotonico()` devolve { ms, bootId } do relógio que não muda com ajuste.
// Não renumera nada: se o servidor já tiver uma cadeia local deste aparelho
// mais adiante do que a do banco local, só sinaliza (cadeiaDivergente).
export async function sincronizarCadastro({ armazem, api, monotonico, corpo = {} }) {
  const envio = monotonico();
  const r = await api("ponto-sincronizar", corpo);
  const resposta = monotonico();
  if (!r.ok) return { ok: false, erro: r.error || `HTTP ${r.status}`, codigo: r.code || null, semRede: r.status === 0, status: r.status };
  // Referência só com leitura monotônica válida e sem reboot no meio.
  if (envio.bootId === resposta.bootId && Number.isFinite(envio.ms) && Number.isFinite(resposta.ms)) {
    await armazem.salvarReferenciaHora(novaReferencia({
      servidorMs: r.servidorMs, monotonicoEnvioMs: envio.ms, monotonicoRespostaMs: resposta.ms, bootId: resposta.bootId, tempo: r.tempo || null,
    }));
  }
  await armazem.salvarCadastro({
    obra: r.obra, dispositivo: r.dispositivo, estabelecimento: r.estabelecimento || null,
    funcionarios: r.funcionarios || [], terceirizados: r.terceirizados || [],
    biometrias: r.biometrias || [], responsaveis: r.responsaveis || [], sincronizadoEm: new Date(r.servidorMs).toISOString(),
    tempo: r.tempo || null,
  });
  const local = await armazem.ultimoEventoGlobal();
  const noServidor = Number(r.cadeiaLocal?.ultimaSequencia || 0);
  return { ok: true, cadeiaDivergente: noServidor > Number(local.localSequence || 0), estabelecimento: r.estabelecimento || null };
}

// Uma rodada completa (o App chama a cada minuto e depois de cada batida):
// cadastro/hora quando pedido ou vencido → eventos → fotos. Nunca lança por
// falha de rede/servidor: devolve o resumo para a tela e o diagnóstico.
// Exceção inesperada (ex.: banco) sobe para quem chamou registrar no estado.
export async function rodadaDeSincronizacao({ armazem, api, monotonico, corpo, cadastroVencido, lerFotoBase64, aposEnviarFoto }) {
  const resumo = { online: true, cadastroAtualizado: false, revogado: false, desconhecido: false, erro: null, envio: null, fotos: null, cadeiaDivergente: false };
  if (cadastroVencido) {
    const s = await sincronizarCadastro({ armazem, api, monotonico, corpo });
    if (s.codigo === "APARELHO_REVOGADO") return { ...resumo, online: true, revogado: true, erro: s.erro };
    if (s.codigo === "APARELHO_DESCONHECIDO" || s.codigo === "APARELHO_SEM_TOKEN") return { ...resumo, online: true, desconhecido: true, erro: s.erro };
    if (!s.ok) { resumo.online = !s.semRede; resumo.erro = s.erro; resumo.status = s.status; }
    resumo.cadastroAtualizado = s.ok;
    resumo.cadeiaDivergente = !!s.cadeiaDivergente;
  }
  const envio = await enviarPendentes({ armazem, api });
  resumo.envio = envio;
  if (envio.codigo === "APARELHO_REVOGADO") return { ...resumo, revogado: true, erro: envio.erro };
  if (envio.codigo === "APARELHO_DESCONHECIDO") return { ...resumo, desconhecido: true, erro: envio.erro };
  if (envio.semRede) resumo.online = false;
  if (envio.erro && !resumo.erro) { resumo.erro = envio.erro; resumo.status = envio.status; }
  resumo.aguardandoEstabelecimento = !!envio.aguardandoEstabelecimento;
  if (resumo.online) resumo.fotos = await enviarFotos({ armazem, api, lerFotoBase64, aposEnviar: aposEnviarFoto });
  return resumo;
}
