import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { allowedTabsForUser } from "../domains/administracao/abas-acesso.js";
import { setWorkContextObra, workContextObraId } from "../features/workflow/work-context.js";
import { normalizeWorkflowScope } from "../features/workflow/workflow-model.js";
import { activeErpModule, moduleForTab, visibleErpModules } from "./erp-navigation.js";
import { rememberSection, restoreSection } from "./section-session.js";
import { nextNavigationIntent, rememberWorkflowOrigin } from "./workflow-navigation-state.js";

/** @typedef {import("./workflow-navigation-state.js").NavigationIntent} NavigationIntent */
/** @typedef {import("./workflow-navigation-state.js").NavigationScope} NavigationScope */
/** @typedef {import("./workflow-navigation-state.js").WorkflowTrailEntry} WorkflowTrailEntry */

export function useWorkspaceNavigation(currentUser, colors) {
  const allowedTabs = allowedTabsForUser(currentUser);
  const [tab,setTab] = useState(()=>restoreSection(currentUser.id,allowedTabs));
  const [buscaAberta, setBuscaAberta] = useState(false);
  // Obra aberta no painel detalhado. Vazio = lista/quadro normal.
  const [obraAberta,  setObraAberta]  = useState("");
  const [workflowIntent,setWorkflowIntent]=useState(/** @type {NavigationIntent|null} */ (null));
  const [workflowScopes,setWorkflowScopes]=useState(/** @type {Record<string, NavigationScope>} */ ({}));
  const workflowViews=useRef(new Map());
  const workflowLastScope=useRef(/** @type {NavigationScope} */ ({}));
  const workflowLastTabs=useRef(new Map());
  const [workflowTrail,setWorkflowTrail]=useState(/** @type {WorkflowTrailEntry[]} */ ([]));
  const rememberWorkflowScope=useCallback((screen,scope)=>{
    workflowLastScope.current=scope;
    setWorkflowScopes(previous=>JSON.stringify(previous[screen])===JSON.stringify(scope)?previous:{...previous,[screen]:scope});
  },[]);

  useEffect(()=>{
    workflowViews.current.clear();
    workflowLastTabs.current.clear();
    workflowLastScope.current={};
    setWorkflowScopes({});
    setWorkflowTrail([]);
    setWorkflowIntent(null);
  },[currentUser?.id]);

  // A lista de obras e o painel detalhado ocupam alturas diferentes. Sem este
  // reset o navegador preserva o scroll da lista e a obra pode abrir já no
  // meio do conteúdo. O layout effect executa antes da pintura, sem salto.
  useLayoutEffect(() => {
    if (!obraAberta) return;
    window.scrollTo({top:0,left:0,behavior:"auto"});
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  },[obraAberta]);

  const allowedTabsKey=allowedTabs.join("|");
  useEffect(()=>{if(currentUser&&!allowedTabs.includes(tab))setTab(allowedTabs[0]||"home");},[currentUser?.id,allowedTabsKey,tab]);
  useEffect(()=>{rememberSection(currentUser?.id,tab,allowedTabs);},[currentUser?.id,allowedTabsKey,tab]);

  // Filtra grupos para mostrar apenas os que o usuário pode acessar
  const visibleGroups = visibleErpModules(allowedTabs,colors);
  const activeGroup = activeErpModule(visibleGroups,tab);

  // Grupos abertos na sidebar. Só o grupo da aba atual começa aberto - a barra
  // abre no que importa e deixa o resto recolhido, em vez de despejar 20 abas.
  const [gruposAbertos, setGruposAbertos] = useState(() =>
    activeGroup ? { [activeGroup.id]: true } : {});
  useEffect(()=>{
    if(activeGroup?.id)setGruposAbertos(previous=>previous[activeGroup.id]?previous:{...previous,[activeGroup.id]:true});
  },[activeGroup?.id]);
  const [sidebarCompacta, setSidebarCompacta] = useState(() => {
    try { return window.localStorage.getItem("arcd-sidebar-compacta") === "1"; }
    catch { return false; }
  });

  useEffect(() => {
    try { window.localStorage.setItem("arcd-sidebar-compacta", sidebarCompacta ? "1" : "0"); }
    catch { /* Navegação privada pode bloquear o armazenamento local. */ }
  }, [sidebarCompacta]);

  // Navegação unificada: leva a uma aba (e opcionalmente abre uma obra),
  // fechando a busca. Usado pela busca global e por qualquer atalho.
  const irPara = useCallback((tabId, obraId="", options={}) => {
    if(!options.preserveHistory)setWorkflowTrail(previous=>previous.length?[]:previous);
    const lastScope=workflowLastScope.current;
    setWorkflowIntent(previous=>nextNavigationIntent(previous,tabId,obraId,options,lastScope,currentUser));
    setObraAberta(obraId || "");
    setTab(tabId);
    const g = moduleForTab(tabId);
    if(g){
      workflowLastTabs.current.set(g.id,{tabId,obraId});
      setGruposAbertos(previous=>({...previous,[g.id]:true}));
    }
    setBuscaAberta(false);
  }, [currentUser?.id,currentUser?.obraId]);
  const navigateWorkflow=useCallback((tabId,scope,options={})=>{
    if(!allowedTabs.includes(tabId))return;
    const normalized=normalizeWorkflowScope(scope||workflowScopes[tabId]||{},currentUser);
    if(tabId!==tab)setWorkflowTrail(previous=>rememberWorkflowOrigin(previous,{tabId:tab,obraId:obraAberta,contextObraId:workContextObraId(),scope:normalizeWorkflowScope(workflowScopes[tab]||workflowLastScope.current,currentUser)}));
    irPara(tabId,"",{...options,linked:true,scope:normalized,preserveHistory:true});
  },[allowedTabsKey,currentUser?.obraId,workflowScopes,irPara,tab,obraAberta]);
  const returnWorkflow=()=>{
    const previous=workflowTrail.at(-1);if(!previous||!allowedTabs.includes(previous.tabId))return;
    setWorkflowTrail(history=>history.slice(0,-1));
    if(previous.contextObraId!==undefined)setWorkContextObra(previous.contextObraId);
    irPara(previous.tabId,previous.obraId,{scope:previous.scope,action:"resume",preserveHistory:true});
  };

  // Atalho de teclado: Ctrl/Cmd+K abre a busca; Esc fecha.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K")) { e.preventDefault(); if(document.querySelector('[role="dialog"]'))return; setBuscaAberta(v=>!v); }
      if (e.key==="Escape") setBuscaAberta(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleGrupo = useCallback((gid) => {
    setGruposAbertos(prev => ({ ...prev, [gid]: !prev[gid] }));
  }, []);

  const goGroup = (group) => {
    if (group.tabs.includes(tab)) return;
    const previous=workflowLastTabs.current.get(group.id);
    irPara(group.tabs.includes(previous?.tabId)?previous.tabId:group.tabs[0],group.tabs.includes(previous?.tabId)?previous.obraId:"");
  };

  return {
    tab, setTab, buscaAberta, setBuscaAberta, obraAberta, setObraAberta,
    workflowIntent, workflowScopes, workflowViews, workflowTrail, rememberWorkflowScope,
    allowedTabs, visibleGroups, activeGroup, gruposAbertos, setGruposAbertos, sidebarCompacta, setSidebarCompacta,
    irPara, navigateWorkflow, returnWorkflow, toggleGrupo, goGroup,
  };
}
