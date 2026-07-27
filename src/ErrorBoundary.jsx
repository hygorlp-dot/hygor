import { Component } from "react";
import { buildLocalErrorDiagnostic } from "./observability/local-error-diagnostic";

// Sem isto, um único erro de render em qualquer componente derruba a árvore
// inteira e o usuário vê uma TELA BRANCA, sem mensagem e sem saída — no meio
// da obra, sem saber se o ponto foi salvo.
//
// Com o boundary, o erro fica contido: mostramos o que aconteceu e damos um
// caminho de volta.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, componentStack: "" };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    const diagnostic = buildLocalErrorDiagnostic(erro, { pathname: window.location.pathname });
    console.error("Erro não tratado:", { reference: diagnostic.reference, erro, componentStack: info?.componentStack });
    const componentStack = String(info?.componentStack || "");
    this.setState({ componentStack });
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        reference: diagnostic.reference,
        message: diagnostic.message,
        pathname: window.location.pathname,
        errorStack: String(erro?.stack || ""),
        componentStack,
      }),
    }).catch(() => {});
  }

  copiarDiagnostico = diagnostic => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(diagnostic.text).catch(() => {});
  };

  render() {
    const { erro, componentStack } = this.state;
    if (!erro) return this.props.children;
    const diagnostic = buildLocalErrorDiagnostic(erro, { pathname: window.location.pathname });

    return (
      <div style={{
        minHeight: "100vh", background: "#F5F3EE",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, fontFamily: "'Inter',-apple-system,sans-serif",
      }}>
        <div style={{
          maxWidth: 420, width: "100%",
          background: "#FFFFFF", border: "1px solid #C8C2B6",
          borderRadius: 14, padding: 26,
          boxShadow: "0 8px 32px rgba(18,18,18,.07)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: "#B71C1C12", color: "#B71C1C",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, marginBottom: 14,
          }}>!</div>

          <h1 style={{
            fontFamily: "'Inter Display','Inter',sans-serif",
            fontSize: 19, fontWeight: 800, color: "#121212", margin: "0 0 6px",
          }}>
            Algo quebrou nesta tela
          </h1>

          <p style={{ fontSize: 13, color: "#6B6459", lineHeight: 1.55, margin: "0 0 6px" }}>
            Ocorreu uma falha de exibição. Recarregar costuma resolver.
          </p>

          <p style={{ fontSize: 11, color: "#6B6459", lineHeight: 1.5, margin: "0 0 18px" }}>
            Se havia uma ação em andamento, confirme o resultado após recarregar. Se continuar, envie o diagnóstico abaixo.
          </p>

          <pre style={{
            background: "#F9F7F2", border: "1px solid #E0DAD0", borderRadius: 8,
            padding: "10px 12px", fontSize: 11, color: "#3D3530",
            overflowX: "auto", margin: "0 0 18px", whiteSpace: "pre-wrap",
          }}>
            {diagnostic.text}
            {componentStack ? `\nOrigem: ${componentStack.trim().split("\n")[0].trim()}` : ""}
          </pre>

          <button
            onClick={() => this.copiarDiagnostico(diagnostic)}
            style={{
              width: "100%", padding: 10, borderRadius: 8, marginBottom: 8,
              background: "#FFFFFF", color: "#3D3530", border: "1px solid #C8C2B6",
              fontFamily: "'Inter',-apple-system,sans-serif", fontWeight: 700,
              fontSize: 12, cursor: "pointer",
            }}
          >
            Copiar diagnóstico
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%", padding: 12, borderRadius: 8,
              background: "#D4AF37", color: "#fff", border: "1.5px solid #B8930F",
              fontFamily: "'Inter Display','Inter',sans-serif",
              fontWeight: 700, fontSize: 13,
              textTransform: "uppercase", letterSpacing: 0.6, cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
