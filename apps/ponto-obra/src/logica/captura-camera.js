export const FOTO_ESPERA_MAX_MS = 8_000;

// Limita somente a espera da foto, não o registro da batida. O chamador
// decide a alternativa autorizada quando não há foto. Respostas tardias não
// podem reaproveitar uma imagem de uma tentativa que já terminou.
export function capturarFotoComPrazo(camera, opcoes, descartar) {
  if (!camera?.takePictureAsync) return Promise.reject(new Error('câmera não está pronta'));
  return new Promise((resolve, reject) => {
    let terminou = false;
    const timer = setTimeout(() => { terminou = true; reject(new Error('a câmera não respondeu a tempo')); }, FOTO_ESPERA_MAX_MS);
    Promise.resolve().then(() => camera.takePictureAsync(opcoes)).then(foto => {
      if (terminou) { if (foto?.uri) descartar?.(foto.uri); return; }
      terminou = true; clearTimeout(timer); resolve(foto);
    }, erro => { if (!terminou) { terminou = true; clearTimeout(timer); reject(erro); } });
  });
}
