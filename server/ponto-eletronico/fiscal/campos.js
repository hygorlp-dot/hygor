import { createHash } from "node:crypto";
import { cpfValido, cnpjValido } from "../../../src/domains/ponto-eletronico/estabelecimento.js";

export const sha256 = value => createHash("sha256").update(value).digest("hex");
export class ErroFiscal extends Error {
  constructor(codigo, campo) { super(codigo + (campo ? ": " + campo : "")); this.codigo = codigo; this.campo = campo; }
}
export function exigir(ok, codigo, campo) { if (!ok) throw new ErroFiscal(codigo, campo); }
export function texto(value, max, campo, opcional = false) {
  exigir(typeof value === "string", "TEXTO_AUSENTE", campo);
  exigir((opcional || value.trim().length > 0) && value.length <= max, "TAMANHO_INVALIDO", campo);
  // Não normalizar, truncar ou substituir caracteres silenciosamente.
  exigir(!/[\x00-\x1f\x7f-\x9f|]/.test(value) && [...value].every(c => c.charCodeAt(0) <= 255), "CARACTERE_INVALIDO", campo);
  return value;
}
export function numero(value, max, campo, min = 0) {
  exigir((typeof value === "number" || typeof value === "string") && /^\d+$/.test(String(value)), "NUMERO_INVALIDO", campo);
  exigir(Number.isSafeInteger(Number(value)) && Number(value) >= min && String(value).length <= max, "NUMERO_FORA_DO_LIMITE", campo);
  return String(value);
}
// O leiaute determina início à esquerda e espaços nas posições não utilizadas.
export const fixo = (value, tamanho, campo, opcional = false) => texto(String(value ?? ""), tamanho, campo, opcional).padEnd(tamanho, " ");
export function cpf(value, campo = "cpf") {
  exigir(typeof value === "string" && /^\d{11}$/.test(value) && cpfValido(value), "CPF_INVALIDO", campo);
  return value;
}
export function identificacao(value, campo = "identificacao") {
  exigir(value && ["cnpj", "cpf"].includes(value.tipo), "TIPO_INSCRICAO_INVALIDO", campo);
  exigir(typeof value.numero === "string" && (value.tipo === "cnpj"
    ? /^\d{14}$/.test(value.numero) && cnpjValido(value.numero) : /^\d{11}$/.test(value.numero) && cpfValido(value.numero)), "INSCRICAO_INVALIDA", campo);
  return [value.tipo === "cnpj" ? "1" : "2", value.numero];
}
export function data(value, campo = "data") {
  exigir(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "DATA_INVALIDA", campo);
  const ms = Date.parse(value + "T00:00:00Z");
  exigir(Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value, "DATA_INVALIDA", campo);
  return value;
}
export function periodo(de, ate) {
  data(de, "de"); data(ate, "ate"); exigir(de <= ate, "PERIODO_INVERTIDO");
}
export function instante(value, campo = "instante") {
  exigir(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)), "INSTANTE_INVALIDO", campo);
  data(value.slice(0, 10), campo);
  exigir(Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60, "INSTANTE_INVALIDO", campo);
  return value;
}
export function dh(value, timezone) {
  instante(value); exigir(typeof timezone === "string" && timezone.length > 0, "FUSO_AUSENTE");
  let parts;
  try { parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(p => [p.type, p.value])); }
  catch { throw new ErroFiscal("FUSO_INVALIDO"); }
  const ms = Date.parse(value);
  const offset = Math.round((Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - Math.floor(ms / 1000) * 1000) / 60000);
  const zone = (offset < 0 ? "-" : "+") + String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0") + String(Math.abs(offset) % 60).padStart(2, "0");
  return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute + ":00" + zone;
}
export function hora(value, campo = "hora") {
  exigir(typeof value === "string" && /^(?:[01]\d|2[0-3])[0-5]\d$/.test(value), "HORA_INVALIDA", campo); return value;
}
export function validarDh(value) {
  exigir(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:00[+-](?:0\d|1[0-4])[0-5]\d$/.test(value), "DH_INVALIDO");
  data(value.slice(0, 10));
  instante(value.slice(0, 22) + ":" + value.slice(22));
  return value;
}
export function inpi(value) {
  // Recebe o identificador numérico canônico do leiaute, sem criar número.
  exigir(typeof value === "string" && /^\d{1,17}$/.test(value) && !/^0+$/.test(value), "INPI_AUSENTE_OU_INVALIDO");
  return value;
}
export function arquivoLinhas(lines) {
  exigir(lines.every(l => l.length > 0 && !/[\r\n]/.test(l)), "LINHA_INVALIDA");
  return Buffer.from(lines.join("\r\n") + "\r\n", "latin1");
}
export function crc16Kermit(value) {
  let crc = 0;
  for (const byte of Buffer.from(value, "latin1")) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export const ASSINATURA_EXTERNA = "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S".padEnd(100, " ");
export function pacoteNaoAssinado(nome, bytes, extra = {}) {
  return { nome, bytes, sha256: sha256(bytes), status: "rascunho_nao_assinado", assinatura: { padrao: "CAdES detached", arquivoEsperado: nome + ".p7s", verificada: false }, ...extra };
}
