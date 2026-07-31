const DEFAULT_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

export function readSinapiInWorker(
  file,
  uf,
  onProgress = () => {},
  {
    WorkerClass = globalThis.Worker,
    workerUrl = new URL("../../workers/sinapi-parser.worker.js", import.meta.url),
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  } = {},
) {
  if (typeof WorkerClass === "undefined") {
    throw new Error("Seu navegador não suporta a leitura segura de planilhas em segundo plano.");
  }

  return file.arrayBuffer().then(bytes => new Promise((resolve, reject) => {
    const worker = new WorkerClass(workerUrl, { type: "module" });
    let timeoutId;

    const stop = () => {
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
    };
    const renewTimeout = () => {
      globalThis.clearTimeout(timeoutId);
      timeoutId = globalThis.setTimeout(() => {
        stop();
        reject(new Error("A leitura do XLSX ficou 2 minutos sem avançar. Confirme se o arquivo oficial está íntegro e tente novamente."));
      }, inactivityTimeoutMs);
    };

    renewTimeout();
    worker.onmessage = ({ data }) => {
      if (data?.tipo === "etapa") {
        renewTimeout();
        onProgress(data.mensagem, data.progresso);
        return;
      }
      stop();
      if (data?.tipo === "concluido") resolve(data.extraida);
      else reject(new Error(data?.mensagem || "Não foi possível interpretar o XLSX oficial."));
    };
    worker.onerror = event => {
      stop();
      reject(new Error(event.message || "Falha no processamento em segundo plano do XLSX."));
    };
    worker.postMessage({ bytes, uf }, [bytes]);
  }));
}

