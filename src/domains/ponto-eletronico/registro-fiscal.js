// REGISTRO FISCAL da ARP (Armazenamento de Registro de Ponto). Puro.
//
// Quando a ARP aceita um evento local de PONTO (evento.js), ela atribui:
// - nsr: Número Sequencial de Registro oficial, POR ESTABELECIMENTO, 1, 2, 3...
//   sem lacuna e sem repetição, dentro de uma transação do banco
//   (função ponto_arp_registrar, migration 017);
// - gravadoEm: data/hora de gravação na ARP (fonte de hora oficial do
//   servidor, server/ponto-eletronico/tempo/);
// - fiscalHash: SHA-256 deste texto canônico, encadeado ao fiscalHash do NSR
//   anterior do MESMO estabelecimento.
//
// O hash LOCAL (do aparelho) prova que o evento não mudou desde a batida; o
// hash FISCAL prova que a sequência de NSR do estabelecimento não mudou desde
// a gravação. São conceitos separados e os dois ficam guardados.
//
// IMPORTANTE: este texto é calculado também em SQL (migration 017, função
// ponto_arp_texto_fiscal). Os dois têm de bater - há teste comparando.
// Não é o hash do AFD (Fase 2): o leiaute do AFD terá cálculo próprio.

export const VERSAO_HASH_FISCAL = 1;
export const HASH_FISCAL_INICIAL = "0".repeat(64);

const texto = v => String(v ?? "").trim();

export function canonicalizarRegistroFiscal(r) {
  return [
    `fiscal-v${VERSAO_HASH_FISCAL}`,
    texto(r?.estabelecimentoId).toLowerCase(),
    String(Number(r?.nsr)),
    texto(r?.eventId).toLowerCase(),
    texto(r?.tipoRegistro || "ponto"),
    texto(r?.cpf).replace(/\D/g, ""),
    texto(r?.employeeId),
    texto(r?.marcadoEm),
    texto(r?.gravadoEm),
    texto(r?.deviceId).toLowerCase(),
    String(Number(r?.localSequence)),
    texto(r?.localHash).toLowerCase(),
    texto(r?.fiscalPreviousHash).toLowerCase(),
  ].join("|");
}

export async function calcularHashFiscal(registro, hashFn) {
  return String(await hashFn(canonicalizarRegistroFiscal(registro))).toLowerCase();
}

// Confere a cadeia fiscal de UM estabelecimento (NSR 1..n, sem lacuna, cada
// registro apontando para o anterior). Base para a exportação futura (AFD).
export async function verificarCadeiaFiscal(registros, hashFn) {
  const ordenados = [...(registros || [])].sort((a, b) => Number(a.nsr) - Number(b.nsr));
  let anterior = HASH_FISCAL_INICIAL;
  for (let i = 0; i < ordenados.length; i++) {
    const r = ordenados[i];
    if (Number(r.nsr) !== i + 1) return { ok: false, erro: `NSR ${r.nsr} fora de ordem (esperado ${i + 1})` };
    if (texto(r.fiscalPreviousHash).toLowerCase() !== anterior) return { ok: false, erro: `NSR ${r.nsr} não aponta para o registro anterior` };
    const calculado = await calcularHashFiscal(r, hashFn);
    if (calculado !== texto(r.fiscalHash).toLowerCase()) return { ok: false, erro: `NSR ${r.nsr} alterado depois de gravado` };
    anterior = calculado;
  }
  return { ok: true, erro: null };
}
