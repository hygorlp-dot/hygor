// FORMATO 1 - LEGADO. Modelo atual: evento.js (sequência local) +
// registro-fiscal.js (NSR fiscal por estabelecimento, atribuído pela ARP).
// Aqui o campo "nsr" é a SEQUÊNCIA DO APARELHO (legacyDeviceSequence), não o
// NSR fiscal - código novo deve ler por sequenciaLegadaDoAparelho().
//
// Marcação de ponto do app "Ponto de Obra" (REP-P, Portaria MTP 671/2021).
//
// Módulo puro, compartilhado pelo servidor (api/data.js → server/ponto-
// eletronico) e pelo app Android (apps/ponto-obra). Nada aqui depende de
// Node, do navegador ou do React Native: o hash é injetado por quem chama
// (crypto do Node no servidor, expo-crypto no aparelho).
//
// Regras que este módulo materializa:
// - toda marcação tem NSR (número sequencial de registro) por aparelho,
//   começando em 1 e sem buracos;
// - cada marcação carrega o hash da anterior do mesmo aparelho (encadeamento):
//   apagar ou alterar qualquer uma quebra a cadeia, e o servidor recusa;
// - marcação nunca é editada nem apagada - correção é anotação separada
//   (fase 2), preservando a original.

export const METODOS_IDENTIFICACAO = Object.freeze(["facial", "encarregado"]);

// legacyDeviceSequence: o "nsr" de um registro formato 1. Era a numeração do
// aparelho e continua sendo SÓ isso - nunca usar como NSR fiscal (que é por
// estabelecimento e só existe depois da ARP).
export const sequenciaLegadaDoAparelho = m => Number(m?.nsr);
export const TIPOS_REGISTRO = Object.freeze(["ponto", "acesso_terceiro"]);
export const HASH_INICIAL = "0".repeat(64);

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const texto = valor => String(valor ?? "").trim();
const numeroOuNulo = valor => (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor)) ? null : Number(valor));

// Campos que entram no hash, em ordem fixa. Qualquer mudança aqui é mudança
// de versão do formato (VERSAO_CANONICA) - marcações antigas continuam
// verificáveis pela versão gravada nelas.
export const VERSAO_CANONICA = 1;
export function canonicalizarMarcacao(m) {
  const gps = m?.gps || null;
  return [
    `v${VERSAO_CANONICA}`,
    texto(m?.id).toLowerCase(),
    texto(m?.dispositivoId).toLowerCase(),
    String(Number(m?.nsr)),
    texto(m?.tipoRegistro || "ponto"),
    texto(m?.employeeId),
    texto(m?.terceiroId),
    texto(m?.cpf).replace(/\D/g, ""),
    texto(m?.marcadoEm),
    texto(m?.relogioAparelho),
    m?.horaConfiavel ? "1" : "0",
    texto(m?.metodo),
    numeroOuNulo(m?.confianca) === null ? "" : Number(m.confianca).toFixed(4),
    texto(m?.encarregadoId),
    gps ? [gps.lat, gps.lng, gps.precisao].map(v => (numeroOuNulo(v) === null ? "" : Number(v).toFixed(6))).join(",") : "",
    texto(m?.fotoSha256).toLowerCase(),
    texto(m?.hashAnterior).toLowerCase(),
  ].join("|");
}

// hashFn: (texto) => hex sha-256 (sync ou async).
export async function calcularHashMarcacao(marcacao, hashFn) {
  return String(await hashFn(canonicalizarMarcacao(marcacao))).toLowerCase();
}

// GPS que pode entrar numa marcação: só {lat, lng, precisao} dentro do
// intervalo que validarMarcacao aceita; qualquer outra coisa vira null. O
// aparelho passa o GPS por aqui antes de registrar - GPS estranho nunca pode
// fazer a batida ser recusada (a Portaria veda restringir a marcação).
export function gpsParaMarcacao(gps) {
  if (!gps || typeof gps !== "object") return null;
  const lat = numeroOuNulo(gps.lat), lng = numeroOuNulo(gps.lng), precisao = numeroOuNulo(gps.precisao);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, precisao: precisao !== null && precisao >= 0 ? precisao : null };
}

