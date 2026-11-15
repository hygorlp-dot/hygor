import {Alert,AlertDescription} from "../../components/ui/alert.jsx";
import {ClientPortalHeader} from "./ClientPortalHeader.jsx";
import {WorkspaceNavigation} from "../../design-system/patterns/WorkspaceNavigation.jsx";
import {PORTAL_PAGES,canOpenPortalPage} from "../navigation.js";
import "../styles/portal.css";
export function ClientPortalShell({project,active,permissions,children,onNavigate,error,...sessionProps}) {
  const visible=PORTAL_PAGES.filter(page=>page.id!=="transparency"&&canOpenPortalPage(page,permissions));
  const groups=[{label:"Evolução da obra",items:visible.filter(page=>["home","photos","progress"].includes(page.id))},{label:"Custos e compras",items:visible.filter(page=>["costs","cash","budget","purchases","administration"].includes(page.id))}];
  return <div className="arcd-client-shell"><div className="arcd-client-workspace arcd-material-panel"><ClientPortalHeader project={project} permissions={permissions} {...sessionProps}/><div className="arcd-client-navigation"><WorkspaceNavigation label="Abas do portal do cliente" active={active} onChange={onNavigate} groups={groups} tools={visible.filter(page=>['decisions','financial','documents','account'].includes(page.id))} toolsLabel="Documentos, contrato e conta"/></div><main className="arcd-client-content">{error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{children}</main></div></div>;
}
