import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_TABS, allowedTabsForUser } from "../domains/administracao/abas-acesso.js";

const names = {home:"dashboard",fin:"financeiro",conc:"conciliacao",cmp:"compras",orc:"orcamentos",plan:"planejamento",est:"estoque",resc:"rescisoes",terc:"terceirizados",cad:"cadastros",config:"configuracoes",relat:"relatorios",dre_emp:"dre-empresa",equip:"equipamentos",equip_fin:"locacoes"};
export const SCREEN_PATHS = Object.fromEntries(ROLE_TABS.admin.map(tab => [tab, `/app/${names[tab] || tab.replaceAll("_", "-")}`]));
const tabsByPath = Object.fromEntries(Object.entries(SCREEN_PATHS).map(([tab,path]) => [path,tab]));

export function readScreenRoute(location = window.location) {
  const tab = tabsByPath[location.pathname.replace(/\/$/, "")] || "home";
  return { tab, obra: tab === "obras" ? new URLSearchParams(location.search).get("obra") || "" : "" };
}

export function screenHref(tab, obra = "") {
  const path = SCREEN_PATHS[tab] || SCREEN_PATHS.home;
  return tab === "obras" && obra ? `${path}?${new URLSearchParams({obra})}` : path;
}

// URL is the navigation source of truth across reloads and browser history.
// Permissions still come from the authenticated user and the existing API.
export function useScreenNavigation(user) {
  const [route,setRoute] = useState(readScreenRoute);
  const replace = useRef(true);
  const allowed = allowedTabsForUser(user);
  const tab = user && !allowed.includes(route.tab) ? allowed[0] || "home" : route.tab;
  const obraAberta = tab === "obras" ? route.obra : "";
  const setTab = useCallback(next => setRoute(previous => {
    const tab = typeof next === "function" ? next(previous.tab) : next;
    return {...previous,tab,obra:tab === "obras" ? previous.obra : ""};
  }), []);
  const setObraAberta = useCallback(next => setRoute(previous => ({...previous,obra:typeof next === "function" ? next(previous.obra) : next})), []);

  useEffect(() => {
    const restore = () => { replace.current = true; setRoute(readScreenRoute()); };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!user) { replace.current = true; return; }
    const url = new URL(window.location.href);
    url.pathname = SCREEN_PATHS[tab] || SCREEN_PATHS.home;
    if (obraAberta) url.searchParams.set("obra", obraAberta);
    else url.searchParams.delete("obra");
    url.searchParams.delete("_arcd_refresh");
    const target = url.pathname + url.search + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (target !== current) {
      window.history[replace.current || tab !== route.tab ? "replaceState" : "pushState"](null, "", target);
    }
    replace.current = false;
  }, [user,tab,obraAberta,route.tab]);
  return {tab,setTab,obraAberta,setObraAberta};
}

export function followScreenLink(event, navigate) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate();
}
