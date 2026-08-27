const DEFAULT_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

export function readSinapiInWorker(
  file,
  uf,
  onProgress = () => {},
  options = {},
) {
  const {
    WorkerClass = globalThis.Worker,
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  } = options;
  if (typeof WorkerClass === "undefined") {
    throw new Error("Seu navegador não suporta a leitura segura de planilhas em segundo plano.");
  }

  return file.arrayBuffer().then(bytes => new Promise((resolve, reject) => {
    // O padrão `new Worker(new URL(caminho, import.meta.url))` precisa
    // aparecer assim, literal, para o bundler reconhecer e empacotar de
    // verdade sinapi-parser.worker.js, resolvendo o import relativo dele
    // para xlsx-selective-reader.js. Passar a URL por variável/parâmetro
    // (como antes) faz o bundler tratar o arquivo como asset comum -
    // copiado sem o import interno resolvido, falhando ao instanciar em
    // produção. Achado ao investigar o mesmo bug no motor do ORSE -
    // provavelmente afetava o SINAPI também (não confirmado se uma
    // importação real chegou a falhar por causa disso). "workerUrl" nas
    // opções ainda existe só para os testes conseguirem mockar.
    const worker = "workerUrl" in options
      ? new WorkerClass(options.workerUrl, { type: "module" })
      : new Worker(new URL("../../workers/sinapi-parser.worker.js", import.meta.url), { type: "module" });
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

