import { Suspense, useEffect, useMemo, useState } from "react";
import {listarPerfis,restaurarSessaoEmail} from "../api.js";
import LoginScreen from "../components/login/LoginScreen.jsx";
import {Spinner} from '../design-system/primitives/Spinner.jsx';
import {HelpProvider} from '../features/help/HelpContext.jsx';
import {activeCompany} from "../lib/company-scope.js";
import { lazyWithCssRetry as lazy } from "../lib/lazy-with-css-retry.js";

// A área de trabalho só é importada depois que a API entrega uma sessão.
const LegacyApp = lazy(() => import("./legacy/LegacyApp.jsx"));

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
  const [companyId,setCompanyId] = useState(activeCompany);
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = "MARCELL";
    return () => { document.title = tituloAnterior; };
  }, []);

  return <CompanyApp key={companyId} onCompanyChanged={setCompanyId}/>;
}

function CompanyApp({onCompanyChanged}) {
  const portalRequest = useMemo(()=>{
    const q=new URLSearchParams(window.location.search);
    return {obraId:q.get("portal")||"",token:q.get("token")||""};
  },[]);
  const [loading, setLoading] = useState(true);
  const [erroInicial, setErroInicial] = useState("");
  const [firstSetup, setFirstSetup] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (portalRequest.obraId && portalRequest.token) return;
    let vivo = true;
    (async () => {
      try {
        const restaurada = await restaurarSessaoEmail();
        if (!vivo) return;
        if (restaurada.ok) {
          setSession({usuario:restaurada.usuario,data:restaurada.data});
          return;
        }
        const perfis = await listarPerfis();
        if (!vivo) return;
        if (perfis.erro) setErroInicial(perfis.erro);
        if (perfis.precisaSetup) setFirstSetup(true);
      } catch (err) {
        console.error(err);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [portalRequest.obraId, portalRequest.token]);

  if (portalRequest.obraId && portalRequest.token) {
    return <Suspense fallback={<RouteLoading/>}><LegacyApp portal={portalRequest}/></Suspense>;
  }
  if (loading) return <RouteLoading/>;
  if (!session) return <LoginScreen
    onLogin={(usuario,data)=>setSession({usuario,data})}
    erroInicial={erroInicial}
    precisaSetup={firstSetup}
  />;
  return <Suspense fallback={<RouteLoading/>}>
    <HelpProvider>
      <LegacyApp session={session} onCompanyChanged={onCompanyChanged} onSessionEnded={()=>setSession(null)}/>
    </HelpProvider>
  </Suspense>;
}
