// Contrato da foto do ponto entre o app (apps/ponto-obra) e o servidor
// (server/ponto-eletronico/handler.js). Puro: usado pelos dois lados para o
// limite nunca divergir - o app não manda foto que o servidor recusaria.

// Limite do servidor para a foto decodificada (JPEG), em bytes.
export const LIMITE_FOTO_BYTES = 1_500_000;

// JPEG começa com FF D8.
export const ehJpeg = bytes => !!bytes && bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;

// Tamanho em bytes do conteúdo de um base64 (sem decodificar).
export function bytesDoBase64(base64) {
  const limpo = String(base64 || "").replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!limpo) return 0;
  const preenchimento = limpo.endsWith("==") ? 2 : limpo.endsWith("=") ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - preenchimento;
}
