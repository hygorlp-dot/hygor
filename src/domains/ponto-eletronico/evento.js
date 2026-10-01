// EVENTO LOCAL (formato 2) - o que o aparelho cria no instante da batida,
// com ou sem internet. Puro, compartilhado por app e servidor.
//
// Separação central do modelo REP-P (docs/REP-P-ARQUITETURA.md):
// - localSequence: sequência POR APARELHO (1, 2, 3...), criada offline;
//   protege a integridade e a ordem dos eventos do aparelho;
// - localPreviousHash/localHash: cadeia de hash POR APARELHO sobre o evento;
// - NSR: NÃO existe no evento. O NSR fiscal é atribuído pela ARP no servidor,
//   por ESTABELECIMENTO, quando o evento chega (registro-fiscal.js).
//
// Nada aqui muda depois de criado: a sincronização devolve NSR e hash fiscal,
// que o aparelho guarda AO LADO do evento, sem tocar nos campos materiais.
// O formato 1 (marcacao.js, "nsr" por aparelho) é LEGADO.
import { HASH_INICIAL, METODOS_IDENTIFICACAO, TIPOS_REGISTRO } from "./marcacao.js";

export const FORMATO_EVENTO = 2;
export { HASH_INICIAL };

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;
const texto = v => String(v ?? "").trim();
const numeroOuNulo = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const inteiroOuVazio = v => (numeroOuNulo(v) === null ? "" : String(Math.round(Number(v))));

// Campos materiais, em ordem fixa. Mudar a lista = novo formato.
export function canonicalizarEvento(e) {
  const gps = e?.gps || null;
  return [
    `evento-v${FORMATO_EVENTO}`,
    texto(e?.eventId).toLowerCase(),
    texto(e?.deviceId).toLowerCase(),
    texto(e?.estabelecimentoId).toLowerCase(),
    String(Number(e?.localSequence)),
    texto(e?.tipoRegistro || "ponto"),
    texto(e?.employeeId),
    texto(e?.terceiroId),
    texto(e?.cpf).replace(/\D/g, ""),
    texto(e?.marcadoEm),
    texto(e?.relogioAparelho),
    e?.horaConfiavel ? "1" : "0",
    e?.relogioAlterado ? "1" : "0",
    inteiroOuVazio(e?.divergenciaMs),
    texto(e?.fonteHora),
    inteiroOuVazio(e?.idadeReferenciaMs),
    texto(e?.metodo),
    numeroOuNulo(e?.confianca) === null ? "" : Number(e.confianca).toFixed(4),
    texto(e?.encarregadoId),
    gps ? [gps.lat, gps.lng, gps.precisao].map(v => (numeroOuNulo(v) === null ? "" : Number(v).toFixed(6))).join(",") : "",
    texto(e?.fotoSha256).toLowerCase(),
    texto(e?.localPreviousHash).toLowerCase(),
  ].join("|");
}

export async function calcularHashLocal(evento, hashFn) {
  return String(await hashFn(canonicalizarEvento(evento))).toLowerCase();
}

export const ehEventoV2 = e => Number(e?.formatVersion) === FORMATO_EVENTO;

export function validarEvento(e) {
  const erros = [];
  if (!ehEventoV2(e)) erros.push(`formatVersion deve ser ${FORMATO_EVENTO}`);
  if (e && "nsr" in e) erros.push("evento local não tem NSR (o NSR fiscal é atribuído pela ARP)");
  if (!UUID.test(texto(e?.eventId))) erros.push("eventId deve ser um UUID gerado no aparelho");
  if (!UUID.test(texto(e?.deviceId))) erros.push("deviceId inválido");
  if (texto(e?.estabelecimentoId) && !UUID.test(texto(e.estabelecimentoId))) erros.push("estabelecimentoId inválido");
  if (!Number.isInteger(Number(e?.localSequence)) || Number(e?.localSequence) < 1) erros.push("localSequence deve ser inteiro a partir de 1");
  const tipo = texto(e?.tipoRegistro || "ponto");
  if (!TIPOS_REGISTRO.includes(tipo)) erros.push("tipoRegistro inválido");
  if (tipo === "ponto" && !texto(e?.employeeId)) erros.push("marcação de ponto sem funcionário");
  if (tipo === "acesso_terceiro" && !texto(e?.terceiroId)) erros.push("acesso de terceiro sem terceirizado");
  if (!ISO_UTC.test(texto(e?.marcadoEm))) erros.push("marcadoEm deve ser data/hora UTC ISO-8601");
  if (e?.relogioAparelho && !ISO_UTC.test(texto(e.relogioAparelho))) erros.push("relogioAparelho deve ser data/hora UTC ISO-8601");
  if (!METODOS_IDENTIFICACAO.includes(texto(e?.metodo))) erros.push("metodo de identificação inválido");
  if (texto(e?.metodo) === "encarregado" && !texto(e?.encarregadoId)) erros.push("identificação por encarregado sem o encarregado");
  const confianca = numeroOuNulo(e?.confianca);
  if (confianca !== null && (confianca < 0 || confianca > 1)) erros.push("confianca deve estar entre 0 e 1");
  if (e?.gps) {
    const { lat, lng, precisao } = e.gps;
    if (!(Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180)) erros.push("gps fora do intervalo");
    if (precisao !== undefined && precisao !== null && !(Number(precisao) >= 0)) erros.push("precisão do gps inválida");
  }
  if (!HEX64.test(texto(e?.localPreviousHash))) erros.push("localPreviousHash ausente");
  if (!HEX64.test(texto(e?.localHash))) erros.push("localHash ausente");
  if (e?.fotoSha256 && !HEX64.test(texto(e.fotoSha256))) erros.push("fotoSha256 inválido");
  return { ok: erros.length === 0, erros };
}

// Confere a cadeia LOCAL de um aparelho a partir do último evento já aceito
// ({ localSequence, localHash } ou null). Reenvio do que já foi aceito é
// ignorado aqui (a ARP trata a idempotência por eventId).
export async function verificarCadeiaLocal(eventos, ultimo, hashFn) {
  const ordenados = [...(eventos || [])].sort((a, b) => Number(a.localSequence) - Number(b.localSequence));
  let esperado = (Number(ultimo?.localSequence) || 0) + 1;
  let anterior = texto(ultimo?.localHash).toLowerCase() || HASH_INICIAL;
  const aceitos = [];
  for (const e of ordenados) {
    if (Number(e.localSequence) < esperado) continue;
    if (Number(e.localSequence) !== esperado) return { aceitos, erro: `sequência local ${e.localSequence} chegou antes da ${esperado}`, eventoComErro: e.eventId };
    if (texto(e.localPreviousHash).toLowerCase() !== anterior) return { aceitos, erro: `sequência local ${e.localSequence} não aponta para o evento anterior`, eventoComErro: e.eventId };
    const recalculado = await calcularHashLocal(e, hashFn);
    if (recalculado !== texto(e.localHash).toLowerCase()) return { aceitos, erro: `evento ${e.localSequence} alterado depois de criado (hash local não confere)`, eventoComErro: e.eventId };
    aceitos.push(e);
    esperado += 1;
    anterior = recalculado;
  }
  return { aceitos, erro: null, eventoComErro: null };
}
