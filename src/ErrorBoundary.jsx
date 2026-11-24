import {Button} from './components/ui/button.jsx';
import { Component } from "react";
import { buildLocalErrorDiagnostic } from "./observability/local-error-diagnostic";
import { enviarRelatorioErro } from "./observability/global-error-capture.js";

const DYNAMIC_IMPORT_FAILURE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS for/i;

export const isDynamicImportFailure = error => DYNAMIC_IMPORT_FAILURE.test(String(error?.message || error || ""));

export const errorRecoveryCopy=(error,online=true)=>!online
  ?{title:'Sem conexão para abrir esta tela',message:'Restabeleça a conexão antes de recarregar. A reconexão habilita o botão e não confirma operações por conta própria.'}
  :isDynamicImportFailure(error)
    ?{title:'Não foi possível carregar esta tela',message:'A conexão ou uma atualização do aplicativo pode ter interrompido o carregamento. Recarregue para buscar a versão disponível.'}
    :{title:'Algo quebrou nesta tela',message:'Ocorreu uma falha de exibição. Recarregue e, se continuar, envie o diagnóstico abaixo.'};

export const dynamicImportRecoveryKey = error => {
  const message=String(error?.message || error || "");
  const asset=message.match(/https?:\/\/[^\s]+/i)?.[0] || message;
  return `arcd:chunk-recovery:${asset.slice(0,500)}`;
};

export const recoverDynamicImport = (error, win = window) => {
  if (!isDynamicImportFailure(error)) return false;
  if (win.navigator?.onLine === false) return false;
  try {
    // O bloqueio pertence ao build carregado, não ao arquivo nem à sessão
    // inteira: duas falhas do mesmo build não criam recargas em sequência,
    // e uma versão nova não herda o bloqueio da anterior.
    const entry = win.document?.querySelector('script[type="module"][src]')?.src || 'unknown-entry';
    const recoveryKey = `arcd:chunk-recovery-build:${entry}`;
    if (win.sessionStorage.getItem(recoveryKey)) return false;
    // Sem armazenamento confiável, a saída manual evita um ciclo de recargas.
    win.sessionStorage.setItem(recoveryKey, "1");
    const freshUrl = new URL(win.location.href);
    freshUrl.searchParams.set("_arcd_refresh", Date.now().toString());
    win.location.replace(freshUrl.toString());
    return true;
  } catch {
    return false;
  }
};

// Sem isto, um único erro de render em qualquer componente derruba a árvore
// inteira e o usuário vê uma TELA BRANCA, sem mensagem e sem saída — no meio
// da obra, sem saber se o ponto foi salvo.
//
// Com o boundary, o erro fica contido: mostramos o que aconteceu e damos um
// caminho de volta.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, componentStack: "", online:globalThis.navigator?.onLine!==false };
  }

  connectionChanged = () => this.setState({online:window.navigator.onLine!==false});
  componentDidMount(){window.addEventListener('online',this.connectionChanged);window.addEventListener('offline',this.connectionChanged);}
  componentWillUnmount(){window.removeEventListener('online',this.connectionChanged);window.removeEventListener('offline',this.connectionChanged);}

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    const diagnostic = buildLocalErrorDiagnostic(erro, { pathname: window.location.pathname });
    console.error("Erro não tratado:", { reference: diagnostic.reference, erro, componentStack: info?.componentStack });
    const componentStack = String(info?.componentStack || "");
    this.setState({ componentStack });
    enviarRelatorioErro({
      reference: diagnostic.reference,
      message: diagnostic.message,
      pathname: window.location.pathname,
      errorStack: String(erro?.stack || ""),
      componentStack,
    });

    // Depois de um deploy, uma aba antiga pode pedir um chunk cujo hash já
    // saiu do alias de produção. Reabre uma única vez com URL nova para obter
    // o index e o manifesto atuais, sem criar um ciclo infinito de recarga.
    recoverDynamicImport(erro);
  }

  copiarDiagnostico = diagnostic => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(diagnostic.text).catch(() => {});
  };

  render() {
    const { erro, componentStack, online } = this.state;
    if (!erro) return this.props.children;
    const copy=errorRecoveryCopy(erro,online);
    const diagnostic = buildLocalErrorDiagnostic(erro, { pathname: window.location.pathname });

    return (
      <div style={{
        minHeight: "100vh", background: "var(--arcd-surface-subtle)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--arcd-space-5)", fontFamily: "var(--arcd-font-sans)",
      }}>
        <div style={{
          maxWidth: 420, width: "100%",
          background: "var(--arcd-surface-elevated)", border: "var(--arcd-border-width) solid var(--arcd-border-default)",
          borderRadius: "var(--arcd-box-radius)", padding: "var(--arcd-space-6)",
          boxShadow: "var(--arcd-shadow-hairline)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: "var(--arcd-box-radius)",
            background: "color-mix(in srgb, var(--arcd-danger-surface) 7%, transparent)", color: "var(--arcd-danger-text)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "var(--arcd-type-section-title)", marginBottom: "var(--arcd-space-3)",
          }}>!</div>

          <h1 style={{
            fontFamily: "var(--arcd-font-sans)",
            fontSize: "var(--arcd-type-section-title)", fontWeight: 600, color: "var(--arcd-text-primary)", margin: "0 0 var(--arcd-space-1)",
          }}>
            {copy.title}
          </h1>

          <p style={{ fontSize: "var(--arcd-type-body)", color: "var(--arcd-text-secondary)", lineHeight: 1.55, margin: "0 0 var(--arcd-space-1)" }}>
            {copy.message}
          </p>

          <p style={{ fontSize: "var(--arcd-type-caption)", color: "var(--arcd-text-secondary)", lineHeight: 1.5, margin: "0 0 var(--arcd-space-4)" }}>
            Rascunhos já salvos neste navegador permanecem disponíveis. Após recarregar, confira o resultado da ação antes de repeti-la. Se o erro continuar, copie o diagnóstico para pedir ajuda.
          </p>

          <pre style={{
            background: "var(--arcd-surface-subtle)", border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)",
            padding: "var(--arcd-space-2) var(--arcd-space-3)", fontSize: "var(--arcd-type-caption)", color: "var(--arcd-text-primary)",
            overflowX: "auto", margin: "0 0 var(--arcd-space-4)", whiteSpace: "pre-wrap",
          }}>
            {diagnostic.text}
            {componentStack ? `\nOrigem: ${componentStack.trim().split("\n")[0].trim()}` : ""}
          </pre>

          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={()=>this.copiarDiagnostico(diagnostic)}>Copiar diagnóstico</Button>
            <Button disabled={!online} onClick={()=>window.location.reload()}>Recarregar</Button>
          </div>
        </div>
      </div>
    );
  }
}
