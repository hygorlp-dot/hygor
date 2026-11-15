import {useCallback, useEffect, useRef, useState} from "react";
import {ClientPortalLogin} from "../auth/ClientPortalLogin.jsx";
import {readClientPortalDashboard, readClientPortalSession, logoutClientPortal} from "../services/clientPortalApi.js";
import {ClientPortalLoading} from "./ClientPortalLoading.jsx";
import {ClientPortalRouter} from "./ClientPortalRouter.jsx";
import {usePortalLocation} from "./usePortalLocation.js";
import {navigatePortal, portalProjectPath} from "../routes.js";
import {HelpProvider} from "../../features/help/HelpContext.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import {ErrorState, EmptyState} from "../../design-system/patterns/FeedbackState.jsx";

export default function ClientPortalApp(props) {
  return <div className="arcd-themed-canvas"><HelpProvider><PortalSession {...props}/></HelpProvider></div>;
}

function PortalSession({session, portalData}) {
  const route=usePortalLocation();
  const [remoteSession,setRemoteSession]=useState(session || null);
  const [checking,setChecking]=useState(!session);
  const [error,setError]=useState("");
  const [result,setResult]=useState(null);
  const [revision,setRevision]=useState(0);
  const [logoutBusy,setLogoutBusy]=useState(false);
  const requestVersion=useRef(0);
  const selectedProject=route.projectId || remoteSession?.projects?.[0]?.projectId || "";
  const membership=remoteSession?.projects?.find(item=>item.projectId===selectedProject);
  const expire=useCallback(()=>{
    requestVersion.current++;
    setRemoteSession(null);setResult(null);setChecking(false);
    setError("Sua sessão terminou. Entre novamente para continuar.");
  },[]);
  const refresh=useCallback(async()=>{
    const version=++requestVersion.current;
    setChecking(true);setError("");
    try {
      const current=await readClientPortalSession();
      if(version!==requestVersion.current)return;
      setRemoteSession(current);setRevision(value=>value+1);
    } catch(failure) {
      if(version!==requestVersion.current)return;
      setRemoteSession(null);setResult(null);
      setError(failure.status===401?"":failure.message);
    } finally {if(version===requestVersion.current)setChecking(false);}
  },[]);
  useEffect(()=>{
    if(!session)void refresh();
    return ()=>{requestVersion.current++;};
  },[session,refresh]);
  useEffect(()=>{
    if(session||!remoteSession)return;
    const check=()=>{if(document.visibilityState==="visible")void refresh();};
    window.addEventListener("focus",check);
    const timer=setInterval(check,60000);
    return ()=>{window.removeEventListener("focus",check);clearInterval(timer);};
  },[session,remoteSession,refresh]);
  useEffect(()=>{
    if(remoteSession && !route.projectId && selectedProject && route.page==="home")navigatePortal(portalProjectPath(selectedProject),{replace:true});
  },[remoteSession,route.projectId,route.page,selectedProject]);
  useEffect(()=>{
    if(portalData||!membership)return;
    let active=true;
    setError("");
    readClientPortalDashboard(selectedProject).then(response=>{
      if(active)setResult({projectId:selectedProject,portal:response.portal});
    }).catch(failure=>{
      if(!active)return;
      if(failure.status===401)expire();
      else setError(failure.message);
    });
    return ()=>{active=false;};
  },[selectedProject,membership,portalData,revision,expire]);
  const logout=async()=>{
    if(logoutBusy)return;
    setLogoutBusy(true);setError("");
    try {
      await logoutClientPortal();
      requestVersion.current++;
      setRemoteSession(null);setResult(null);
      navigatePortal("/cliente",{replace:true});
    } catch(failure) {setError(failure.message);}
    finally {setLogoutBusy(false);}
  };
  if(checking&&!remoteSession)return <ClientPortalLoading/>;
  if(!remoteSession)return <ClientPortalLogin onAuthenticated={refresh} initialError={error}/>;
  const common={projects:remoteSession.projects||[],selectedProject,onSelectProject:id=>{setResult(null);setError("");navigatePortal(portalProjectPath(id));},onLogout:logout,logoutBusy,onRefresh:()=>setRevision(value=>value+1)};
  if(!portalData && (!selectedProject||!membership||route.page==="unknown"))return <main className="arcd-client-loading"><div className="arcd-material-panel"><EmptyState title={!selectedProject?"Nenhuma obra disponível":"Obra indisponível"} description="Peça à equipe responsável para conferir seu vínculo e a publicação da obra." action={<div className="arcd-client-actions">{remoteSession.projects?.map(project=><Button key={project.projectId} onClick={()=>common.onSelectProject(project.projectId)}>Abrir {project.name||project.projectId}</Button>)}<Button variant="secondary" onClick={logout} disabled={logoutBusy}>Sair do portal</Button></div>}/></div></main>;
  const data=portalData || (result?.projectId===selectedProject ? result.portal : null);
  if(error&&!data)return <main className="arcd-client-loading"><div className="arcd-material-panel"><ErrorState title="Não foi possível abrir sua obra" description={error} action={<div className="arcd-client-actions"><Button onClick={()=>setRevision(value=>value+1)}>Tentar novamente</Button><Button variant="secondary" onClick={logout} disabled={logoutBusy}>Sair do portal</Button></div>}/></div></main>;
  if(!data)return <ClientPortalLoading/>;
  return <ClientPortalRouter key={selectedProject} portalData={data} permissions={membership?.permissions || session?.permissions || {}} {...common} error={error}/>;
}