// Valida a forma de uma marcação recebida do aparelho. Não confere hash nem
// sequência (isso depende do histórico - ver verificarCadeia).
export function validarMarcacao(m) {
  const erros = [];
  if (!UUID.test(texto(m?.id))) erros.push("id deve ser um UUID gerado no aparelho");
  if (!UUID.test(texto(m?.dispositivoId))) erros.push("dispositivoId inválido");
  if (!Number.isInteger(Number(m?.nsr)) || Number(m?.nsr) < 1) erros.push("nsr deve ser inteiro a partir de 1");
  const tipo = texto(m?.tipoRegistro || "ponto");
  if (!TIPOS_REGISTRO.includes(tipo)) erros.push("tipoRegistro inválido");
  if (tipo === "ponto" && !texto(m?.employeeId)) erros.push("marcação de ponto sem funcionário");
  if (tipo === "acesso_terceiro" && !texto(m?.terceiroId)) erros.push("acesso de terceiro sem terceirizado");
  if (!ISO_UTC.test(texto(m?.marcadoEm))) erros.push("marcadoEm deve ser data/hora UTC ISO-8601");
  if (m?.relogioAparelho && !ISO_UTC.test(texto(m.relogioAparelho))) erros.push("relogioAparelho deve ser data/hora UTC ISO-8601");
  if (!METODOS_IDENTIFICACAO.includes(texto(m?.metodo))) erros.push("metodo de identificação inválido");
  if (texto(m?.metodo) === "encarregado" && !texto(m?.encarregadoId)) erros.push("identificação por encarregado sem o encarregado");
  const confianca = numeroOuNulo(m?.confianca);
  if (confianca !== null && (confianca < 0 || confianca > 1)) erros.push("confianca deve estar entre 0 e 1");
  if (m?.gps) {
    const { lat, lng, precisao } = m.gps;
    if (!(Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180)) erros.push("gps fora do intervalo");
    if (precisao !== undefined && precisao !== null && !(Number(precisao) >= 0)) erros.push("precisão do gps inválida");
  }
  if (!/^[0-9a-f]{64}$/i.test(texto(m?.hashAnterior))) erros.push("hashAnterior ausente");
  if (!/^[0-9a-f]{64}$/i.test(texto(m?.hash))) erros.push("hash ausente");
  if (m?.fotoSha256 && !/^[0-9a-f]{64}$/i.test(texto(m.fotoSha256))) erros.push("fotoSha256 inválido");
  return { ok: erros.length === 0, erros };
}

// Confere uma sequência de marcações de UM aparelho, continuando de `ultima`
// (a última já aceita: {nsr, hash}, ou null se o aparelho nunca enviou).
// Devolve as aceitáveis em ordem e o primeiro problema encontrado - a cadeia
// para no primeiro erro, porque tudo depois dele dependeria de um elo inválido.
export async function verificarCadeia(marcacoes, ultima, hashFn) {
  const ordenadas = [...(marcacoes || [])].sort((a, b) => Number(a.nsr) - Number(b.nsr));
  let esperadoNsr = (Number(ultima?.nsr) || 0) + 1;
  let hashAnterior = texto(ultima?.hash) || HASH_INICIAL;
  const aceitas = [];
  for (const m of ordenadas) {
    if (Number(m.nsr) < esperadoNsr) continue; // reenvio de algo já aceito: idempotente
    if (Number(m.nsr) !== esperadoNsr) return { aceitas, erro: `NSR ${m.nsr} chegou antes do ${esperadoNsr} - lacuna na sequência`, nsrComErro: Number(m.nsr) };
    if (texto(m.hashAnterior).toLowerCase() !== hashAnterior) return { aceitas, erro: `NSR ${m.nsr} não aponta para a marcação anterior (cadeia quebrada)`, nsrComErro: Number(m.nsr) };
    const recalculado = await calcularHashMarcacao(m, hashFn);
    if (recalculado !== texto(m.hash).toLowerCase()) return { aceitas, erro: `NSR ${m.nsr} foi alterada depois de registrada (hash não confere)`, nsrComErro: Number(m.nsr) };
    aceitas.push(m);
    esperadoNsr += 1;
    hashAnterior = recalculado;
  }
  return { aceitas, erro: null, nsrComErro: null };
}
