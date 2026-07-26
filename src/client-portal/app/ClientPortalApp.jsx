import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientPortalLogin } from "../auth/ClientPortalLogin.jsx";
import { readClientPortalDashboard, readClientPortalSession } from "../services/clientPortalApi.js";
import { ClientPortalLoading } from "./ClientPortalLoading.jsx";
import { ClientPortalRouter } from "./ClientPortalRouter.jsx";

const projectFromPath=()=>decodeURIComponent((window.location.pathname.match(/^\/cliente\/obra\/([^/]+)/)?.[1] || ""));

/** O portal carrega sessão e projeção próprias; nunca usa o blob operacional. */
export default function ClientPortalApp({ session, portalData }) {
  const [remoteSession,setRemoteSession]=useState(session || null);
  const [remotePortal,setRemotePortal]=useState(portalData || null);
  const [state,setState]=useState({checking:!session,error:""});
  const selectedProject=useMemo(()=>projectFromPath() || remoteSession?.projects?.[0]?.projectId || "",[remoteSession]);
  const refresh=useCallback(async()=>{
    setState({checking:true,error:""});
    try { const result=await readClientPortalSession(); setRemoteSession(result); setState({checking:false,error:""}); }
    catch (error) { setRemoteSession(null); setRemotePortal(null); setState({checking:false,error:error.status===401?"":error.message}); }
  },[]);
  useEffect(()=>{ if(!session) refresh(); },[session,refresh]);
  useEffect(()=>{ if(portalData || !remoteSession || !selectedProject) return; let active=true; setState(current=>({...current,checking:true,error:""})); readClientPortalDashboard(selectedProject).then(result=>{if(active){setRemotePortal(result.portal);setState({checking:false,error:""});}}).catch(error=>{if(active)setState({checking:false,error:error.message});}); return()=>{active=false;}; },[portalData,remoteSession,selectedProject]);
  if (!remoteSession) return <ClientPortalLogin onAuthenticated={refresh} initialError={state.error}/>;
  if (state.checking && !remotePortal) return <ClientPortalLoading />;
  if (state.error) return <main className="arcd-client-loading"><div><h1>Não foi possível abrir sua obra</h1><p>{state.error}</p><button type="button" onClick={refresh}>Tentar novamente</button></div></main>;
  if (!remotePortal) return <ClientPortalLoading />;
  const membership=remoteSession.projects?.find(item=>item.projectId===selectedProject) || remoteSession.projects?.[0] || {};
  return <ClientPortalRouter portalData={remotePortal} permissions={membership.permissions || session?.permissions || {}} />;
}
