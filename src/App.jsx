import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";

// Boundary inicial de rota. Enquanto os domínios são extraídos gradualmente,
// o shell permanece pequeno e a aplicação operacional é baixada em paralelo.
const OperationalApp = lazy(() =>
  import(/* webpackChunkName: "operational-app" */ "./LegacyApp")
);

function RouteLoading() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <div className="route-loading-mark" aria-hidden="true">ARCD</div>
      <div>
        <strong>Preparando o ambiente operacional</strong>
        <span>Carregando somente os módulos necessários…</span>
      </div>
    </main>
  );
}

// "/entrar" na URL leva direto ao app operacional (link direto/atalho
// compartilhável); a landing pública fica em "/". A troca é só de shell -
// o app operacional continua com seu próprio login/PIN interno.
const querEntrar = () => window.location.hash === "#entrar";

export default function App() {
  const [mostrarApp, setMostrarApp] = useState(querEntrar);

  useEffect(() => {
    const aoMudarHash = () => setMostrarApp(querEntrar());
    window.addEventListener("hashchange", aoMudarHash);
    return () => window.removeEventListener("hashchange", aoMudarHash);
  }, []);

  const entrar = () => {
    window.location.hash = "entrar";
    setMostrarApp(true);
  };

  if (!mostrarApp) return <LandingPage onEntrar={entrar}/>;

  return (
    <Suspense fallback={<RouteLoading/>}>
      <OperationalApp/>
    </Suspense>
  );
}
