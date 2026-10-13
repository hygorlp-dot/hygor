// Prazo para chamadas nativas que podem nunca responder.
//
// Por quê: no expo-camera 57, takePictureAsync antes de a câmera terminar de
// ligar (imageCaptureUseCase ainda nulo) devolve uma promessa que nunca
// resolve nem rejeita. Sem prazo, a tela ficava em "Aguarde" para sempre e o
// quiosque travava - inclusive o caminho do encarregado. Com prazo, a falha
// cai no tratamento normal ("A câmera não respondeu" + registrar com o
// encarregado): a marcação nunca fica impedida.
export const PRAZO_CAPTURA_MS = 8000;
export const PRAZO_CAMERA_LIGAR_MS = 10_000;

export function comPrazo(promessa, ms, mensagem = "sem resposta no prazo") {
  let timer;
  const estouro = new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error(mensagem)), ms); });
  return Promise.race([Promise.resolve(promessa), estouro]).finally(() => clearTimeout(timer));
}
