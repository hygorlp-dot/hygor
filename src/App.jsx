import { lazy, Suspense } from "react";

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

export default function App() {
  return (
    <Suspense fallback={<RouteLoading/>}>
      <OperationalApp/>
    </Suspense>
  );
}
