import { Suspense, useEffect, useState } from "react";
import {Spinner} from '../design-system/primitives/Spinner.jsx';
import {HelpProvider} from '../features/help/HelpContext.jsx';
import { lazyWithCssRetry as lazy } from "../lib/lazy-with-css-retry.js";

// O sistema operacional continua em chunk próprio para exibir um estado de
// carregamento imediato enquanto o aplicativo principal é baixado.
const LegacyApp = lazy(() =>
  import(/* webpackChunkName: "operational-app" */ "./legacy/LegacyApp.jsx")
);

function RouteLoading() {
  const [visible,setVisible]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setVisible(true),200);return()=>clearTimeout(timer);},[]);
  if(!visible)return null;
  return <main className="route-loading" aria-label="Carregamento do MARCELL">
    <img src="/brand/marcell/full-azul.svg" alt="MARCELL"/>
    <Spinner label="Carregando MARCELL"/>
    <p>Aguarde o carregamento do sistema…</p>
  </main>;
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
