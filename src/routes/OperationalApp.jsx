import { lazy, Suspense, useEffect } from "react";

// Sistema operacional existente - só é baixado quando a rota /sistema é
// acessada. Nada aqui é compartilhado com a landing pública (bundle,
// dados ou lógica), preservando o isolamento entre as duas áreas.
const LegacyApp = lazy(() =>
  import(/* webpackChunkName: "operational-app" */ "../LegacyApp")
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

export default function OperationalApp() {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "ArcD Ponto PRO";
    return () => { document.title = tituloAnterior; };
  }, []);

  return (
    <Suspense fallback={<RouteLoading/>}>
      <LegacyApp/>
    </Suspense>
  );
}
