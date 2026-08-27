// Espelha sinapi-import.js: lê os 5 TXT do ORSE em um Web Worker (os
// arquivos somados passam de 20MB - não dá para bloquear a tela) e
// devolve {itens, insumos, componentes, dataBase} pronto para o mesmo
// pipeline de /api/references que o SINAPI já usa.
const DEFAULT_INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

// Carregado por import() dinâmico (ver lerOrseEmSegundoPlano em
// BasesPrecoAdmin.jsx) - mesma técnica já usada para o SINAPI
// (lerSinapiEmSegundoPlano, LegacyApp.jsx): manter o import estático do
// chamador longe deste módulo é o que faz o bundler (Rolldown) reconhecer
// o `new Worker(new URL(...))` abaixo como um chunk de worker separado -
// import direto no topo do arquivo deixava o parser inteiro (e o próprio
// Worker) embutido no bundle principal, sem nenhum arquivo de worker
// publicado para o navegador buscar.
export function readOrseInWorker(
  arquivos, // { insumo, insumoPreco, servico, servicoPreco, composicao } - cada um um File/Blob
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
  const chaves = ["insumo", "insumoPreco", "servico", "servicoPreco", "composicao"];
  const faltando = chaves.filter(chave => !arquivos?.[chave]);
  if (faltando.length) {
    throw new Error(`Faltam arquivos do ORSE: ${faltando.join(", ")}.`);
  }

  return Promise.all(chaves.map(chave => arquivos[chave].arrayBuffer())).then(buffers => new Promise((resolve, reject) => {
    // O padrão `new Worker(new URL(caminho, import.meta.url))` PRECISA
    // aparecer assim, literal, para o bundler (Vite/Rolldown) reconhecer e
    // empacotar de verdade orse-parser.worker.js como um chunk de worker
    // publicável, resolvendo o import relativo dele para orse-parser.js.
    // Passar a URL por uma variável/parâmetro (como antes) faz o bundler
    // tratar o arquivo como um asset qualquer - copiado sem o import
    // interno resolvido, e o worker falha ao instanciar em produção
    // (raiz do "não lê as tabelas" achado ao vivo). "workerUrl" nas
    // opções ainda existe só para os testes conseguirem mockar.
    const worker = "workerUrl" in options
      ? new WorkerClass(options.workerUrl, { type: "module" })
      : new Worker(new URL("../../workers/orse-parser.worker.js", import.meta.url), { type: "module" });
    let timeoutId;

    const stop = () => {
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
    };
    const renewTimeout = () => {
      globalThis.clearTimeout(timeoutId);
      timeoutId = globalThis.setTimeout(() => {
        stop();
        reject(new Error("A leitura dos arquivos do ORSE ficou 2 minutos sem avançar. Confirme se os arquivos oficiais estão íntegros e tente novamente."));
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
      else reject(new Error(data?.mensagem || "Não foi possível interpretar os arquivos do ORSE."));
    };
    worker.onerror = event => {
      stop();
      reject(new Error(event.message || "Falha no processamento em segundo plano dos arquivos do ORSE."));
    };
    const payload = Object.fromEntries(chaves.map((chave, index) => [chave, buffers[index]]));
    worker.postMessage(payload, buffers);
  }));
}
