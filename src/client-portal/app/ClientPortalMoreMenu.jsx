import {Dialog} from "../../design-system/primitives/Dialog.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import {PORTAL_PAGES,canOpenPortalPage} from "../navigation.js";
export function ClientPortalMoreMenu({open,onOpenChange,onNavigate,permissions={}}) {
  return <Dialog open={open} onOpenChange={onOpenChange} title="Mais opções do portal"><nav className="arcd-client-stack" aria-label="Mais opções">{PORTAL_PAGES.slice(4).filter(item=>canOpenPortalPage(item,permissions)).map(item=><Button key={item.id} variant="secondary" onClick={()=>{onNavigate(item.id);onOpenChange(false);}}>{item.label}</Button>)}</nav></Dialog>;
}
