import {describe,it,expect} from "vitest";
import {ROLE_TABS,allowedTabsForUser} from "../domains/administracao/abas-acesso.js";
import {ERP_MODULES,visibleErpModules,moduleForTab,activeErpModule} from "./erp-navigation.js";

describe("módulos ERP preservam os destinos e as permissões",()=>{
  it("dá um único módulo a todas as telas existentes, inclusive atalhos antigos",()=>{
    const destinations=ERP_MODULES.flatMap(group=>[...group.tabs,...(group.aliases||[])]);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(new Set(destinations)).toEqual(new Set(ROLE_TABS.admin));
    for(const tab of ROLE_TABS.admin)expect(moduleForTab(tab)).toBeDefined();
    expect(moduleForTab("dre_emp").id).toBe("painel");
    expect(moduleForTab("equip_fin").id).toBe("equip_grp");
    expect(moduleForTab("conc").id).toBe("fin_grp");
  });
  it.each(Object.keys(ROLE_TABS))("não amplia permissões do perfil %s",role=>{
    const allowed=allowedTabsForUser({id:"operator",role}),groups=visibleErpModules(allowed);
    for(const group of groups)for(const tab of group.tabs)expect(allowed).toContain(tab);
    for(const tab of allowed)expect(groups.some(group=>group.id===moduleForTab(tab).id)).toBe(true);
  });
  it("mantém a restrição personalizada, inclusive quando autoriza só um destino comercial antigo",()=>{
    const allowed=allowedTabsForUser({id:"legacy",role:"comercial",accessTabs:["com_clientes"]});
    const groups=visibleErpModules(allowed),commercial=groups.find(group=>group.id==="com_grp");
    expect(commercial.tabs).toEqual(["com_clientes"]);
    expect(activeErpModule(groups,"com_clientes")).toBe(commercial);
    expect(groups.some(group=>group.id==="fin_grp")).toBe(false);
    expect(groups.some(group=>group.id==="equip_grp")).toBe(false);
  });
  it("um usuário sem DRE pode abrir o painel sem ganhar acesso a resultados financeiros",()=>{
    const groups=visibleErpModules(allowedTabsForUser({role:"compras",id:"buyer"}));
    expect(groups.find(group=>group.id==="painel").tabs).not.toContain("dre_emp");
    expect(groups.flatMap(group=>group.tabs)).not.toContain("equip_fin");
  });
});
