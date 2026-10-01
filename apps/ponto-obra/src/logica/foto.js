// Foto da batida dentro do contrato do servidor (JPEG, até LIMITE_FOTO_BYTES).
// Puro: quem gera o JPEG (expo-image-manipulator) é injetado.
//
// Começa com qualidade boa para auditoria e só reduz se o arquivo passar do
// limite. O SHA-256 que vai na batida é calculado depois, sobre os bytes
// EXATOS do arquivo escolhido - o mesmo arquivo que será enviado.
import { LIMITE_FOTO_BYTES, ehJpeg } from "../../../../src/domains/ponto-eletronico/foto.js";

export const ESCADA_FOTO = Object.freeze([
  { largura: 720, qualidade: 0.8 },
  { largura: 720, qualidade: 0.65 },
  { largura: 600, qualidade: 0.6 },
  { largura: 480, qualidade: 0.55 },
  { largura: 400, qualidade: 0.5 },
  { largura: 320, qualidade: 0.45 },
]);

export class FotoForaDoLimite extends Error {
  constructor() { super("A foto não ficou dentro do limite do servidor."); this.codigo = "FOTO_ACIMA_DO_LIMITE"; }
}

// gerar({ largura, qualidade }) -> { bytes: Uint8Array, ... } (um JPEG).
// descartar(gerada) apaga a tentativa que não serviu.
export async function fotoDentroDoLimite({ gerar, descartar = async () => {}, limiteBytes = LIMITE_FOTO_BYTES, escada = ESCADA_FOTO }) {
  for (let i = 0; i < escada.length; i++) {
    const gerada = await gerar(escada[i]);
    if (ehJpeg(gerada?.bytes) && gerada.bytes.length <= limiteBytes) return { ...gerada, passo: escada[i], tentativas: i + 1 };
    await descartar(gerada);
  }
  throw new FotoForaDoLimite();
}
