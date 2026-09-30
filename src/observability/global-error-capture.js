import { buildLocalErrorDiagnostic } from "./local-error-diagnostic";

// O ErrorBoundary só vê erro de renderização. Erro em clique, em janela de
// exportação ou numa promessa sem catch (gravação, API) passava sem deixar
// rastro - o usuário via "nada acontece" e ninguém sabia. Aqui esses erros vão
// para o mesmo relatório (/api/data client-error, código ARCD-XXXX,
// mascaramento no servidor em server/client-error-report.js).

// Ruído que não é defeito do app: extensão do navegador, script de outra
// origem sem detalhe, laço do ResizeObserver, cancelamento pelo usuário.
const RUIDO = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-(web-)?extension:|AbortError|The user aborted|NotAllowedError/i;
// Falha de chunk depois de deploy já é tratada (e reportada) pelo ErrorBoundary.
const FALHA_IMPORT_DINAMICO = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

export const enviarRelatorioErro = payload => {
  try {
    return fetch("/api/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ action: "client-error", ...payload }),
    }).catch(() => {});
  } catch { return Promise.resolve(); }
};

export function instalarCapturaGlobal(win = window, { enviar = enviarRelatorioErro, limitePorPagina = 10 } = {}) {
  const vistos = new Set();
  let enviados = 0;

  const reportar = (erro, origem) => {
    const mensagem = String(erro?.message ?? erro ?? "").trim();
    const pilha = String(erro?.stack || "");
    if (!mensagem || RUIDO.test(mensagem) || RUIDO.test(pilha) || FALHA_IMPORT_DINAMICO.test(mensagem)) return;
    // Mesmo erro repetido (ex.: em loop de render) conta uma vez por página.
    const chave = `${origem}|${mensagem.slice(0, 200)}`;
    if (vistos.has(chave) || enviados >= limitePorPagina) return;
    vistos.add(chave);
    enviados += 1;
    const pathname = win.location?.pathname || "";
    const diagnostico = buildLocalErrorDiagnostic(erro ?? mensagem, { pathname });
    console.error("Erro não tratado:", { reference: diagnostico.reference, origem, erro });
    enviar({
      reference: diagnostico.reference,
      message: diagnostico.message,
      pathname,
      errorStack: pilha,
      componentStack: `origem: ${origem}`,
    });
  };

  const aoErro = evento => reportar(evento?.error ?? evento?.message, "janela");
  const aoRejeitar = evento => reportar(evento?.reason, "promessa sem catch");
  win.addEventListener("error", aoErro);
  win.addEventListener("unhandledrejection", aoRejeitar);
  return () => {
    win.removeEventListener("error", aoErro);
    win.removeEventListener("unhandledrejection", aoRejeitar);
  };
}
