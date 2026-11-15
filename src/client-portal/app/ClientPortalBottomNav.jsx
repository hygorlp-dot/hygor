import {Home,ChartNoAxesCombined,ListChecks,Wallet,MoreHorizontal} from "lucide-react";
import {Button} from "../../design-system/primitives/Button.jsx";
import {PORTAL_PAGES,canOpenPortalPage} from "../navigation.js";
const icons={home:Home,progress:ChartNoAxesCombined,decisions:ListChecks,financial:Wallet,more:MoreHorizontal};
export function ClientPortalBottomNav({active="home",onNavigate,permissions={}}) {
  const items=[...PORTAL_PAGES.filter(page=>["home","progress","decisions","financial"].includes(page.id)),{id:"more",label:"Mais"}];
  return <nav className="arcd-client-bottom-nav" aria-label="Navegação do portal">{items.map(item=>{
    const selected=item.id==="more"?!["home","progress","decisions","financial"].includes(active):active===item.id;
    const Icon=icons[item.id];
    return <Button key={item.id} variant={selected?"secondary":"ghost"} disabled={item.id!=="more"&&!canOpenPortalPage(item,permissions)} aria-current={selected?"page":undefined} onClick={()=>onNavigate?.(item.id)}><Icon aria-hidden="true"/><span>{item.label}</span></Button>;
  })}</nav>;
}
