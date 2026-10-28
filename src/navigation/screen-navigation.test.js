import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SCREEN_PATHS, readScreenRoute, screenHref, useScreenNavigation, followScreenLink } from "./screen-navigation.js";
import { ROLE_TABS } from "../domains/administracao/abas-acesso.js";

let root, container, nav;
function Probe({user}) { nav=useScreenNavigation(user); return null; }
function mount(user) {
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  act(()=>root.render(createElement(Probe,{user})));
}
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();root=null;window.history.replaceState(null,"","/");});
const admin={id:"admin",role:"admin"};
it("every authorized screen has a unique reversible link",()=>{
  expect(new Set(Object.values(SCREEN_PATHS)).size).toBe(ROLE_TABS.admin.length);
  for(const tab of ROLE_TABS.admin) expect(readScreenRoute(new URL(screenHref(tab),"https://example.test")).tab).toBe(tab);
});
it("keeps direct link through login and remount (refresh)",()=>{
  window.history.replaceState(null,"","/app/ponto");mount(null);
  expect(nav.tab).toBe("ponto");
  act(()=>root.render(createElement(Probe,{user:admin})));
  expect(nav.tab).toBe("ponto");expect(location.pathname).toBe("/app/ponto");
  act(()=>root.unmount());container.remove();mount(admin);expect(nav.tab).toBe("ponto");
});
it("navigates without reload, restores popstate without another history entry",()=>{
  mount(admin);const push=vi.spyOn(history,"pushState");
  act(()=>nav.setTab("fin"));expect(location.pathname).toBe("/app/financeiro");expect(push).toHaveBeenCalledTimes(1);
  history.replaceState(null,"","/app/dashboard");
  act(()=>window.dispatchEvent(new PopStateEvent("popstate")));
  expect(nav.tab).toBe("home");expect(push).toHaveBeenCalledTimes(1);push.mockRestore();
});
it("preserves obra detail and removes it on another screen",()=>{
  const obra="obra / A&1";window.history.replaceState(null,"",screenHref("obras",obra));mount(admin);
  expect(nav.obraAberta).toBe(obra);
  act(()=>nav.setTab("ponto"));expect(location.search).toBe("");expect(nav.obraAberta).toBe("");
});
it("unauthorized and unknown links fall back safely",()=>{
  window.history.replaceState(null,"","/app/configuracoes");mount({id:"rh",role:"rh"});
  expect(nav.tab).toBe("home");expect(location.pathname).toBe("/app/dashboard");
  expect(readScreenRoute(new URL("https://example.test/app/unknown")).tab).toBe("home");
});
it("modified clicks keep native open-in-new-tab behavior",()=>{
  const navigate=vi.fn(),preventDefault=vi.fn();
  followScreenLink({button:0,ctrlKey:true,preventDefault},navigate);expect(navigate).not.toHaveBeenCalled();
  followScreenLink({button:0,preventDefault},navigate);expect(navigate).toHaveBeenCalledOnce();expect(preventDefault).toHaveBeenCalledOnce();
});
