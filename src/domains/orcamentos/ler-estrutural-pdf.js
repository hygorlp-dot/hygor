// Lê um PDF de projeto (estrutural, por enquanto) em um Web Worker e
// devolve o texto extraído puro - quem interpreta esse texto em sapatas,
// vigas etc. é o módulo de extração correspondente (ex.:
// estrutural-pdf-extrator.js), mantido separado e sem Worker para ficar
// testável com uma string comum.
const DEFAULT_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

export function lerPdfEmWorker(arquivo, onProgress = () => {}, options = {}) {
  const {
    WorkerClass = globalThis.Worker,
    inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT_MS,
  } = options;
  if (typeof WorkerClass === "undefined") {
    throw new Error("Seu navegador não suporta a leitura segura de PDF em segundo plano.");
  }

  return arquivo.arrayBuffer().then(bytes => new Promise((resolve, reject) => {
    // Mesma exigência do bundler já documentada em sinapi-import.js/
    // orse-import.js: o `new Worker(new URL(...))` precisa aparecer literal
    // aqui para o Vite/Rolldown empacotar de verdade o worker.
    const worker = "workerUrl" in options
      ? new WorkerClass(options.workerUrl, { type: "module" })
      : new Worker(new URL("../../workers/estrutural-pdf.worker.js", import.meta.url), { type: "module" });
    let timeoutId;

    const stop = () => {
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
    };
    const renewTimeout = () => {
      globalThis.clearTimeout(timeoutId);
      timeoutId = globalThis.setTimeout(() => {
        stop();
        reject(new Error("A leitura do PDF ficou 2 minutos sem avançar. Confirme se o arquivo está íntegro e tente novamente."));
      }, inactivityTimeoutMs);
    };

    renewTimeout();
    worker.onmessage = ({ data }) => {
      stop();
      if (data?.tipo === "concluido") resolve(data.texto);
      else reject(new Error(data?.mensagem || "Não foi possível interpretar o PDF."));
      onProgress?.(); // sem etapas intermediárias hoje - reservado para PDFs de muitas páginas
    };
    worker.onerror = event => {
      stop();
      reject(new Error(event.message || "Falha no processamento em segundo plano do PDF."));
    };
    worker.postMessage({ bytes }, [bytes]);
  }));
}
