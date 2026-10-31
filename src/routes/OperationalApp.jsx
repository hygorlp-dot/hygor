import { Suspense, useEffect } from "react";
import {HelpProvider} from '../features/help/HelpContext.jsx';
import { lazyWithCssRetry as lazy } from "../lib/lazy-with-css-retry.js";

// O sistema operacional continua em chunk próprio para exibir um estado de
// carregamento imediato enquanto o aplicativo principal é baixado.
const LegacyApp = lazy(() =>
  import(/* webpackChunkName: "operational-app" */ "../LegacyApp")
);

function RouteLoading() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <div className="route-loading-mark" aria-hidden="true">MARCELL</div>
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
    document.title = "MARCELL";
    return () => { document.title = tituloAnterior; };
  }, []);

  return (
    <Suspense fallback={<RouteLoading/>}>
      <HelpProvider><LegacyApp/></HelpProvider>
    </Suspense>
  );
}
